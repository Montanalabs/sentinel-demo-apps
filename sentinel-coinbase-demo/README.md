<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/Montanalabs/sentinel@main/assets/sentinel-mark-dark.svg" />
    <img width="64" src="https://cdn.jsdelivr.net/gh/Montanalabs/sentinel@main/assets/sentinel-mark-light.svg" alt="Sentinel" />
  </picture>
</p>

<h1 align="center">Sentinel × Coinbase</h1>

<p align="center">
  <strong>Gated agent payments — an AI agent with a Coinbase wallet, behind the Sentinel action-gate.</strong><br />
  Sentinel independently authorizes every payment the agent proposes — <strong>allow · block · escalate</strong> — and signs each decision.
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

An autonomous **treasury agent operates a Coinbase wallet**, and every on-chain action it proposes is
sent to the **independent Sentinel gate first**. Only an `ALLOW` reaches the wallet:

- a routine vendor payment → **ALLOW** → settles on Base
- a payment to a sanctioned address → **BLOCK** → the wallet is never called
- a high-value transfer → **ESCALATE** → held for human dual-control, then settles on approval

Every decision is written to a **signed, hash-chained audit log**, verified end-to-end at the end of
the run. The gate behaves identically whether the wallet is simulated or a real Coinbase CDP wallet;
only the executor differs.

---

## Run it (2 terminals, no keys)

Install the [Sentinel](https://github.com/Montanalabs/sentinel) CLI:

```bash
curl -fsSL https://montanalabs.ai/sentinel/install.sh | sh
```

**Terminal A — set up and run the gate.** Run this in a *separate* directory (not this demo folder —
`sentinel init` scaffolds its own `.env`/config):

```bash
mkdir sentinel-gate && cd sentinel-gate
sentinel init      # choose: provider = mock · store = memory · packs = fintech
sentinel start     # gate on http://localhost:4000
```

**Terminal B — run the demo:**

```bash
cd sentinel-coinbase-demo
npm install
npm run demo            # scripted scenario: ALLOW → BLOCK → ESCALATE → verify
npm run interactive     # propose your own transfers and watch the gate decide
npm run agent           # an LLM decides what to pay; Sentinel gates every call (needs an LLM key)
```

> Prefer Docker for the gate? `docker run -p 4000:4000 -e SENTINEL_SECOND_OPINION_PROVIDER=mock -e SENTINEL_DATABASE_URL=memory ghcr.io/montanalabs/sentinel`. Point `SENTINEL_URL` at any reachable gate.

> **Provider choice.** For the **deterministic scripted scenario** (clean ALLOW → BLOCK → ESCALATE),
> use `mock` — it's instant and the verdicts are stable. A **real** second-opinion model
> (`anthropic`/`openai`) is deliberately conservative: it escalates whenever it can't verify the
> action against the stated intent, so with it you'll see more escalations (the safe direction). The
> demo passes the agent's intent to the gate to help, but a cautious model may still escalate. If you
> use a real model, set `SENTINEL_TIMEOUT_MS` (default `20000`) ≥ the gate's `SENTINEL_SLOW_BUDGET_MS`
> + margin, or the client times out and **fails closed (BLOCK)** before the gate answers.

`demo` and `interactive` need **no keys** — the wallet is simulated, but the Sentinel gating,
escalation, and signed provenance are real: the published `@montanalabs/sentinel` client talking to a
running sidecar.

### Autonomous agent (`npm run agent`)

A real model (Anthropic Claude by default, or OpenAI) is given a treasury task and one `send_payment`
tool; **Sentinel gates the tool before any funds move.** The task deliberately includes a legitimate
payment, a high-value sweep, *and* a prompt-injected payment to a sanctioned address, so the gate's
allow / escalate / block decisions are driven by the model's own choices. Set one LLM key in `.env`:

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
at `LIVE_TESTNET_CAP_USDC` (default 0.1) so testnet faucet funds are sufficient — **the gate still
evaluates the full policy amount**, so verdicts are unchanged. A guard refuses any non-Sepolia network
unless `ALLOW_MAINNET=true`. A blocked transfer never touches the chain.

This uses the [`@coinbase/cdp-sdk`](https://github.com/coinbase/cdp-sdk) Server Wallet — the same
wallet [Coinbase AgentKit](https://github.com/coinbase/agentkit) drives — so the gate drops straight
into an AgentKit action's executor.

---

## Architecture

Layered and dependency-injected; each module owns a single concern:

| Module | Responsibility |
| --- | --- |
| `domain.ts` | enums + interfaces (`Verdict`, `WalletMode`, `Counterparty`, `TransferRequest`, `GateDecision`, …) — pure types |
| `config.ts` | typed `AppConfig`, `.env` loader |
| `counterparties.ts` | the registry: one source of truth linking a **policy label** to an **on-chain address** |
| `gate.ts` | `SentinelGate` — `guard`, escalation, audit verification (wraps the published SDK + sidecar API) |
| `wallet.ts` | `Wallet` interface + `SimulatedWallet` / `CdpWallet` + `createWallet` factory |
| `payment-flow.ts` | `PaymentFlow.process` — propose → guard → settle/block/escalate→approve→settle |
| `view.ts` / `ui.ts` | presentation only (`FlowReporter`); the flow emits events, the view renders |
| `commands/` (`demo.ts` · `agent.ts` · `interactive.ts` · `wallet-info.ts`) | entry points, all sharing the same flow |

The decision is always the gate's, settlement is always the wallet's, and rendering is always the
view's — so the same `PaymentFlow` is reused by the scripted, interactive, and agent entry points.

## How it maps to a real integration

| Demo piece | Real system |
| --- | --- |
| `SentinelGate.guard()` | `Action.payment(...)` + `client.guard(...)` from `@montanalabs/sentinel` |
| `CdpWallet.transfer()` | `@coinbase/cdp-sdk` `account.transfer({ to, amount, token, network })` (bigint base units) |
| ESCALATE → approve | the sidecar's `/v1/escalations` dual-control queue |
| Audit trail | `/v1/verify` over the Ed25519, hash-chained provenance log |

The rule everywhere: **build the action → guard it → execute only on `ALLOW`.** See the Sentinel
[integration docs](https://sentinel.montanalabs.ai/integrations).

## Scope and limitations

The following are deliberate simplifications in the demo, not properties of Sentinel itself:

- **On-chain amount is capped** in live mode; the gate evaluates the real amount.
- **Escalations auto-approve** (the demo simulates the treasurer via the real API); production wires a
  real human to the dual-control queue.
- The gate evaluates the counterparty **label**; a production deployment would reconcile the **actual
  on-chain recipient** against a Sentinel connector (the registry is the stand-in here).
- The sidecar runs the **mock** second-opinion provider + in-memory store (dev config).

---

© Montana Labs · demo only · Apache-2.0 components
