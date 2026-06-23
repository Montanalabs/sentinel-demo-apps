/**
 * The scripted demo scenario, expressed as data. Amounts and counterparties are chosen to land
 * deterministically on the stock `fintech.payments` policy + demo ledger that ships with the
 * sidecar: a routine vendor payment ALLOWs, a sanctioned counterparty BLOCKs, and a high-value
 * transfer ESCALATEs to dual-control.
 */
import { COUNTERPARTIES } from './counterparties';
import type { TransferRequest } from './domain';

/** The ordered list of payments the scripted demo proposes. */
export const SCENARIO: readonly TransferRequest[] = [
  { amountUsdc: 250, counterparty: COUNTERPARTIES.vendor_42, reason: 'Routine vendor payment — monthly GPU compute' },
  { amountUsdc: 500, counterparty: COUNTERPARTIES.acct_ofac_1, reason: 'Prompt-injected payment to a flagged address' },
  { amountUsdc: 80_000, counterparty: COUNTERPARTIES.vendor_42, reason: 'High-value treasury sweep (dual-control)' },
];
