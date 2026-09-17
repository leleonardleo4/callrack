# Callrack Monorepo

Callrack is a pay-per-use information infrastructure platform delivering structured capabilities (academic research, news, market data, FX, weather, geocoding, public holidays, knowledge, government data, and research synthesis).

This repository contains the Phase 0 foundational monorepo setup powered by **pnpm workspaces**, **Turborepo**, **NestJS + Fastify**, **React + Vite**, and **Prisma 7**.

---

## 📁 Repository Structure

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
├── .github/
│   └── workflows/    # CI workflow (install, lint, typecheck, test, build)
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json
├── .gitignore
├── .env.example
└── README.md
```

---

## ⚙️ Prerequisites

- **Node.js**: `^22.0.0` or `>=18.0.0`
- **pnpm**: `>=9.0.0` (v11 recommended)
- **Docker & Docker Compose**: Required for local PostgreSQL and Redis services

---

## 🚀 Getting Started

### 1. Installation

Clone the repository and install all workspace dependencies from root:

```bash
pnpm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Default environment variables:

```env
NODE_ENV=development
DATABASE_URL="postgresql://callrack:callrack_dev_password@localhost:5432/callrack_dev?schema=public"
REDIS_URL="redis://localhost:6379"
API_PORT=3000
WEB_PORT=5173
```

### 3. Start Local Infrastructure (PostgreSQL + Redis)

Spin up background database and caching containers using Docker Compose:

```bash
docker compose -f docker/docker-compose.yml up -d
```

To verify running containers and health checks:

```bash
docker compose -f docker/docker-compose.yml ps
```

To stop local infrastructure:

```bash
docker compose -f docker/docker-compose.yml down
```

### 4. Database Setup

Generate the Prisma 7 client and apply migrations to the local database:

```bash
pnpm --filter @callrack/db run db:generate
pnpm --filter @callrack/db run db:migrate
```

This creates the schema (Capability, Provider, Request models) from
`packages/db/prisma/migrations`. To apply existing migrations without creating
a new one (e.g. in CI or a fresh clone), use:

```bash
pnpm --filter @callrack/db run db:migrate:deploy
```

Optionally seed a couple of minimal development records:

```bash
pnpm --filter @callrack/db run db:seed
```

| Command | Action |
|---|---|
| `db:generate` | Generates the Prisma Client |
| `db:migrate` | Creates and applies a migration in development (`prisma migrate dev`) |
| `db:migrate:deploy` | Applies existing migrations without prompting (`prisma migrate deploy`) |
| `db:push` | Pushes the schema without creating a migration (quick prototyping only) |
| `db:seed` | Runs `packages/db/prisma/seed.ts` |

---

## 🗄️ Database & Cache Architecture

- **PostgreSQL** (via `@callrack/db`, Prisma 7) is the persistent application
  database. It tracks `Capability`, `Provider`, and `Request` records for
  operational analytics.
- **Redis** (via `@callrack/redis`, ioredis) is infrastructure only — short-lived
  state, caching, rate-limit counters, and locks. It is never used as a primary
  datastore.
- The API consumes both through dedicated NestJS modules
  (`apps/api/src/database`, `apps/api/src/redis`) that manage a single client
  instance per process, connect on startup, and disconnect cleanly on shutdown.
  Connection failures at startup are logged as warnings rather than crashing
  the process, so `GET /health` stays available even if infrastructure is
  briefly unreachable.
- `GET /health` remains a lightweight liveness check. `GET /health/ready`
  reports whether PostgreSQL and Redis are currently reachable (`200` when
  both are `ok`, `503` when either is `down`).

---

## 💻 Development Workflow

### Start All Applications & Packages in Watch Mode

```bash
pnpm dev
```

This launches Turborepo pipeline starting `apps/api` (port 3000) and `apps/web` (port 5173) concurrently.

### Run Individual Applications

- **API backend**: `pnpm --filter @callrack/api dev`
- **Web frontend**: `pnpm --filter @callrack/web dev`

---

