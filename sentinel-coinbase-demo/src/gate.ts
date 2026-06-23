/**
 * Sentinel integration — the independent action-gate.
 *
 * Wraps the published `@montanalabs/sentinel` client for the verdict (`guard`) and the sidecar's
 * HTTP API for the human-in-the-loop escalation flow and the tamper-evident audit chain. The verdict
 * is never decided here; it is rendered by the sidecar's policy engine and merely normalized into a
 * {@link GateDecision}.
 */
import { SentinelClient, Action } from '@montanalabs/sentinel';
import type { AppConfig } from './config';
import { AuditResult, GateDecision, TransferRequest, Verdict } from './domain';

const ACTOR = { id: 'agent-treasury-001', roles: ['ops'] };

/** The agent-side gate: submit proposed transfers, route escalations, verify the audit chain. */
export class SentinelGate {
  private readonly client: SentinelClient;

  /** @param cfg - runtime configuration (sidecar URL + client timeout are read from here). */
  constructor(private readonly cfg: AppConfig) {
    // fail closed: an unreachable/garbled sidecar yields BLOCK, never a silent allow. The timeout is
    // generous (>= the gate's slow-tier budget) so a real-model second opinion isn't cut short.
    this.client = new SentinelClient({ endpoint: cfg.sentinelUrl, failMode: 'closed', timeoutMs: cfg.sentinelTimeoutMs });
  }

  /**
   * Probe the sidecar's health endpoint.
   *
   * @returns `true` if the sidecar responded OK, `false` otherwise (including network errors).
   */
  async health(): Promise<boolean> {
    try {
      return (await fetch(`${this.cfg.sentinelUrl}/healthz`)).ok;
    } catch {
      return false;
    }
  }

  /**
   * Gate a proposed transfer. The action commits both the policy label ({@link Counterparty.id})
   * and the real on-chain recipient (in `meta`), so the decision and its settlement reference the
   * same counterparty.
   *
   * @param request - the proposed transfer (amount + counterparty + reason).
   * @param runId - correlates every action within one agent run.
   * @returns the gate's decision; on an unreachable sidecar this is a fail-closed `BLOCK`.
   */
  async guard(request: TransferRequest, runId: string): Promise<GateDecision> {
    const action = Action.payment(
      { amount: request.amountUsdc, from: this.cfg.fromAccount, to: request.counterparty.id, currency: 'USDC' },
      { meta: { asset: 'USDC', network: this.cfg.wallet.network, recipient: request.counterparty.address, rail: 'coinbase-cdp' } },
    );
    const d = await this.client.guard(action, { runId, actor: ACTOR }, this.cfg.policy);
    return { verdict: d.verdict as Verdict, reason: d.reason, recordId: d.recordId, escalationId: d.escalationId };
  }

  /**
   * Approve (or deny) a pending escalation through the sidecar's dual-control queue. The resolution
   * is appended to the provenance chain as a signed `human.review` record.
   *
   * @param escalationId - the escalation handle from a `ESCALATE` decision.
   * @param decision - `'approve'` to authorize the held action, `'deny'` to reject it.
   * @param approver - identity recorded as the resolver (e.g. an email).
   */
  async resolveEscalation(escalationId: string, decision: 'approve' | 'deny', approver: string): Promise<void> {
    await fetch(`${this.cfg.sentinelUrl}/v1/escalations/${escalationId}/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision, approver }),
    });
  }

  /**
   * Verify the full signed, hash-chained provenance log and count its records.
   *
   * @returns whether the chain is intact (`ok`), the record count, and — when broken — the failing
   *   sequence (`brokenAt`) and `reason`.
   */
  async verifyAudit(): Promise<AuditResult> {
    const [verify, records] = await Promise.all([
      fetch(`${this.cfg.sentinelUrl}/v1/verify`).then((r) => r.json() as Promise<Omit<AuditResult, 'records'>>),
      fetch(`${this.cfg.sentinelUrl}/v1/records`).then((r) => (r.ok ? (r.json() as Promise<unknown[]>) : [])),
    ]);
    return { ...verify, records: records.length };
  }
}
