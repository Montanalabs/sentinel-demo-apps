<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/Montanalabs/sentinel@main/assets/sentinel-mark-dark.svg" />
    <img width="64" src="https://cdn.jsdelivr.net/gh/Montanalabs/sentinel@main/assets/sentinel-mark-light.svg" alt="Sentinel" />
  </picture>
</p>

<h1 align="center">Sentinel Demo Apps</h1>

<p align="center">
  <strong>Reference integrations of the Sentinel action-gate for autonomous AI agents.</strong><br />
  Each application demonstrates the gate authorizing a consequential agent action — returning
  <strong>ALLOW, BLOCK, or ESCALATE</strong> before execution — with a signed, tamper-evident audit trail.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/apps-1-6457a6" alt="apps" />
  <img src="https://img.shields.io/badge/license-Apache--2.0-6457a6" alt="license" />
  <img src="https://img.shields.io/badge/by-Montana%20Labs-171717" alt="Montana Labs" />
</p>

---

## Overview

[Sentinel](https://github.com/Montanalabs/sentinel) is the **independent action-gate for AI agents**:
at the moment an agent is about to do something consequential, it calls the gate and gets back
`ALLOW` / `BLOCK` / `ESCALATE` **before** anything executes — signing an auditor-grade receipt for
every decision.

This repository contains **standalone, runnable example integrations** that demonstrate the gate
authorizing real agent actions across different ecosystems. Each application is self-contained, has
its own README, and runs against a local Sentinel sidecar.

## Apps

| App | What it shows | Stack |
| --- | --- | --- |
| [`sentinel-coinbase-demo`](./sentinel-coinbase-demo) | An autonomous treasury agent operating a Coinbase wallet. Every on-chain payment is authorized by Sentinel before execution: routine payments are allowed, sanctioned counterparties are blocked, and high-value transfers are escalated for human approval. Settled on Base Sepolia with a verifiable audit trail. | TypeScript · Coinbase CDP · Vercel AI SDK |

*Additional integrations will be added over time.*

## Run one

```bash
# 1. Start a Sentinel gate (in a separate directory) with the Sentinel CLI:
#      sentinel init     (provider = mock · store = memory · packs = fintech)
#      sentinel start
# 2. Run the demo:
cd sentinel-coinbase-demo && npm install && npm run demo
```

See each app's README for setup, live-mode keys, and architecture.

---

<p align="center">
  <sub>© Montana Labs · Apache-2.0. Product names and logos are trademarks of their respective owners;
  these demos are independent and not affiliated with, sponsored by, or endorsed by those companies.</sub>
</p>
