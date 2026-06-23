/**
 * Prints the agent's Coinbase CDP wallet address (and self-faucets it) so you can top it up before a
 * live run. Needs `DEMO_MODE=live` + CDP keys in `.env`. Run with `npm run wallet:address`.
 */
import { config } from '../config';
import { CdpWallet } from '../wallet';
import { WalletMode } from '../domain';
import { c } from '../ui';

/** Print (and faucet-fund) the agent's CDP wallet address for live runs. */
async function main(): Promise<void> {
  if (config.wallet.mode !== WalletMode.Live) {
    console.log(c.amber('  Set DEMO_MODE=live and CDP keys in .env to materialize the on-chain wallet.'));
    process.exit(1);
  }
  const address = await new CdpWallet(config).address();
  console.log('\n  ' + c.bold('Agent CDP wallet') + c.gray(`  (${config.wallet.network})`));
  console.log('  address: ' + c.cyan(address));
  console.log(c.gray(`\n  Auto-faucet requested (ETH + USDC); settlement is capped at ${config.wallet.liveCapUsdc} USDC/transfer.`));
  console.log(c.gray('  Manual top-up if rate-limited: https://portal.cdp.coinbase.com → Faucets → Base Sepolia\n'));
}

main().catch((err) => {
  console.error('error:', (err as Error).message);
  process.exit(1);
});
