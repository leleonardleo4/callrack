# Callrack — Pay-Per-Use Information Infrastructure for AI Agents

> **Live:** https://callrack.xyz · **API:** https://api.callrack.xyz · **Built for x402 on Algorand Mainnet**

Callrack is a unified, pay-per-request API that gives AI agents and
applications machine-readable access to information across 16 capabilities —
academic search, news, crypto markets, FX, weather, geocoding, holidays,
general knowledge, US Census data, and four provenance-backed research
capabilities (`research`, `verify`, `evidence`, `compare`). No API keys, no
subscriptions: an agent discovers a capability, pays per request in **USDC on
Algorand via x402**, and gets a normalized JSON response with real source
provenance — never a synthesized or fabricated answer.

**Every AI data request becomes a USDC transaction on Algorand.**

This repository is powered by **pnpm workspaces**, **Turborepo**,
**NestJS + Fastify** (API), **React + Vite** (web), and **Prisma 7**.

---

## Why Callrack?

Agents today juggle a dozen API keys, subscriptions, and inconsistent
response formats just to get basic data — infrastructure built for humans
with credit cards, not for autonomous software that needs to pay in
milliseconds.

Callrack fixes this:
- **One API** for 16 capabilities instead of a dozen separate providers
- **Pay-per-request** via HTTP `402`, no account or subscription
- **Algorand settlement** — low fees and fast finality, well suited to
  the $0.04–$0.20 USDC micro-payments Callrack actually charges per request
- **Deterministic composition, never an LLM** — `verify`/`evidence`/`compare`/
  `research` return real, source-attributed evidence; empty results when
  there isn't enough evidence, never an invented one

---

## Live Agent Discovery

Agents don't read prose docs. They read these:

- **Operating instructions:** https://api.callrack.xyz/agents.md
- **Capabilities & prices:** https://api.callrack.xyz/llms.txt
- **OpenAPI spec:** https://api.callrack.xyz/openapi.json
- **x402 discovery document:** https://api.callrack.xyz/.well-known/x402
- **MCP tool manifest:** https://api.callrack.xyz/.well-known/mcp.json

See [`docs/X402.md`](docs/X402.md) for the full discovery/merchant-metadata
picture, including which files live on `callrack.xyz` vs. `api.callrack.xyz`.

---

## Capabilities

