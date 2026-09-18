# Callrack Monorepo

Callrack lets software and AI agents acquire, verify, compare, and compose
information as paid, machine-readable capabilities with source provenance.
It is a pay-per-use information infrastructure platform, not another
general-purpose chatbot: every response traces back to a real provider, a
real retrieval timestamp, and (for the higher-level `verify`/`evidence`/
`compare`/`research` capabilities) explicit source-level provenance —
never a synthesized or fabricated answer.

Atomic capabilities: academic search/work, news search/trends, crypto
price/market, FX rates, weather, geocoding, public holidays, knowledge
search, and government (Census) data. Composed, higher-value capabilities
built on top of those: `research` (an evidence-backed research packet),
`verify` (deterministic claim verification), `evidence` (a machine-readable
evidence pack), and `compare` (structured cross-source comparison).

This repository is powered by **pnpm workspaces**, **Turborepo**, **NestJS + Fastify**, **React + Vite**, and **Prisma 7**.

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
├── docs/
│   └── DEPLOYMENT.md # Production deployment, hardening, and release checklist (see below)
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

## 🔍 Information Capabilities

Beyond the atomic capabilities (one query, one provider-backed result),
Callrack composes existing capabilities into higher-value, provenance-rich
information capabilities — deterministic composition, never an LLM, never
a fabricated fact or citation. All four reuse the exact same underlying
capability *services* (academic/news/knowledge) that back their atomic
counterparts (`apps/api/src/information/`) — never a duplicate HTTP client,
never a second registry.

| Capability | ID | Endpoint | Purpose |
|---|---|---|---|
| Verify | `information.verify` | `POST /v1/verify` | Verify a claim against real evidence and return a deterministic verdict (`supported` / `contradicted` / `mixed` / `insufficient`) with confidence and the evidence itself. |
| Evidence | `information.evidence` | `POST /v1/evidence` | A machine-readable evidence pack for a query — findings with full provenance, never a narrative answer. |
| Compare | `information.compare` | `POST /v1/compare` | Structured comparison across whatever distinct subjects the underlying capabilities actually return — real attribute values, real detected disagreements. |
| Research | `research` | `POST /v1/research` | The original research composition, upgraded: alongside its existing per-source results, it now also returns `findings` (normalized evidence), `disagreements`, and `composition` metadata (which sources succeeded/were empty/failed, and when). |

```bash
curl -X POST https://api.callrack.xyz/v1/verify \
  -H "content-type: application/json" \
  -d '{"claim": "Nigeria is the most populous country in Africa."}'
# → 402 Payment Required (pay, then retry — see the x402 section below)
```

**How `verify` actually works.** It gathers real evidence from academic,
news, and knowledge search (the same composition pattern `research` uses),
then classifies each *relevant* item as affirming or denying the claim
using explainable lexical heuristics — term overlap against the claim's
significant words, and a small set of negation cue words ("debunked",
"denied", "false", ...). This is **not** semantic fact-checking or an LLM
judgment: it is a deterministic, reproducible signal over the evidence
Callrack actually returns, and the API description says so. `sourcesChecked: 0`
(verdict `"insufficient"`) means no relevant evidence was found — never
that the claim is false.

**Never fabricated.** `evidence`/`compare` return empty arrays, not
invented values, when the underlying providers don't have enough
information — the same "no fabrication" rule that already governed
`research`. A `compare` subject with only one attribute, or zero detected
disagreements, is a correct, common result.

All four are configurable via `PRICE_INFORMATION_VERIFY`,
`PRICE_INFORMATION_EVIDENCE`, `PRICE_INFORMATION_COMPARE`, and
`PRICE_RESEARCH` (see `.env.example`) — prices are never hardcoded, and
x402 resolves the exact same registry price automatically for every route.

---

## 💳 x402 Payment Protection

Every paid Callrack capability (academic search/work, news search/trends,
crypto price/market, FX rates, weather, geocode, holidays, knowledge search,
government census, research, verify, evidence, and compare) is protected by the
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

### GoPlausible discovery & merchant metadata

