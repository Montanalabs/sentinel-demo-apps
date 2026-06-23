/**
 * Interactive entry point (`npm run interactive`): propose transfers yourself and watch the gate
 * decide. Try amount 250 → vendor_42 (ALLOW), → acct_ofac_1 (BLOCK), or amount 80000 (ESCALATE).
 */
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { config } from '../config';
import { ConsoleView } from '../view';
import { c } from '../ui';
import { SentinelGate } from '../gate';
import { createWallet } from '../wallet';
import { PaymentFlow } from '../payment-flow';
import { resolveCounterparty } from '../counterparties';
import type { TransferRequest } from '../domain';

/** Run the interactive REPL: prompt for transfers and gate each one until the user quits. */
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
  console.log(c.gray('  counterparties: vendor_42 (ok) · acct_ofac_1 (sanctioned) · amount ≥ 80000 escalates · empty/q to quit'));

  const flow = new PaymentFlow(gate, wallet, view);
  const rl = createInterface({ input, output });
  const runId = `interactive-${Date.now()}`;
  let n = 0;

  try {
    for (;;) {
      const raw = (await rl.question(c.purple('\n  amount USDC › '))).trim();
      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount <= 0) break;
      const to = (await rl.question(c.purple('  recipient   › '))).trim() || 'vendor_42';
      const request: TransferRequest = { amountUsdc: amount, counterparty: resolveCounterparty(to), reason: 'interactive request' };
      view.proposed(++n, n, request);
      await flow.process(request, runId);
    }
  } finally {
    rl.close();
  }
  console.log(c.gray('\n  bye.\n'));
}

main().catch((err) => {
  console.error('error:', (err as Error).message);
  process.exit(1);
});
