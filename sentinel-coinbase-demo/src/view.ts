/**
 * Presentation layer. The flow emits structured events to a {@link FlowReporter}; this module
 * renders them to the terminal. Keeping all console I/O here lets the gate / wallet / flow modules
 * stay free of formatting concerns.
 */
import { c, rule } from './ui';
import { AuditResult, GateDecision, SettlementReceipt, TransferRequest, Verdict, WalletMode } from './domain';

/** The per-transfer events {@link PaymentFlow} reports as it processes a request. */
export interface FlowReporter {
  /** The gate's verdict came back. */
  decided(decision: GateDecision): void;
  /** An allowed (or approved) transfer settled on-chain. */
  settled(receipt: SettlementReceipt, policyAmountUsdc: number): void;
  /** The gate blocked the transfer; nothing executed. */
  blocked(): void;
  /** The transfer was escalated to human review. */
  escalated(escalationId: string): void;
  /** A human approved the escalated transfer. */
  approved(approver: string): void;
}

const indent = '        ';
const kv = (label: string, value: string): void => console.log(c.gray(`${indent}${label.padEnd(11)} `) + value);
const note = (symbol: string, text: string, color = c.gray): void => console.log(color(`${indent}${symbol} `) + c.gray(text));
const heading = (text: string): void => console.log('\n  ' + c.bold(c.white(text)));

/**
 * Render a verdict as a colored badge.
 *
 * @param verdict - the gate's verdict.
 * @returns the styled badge string.
 */
function badge(verdict: Verdict): string {
  switch (verdict) {
    case Verdict.Allow: return c.green(c.bold(' ✓ ALLOW '));
    case Verdict.Block: return c.red(c.bold(' ✕ BLOCK '));
    case Verdict.Escalate: return c.amber(c.bold(' ! ESCALATE '));
  }
}

/** Renders the demo to the terminal. Implements {@link FlowReporter} plus the surrounding panels. */
export class ConsoleView implements FlowReporter {
  /** Print the title block. */
  banner(): void {
    console.log();
    console.log(`${c.purple('  ◗ ')}${c.bold('Sentinel')}${c.gray('  ×  ')}${c.bold('Coinbase')}${c.gray('  —  gated agent payments')}`);
    console.log(c.gray('  An AI agent holds a Coinbase wallet. Every on-chain action clears the'));
    console.log(c.gray('  independent Sentinel gate first — allow · block · escalate — all signed.'));
    console.log(rule());
  }

  /**
   * Print a "gate is down — start the sidecar" message.
   *
   * @param url - the sidecar URL that could not be reached.
   */
  gateUnreachable(url: string): void {
    console.log(`${c.red('  ✕ Sentinel sidecar not reachable at ')}${c.white(url)}`);
    console.log(c.gray('    Start it in another terminal:  ') + c.cyan('npm run sidecar'));
  }

  /**
   * Print the run context panel (wallet, network, gate, and optional model).
   *
   * @param info - the wallet mode/address/network, gate URL + policy, and an optional model label.
   */
  context(info: { mode: WalletMode; network: string; address: string; gateUrl: string; policy: string; model?: string }): void {
    heading('Agent wallet');
    if (info.model) kv('model', c.cyan(info.model));
    kv('mode', info.mode === WalletMode.Live ? c.green('live · Coinbase CDP') : c.amber('simulated (real gating)'));
    kv('network', info.network);
    kv('address', c.cyan(info.address));
    kv('gate', `${info.gateUrl}${c.gray(`  ·  policy ${info.policy}`)}`);
    console.log(rule());
  }

  /**
   * Print the header for a proposed transfer (step `index/total`).
   *
   * @param index - 1-based step number.
   * @param total - total number of steps.
   * @param request - the proposed transfer.
   */
  proposed(index: number, total: number, request: TransferRequest): void {
    console.log(`\n${c.purple(`  ${index}/${total}  `)}${c.bold(c.white(request.reason))}`);
    kv('transfer', `${c.bold(String(request.amountUsdc))} USDC  →  ${request.counterparty.id} ${c.gray(`(${request.counterparty.address.slice(0, 10)}…)`)}`);
  }

  /**
   * Render the gate's verdict and provenance record id.
   *
   * @param decision - the gate's decision.
   */
  decided(decision: GateDecision): void {
    console.log(c.gray(`${indent}verdict     `) + badge(decision.verdict) + c.gray(`   ${decision.reason ?? ''}`));
    kv('record', c.gray(decision.recordId || '(transport fallback)'));
  }

  /**
   * Render a settlement, noting the testnet cap when the on-chain amount was reduced.
   *
   * @param receipt - the settlement receipt.
   * @param policyAmountUsdc - the full amount the gate evaluated (for the cap note).
   */
  settled(receipt: SettlementReceipt, policyAmountUsdc: number): void {
    note('→', `settled: ${c.cyan(receipt.hash)}`, c.green);
    if (receipt.settledUsdc < policyAmountUsdc) {
      note(' ', `testnet cap: moved ${receipt.settledUsdc} USDC on-chain (gate evaluated ${policyAmountUsdc}).`);
    }
    if (receipt.explorerUrl) note(' ', receipt.explorerUrl);
  }

  /** Note that a blocked transfer never reached the wallet. */
  blocked(): void {
    note('✕', 'wallet never called — no value moved.', c.red);
  }

  /**
   * Note that a transfer was escalated to human dual-control.
   *
   * @param escalationId - the escalation handle.
   */
  escalated(escalationId: string): void {
    note('!', `held for human dual-control (${escalationId}).`, c.amber);
  }

  /**
   * Note that a human approved an escalated transfer.
   *
   * @param approver - identity of the approver.
   */
  approved(approver: string): void {
    note('✓', `${approver} approved (signed human.review record appended).`, c.green);
  }

  /**
   * Render the audit-trail panel.
   *
   * @param result - the outcome of verifying the provenance chain.
   */
  audit(result: AuditResult): void {
    console.log(rule());
    heading('Audit trail');
    if (result.ok) {
      note('✓', `${result.records} signed records, hash-chained — chain verifies ${c.green('ok:true')} (tamper-evident, offline).`, c.green);
    } else {
      note('✕', `chain broken at seq ${result.brokenAt}: ${result.reason}`, c.red);
    }
  }

  /**
   * Render the closing tally.
   *
   * @param counts - the number of allowed, blocked, and escalated decisions.
   */
  summary(counts: { allow: number; block: number; escalate: number }): void {
    console.log(rule());
    heading('Summary');
    console.log(`${indent}${c.green(`${counts.allow} allowed`)}${c.gray('  ·  ')}${c.red(`${counts.block} blocked`)}${c.gray('  ·  ')}${c.amber(`${counts.escalate} escalated`)}`);
    console.log(c.gray(`${indent}The agent holds the wallet. Sentinel — independent of it — decides what`));
    console.log(c.gray(`${indent}actually executes, and signs an auditor-grade receipt for every call.`));
    console.log();
  }

  /**
   * Render a free-text block (e.g. the LLM agent's closing summary).
   *
   * @param title - the panel heading.
   * @param body - multi-line text to print, indented.
   */
  prose(title: string, body: string): void {
    console.log(rule());
    heading(title);
    for (const ln of body.split('\n')) console.log(c.gray('  ' + ln));
  }
}
