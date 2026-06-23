/**
 * Orchestrates one transfer: propose → guard → (settle | block | escalate → approve → settle).
 *
 * Coordination only. The decision belongs to {@link SentinelGate}, settlement to {@link Wallet}, and
 * all presentation to a {@link FlowReporter}. The wallet is never touched unless the gate allows
 * (or a human approves an escalation) — that is the whole guarantee this flow encodes.
 */
import type { SentinelGate } from './gate';
import type { Wallet } from './wallet';
import type { FlowReporter } from './view';
import { FlowOutcome, FlowResult, TransferRequest, Verdict } from './domain';

/** Who approves escalations in the demo; in production a real human resolves the dual-control item. */
const DEMO_APPROVER = 'treasurer@montanalabs.ai';

/** Runs proposed transfers through the gate and settles only what is authorized. */
export class PaymentFlow {
  /**
   * @param gate - the Sentinel gate that renders the verdict.
   * @param wallet - the backend that settles allowed transfers.
   * @param reporter - receives per-step events to render.
   */
  constructor(
    private readonly gate: SentinelGate,
    private readonly wallet: Wallet,
    private readonly reporter: FlowReporter,
  ) {}

  /**
   * Gate a proposed transfer and act on the verdict: settle on `ALLOW`, refuse on `BLOCK`, and on
   * `ESCALATE` route to human approval before settling. The wallet is never touched unless the gate
   * authorizes the action.
   *
   * @param request - the proposed transfer.
   * @param runId - correlates the transfer within one agent run.
   * @returns the decision, the terminal {@link FlowOutcome}, and the settlement receipt when settled.
   * @throws if the wallet fails to settle an authorized transfer (propagated from the backend).
   */
  async process(request: TransferRequest, runId: string): Promise<FlowResult> {
    const decision = await this.gate.guard(request, runId);
    this.reporter.decided(decision);
    const { address } = request.counterparty;

    switch (decision.verdict) {
      case Verdict.Allow: {
        const receipt = await this.wallet.transfer(address, request.amountUsdc);
        this.reporter.settled(receipt, request.amountUsdc);
        return { request, decision, outcome: FlowOutcome.Settled, receipt };
      }

      case Verdict.Escalate: {
        this.reporter.escalated(decision.escalationId ?? '(none)');
        if (!decision.escalationId) {
          return { request, decision, outcome: FlowOutcome.PendingApproval };
        }
        await this.gate.resolveEscalation(decision.escalationId, 'approve', DEMO_APPROVER);
        this.reporter.approved(DEMO_APPROVER);
        const receipt = await this.wallet.transfer(address, request.amountUsdc);
        this.reporter.settled(receipt, request.amountUsdc);
        return { request, decision, outcome: FlowOutcome.ApprovedAndSettled, receipt };
      }

      case Verdict.Block:
      default: {
        this.reporter.blocked();
        return { request, decision, outcome: FlowOutcome.Blocked };
      }
    }
  }
}

/**
 * Count verdicts across processed transfers, for the closing summary.
 *
 * @param results - the flow results to tally.
 * @returns the number of `ALLOW`, `BLOCK`, and `ESCALATE` decisions.
 */
export function tally(results: readonly FlowResult[]): { allow: number; block: number; escalate: number } {
  const count = (v: Verdict): number => results.filter((r) => r.decision.verdict === v).length;
  return { allow: count(Verdict.Allow), block: count(Verdict.Block), escalate: count(Verdict.Escalate) };
}
