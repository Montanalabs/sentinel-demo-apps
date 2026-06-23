/**
 * The counterparty registry: the single source of truth linking a policy label to the on-chain
 * address funds are sent to. The gate evaluates {@link Counterparty.id}; the wallet settles to
 * {@link Counterparty.address}. Defining both here keeps a decision and its settlement bound to the
 * same entity.
 *
 * In production you would reconcile the *actual* on-chain recipient against a Sentinel connector
 * (ledger / sanctions list) rather than a static map; this registry is the demo's stand-in for that.
 */
import type { Counterparty } from './domain';

/** Known counterparties used by the scripted scenario and recognized in interactive/agent input. */
export const COUNTERPARTIES = {
  vendor_42: {
    id: 'vendor_42',
    label: 'Acme GPU — vetted vendor',
    address: '0x7c3a9e2b15d8460af1c6e0934d52187bca3f0d29',
    note: 'allow-listed',
  },
  acct_ofac_1: {
    id: 'acct_ofac_1',
    label: 'Flagged counterparty',
    address: '0x000000000000000000000000000000000000dead',
    note: 'sanctioned (ledger)',
  },
} as const satisfies Record<string, Counterparty>;

/** A known counterparty id. */
export type CounterpartyId = keyof typeof COUNTERPARTIES;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

/**
 * Resolve a counterparty by id. Unknown ids are synthesized (with a zero address) so arbitrary
 * input still flows through the gate and is judged on policy rather than rejected up front.
 *
 * @param id - the counterparty id the policy keys on (e.g. `vendor_42`).
 * @returns the registered {@link Counterparty}, or a synthesized one for unknown ids.
 */
export function resolveCounterparty(id: string): Counterparty {
  return (COUNTERPARTIES as Record<string, Counterparty>)[id] ?? { id, label: id, address: ZERO_ADDRESS, note: 'unknown' };
}
