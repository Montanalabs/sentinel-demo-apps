<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/Montanalabs/sentinel@main/assets/sentinel-mark-dark.svg" />
    <img width="64" src="https://cdn.jsdelivr.net/gh/Montanalabs/sentinel@main/assets/sentinel-mark-light.svg" alt="Sentinel" />
  </picture>
</p>

<h1 align="center">Sentinel × Coinbase</h1>

<p align="center">
  <strong>Gated agent payments — an AI agent with a Coinbase wallet, behind the Sentinel action-gate.</strong><br />
  The agent proposes; an independent authority disposes — <strong>allow · block · escalate</strong>, all signed.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/demo-v0.1.0-6457a6" alt="version" />
  <img src="https://img.shields.io/badge/network-Base%20Sepolia-6457a6" alt="Base Sepolia" />
  <img src="https://img.shields.io/badge/built%20with-Coinbase%20CDP-171717" alt="built with Coinbase CDP" />
  <img src="https://img.shields.io/badge/license-Apache--2.0-6457a6" alt="license" />
  <img src="https://img.shields.io/badge/by-Montana%20Labs-171717" alt="Montana Labs" />
</p>

<p align="center">
  <sub>Independent demo by Montana Labs — not affiliated with, sponsored by, or endorsed by Coinbase.<br />
  “Coinbase”, “CDP”, “AgentKit”, and “Base” are trademarks of Coinbase Global, Inc.</sub>
</p>

> Standalone demo project — not part of any repo. Made to be run, read, and shown.

An autonomous **treasury agent holds a Coinbase wallet**, and every on-chain action it proposes is
sent to the **independent Sentinel gate first**. Only an `ALLOW` ever reaches the wallet:

- a routine vendor payment → **ALLOW** → settles on Base
- a payment to a sanctioned address → **BLOCK** → the wallet is never called
- a high-value transfer → **ESCALATE** → held for human dual-control, then settles on approval

…and the whole run is a **signed, hash-chained audit log** that is verified end-to-end at the finish.
The gate is identical whether the wallet is simulated or a real Coinbase CDP wallet — only the
executor changes. That is the point: **the agent proposes; an independent authority disposes.**

---

## Run it (2 terminals, no keys)

**Prereq:** a [`sentinel`](https://github.com/Montanalabs/sentinel) checkout next to the
`sentinel-demo-apps` folder (so it resolves at `../../sentinel`), with its dependencies installed
(`npm install`). The `npm run sidecar` script starts it from there; alternatively, run a Sentinel
sidecar yourself and point `SENTINEL_URL` at it.

```bash
cd sentinel-coinbase-demo
npm install

# terminal A — start the Sentinel gate (offline mock provider, in-memory store, demo ledger)
npm run sidecar

# terminal B
npm run demo            # scripted scenario: ALLOW → BLOCK → ESCALATE → verify
npm run interactive     # propose your own transfers and watch the gate decide
npm run agent           # an LLM decides what to pay; Sentinel gates every call (needs an LLM key)
```

`demo` and `interactive` need **no keys** — the wallet is simulated, but the Sentinel gating,
escalation, and signed provenance are 100% real (the published `@montanalabs/sentinel` client talking
to a real sidecar).

### Autonomous agent (`npm run agent`)

A real model (Anthropic Claude by default, or OpenAI) is given a treasury task and one `send_payment`
tool; **Sentinel gates the tool before any funds move.** The task deliberately includes a legit
payment, a high-value sweep, *and* a prompt-injected payment to a sanctioned address — so you watch
the gate allow / escalate / block the model's own choices. Set one LLM key in `.env`:

```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-…       # or LLM_PROVIDER=openai + OPENAI_API_KEY
```

---

## Go live on Base Sepolia (real Coinbase CDP wallet)

```bash
npm i @coinbase/cdp-sdk
cp .env.example .env
# Secret API key (portal.cdp.coinbase.com/api-keys/secret): Advanced → Non-custodial: Export + Manage, Ed25519
# Wallet Secret (portal.cdp.coinbase.com/wallets/non-custodial/security): Generate
# set DEMO_MODE=live + CDP_API_KEY_ID / CDP_API_KEY_SECRET / CDP_WALLET_SECRET + an LLM key
npm run wallet:address     # creates + faucet-funds the agent wallet, prints its address
npm run agent              # gates each payment; ALLOW/approved transfers settle real testnet USDC
```

The wallet **self-funds** from the CDP faucet (ETH for gas + USDC). On-chain settlement is **capped**
at `LIVE_TESTNET_CAP_USDC` (default 0.1) so it stays faucet-cheap — **the gate still evaluates the full
policy amount**, so verdicts are unchanged. A guard refuses any non-Sepolia network unless
`ALLOW_MAINNET=true`. The BLOCK never touches the chain.

This uses the [`@coinbase/cdp-sdk`](https://github.com/coinbase/cdp-sdk) Server Wallet — the same
wallet [Coinbase AgentKit](https://github.com/coinbase/agentkit) drives — so the gate drops straight
into an AgentKit action's executor.

---

## Architecture

Clean layering, dependency-injected, no module reaches across its concern:

| Module | Responsibility |
| --- | --- |
| `domain.ts` | enums + interfaces (`Verdict`, `WalletMode`, `Counterparty`, `TransferRequest`, `GateDecision`, …) — pure types |
| `config.ts` | typed `AppConfig`, `.env` loader |
| `counterparties.ts` | the registry: one source of truth linking a **policy label** to an **on-chain address** |
| `gate.ts` | `SentinelGate` — `guard`, escalation, audit verification (wraps the published SDK + sidecar API) |
| `wallet.ts` | `Wallet` interface + `SimulatedWallet` / `CdpWallet` + `createWallet` factory |
| `payment-flow.ts` | `PaymentFlow.process` — propose → guard → settle/block/escalate→approve→settle |
| `view.ts` / `ui.ts` | presentation only (`FlowReporter`); the flow emits events, the view renders |
| `index.ts` · `agent.ts` · `interactive.ts` · `wallet-info.ts` | entry points, sharing the same flow |

The decision is always the gate's, settlement is always the wallet's, and rendering is always the
view's — so the same `PaymentFlow` powers the scripted, interactive, and LLM-agent runs unchanged.

## How it maps to a real integration

| Demo piece | Real system |
| --- | --- |
| `SentinelGate.guard()` | `Action.payment(...)` + `client.guard(...)` from `@montanalabs/sentinel` |
| `CdpWallet.transfer()` | `@coinbase/cdp-sdk` `account.transfer({ to, amount, token, network })` (bigint base units) |
| ESCALATE → approve | the sidecar's `/v1/escalations` dual-control queue |
| Audit trail | `/v1/verify` over the Ed25519, hash-chained provenance log |

The rule everywhere: **build the action → guard it → execute only on `ALLOW`.** See the Sentinel
[integration docs](https://sentinel.montanalabs.ai/integrations).

## Demo scaffolding (honest notes)

These are deliberate demo simplifications, not part of the contract:

- **On-chain amount is capped** in live mode; the gate evaluates the real amount.
- **Escalations auto-approve** (the demo simulates the treasurer via the real API); production wires a
  real human to the dual-control queue.
- The gate evaluates the counterparty **label**; a production deployment would reconcile the **actual
  on-chain recipient** against a Sentinel connector (the registry is the stand-in here).
- The sidecar runs the **mock** second-opinion provider + in-memory store (dev config).

---

© Montana Labs · demo only · Apache-2.0 components
