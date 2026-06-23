/**
 * Typed application configuration, loaded once from the environment (and an optional `.env` file).
 *
 * Every value has a working default for the simulated demo; the CDP credentials are required only
 * in {@link WalletMode.Live} and validated lazily by the wallet, so `npm run demo` works with none.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LlmProvider, WalletMode } from './domain';

/** Coinbase CDP credentials (required only in {@link WalletMode.Live}). */
export interface CdpCredentials {
  readonly apiKeyId: string;
  readonly apiKeySecret: string;
  readonly walletSecret: string;
}

/** All runtime configuration for the demo. */
export interface AppConfig {
  /** Base URL of the Sentinel sidecar. */
  readonly sentinelUrl: string;
  /** Policy pack the gate evaluates against. */
  readonly policy: string;
  /** The agent's funded treasury account, as the policy/ledger knows it. */
  readonly fromAccount: string;
  readonly wallet: {
    readonly mode: WalletMode;
    /** Target network (kept to a testnet by a guard in the live wallet). */
    readonly network: string;
    /** On-chain settlement cap (USDC) in live mode; the gate still evaluates the full amount. */
    readonly liveCapUsdc: number;
  };
  readonly llm: {
    readonly provider: LlmProvider;
    /** Optional model override; the agent picks a sensible default per provider when unset. */
    readonly model?: string;
  };
  readonly cdp: CdpCredentials;
}

/**
 * Load a `.env` file into `process.env` (only keys not already set), stripping inline `# comments`
 * and surrounding quotes. A real shell environment always wins over the file.
 *
 * @param root - directory that may contain the `.env` file.
 */
function loadDotenv(root: string): void {
  const path = join(root, '.env');
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].split('#')[0].trim().replace(/^["']|["']$/g, '');
    }
  }
}

/**
 * Read a trimmed environment variable.
 *
 * @param key - the environment variable name.
 * @param fallback - value to use when the variable is unset or empty.
 * @returns the variable's value, or `fallback`.
 */
const read = (key: string, fallback = ''): string => process.env[key]?.trim() || fallback;

/**
 * Coerce a string to an enum member, falling back when it isn't a valid value.
 *
 * @param e - the enum object.
 * @param value - the candidate string.
 * @param fallback - returned when `value` is not a member of `e`.
 * @returns the matching enum member, or `fallback`.
 */
function asEnum<E extends Record<string, string>>(e: E, value: string, fallback: E[keyof E]): E[keyof E] {
  return (Object.values(e) as string[]).includes(value) ? (value as E[keyof E]) : fallback;
}

/**
 * Read and normalize configuration from the environment (loading `.env` first).
 *
 * @returns the fully-populated {@link AppConfig}, with defaults applied.
 */
export function loadConfig(): AppConfig {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  loadDotenv(root);
  return {
    sentinelUrl: read('SENTINEL_URL', 'http://localhost:4000').replace(/\/+$/, ''),
    policy: read('POLICY', 'fintech.payments'),
    fromAccount: read('FROM_ACCOUNT', 'acct_ops'),
    wallet: {
      mode: asEnum(WalletMode, read('DEMO_MODE', WalletMode.Simulated), WalletMode.Simulated),
      network: read('NETWORK', 'base-sepolia'),
      liveCapUsdc: Number(read('LIVE_TESTNET_CAP_USDC', '0.1')),
    },
    llm: {
      provider: asEnum(LlmProvider, read('LLM_PROVIDER', LlmProvider.Anthropic), LlmProvider.Anthropic),
      model: read('AGENT_MODEL') || undefined,
    },
    cdp: {
      apiKeyId: read('CDP_API_KEY_ID'),
      apiKeySecret: read('CDP_API_KEY_SECRET'),
      walletSecret: read('CDP_WALLET_SECRET'),
    },
  };
}

/** The process-wide configuration, loaded at import time. */
export const config: AppConfig = loadConfig();