Callrack follows the official
[GoPlausible x402 Facilitator discovery guide](https://facilitator.goplausible.xyz/guide/discovery),
which has two independent layers:

1. **Listing** (how a resource shows up in the Bazaar catalog at all): a
   paid route that declares the `bazaar` extension, publicly reachable, that
   receives a **real, successfully settled payment**. There is no manual
   registration step and no Callrack-side "Bazaar database" — the
   facilitator catalogs the resource itself the first time it settles a
   payment against it. Nothing in this codebase can simulate or fake this;
   see "Local declaration vs. real Bazaar visibility" below.
2. **Enrichment** (optional, free, cosmetic — name/logo/description shown
   next to a listed resource): the facilitator reads the `x402-merchant`
   extension if present, and otherwise falls back to crawling one HTML
   origin for `<meta>` tags and `.well-known` files.

Every paid route declares both extensions, generated from one source (the
Capability Registry) so nothing is hand-maintained per route or can drift:

```text
Capability Registry (id, description, requestSchema, discovery.{input,output})
        ↓
apps/api/src/x402/discovery-schema.util.ts    — reflects the live request DTO
        ↓                                       (the same @ApiProperty decorators
        ↓                                        /docs/json already uses) into JSON
        ↓                                        Schema, dereferencing any
        ↓                                        `$ref`s so each schema is
        ↓                                        self-contained
apps/api/src/x402/discovery-metadata.builder.ts — calls @x402/extensions/bazaar's
        ↓                                          declareDiscoveryExtension(...) and
        ↓                                          merges in the x402-merchant extension
x402 route `extensions` = { bazaar, "x402-merchant" }
```

The registry itself never imports any `@x402/*` package — only the small
adapter in `apps/api/src/x402/` does, keeping capability metadata reusable
even if x402 were replaced later. The Bazaar resource-server extension
(`bazaarResourceServerExtension`) is registered exactly once, in
`x402-resource-server.factory.ts`; each route still declares its own
discovery info.

**`x402-merchant` identity.** Callrack explicitly declares the merchant
extension (`apps/api/src/x402/merchant-extension.builder.ts`) rather than
relying only on HTML crawling, so identity is under explicit, versioned
control:

```json
{
  "x402-merchant": {
    "info": {
      "name": "Callrack",
      "website": "https://callrack.xyz",
      "logo": "https://callrack.xyz/favicon.svg",
      "categories": ["api", "information", "algorand", "x402"]
    },
    "schema": { "...": "JSON Schema describing the info object above" }
  }
}
```

`website` is deliberately `https://callrack.xyz` (the brand/root domain),
**not** `api.callrack.xyz` (where the paid routes actually live) — the guide
resolves the enrichment-crawl origin from `x402-merchant.website` when
present, so this is what points the facilitator's HTML/well-known crawl at
the right place. `apps/web`'s `index.html` carries the corresponding root
page metadata (title, description, `og:*`, `theme-color`, favicon — every
value points at something that actually exists in this repo; nothing is
fabricated), and ships static `.well-known/agent.json`, `llms.txt`, and
`agents.md` files that defer to `api.callrack.xyz` for the live,
never-stale capability list rather than duplicating prices on two domains.

**Discovery files on `api.callrack.xyz`** (`apps/api/src/discovery/`,
registered *before* any SPA fallback so they always return real content,
never `index.html`):

| Path | Content-Type | Purpose |
| --- | --- | --- |
| `/.well-known/x402` | `application/json` | Static x402 discovery document: every paid resource, its network, USDC asset, base-unit amount, and `payTo` — generated from the live registry and active network config, not hand-written |
| `/.well-known/agent-card.json` | `application/json` | A2A-style agent card listing Callrack's real capabilities (research, news, market data, weather, geocoding, knowledge) — never claims Callrack itself is an autonomous agent |
| `/.well-known/agent.json` | `application/json` | Generic manifest: name, description, url, documentation, and the x402/Algorand/USDC payment block |
| `/llms.txt` | `text/plain` | Markdown starting `# Callrack`; explains the pay-per-request model, current capabilities and prices, how to pay, and links to `/openapi.json` and `/agents.md` |
| `/agents.md` | `text/markdown` | Operating instructions for agents already integrating Callrack: the 402 → pay → retry flow, and the rule that a live 402 response is always authoritative over any hardcoded price |
| `/openapi.json` | `application/json` | The same Swagger/OpenAPI document `/docs` renders, at the conventional root path agent tooling looks for — `/docs` is unaffected |

Callrack does **not** publish `.well-known/ai-plugin.json` (no real contact
email exists in project config to put in one — publishing a fabricated
email would be worse than omitting the file) or `.well-known/mcp.json` (no
MCP server exists in this project). Both return a plain 404, not a fake
manifest.

Every paid route's Mainnet payment option also carries the
`x402-global-challenge` tag required by the 2026 Algorand Global x402
Challenge, **only when `NETWORK=mainnet`**, in the route's x402 `extra`
field — Testnet traffic is never part of the competition/leaderboard, so
Testnet routes never carry this tag:

```json
{ "accepts": [{ "...": "...", "extra": { "tag": "x402-global-challenge", "feePayer": "..." } }] }
```

(`feePayer` above is added independently by `@x402/avm`'s own
`ExactAvmScheme` enrichment, not by Callrack — Callrack's `extra.tag` is
merged in alongside it, never overwriting it.)

**Facilitator caching.** The GoPlausible facilitator caches enrichment
results (merchant/root-page/well-known metadata) for **24 hours**. Callrack
does not build any duplicate cache of its own for this — a metadata change
(new logo, new description, edited `llms.txt`) needs no code change on
Callrack's side, but will not be reflected in the facilitator's own catalog
until that cache expires or is manually refreshed from the merchant side.
This repository does not claim metadata updates propagate immediately.

**Local declaration vs. real Bazaar visibility.** Running locally proves the
*declaration* is correct — the 402 response really does carry a valid
`extensions.bazaar` block, a well-formed `x402-merchant` extension, the
Mainnet-only challenge tag, and the right schemas (see
`apps/api/test/x402/x402.e2e.spec.ts` and `apps/api/test/discovery/discovery.e2e.spec.ts`).
It does **not** prove Callrack is listed in the actual GoPlausible Bazaar
catalog — that requires a public HTTPS deployment on Mainnet and a real
settled payment, which is out of scope for this phase. Nothing in this
codebase claims Callrack is currently in the Bazaar catalog.

**Verifying with the GoPlausible x402 Doctor.** Once Callrack is deployed to
a public HTTPS `api.callrack.xyz` (and `callrack.xyz` is live for
enrichment crawling), run the
[GoPlausible x402 Doctor](https://facilitator.goplausible.xyz/guide) against
it to confirm the facilitator actually sees what this README describes:
discovery files return 200 with correct content types, the `bazaar` and
`x402-merchant` extensions parse, CORS headers pass its sanity checks, and
(after a first real settled payment) the resource appears in the Bazaar
catalog. This has not been run yet — there is no public deployment to point
it at — and nothing in this repository claims it has passed.

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
- **CORS** is deliberately open (`origin: true`, no `Access-Control-Allow-Credentials`)
  rather than restricted to a configured allowlist: paid capabilities are
  meant to be called by arbitrary x402 clients/agents, not one fixed browser
  origin, and the API never uses cookies or other credentialed browser auth
  (payment proof travels in a request header). An open origin without
  credentialed CORS is the standard-compliant combination for this shape of
  API, and is what the GoPlausible x402 Doctor's CORS checks expect from a
  public resource server (see `apps/api/test/cors.e2e.spec.ts`).

Current x402 documentation: https://github.com/x402-foundation/x402 (packages
used: `@x402/core`, `@x402/avm`, `@x402/fastify`, all `2.26.0`).

---

## 🚢 Production Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full production
hardening and deployment guide: environment separation, required
production environment variables, Mainnet `payTo`/USDC opt-in validation,
database/Redis production safety, rate limiting, `apps/api/Dockerfile`,
the web production build, backup/rollback procedures, and the release
candidate checklist.

---

## 📜 Development Conventions

1. **TypeScript First**: Strict mode enabled (`noImplicitAny`, `strictNullChecks`).
2. **Explicit Workspace Dependencies**: Internal packages reference each other via `workspace:*`.
3. **Clean Module Boundaries**: Public exports managed through explicit `index.ts` files.
4. **Environment Driven**: No hardcoded credentials or API keys.