## 🧪 Testing, Quality & Build Commands

| Command | Action |
|---|---|
| `pnpm build` | Compiles production builds for all packages and applications |
| `pnpm dev` | Starts development servers in watch mode |
| `pnpm test` | Runs unit and integration test suites across workspace |
| `pnpm lint` | Executes ESLint across typescript files |
| `pnpm typecheck` | Validates TypeScript type checking across workspace |
| `pnpm format` | Formats codebase using Prettier |

`packages/db` and `packages/redis` include integration tests that exercise a
real PostgreSQL/Redis connection. They check reachability at startup and
automatically skip (rather than fail) when the local Docker infrastructure
isn't running, so `pnpm test` stays green on machines without Docker started.
Start the infrastructure (step 3 above) before running tests if you want these
integration tests to actually execute.

---

## 💳 x402 Payment Protection

Every paid Callrack capability (academic search/work, news search/trends,
crypto price/market, FX rates, weather, geocode, holidays, knowledge search,
government census, and research) is protected by the
[x402 payment protocol](https://github.com/x402-foundation/x402) over
Algorand. A request without a valid payment gets `402 Payment Required`
instead of running the capability; a request with a verified payment runs
normally and settles afterward. `GET /health`, `GET /health/ready`, and
`GET /docs` are never protected.

Prices come from the capability registry (`apps/api/src/capabilities/`),
which itself reads `PRICE_*` environment variables — x402 never hardcodes or
duplicates a price. All paid endpoints share one configured `payTo` address
per network (the Composite-challenge requirement of one payment destination
across every Callrack endpoint).

### Required environment variables

```env
NETWORK=testnet                    # or "mainnet" — selects which pair below is active

TESTNET_PAY_TO=<algorand-address>
MAINNET_PAY_TO=<algorand-address>

TESTNET_FACILITATOR_URL=https://facilitator.goplausible.xyz
MAINNET_FACILITATOR_URL=https://facilitator.goplausible.xyz
```

Only the *active* network's `_PAY_TO` / `_FACILITATOR_URL` pair needs to be
valid — you don't need Mainnet credentials to develop against Testnet. All of
this is validated at application startup (`X402ConfigService`); a missing or
malformed value fails startup with a clear error, never a customer's first
request. USDC (Testnet ASA `10458941`, Mainnet ASA `31566704`) is resolved
automatically by `@x402/avm` from the network — Callrack never hardcodes an
asset ID.

### Testnet setup

1. Copy `.env.example` to `.env` (already includes structurally-valid but
   **non-spendable placeholder** `TESTNET_PAY_TO`/`MAINNET_PAY_TO` values —
   replace them with a real Algorand address you control before accepting
   any real payment).
2. Leave `NETWORK=testnet` (the default for local development).
3. Start the API normally (`pnpm --filter @callrack/api dev`).

### How unpaid requests behave

```
POST /v1/weather   (no payment)
        ↓
    402 Payment Required
        ↓  (PAYMENT-REQUIRED header, decodable via @x402/core/http)
Client signs a payment and retries with a Payment-Signature header
        ↓
    x402 verifies with the GoPlausible facilitator
        ↓
    WeatherService runs (exactly as it would unprotected)
        ↓
    x402 settles, then returns the normal 200 response
```

The capability provider is never called for an unpaid or invalid-payment
request — payment verification happens entirely before the capability
service runs, and capability services have no knowledge of x402 at all (see
`apps/api/src/x402/` — the entire integration lives at the Fastify transport
boundary, wired in by `createProtectedApp()` in `apps/api/src/bootstrap.ts`).

### Bazaar discovery metadata

Every paid route also declares [x402 Bazaar](https://github.com/x402-foundation/x402)
discovery metadata: a route description, a representative input example +
JSON Schema, and a representative output example + schema, so an agent or
the GoPlausible catalog can see what an endpoint does and how to call it
*before* paying. This is generated, not hand-maintained per route:

```text
Capability Registry (id, description, requestSchema, discovery.{input,output})
        ↓
apps/api/src/x402/discovery-schema.util.ts    — reflects the live request DTO
        ↓                                       (the same @ApiProperty decorators
        ↓                                        /docs/json already uses) into JSON Schema
apps/api/src/x402/discovery-metadata.builder.ts — calls @x402/extensions/bazaar's
        ↓                                          declareDiscoveryExtension(...)
x402 route `extensions.bazaar`
```

The registry itself never imports any `@x402/*` package — only the small
adapter in `apps/api/src/x402/` does, keeping capability metadata reusable
even if x402 were replaced later. The Bazaar resource-server extension
(`bazaarResourceServerExtension`) is registered exactly once, in
`x402-resource-server.factory.ts`; each route still declares its own
discovery info.

Every paid route's payment option also carries the
`x402-global-challenge` tag required by the 2026 Algorand Global x402
Challenge, in the route's x402 `extra` field:

```json
{ "accepts": [{ "...": "...", "extra": { "tag": "x402-global-challenge", "feePayer": "..." } }] }
```

**Local declaration vs. real Bazaar visibility.** Running locally proves the
*declaration* is correct — the 402 response really does carry a valid
`extensions.bazaar` block, the challenge tag, and the right schemas (see
`apps/api/test/x402/x402.e2e.spec.ts`). It does **not** prove Callrack is
listed in the actual GoPlausible Bazaar catalog — that requires a public
HTTPS deployment on Mainnet and a real settled payment, which is out of
scope for this phase. Nothing in this codebase claims Callrack is currently
in the Bazaar catalog.

### Running the x402 test suite

```bash
pnpm --filter @callrack/api test              # includes deterministic x402 tests (mocked facilitator, no network calls)
pnpm --filter @callrack/api test:x402:testnet # real Testnet payment — see below
```

The default suite never hits a real facilitator or blockchain: `apps/api/test/x402/fake-facilitator.ts`
provides a deterministic in-memory `FacilitatorClient`, while everything else
in the pipeline (the real x402 resource server, Algorand `exact` scheme, and
Fastify middleware) runs unmodified.

`test:x402:testnet` (`apps/api/test/x402/testnet-smoke.ts`) makes a **real**
Testnet payment end-to-end (unpaid request → 402 → sign → retry → paid
response → settlement). It requires a funded Testnet Algorand account with
Testnet USDC, supplied via `TESTNET_TEST_PAYER_PRIVATE_KEY` (a base64-encoded
private key, never a mnemonic or file in this repo — export it in your own
shell only). It is never run as part of `pnpm test` or CI.

### Switching between Testnet and Mainnet

Change `NETWORK` and ensure the corresponding `MAINNET_PAY_TO` /
`MAINNET_FACILITATOR_URL` (or `TESTNET_*`) pair is set — no code changes are
needed. `NETWORK=mainnet` resolves Algorand Mainnet's CAIP-2 identifier and
Mainnet USDC automatically.

### ⚠️ Security

- Never commit a private key, mnemonic, or `.env` file. `.env` is
  git-ignored; `.env.example` only ever contains non-spendable placeholders.
- The resource server (this API) only ever *receives* payments — it never
  holds or needs a payer's private key. `TESTNET_TEST_PAYER_PRIVATE_KEY` is a
  **test-only, funded-with-testnet-only** credential you provide yourself
  when running the Testnet smoke script; it is never read by the running
  server.
- `payTo`, network, and asset are always resolved from trusted server
  configuration — a client can never choose or influence any of them.

Current x402 documentation: https://github.com/x402-foundation/x402 (packages
used: `@x402/core`, `@x402/avm`, `@x402/fastify`, all `2.26.0`).

---

## 📜 Development Conventions

1. **TypeScript First**: Strict mode enabled (`noImplicitAny`, `strictNullChecks`).
2. **Explicit Workspace Dependencies**: Internal packages reference each other via `workspace:*`.
3. **Clean Module Boundaries**: Public exports managed through explicit `index.ts` files.
4. **Environment Driven**: No hardcoded credentials or API keys.
