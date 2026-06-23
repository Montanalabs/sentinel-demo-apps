/**
 * Domain model for the Sentinel × Coinbase demo.
 *
 * Pure types and enums shared by every layer — no logic, no I/O. The gate, the wallet, the flow,
 * and the presentation layer all speak in terms of these.
 */

/** The gate's decision on a proposed action — Sentinel's verdict vocabulary. */
export enum Verdict {
  /** Authorized: the wallet may execute the action. */
  Allow = 'ALLOW',
  /** Forbidden: the action must not run. */
  Block = 'BLOCK',
  /** Held for human dual-control before it may run. */
  Escalate = 'ESCALATE',
}

/** Which backend settles an allowed transfer. */
export enum WalletMode {
  /** No keys; deterministic fake settlement. The Sentinel gating is still real. */
  Simulated = 'simulated',
  /** A real Coinbase CDP Server Wallet on a testnet. */
  Live = 'live',
}

/** Which LLM drives the autonomous-agent entry point. */
export enum LlmProvider {
  Anthropic = 'anthropic',
  OpenAI = 'openai',
}

/** Terminal outcome of running one transfer through {@link Verdict gate} then settlement. */
export enum FlowOutcome {
  /** Allowed and settled on-chain. */
  Settled = 'settled',
  /** Escalated, approved by a human, then settled. */
  ApprovedAndSettled = 'approved_and_settled',
  /** Escalated and still awaiting human approval (not settled). */
  PendingApproval = 'pending_approval',
  /** Blocked by policy; never settled. */
  Blocked = 'blocked',
}

/**
 * A known counterparty — the single source of truth that links the **policy label** the gate
 * evaluates to the **on-chain address** funds are actually sent to. Because both the gate and the
 * wallet read the same record, a decision and its settlement always refer to the same entity.
 */
export interface Counterparty {
  /** Stable id the policy keys on (e.g. `vendor_42`). */
  readonly id: string;
  /** Human-readable name, for display. */
  readonly label: string;
  /** The address that receives funds on-chain. */
  readonly address: `0x${string}`;
  /** Optional risk annotation, for the demo narrative. */
  readonly note?: string;
}

/** A payment the agent proposes — the unit the flow gates and settles. */
export interface TransferRequest {
  /** Amount in USDC the policy evaluates. */
  readonly amountUsdc: number;
  /** Who is paid. */
  readonly counterparty: Counterparty;
  /** Why — surfaced in logs and provenance. */
  readonly reason: string;
}

/** The gate's decision, normalized from the Sentinel SDK response. */
export interface GateDecision {
  readonly verdict: Verdict;
  /** Human-readable explanation from the policy engine, when present. */
  readonly reason?: string;
  /** Id of the signed provenance record; empty string on a transport fallback. */
  readonly recordId: string;
  /** Handle to the human-review item; present only when {@link GateDecision.verdict} is {@link Verdict.Escalate}. */
  readonly escalationId?: string;
}

/** Proof of an on-chain settlement. */
export interface SettlementReceipt {
  /** Transaction hash. */
  readonly hash: string;
  /** Amount actually moved on-chain (may be capped below the policy amount on testnet). */
  readonly settledUsdc: number;
  /** Block-explorer link, when available. */
  readonly explorerUrl?: string;
}

/** The full result of processing one transfer: what was asked, what the gate said, what happened. */
export interface FlowResult {
  readonly request: TransferRequest;
  readonly decision: GateDecision;
  readonly outcome: FlowOutcome;
  readonly receipt?: SettlementReceipt;
}

/** The result of verifying the signed, hash-chained provenance log. */
export interface AuditResult {
  /** Whether the chain is intact. */
  readonly ok: boolean;
  /** Number of records in the chain. */
  readonly records: number;
  /** When broken, the failing sequence number. */
  readonly brokenAt?: number;
  /** When broken, a human-readable reason. */
  readonly reason?: string;
}
