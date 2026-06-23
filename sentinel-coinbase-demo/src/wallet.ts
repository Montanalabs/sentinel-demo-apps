/**
 * Wallet backends that settle an allowed transfer.
 *
 * The gate is identical regardless of backend — only execution differs:
 *  - {@link SimulatedWallet}: no keys, deterministic fake settlement (real Sentinel gating).
 *  - {@link CdpWallet}: a real Coinbase CDP Server Wallet on a testnet — the same wallet AgentKit
 *    drives — that self-funds from the faucet and settles real USDC.
 */
import { randomBytes } from 'node:crypto';
import type { AppConfig } from './config';
import { SettlementReceipt, WalletMode } from './domain';

const USDC_DECIMALS = 6;
const SETTLE_LATENCY_MS = 350;

const randomHex = (bytes: number): string => '0x' + randomBytes(bytes).toString('hex');
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** A backend that can report its address and settle a USDC transfer. */
export interface Wallet {
  /** Which backend this is. */
  readonly mode: WalletMode;
  /**
   * The agent's wallet address.
   *
   * @returns the `0x` address that holds and sends funds.
   */
  address(): Promise<string>;
  /**
   * Settle a USDC transfer.
   *
   * @param toAddress - the on-chain recipient.
   * @param amountUsdc - amount in USDC (live backends may cap the amount actually moved).
   * @returns a receipt with the transaction hash and the amount settled.
   */
  transfer(toAddress: string, amountUsdc: number): Promise<SettlementReceipt>;
}

/** No-keys backend: address-shaped values and fake settlement, so the demo runs without Coinbase. */
export class SimulatedWallet implements Wallet {
  readonly mode = WalletMode.Simulated;
  private readonly addr = randomHex(20);

  /** @returns a stable, randomly-generated address for the lifetime of the process. */
  async address(): Promise<string> {
    return this.addr;
  }

  /**
   * Fake a settlement after a short delay — no chain involved.
   *
   * @param _toAddress - ignored; kept for interface parity.
   * @param amountUsdc - echoed back as the settled amount.
   * @returns a receipt with a random transaction hash and the full amount.
   */
  async transfer(_toAddress: string, amountUsdc: number): Promise<SettlementReceipt> {
    await delay(SETTLE_LATENCY_MS);
    return { hash: randomHex(32), settledUsdc: amountUsdc };
  }
}

/** Real Coinbase CDP Server Wallet (Base Sepolia by default). Lazily imports the SDK and self-funds. */
export class CdpWallet implements Wallet {
  readonly mode = WalletMode.Live;
  private cdp: any = null;
  private account: any = null;
  private funded = false;

  /** @param cfg - runtime configuration (CDP credentials, network, settlement cap). */
  constructor(private readonly cfg: AppConfig) {}

  /**
   * @returns the CDP account's on-chain address (connecting + faucet-funding on first call).
   * @throws if not on a testnet, credentials are missing, or `@coinbase/cdp-sdk` is not installed.
   */
  async address(): Promise<string> {
    return (await this.connect()).address;
  }

  /**
   * Settle a USDC transfer via the CDP Server Wallet. On testnet the amount is capped to
   * {@link AppConfig.wallet}'s `liveCapUsdc` — the gate already evaluated the full amount.
   *
   * @param toAddress - the on-chain recipient.
   * @param amountUsdc - the policy amount; the on-chain amount is `min(amountUsdc, cap)`.
   * @returns a receipt with the transaction hash, settled amount, and explorer link.
   * @throws if the CDP transfer fails (e.g. insufficient funds or network error).
   */
  async transfer(toAddress: string, amountUsdc: number): Promise<SettlementReceipt> {
    const account = await this.connect();
    const settledUsdc = Math.min(amountUsdc, this.cfg.wallet.liveCapUsdc); // testnet cap; the gate saw the full amount
    const baseUnits = BigInt(Math.round(settledUsdc * 10 ** USDC_DECIMALS)); // cdp-sdk wants a bigint in smallest units
    const res = (await account.transfer({
      to: toAddress,
      amount: baseUnits,
      token: 'usdc',
      network: this.cfg.wallet.network,
    })) as { transactionHash?: string; hash?: string };
    const hash = res.transactionHash ?? res.hash ?? 'unknown';
    return { hash, settledUsdc, explorerUrl: `https://sepolia.basescan.org/tx/${hash}` };
  }

