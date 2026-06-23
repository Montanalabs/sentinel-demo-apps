/**
 * Scripted demo entry point.
 *
 *   terminal A:  npm run sidecar     (starts the Sentinel gate from ../sentinel)
 *   terminal B:  npm run demo
 *
 * Runs the fixed {@link SCENARIO} through the gate-then-settle flow — a routine vendor payment
 * ALLOWs and settles, a sanctioned counterparty is BLOCKed, a high-value transfer ESCALATEs to
 * dual-control — then verifies the signed, hash-chained audit log.
 */
import { config } from '../config';
import { ConsoleView } from '../view';
import { SentinelGate } from '../gate';
import { createWallet } from '../wallet';
import { PaymentFlow, tally } from '../payment-flow';
import { SCENARIO } from '../scenario';
import type { FlowResult } from '../domain';

/** Run the scripted scenario through the gate-then-settle flow and verify the audit chain. */
async function main(): Promise<void> {
  const view = new ConsoleView();
  view.banner();

  const gate = new SentinelGate(config);
  if (!(await gate.health())) {
    view.gateUnreachable(config.sentinelUrl);
    process.exit(1);
  }

  const wallet = createWallet(config);
  view.context({
    mode: wallet.mode,
    network: config.wallet.network,
    address: await wallet.address(),
    gateUrl: config.sentinelUrl,
    policy: config.policy,
  });

  const flow = new PaymentFlow(gate, wallet, view);
  const runId = `scripted-${Date.now()}`;
  const results: FlowResult[] = [];
  for (let i = 0; i < SCENARIO.length; i++) {
    view.proposed(i + 1, SCENARIO.length, SCENARIO[i]);
    results.push(await flow.process(SCENARIO[i], runId));
  }

  view.audit(await gate.verifyAudit());
  view.summary(tally(results));
}

main().catch((err) => {
  console.error('demo error:', (err as Error).message);
  process.exit(1);
});