All endpoints are `POST` with a JSON body, versioned under `/v1`, and priced
in USDC via x402 (see [How x402 works](#how-x402-on-algorand-works) below).

| Capability | Endpoint | Price (live, USDC) |
|---|---|---|
| Academic Search | `/v1/academic/search` | $0.08 |
| Academic Work Lookup | `/v1/academic/work` | $0.06 |
| News Search | `/v1/news/search` | $0.08 |
| News Trends | `/v1/news/trends` | $0.09 |
| Crypto Price | `/v1/crypto/price` | $0.04 |
| Crypto Market Data | `/v1/crypto/market` | $0.06 |
| FX Rates | `/v1/fx/rates` | $0.04 |
| Weather | `/v1/weather` | $0.05 |
| Geocoding | `/v1/geocode` | $0.04 |
| Public Holidays | `/v1/holidays` | $0.04 |
| Knowledge Search | `/v1/knowledge/search` | $0.06 |
| US Census (Government) | `/v1/government/census` | $0.08 |
| Research | `/v1/research` | $0.10 |
| Verify (claim verification) | `/v1/verify` | $0.12 |
| Evidence (evidence pack) | `/v1/evidence` | $0.15 |
| Compare (structured comparison) | `/v1/compare` | $0.20 |

Prices above are read live from `GET /v1/capabilities` and
`/.well-known/x402` (confirmed against the running production API) — those
two endpoints are always the canonical source if this table ever drifts.
`GET /health` and `GET /health/ready` are free and unauthenticated.

---

## How x402 on Algorand Works

```http
1. Agent  -> POST https://api.callrack.xyz/v1/news/search {"query":"Algorand"}
2. Server <- 402 Payment Required
   PAYMENT-REQUIRED: { amount: "0.08", asset: "USDC", network: "algorand", payTo: "..." }
3. Agent  -> signs and submits a USDC payment on Algorand via x402
4. Agent  -> retries the same request
   PAYMENT-SIGNATURE: <x402 payment proof>
5. Server <- 200 OK { data: [...] }
```

No API keys — payment *is* the auth. Every successful paid request is a
real, settled on-chain USDC transaction on Algorand. Full protocol details,
required environment variables, discovery/merchant metadata, the wallet
Playground, and security notes live in [`docs/X402.md`](docs/X402.md).

---

## Quick Start for Agents

```bash
curl -X POST https://api.callrack.xyz/v1/news/search \
  -H "content-type: application/json" \
  -d '{"query": "Algorand"}'
# -> 402 Payment Required, with payment requirements in the PAYMENT-REQUIRED header

# Pay the amount in USDC on Algorand, then retry with proof:
curl -X POST https://api.callrack.xyz/v1/news/search \
  -H "content-type: application/json" \
  -H "PAYMENT-SIGNATURE: <proof>" \
  -d '{"query": "Algorand"}'
# -> 200 OK
```

Full agent operating instructions: https://api.callrack.xyz/agents.md

---

## Tech Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **API:** NestJS + Fastify, TypeScript, OpenAPI 3.0 (`/docs`, `/openapi.json`)
- **Web:** React + Vite + Tailwind CSS
- **Database / Cache:** PostgreSQL via Prisma 7, Redis (ioredis) for
  short-lived state and rate limiting
- **Payments:** [x402 protocol](https://github.com/x402-foundation/x402)
  (`@x402/core`, `@x402/avm`, `@x402/fastify`) settling USDC on Algorand
- **Wallets:** [`@txnlab/use-wallet` v5](https://github.com/TxnLab/use-wallet)
  (Pera, Defly, Lute, WalletConnect, Exodus) in the web Playground

---

## Repository Structure

```text
callrack/
├── apps/
│   ├── api/          # NestJS + Fastify backend application
│   └── web/          # React + Vite + Tailwind CSS frontend application
│
├── packages/
│   ├── config/       # Environment parsing & typed configuration utilities
│   ├── types/        # Shared TypeScript interfaces & API models
│   ├── validation/   # Shared Zod validation schemas
│   ├── db/           # Prisma 7 database schema, migrations & client instance
│   ├── redis/        # Redis client factory & cache abstraction (get/set/delete/exists + TTL)
│   └── sdk/          # Client SDK package boundary
│
├── docker/
│   └── docker-compose.yml  # Local PostgreSQL & Redis infrastructure
│
├── docs/
│   ├── DEVELOPMENT.md # Full local setup, database/cache architecture, dev workflow, testing
│   ├── X402.md         # x402 protocol, discovery/merchant metadata, wallet Playground, security
│   ├── DEPLOYMENT.md  # Production deployment, hardening, and release checklist
│   └── REFUNDS.md      # Automatic refund design for failed paid requests
│
├── .github/
│   └── workflows/    # CI workflow (install, lint, typecheck, test, build, Docker image build)
│
├── apps/api/Dockerfile  # Production API image (see docs/DEPLOYMENT.md)
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json
├── .gitignore
├── .dockerignore
├── .env.example
└── README.md
```

---

## Getting Started (Developers)

```bash
pnpm install
cp .env.example .env
docker compose -f docker/docker-compose.yml up -d
pnpm --filter @callrack/db run db:generate
pnpm --filter @callrack/db run db:migrate
pnpm dev   # starts apps/api on :3000 and apps/web on :5173
```

For the full setup guide (Prisma migrations, database/cache architecture,
test commands, conventions), see [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

---

## Production Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full production
hardening and deployment guide: environment separation, required
production environment variables, Mainnet `payTo`/USDC opt-in validation,
database/Redis production safety, rate limiting, `apps/api/Dockerfile`,
the web production build, backup/rollback procedures, and the release
candidate checklist.

---

## Roadmap

- [x] Core API with 16 capabilities across 9 data domains
- [x] x402 payment flow settling USDC on Algorand
- [x] Agent discovery files (`agents.md`, `llms.txt`, `openapi.json`, `.well-known/mcp.json`)
- [x] Automatic refunds for failed paid requests
- [x] Wallet Playground for paying with a real Algorand wallet
- [x] Public Mainnet deployment, confirmed listed in the GoPlausible Bazaar catalog
- [ ] Usage dashboard for developers
- [ ] Additional capabilities (stocks, flights, patents)

---

## Author

Built by [Leonard](https://github.com/leleonardleo4), focused on making
Algorand a practical settlement layer for pay-per-use agent infrastructure.

Repository: https://github.com/leleonardleo4/callrack