  /**
   * Build the CDP client, load or create the account, and faucet-fund it — memoized after the first
   * call.
   *
   * @returns the connected account.
   * @throws if the network isn't a testnet, credentials are missing, or `@coinbase/cdp-sdk` is absent.
   */
  private async connect(): Promise<{ address: string; transfer: (args: Record<string, unknown>) => Promise<unknown> }> {
    if (this.account) return this.account;
    this.assertTestnet();
    const sdk = await this.importSdk();
    this.assertCredentials();
    this.cdp = new sdk.CdpClient({
      apiKeyId: this.cfg.cdp.apiKeyId,
      apiKeySecret: this.cfg.cdp.apiKeySecret,
      walletSecret: this.cfg.cdp.walletSecret,
    });
    try {
      this.account = await this.cdp.evm.getOrCreateAccount({ name: 'sentinel-demo-treasury' });
    } catch {
      this.account = await this.cdp.evm.createAccount(); // older SDKs without getOrCreateAccount
    }
    await this.fund();
    return this.account;
  }

  /**
   * Self-fund gas + USDC from the CDP testnet faucet — best-effort and idempotent; rate limits, an
   * unsupported token, or an already-funded wallet are swallowed.
   */
  private async fund(): Promise<void> {
    if (this.funded) return;
    this.funded = true;
    for (const token of ['eth', 'usdc']) {
      try {
        await this.cdp.evm.requestFaucet({ address: this.account.address, network: this.cfg.wallet.network, token });
      } catch {
        /* rate-limited, unsupported token, or already funded — ignore */
      }
    }
    await delay(3000); // CDP balance-sync delay
  }

  /** @throws if the configured network is not a testnet and `ALLOW_MAINNET` is not `'true'`. */
  private assertTestnet(): void {
    if (!/sepolia|testnet/i.test(this.cfg.wallet.network) && process.env.ALLOW_MAINNET !== 'true') {
      throw new Error(`refusing non-testnet network "${this.cfg.wallet.network}" (set ALLOW_MAINNET=true to override)`);
    }
  }

  /** @throws if any of the three CDP credentials is missing. */
  private assertCredentials(): void {
    const { apiKeyId, apiKeySecret, walletSecret } = this.cfg.cdp;
    if (!apiKeyId || !apiKeySecret || !walletSecret) {
      throw new Error('live mode needs CDP_API_KEY_ID / CDP_API_KEY_SECRET / CDP_WALLET_SECRET in .env');
    }
  }

  /**
   * Import the optional Coinbase SDK. The `as string` specifier keeps it out of compile-time
   * resolution so the simulated path never requires the dependency.
   *
   * @returns the `@coinbase/cdp-sdk` module.
   * @throws if the SDK is not installed.
   */
  private async importSdk(): Promise<any> {
    try {
      return await import('@coinbase/cdp-sdk' as string);
    } catch {
      throw new Error('live mode needs the Coinbase SDK — run `npm i @coinbase/cdp-sdk`');
    }
  }
}

/**
 * Build the wallet backend selected by configuration.
 *
 * @param cfg - runtime configuration; {@link AppConfig.wallet}'s `mode` selects the backend.
 * @returns a {@link CdpWallet} in live mode, otherwise a {@link SimulatedWallet}.
 */
export function createWallet(cfg: AppConfig): Wallet {
  return cfg.wallet.mode === WalletMode.Live ? new CdpWallet(cfg) : new SimulatedWallet();
}
