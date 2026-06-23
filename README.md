<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/Montanalabs/sentinel@main/assets/sentinel-mark-dark.svg" />
    <img width="64" src="https://cdn.jsdelivr.net/gh/Montanalabs/sentinel@main/assets/sentinel-mark-light.svg" alt="Sentinel" />
  </picture>
</p>

<h1 align="center">Sentinel Demo Apps</h1>

<p align="center">
  <strong>Runnable, demo-worthy integrations of the Sentinel action-gate.</strong><br />
  Each app puts Sentinel in front of a real agent action — <strong>allow · block · escalate</strong> —
  with a signed, hash-chained audit trail.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/apps-1-6457a6" alt="apps" />
  <img src="https://img.shields.io/badge/license-Apache--2.0-6457a6" alt="license" />
  <img src="https://img.shields.io/badge/by-Montana%20Labs-171717" alt="Montana Labs" />
</p>

---

## What this is

[Sentinel](https://github.com/Montanalabs/sentinel) is the **independent action-gate for AI agents**:
at the moment an agent is about to do something consequential, it calls the gate and gets back
`ALLOW` / `BLOCK` / `ESCALATE` **before** anything executes — signing an auditor-grade receipt for
every decision.

This repo collects **standalone, runnable demos** that show that gate in front of real agent actions
across ecosystems. Every app is self-contained, has its own README, and runs against a local Sentinel
sidecar.

## Apps

| App | What it shows | Stack |
| --- | --- | --- |
| [`sentinel-coinbase-demo`](./sentinel-coinbase-demo) | An autonomous treasury agent with a real Coinbase wallet — every on-chain payment clears Sentinel first (allow vendor pay · **block** sanctioned · **escalate** high-value to dual-control), settled on Base Sepolia and fully auditable. | TypeScript · Coinbase CDP · Vercel AI SDK |

*More demos coming.*

## Run one

```bash
cd sentinel-coinbase-demo
npm install
npm run sidecar      # terminal A — start the Sentinel gate
npm run demo         # terminal B — scripted demo (or: npm run agent / npm run interactive)
```

See each app's README for setup, live-mode keys, and architecture.

---

<p align="center">
  <sub>© Montana Labs · Apache-2.0. Product names and logos are trademarks of their respective owners;
  these demos are independent and not affiliated with, sponsored by, or endorsed by those companies.</sub>
</p>
