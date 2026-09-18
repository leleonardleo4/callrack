# Callrack Production Deployment

This document covers taking Callrack from a working development setup to a
public, production-hardened deployment, and from there to Mainnet
readiness for the 2026 Algorand Global x402 Challenge. It assumes you've
already read the root `README.md` (local development, x402 configuration,
Bazaar discovery).

No specific hosting platform is wired into this repository — there was
none selected as of this phase, and this document deliberately does not
invent one. `apps/api/Dockerfile` produces a standard container image that
runs on any container host (Railway, Fly.io, Render, a VPS with Docker, a
Kubernetes cluster, etc.); `apps/web` is a static build deployable to any
static host (Vercel, Netlify, Cloudflare Pages, a CDN + object storage,
etc.). Fill in the actual host's specific steps (secrets UI, deploy CLI)
where this document says to.

## Architecture

```text
                Internet
                   |
             HTTPS / DNS
             /           \
            /             \
           v               v
      callrack.xyz     api.callrack.xyz
         Web              API (this Dockerfile)
        (static)            |
                +-----------+-----------+
                |                       |
           PostgreSQL                 Redis
                |
          x402 / GoPlausible facilitator
                |
          External providers (OpenAlex, GDELT, Open-Meteo, ...)
```

The API and web app are separately deployable and separately scalable.
Redis and PostgreSQL are infrastructure the API depends on, never the web
app directly.

## 1. Environment separation

Run three genuinely separate environments — **never share one physical
`.env` file, database, or Redis instance across them**:

| Environment | `NETWORK` | Purpose |
|---|---|---|
| development | `testnet` | Local machine, `docker/docker-compose.yml` infra, placeholder `.env` |
| testnet (staging) | `testnet` | The real deployed API/web, real Testnet payments, used to rehearse the full flow before Mainnet |
| production | `mainnet` | The real deployed API/web, real Mainnet payments, the challenge submission target |

`.env.example` (repo root) is the one template, containing placeholders
only — never commit a real `.env` for any of the three. Each environment's
real configuration lives in that host's own secret store (see below), set
independently. A development machine's `.env` must never be copied onto a
testnet or production host, and the testnet deployment's configuration
must never be reused for production (different `DATABASE_URL`, `REDIS_URL`,
and critically, `NETWORK`/`MAINNET_PAY_TO` — see §3).

## 2. Required production environment variables

Every variable below is validated at API startup (`ApiConfigService`,
`X402ConfigService`, `PricingConfigService`) — a missing or malformed value
fails startup immediately with a clear error, never a customer's first
request.

| Variable | Required in production? | Notes |
|---|---|---|
| `NODE_ENV` | Yes | `production` |
| `DATABASE_URL` | Yes | Append `?sslmode=require` if the provider needs TLS |
| `DATABASE_POOL_MAX` | No (default `10`) | Lower for a small-plan Postgres with multiple replicas |
| `REDIS_URL` | Yes | Use `rediss://` for TLS |
| `API_PORT` | No (default `3000`) | |
| `API_PREFIX` | No (default `v1`) | |
| `TRUST_PROXY` | No (default `true`) | Set `false` only if the API is NOT behind a reverse proxy |
| `BODY_LIMIT_BYTES` | No (default `1048576`) | |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | No (defaults `300` / `60000`) | Per-client-IP, see §"Rate limiting" |
| `NETWORK` | Yes | `testnet` for staging, `mainnet` for production |
| `MAINNET_PAY_TO` | Yes, when `NETWORK=mainnet` | See §3 |
| `MAINNET_FACILITATOR_URL` | Yes, when `NETWORK=mainnet` | `https://facilitator.goplausible.xyz` |
| `TESTNET_PAY_TO` / `TESTNET_FACILITATOR_URL` | Yes, when `NETWORK=testnet` | |
| `PRICE_*` (13 vars) | Yes | Every paid capability's price — see root `.env.example` |
| Provider vars (`OPENALEX_MAILTO`, `COINGECKO_API_KEY`, etc.) | No | Optional; see root `.env.example` |
| `VITE_API_BASE_URL` (web, build-time) | Yes | `https://api.callrack.xyz` for a production web build |

**Secrets management.** Set these through the hosting platform's own
secret/environment-variable store (every mainstream host — container
platforms and static hosts alike — has one), never by committing a file or
baking them into the Docker image. The API resource server never needs a
signing key (see §"Mainnet wallet readiness" — it only ever *receives*
payments), so there is no private key to manage server-side at all.

## 3. Mainnet `payTo` validation

Before any Mainnet deployment, confirm `MAINNET_PAY_TO`:

- Is a structurally valid Algorand address (`X402ConfigService` already
  rejects a malformed one at startup via `@x402/avm`'s
  `isValidAlgorandAddress`).
- Is controlled by the project (a wallet you/the team actually hold keys
  to — this API never holds or needs that key itself).
- Is **not equal to `TESTNET_PAY_TO`** — `x402.schema.ts`'s validation now
  fails startup if both are set and identical, specifically to catch a
  copy-paste mistake here.
- Is intended to remain stable — every Composite (research) and atomic
  route reads the same `payTo` from this one value, so rotating it
  mid-competition would split settlement volume across two addresses.
- Is not generated or rotated automatically by anything in this
  repository — nothing here creates or changes this address. It's an
  operational choice made once, outside the codebase.

## 4. Mainnet USDC opt-in (operational checklist item)

Before Mainnet traffic can settle, `MAINNET_PAY_TO` must be opted in to
**USDC ASA `31566704`** on Algorand Mainnet. This is a real on-chain
transaction from that address's own wallet (an asset-opt-in transaction),
done once, outside this codebase — nothing in the API attempts this
automatically at startup or ever. If the address is not opted in,
**production payment settlement is blocked**: a real payer's payment
transaction (an asset transfer to an unopted-in account) will fail
on-chain even though the x402 handshake itself completed correctly.
Verify opt-in status with any Algorand block explorer (e.g. Pera Explorer,
AlgoExplorer) before going live.

## 5. Testnet configuration

- Network: `ALGORAND_TESTNET_CAIP2` / the genesis-hash form Callrack
  actually uses (`X402ConfigService`) — resolved automatically from
  `NETWORK=testnet`, never hand-rolled.
- Asset: USDC ASA `10458941`, resolved automatically by `@x402/avm`.
- `TESTNET_PAY_TO` must be: funded with test ALGO (for the account to
  exist/pay fees), opted in to Testnet USDC, and — to actually verify
  *receiving* payments end-to-end — it's the payer's Testnet account that
  additionally needs test USDC, not the receiving `payTo` itself (the
  receiving address only needs the opt-in, not a balance).
- Get test ALGO from the [Testnet dispenser](https://bank.testnet.algorand.network/)
  and Testnet USDC from a Testnet USDC faucet, for whichever account is
  acting as the *payer* in your verification run.

## 6. x402 configuration audit

`apps/api/src/x402/x402-route-config.builder.ts` is the single place
capability metadata becomes x402 route configuration — every paid route is
generated from the same Capability Registry entry and the same
`ActiveX402NetworkConfig`, so method/path/price/network/asset/`payTo` can
never drift per-route. Concretely, for every paid route:

- **Method/route/price**: read from `capability-definitions.ts`, the one
  authoritative list (see root README's "Database & Cache Architecture"
  section for how this stays in sync with `/v1/capabilities`).
- **Network/asset/`payTo`/facilitator**: read from `X402ConfigService`'s
  `activeNetworkConfig` — one value, shared by every route, for whichever
  `NETWORK` is active. A Testnet-configured deployment structurally cannot
  emit a Mainnet `payTo` or vice versa, because there is only one
  `active.payTo` in memory for the process's entire lifetime.
- **`bazaar` extension**: attached via `discoveryExtensions`
  (`discovery-metadata.builder.ts`), generated from the same registry
  entry's `discovery` block plus the live request JSON Schema — see root
  README's "GoPlausible discovery & merchant metadata" section for the
  full pipeline.
- **`x402-merchant` extension**: attached the same way, from
  `merchant-extension.builder.ts` — fixed to `https://callrack.xyz`.
- **Challenge tag**: see §7.

Verified by `apps/api/test/x402/x402.e2e.spec.ts` and
`apps/api/test/discovery/discovery.e2e.spec.ts` (mocked facilitator, real
resource server / route config / discovery code).

## 7. Mainnet challenge tag

`X402_GLOBAL_CHALLENGE_TAG = 'x402-global-challenge'`
(`x402-route-config.builder.ts`) is merged into each route's
`accepts.extra.tag` — **only when `active.network === 'mainnet'`**. This is
in the payment-requirement `extra` field the x402 scheme actually signs
over, not the Bazaar/`x402-merchant`/`.well-known` metadata layers, and not
anywhere in API response bodies — exactly the structure the prompt
requires and nowhere else. A Testnet-configured deployment (`NETWORK=testnet`)
never adds this key at all; there is no separate "competition mode" flag to
forget to turn off.

## 8. Database production safety

- **Migrations**: production must run `pnpm --filter @callrack/db run db:migrate:deploy`
  (`prisma migrate deploy`) — applies existing, already-committed
  migrations only. **Never** run `db:migrate` (`prisma migrate dev`,
  interactive, can create new migrations) or `db:push` (schema sync with
  no migration history) against a production database.
- The API itself never runs a migration at startup — `DatabaseService`
  only connects; nothing in `onModuleInit` mutates schema. Migrations are a
  distinct deploy step (see §"Deployment steps", step 5), which must
  complete *before* new API instances expecting the new schema start
  receiving traffic.
- **Concurrency**: run the migration step exactly once per deploy, from a
  single release/migration job or the deploy pipeline itself — never from
  every replica's own startup. If your platform has a dedicated
  release/migration command (Railway's release command, a Kubernetes
  `Job`/init container, etc.), use that instead of a plain replica
  hook. Prisma's migration history table makes a second, redundant
  `migrate deploy` a safe no-op, but two migrations racing to *apply a new*
  migration concurrently is not something to rely on being safe.
- **Failure visibility**: `prisma migrate deploy` exits non-zero on
  failure — wire the deploy pipeline to stop (not proceed to start new API
  instances) if this step fails.
- **Connection pooling**: `packages/db/src/index.ts` sizes its `pg.Pool`
  from `DATABASE_POOL_MAX` (default 10) — see §2.
- **SSL/TLS**: configured via `DATABASE_URL`'s `sslmode` query parameter
  (see §2), which `pg` parses automatically — no code change needed per
  provider.

## 9. Database backup strategy

This repository does not implement a custom backup system — use whatever
automated backup mechanism your chosen managed Postgres provider already
offers (nearly every one does: point-in-time recovery, daily snapshots,
etc.), and **document and verify it's actually enabled** for the
production database specifically (not just available on the plan):

- **Provider**: (fill in once a host is chosen — e.g. "Neon: 7-day PITR",
  "Railway Postgres: daily snapshot", "RDS: automated backups + PITR").
- **Frequency**: whatever the provider's automated backup performs (daily
  snapshot and/or continuous WAL-based PITR).
- **Retention**: match the provider's default unless the competition or
  operational needs require longer.
- **Restore procedure**: use the provider's own restore flow (typically:
  create a new instance from a snapshot/point-in-time, verify it, then
  repoint `DATABASE_URL` at it — Callrack's schema/data is small
  (`Capability`/`Provider`/`Request` — analytics only, never payment state;
  see §"Rollback"), so a restore is low-risk to application behavior.
- **Recovery expectation**: the `Request`/`Capability`/`Provider` tables
  are usage analytics, not the source of truth for payments (x402/the
  Algorand chain is) or capability configuration (the registry in code
  is) — losing recent rows to a restore point loses historical analytics,
  never live functionality or payment correctness.

## 10. Redis production safety

- **Authentication/TLS**: both configured via `REDIS_URL` itself
  (`rediss://user:password@host:port` — ioredis parses `rediss://` as TLS
  automatically; see §2). Never expose Redis on a public port without
  authentication.
- **No persistent business data**: `RedisService`/`CapabilityCacheService`
  use Redis only for response caching (see root README) — nothing here
  treats Redis as a system of record. Losing all Redis data only costs a
  round of cache misses, never correctness.
- **Connection retry**: `ioredis`'s own default reconnect/retry strategy is
  used (`packages/redis/src/client.ts`); `maxRetriesPerRequest: 3` bounds
  how long a single command waits during an outage rather than hanging.
- **Fail-open behavior**: `CapabilityCacheService` and rate limiting (see
  below) both treat a Redis error as "proceed without it" — a Redis outage
  degrades the API (no caching, rate limits per-instance instead of
  global) rather than taking it down. Verified locally by starting the
  packaged production build with no Redis reachable at all: the API still
  served `/health` `200`, real capability responses, and correctly
  reported `/health/ready` as `503` (Redis down) the whole time.
- **Graceful shutdown**: `RedisService.onModuleDestroy` disconnects
  cleanly; see §15.

## 11. API security

Already in place, audited this phase:

- Global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`) —
  every capability request body is validated against its DTO; unknown
  fields are rejected, not silently dropped or passed through.
- `@fastify/helmet` security headers (`X-Content-Type-Options`,
  `X-Frame-Options: sameorigin`; CSP disabled specifically so Swagger UI's
  own inline scripts still load at `/docs`).
- `ApiExceptionFilter` never leaks a stack trace, raw provider response, or
  database/Redis error text in production (`isProduction` branch reduces
  every uncaught error to a generic message; `stack`/`details` are only
  attached outside production) — always includes the request ID.
- No debug/internal/admin routes exist in `apps/api/src` (audited via
  `@Controller`/`@Get`/`@Post` grep across the whole source tree).
- Request body size capped (`BODY_LIMIT_BYTES`, default 1 MiB).
- `TRUST_PROXY` correctly configures Fastify to honor `X-Forwarded-*` from
  a real reverse proxy — needed for both correct per-IP rate limiting and
  `resolveRequestOrigin`'s `.well-known/x402` resource URLs once deployed
  behind one.
- No authentication system was added — the product is deliberately
  unauthenticated-but-paid (x402 payment proof *is* the access control);
  adding accounts/API keys would be a product change out of this phase's
  scope.

## 12. Rate limiting

`@fastify/rate-limit`, registered globally in `bootstrap.ts`:

- **Limit**: `RATE_LIMIT_MAX` requests per `RATE_LIMIT_WINDOW_MS`, per
  client IP (`request.ip`, correct once `TRUST_PROXY` is honored behind a
  real proxy). Defaults: **300 requests / 60 seconds**.
- **Store**: Redis-backed (shared across replicas) when reachable;
  `skipOnError: true` means a Redis outage fails *open* (requests proceed
  unlimited) rather than taking the API down.
- **Exempt**: `/health` and `/health/ready` (`allowList`), so orchestrator
  liveness/readiness polling is never throttled.
- **Paid (x402) requests are not exempted or given a separate budget**: the
  per-request USDC cost already deters abusive volume far more than a
  request-count limit could; one shared budget is simpler than a second
  policy layer. 300/min comfortably covers legitimate agent/client usage
  while still bounding worst-case unpaid-402-probe volume.
- Verified locally: a request to `/v1/capabilities` returns
  `x-ratelimit-limit`/`x-ratelimit-remaining`/`x-ratelimit-reset` headers;
  a request to `/health` does not.

## 13. Provider protection

Already in place (`apps/api/src/providers/common/`), audited this phase:

- **Timeout**: `ProviderHttpClient`, default 10s per request
  (`AbortController`-based, per-adapter configurable).
- **Retry**: `withRetry`/`RetryPolicy` — bounded (default 2 retries, so 3
  attempts total), exponential backoff capped at 2s, `Retry-After` header
  honored when present, and only for errors classified as transient
  (`isRetryableProviderError`) — never retries a 4xx/malformed-request
  failure.
- **Failure isolation**: each provider adapter's failure becomes a
  `ProviderError` mapped to a safe HTTP status (502/503/etc.) for that one
  capability's response; nothing in this path can crash the process or
  affect an unrelated capability.
- **Cache**: `CapabilityCacheService`, per-capability TTL, Redis-backed,
  fails open on a Redis error (see §10).

## 14. Web fetch / SSRF review

Callrack does not expose any capability or endpoint that fetches an
arbitrary, caller-supplied URL. Every provider adapter
(`apps/api/src/providers/*/*.provider.ts`) calls one fixed,
server-configured base URL (`OPEN_METEO_BASE_URL`, `PHOTON_BASE_URL`,
`WIKIMEDIA_BASE_URL`, or a hardcoded provider API root) with a
capability-specific path/query built from validated request DTO fields —
never a caller-provided URL or hostname. There is no "fetch this webpage"
or generic URL-extraction capability in this product. SSRF-hardening
controls (private-IP/localhost blocking, protocol restriction, redirect
limits, DNS-rebinding mitigation) are therefore not applicable today; this
is a property to re-audit if a future phase ever adds a capability that
accepts a URL as input.

## 15. Graceful shutdown

`apps/api/src/bootstrap.ts`'s `bootstrap()` (the real process entrypoint;
not `createApp()`/`createProtectedApp()`, which the test suite also calls
many times per run and must not accumulate signal listeners) calls
`app.enableShutdownHooks()`. On `SIGTERM` (or `SIGINT`), NestJS:

1. Stops Fastify from accepting new connections and lets in-flight
   requests finish (Fastify's own `close()` behavior).
2. Calls `onModuleDestroy` on every provider — `DatabaseService` calls
   `this.client.$disconnect()` (Prisma), `RedisService` calls
   `this.client.disconnect()` (ioredis).
3. Exits the process.

This is standard, source-verified NestJS behavior
(`@nestjs/core`'s `listenToShutdownSignals`) — not something this repo
reimplements. **Not independently re-verified end-to-end in this session**:
Windows has no real `SIGTERM` semantics to test with (`Stop-Process`
performs an abrupt `TerminateProcess`, not a signal delivery), so this can
only be meaningfully exercised inside the Linux container the Dockerfile
actually targets, or on a Linux deployment host directly — do this once a
real deployment exists (`docker run --rm callrack-api & sleep 2 && docker kill -s TERM <id>`,
confirm the container logs a clean shutdown and exits promptly rather than
being killed by Docker's SIGKILL timeout).

## 16–17. Health / readiness

Unchanged this phase — already correct:

- `GET /health`: liveness only, independent of Postgres/Redis (so
  orchestration can always tell the process is alive even mid-outage).
- `GET /health/ready`: `200` only when both Postgres and Redis are
  reachable (`HealthService.getReadiness`); `503` otherwise, with
  `{ checks: { database, redis } }` — `"ok"`/`"down"` only, never a
  connection string or credential.
- **Verified locally** (packaged production build, no Postgres/Redis
  running): `/health` → `200 {"status":"ok",...}`; `/health/ready` → `503`.

## 18. Structured logging

`AppLoggerService` emits single-line JSON in production
(`{timestamp, level, requestId, context, message, data}`); human-readable
lines in development. `HttpLoggingInterceptor` logs
`METHOD url → status → duration [requestId]` for every request.
`RequestTrackingService` separately persists capability/provider/status/
duration/cache-hit per request to Postgres for analytics (see root
README's "Database & Cache Architecture") — that table is where
capability/provider/network-level observability actually lives, rather
than duplicating it into every stdout line. Nothing in this pipeline logs
a mnemonic, private key, payment signature, authorization secret, provider
API key, or full request body — confirmed by reading every logging call
site plus the secrets grep in §36.

## 19. Error handling

`ApiExceptionFilter` (unchanged, audited this phase) maps every thrown
error to `{ error: { code, message, details? }, meta: { requestId } }`
with the correct status, and specifically never leaks a stack trace,
database/Redis error text, or internal hostname in production. x402's own
`402` responses, `429` from rate limiting, and `502`/`503` from provider
failures all flow through the same safe shape. The request ID is always
present in both the response body and the `X-Request-ID` header, in every
case, including a fully unhandled 500.

## 20. CORS

CORS is deliberately **open** (`origin: true`, no
`Access-Control-Allow-Credentials`) — this is an intentional, documented
architectural decision from Phase 7, not an oversight to "fix" here.
Callrack's paid capabilities are called by arbitrary x402 clients/agents,
not one fixed browser origin, and the API never uses cookies or other
credentialed browser auth (payment proof travels in a request header).
Restricting `origin` to an allowlist would break legitimate cross-origin
callers — including the GoPlausible x402 Doctor's own CORS checks —
without protecting anything a credential-free, payment-gated API needs
protected. See `apps/api/src/bootstrap.ts`'s own CORS comment and
`apps/api/test/cors.e2e.spec.ts`.

## 21. HTTPS

Both `callrack.xyz` and `api.callrack.xyz` must be served over HTTPS with
a valid certificate (any modern host/CDN issues one automatically — Let's
Encrypt via the platform, or the platform's own managed cert). Configure
an HTTP → HTTPS redirect at the edge (host/CDN level, not application
code). The web app must only ever call `https://api.callrack.xyz` (set via
`VITE_API_BASE_URL` at build time, see §23) — never mixed content, never a
plain-HTTP API call from an HTTPS page. Do not expose PostgreSQL or Redis
directly to the public Internet; they should only be reachable from the
API's own network/VPC.

## 22. Docker / production image

`apps/api/Dockerfile` — multi-stage (`turbo prune` → install/build →
minimal Alpine runtime), non-root (`callrack` user, uid/gid 1001), no
dev dependencies in the runtime stage, a `HEALTHCHECK` using Node's
built-in `fetch` against `/health` (no extra HTTP client added to the
image just for this), and an exec-form `CMD` so Node is PID 1 and receives
`SIGTERM` directly (required for §15's graceful shutdown to actually
fire). Build from the **monorepo root** as context:

```bash
docker build -f apps/api/Dockerfile -t callrack-api .
docker run --rm -p 3000:3000 --env-file .env callrack-api
```

Every build step (the `turbo prune` command sequence, the
`--ignore-scripts` dependency layer, `prisma generate`, the build, and the
final `--prod` reinstall) was manually replicated and verified working
outside Docker in this session — including starting the resulting
`apps/api/dist/main.js` with only production dependencies present and
confirming `/health`, `/health/ready`, `/.well-known/x402`, `/llms.txt`,
`/openapi.json`, and an unpaid `POST /v1/weather` (→ `402`) all behaved
correctly. **The actual `docker build`/`docker run` were not executed in
this session** — the Docker daemon was not available in this sandbox
(Docker Desktop's daemon did not come up). `apps/api/Dockerfile` is
additionally built (not run) on every push/PR via CI (see §27) — treat the
first real `docker build` + `docker run` against a live Postgres/Redis as
an outstanding verification step before relying on it for a real
deployment.

`apps/web` has no Dockerfile — it's a static build (see §23), deployed to
a static host, not containerized.

## 23. Web production build

```bash
VITE_API_BASE_URL=https://api.callrack.xyz pnpm --filter @callrack/web build
```

- `apps/web/src/config/env.ts` reads `VITE_API_BASE_URL` at build time;
  falls back to `http://localhost:3000` only when unset (dev).
- No other `VITE_`-prefixed variable exists in this codebase, and none is
  needed — there is no private API key or wallet secret to accidentally
  expose (remember: anything `VITE_`-prefixed ships in the public bundle).
- `og:url`/canonical metadata already point at `https://callrack.xyz`
  (`index.html`); no hardcoded `localhost` reference outside the
  documented dev-only fallback above.
- Output is a static `dist/` directory — deploy it as-is to any static
  host.

## 24. Static discovery files

Served by the **API** (`api.callrack.xyz`), registered before any SPA
fallback so they always return real content:

| Path | Content-Type |
|---|---|
| `/.well-known/x402` | `application/json` |
| `/.well-known/agent-card.json` | `application/json` |
| `/.well-known/agent.json` | `application/json` |
| `/llms.txt` | `text/plain` |
| `/agents.md` | `text/markdown` |
| `/openapi.json` | `application/json` |

Also served by the **web app** as physical static files
(`apps/web/public/`) for `callrack.xyz`-domain enrichment crawling:
`.well-known/agent.json`, `llms.txt`, `agents.md`, favicon. Verified
locally (packaged production API build) that all six API-side paths above
return `200` with the documented content type. Most static hosts serve a
real file before falling back to the SPA's `index.html`, so this is
typically automatic — **re-verify this specifically** once `callrack.xyz`
is deployed to whichever static host is chosen (fetch each path and
confirm it's the real file, not `index.html`).

## 25. Production API docs

`/docs` (Swagger UI) and `/openapi.json` are left publicly accessible —
this is a public, unauthenticated, pay-per-request API; the documentation
describing it is not sensitive, and hiding it would only hurt legitimate
agent/developer discovery. Swagger UI shows only what `@ApiOperation`/
`@ApiResponse` decorators declare on real, public routes — no internal
debug information is exposed through it (audited this phase).

## 26. Observability

Structured JSON logs (§18) plus whatever platform-level monitoring your
host provides (most container hosts surface request count, error rate,
CPU/memory, and restart count out of the box) is the accepted baseline for
this phase — no dedicated dashboard was built. At minimum, once deployed,
watch: `/health`/`/health/ready` status over time, error-rate from
`ApiExceptionFilter`'s logged 5xx/502/503s, and 402 vs. 200 response
counts on paid routes (visible in `HttpLoggingInterceptor`'s log lines and
the `Request` table). No private payment data (amounts tied to a specific
payer identity beyond what's already public on-chain) is exposed by any of
this.

## 27. CI/CD

`.github/workflows/ci.yml`:

- **`verify`** (push + PR to `main`): install → generate Prisma client →
  `migrate deploy` against a CI Postgres → lint → typecheck → test → build.
  Merging is blocked if any step fails (standard GitHub branch-protection
  behavior — enable "require status checks to pass" on `main` if not
  already).
- **`docker-build`** (push + PR, after `verify`): builds
  `apps/api/Dockerfile` (no push/registry) to catch a Dockerfile
  regression before merge.
- **`deploy`** (manual `workflow_dispatch` only — **never** on push/PR):
  requires selecting `testnet` or `production`, which maps to a GitHub
  Environment of the same name. Configure each Environment (repo Settings
  → Environments) with its own secrets and, for `production`, required
  reviewers, so a Mainnet deploy needs an explicit human approval on top
  of picking the right dropdown value. The job currently exits 1 with an
  explanatory message — replace its placeholder step with the chosen
  host's real deploy command (and the migration-release step from §8)
  once a platform is selected. This structure makes it structurally
  impossible for a routine push/PR merge to trigger any deployment, let
  alone one with Mainnet configuration.

## 28. Database migration deployment

Covered in §8 — the short version: `prisma migrate deploy`, as its own
pipeline/release step, once per deploy, before new instances start, never
`migrate dev`/`db push` in production, never from every replica.

## 29–30. Deployment steps

1. **Build**: `pnpm install && pnpm build` (or `docker build -f apps/api/Dockerfile -t callrack-api .`
   for the API specifically); `VITE_API_BASE_URL=https://api.callrack.xyz pnpm --filter @callrack/web build`
   for web.
2. **Configure secrets**: set every variable in §2's table in the target
   environment's secret store (host's dashboard/CLI, or the GitHub
   Environment's secrets for the `deploy` workflow).
3. **Configure database**: provision managed Postgres; set `DATABASE_URL`
   (with `sslmode` if required); confirm automated backups are enabled
   (§9).
4. **Configure Redis**: provision managed Redis; set `REDIS_URL`
   (`rediss://` if TLS-capable); confirm it's not publicly reachable
   without auth.
5. **Run migrations**: `pnpm --filter @callrack/db run db:migrate:deploy`
   against the target `DATABASE_URL`, as a distinct step before step 6.
6. **Start API**: deploy `apps/api/Dockerfile`'s image (or
   `node apps/api/dist/main.js` directly on a host that isn't
   container-based) with the environment from step 2.
7. **Deploy web**: upload `apps/web/dist/` to the static host.
8. **Configure DNS**: point `callrack.xyz` at the web deployment,
   `api.callrack.xyz` at the API deployment.
9. **Configure HTTPS**: issue/attach certificates for both domains (§21).
10. **Verify health**: `curl https://api.callrack.xyz/health` and
    `/health/ready` both return as expected.
11. **Verify discovery files**: all six paths in §24 return `200` with the
    right content type, and are the real file, not the SPA fallback.
12. **Verify x402**: an unpaid `POST` to any paid route returns `402` with
    a valid `PAYMENT-REQUIRED` header/body.
13. **Verify Testnet**: see §31.
14. **Prepare Mainnet**: see §34–35.

## 31. Testnet production-like verification

**Not executed against a public deployment in this session** — there is
no public HTTPS deployment yet, and this phase did not create one (out of
scope; see §42 in the phase spec). What *was* verified, against a locally
packaged, production-mode build of the exact same code
(`NODE_ENV=production`, only production dependencies installed, no
Postgres/Redis running to prove fail-safe behavior):

- `GET /health` → `200`.
- `GET /health/ready` → `503` (Postgres/Redis both down, as expected).
- `GET /.well-known/x402`, `/llms.txt`, `/openapi.json` → `200`, correct
  content types.
- `POST /v1/weather` (unpaid) → `402`.
- Rate-limit headers present on `/v1/capabilities`, absent on `/health`.

**Still required before Mainnet** (needs a real deployment + funded
Testnet account, neither available in this session): the full
`unpaid → 402 → sign → retry → 200` round trip against the *deployed* API
for `/v1/weather`, `/v1/academic/search`, and `/v1/research`, confirming
payment asset/amount/`payTo`/settlement/cache/provider execution/response/
request ID all match expectations. The existing
`apps/api/test/x402/testnet-smoke.ts` (`pnpm --filter @callrack/api run test:x402:testnet`)
and `packages/sdk/test/testnet-smoke.ts`
(`pnpm test:agent:testnet`) already implement this flow end-to-end against
whatever `CALLRACK_API_URL`/`TESTNET_TEST_PAYER_PRIVATE_KEY`/`AVM_MNEMONIC`
you point them at — run either against the real deployed Testnet URL once
it exists, with a funded Testnet test account, as the very next step.

## 32. GoPlausible Doctor

**Not run.** There is no public HTTPS deployment for it to inspect yet.
Do not claim this has passed until it has actually been run against a
live `api.callrack.xyz` (and `callrack.xyz` reachable for enrichment
crawling) — see root README's own "Verifying with the GoPlausible x402
Doctor" section, which states the same thing.

## 33. Bazaar discovery readiness

Every paid route already declares the `bazaar` extension (§6) — nothing
further to configure. Per the GoPlausible discovery guide: `bazaar`
extension + a real, successfully settled payment = automatic cataloging.
There is no manual registration step, and nothing in this codebase can
simulate real Bazaar visibility locally (see root README's "Local
declaration vs. real Bazaar visibility").

## 34. Mainnet dry run

Configuration-only validation (no real transaction), performed by reading
`X402ConfigService`'s resolution logic and its test coverage
(`apps/api/test/x402-config.service.spec.ts`, `apps/api/test/x402.schema.spec.ts`):
setting `NETWORK=mainnet` with a valid `MAINNET_PAY_TO`/
`MAINNET_FACILITATOR_URL` resolves `ALGORAND_MAINNET_GENESIS_HASH`'s CAIP-2
form, and `@x402/avm`'s `getDefaultAsset` resolves USDC ASA `31566704`
automatically for that network — both by the same code path already
exercised for Testnet, not a separate Mainnet-only implementation. Every
paid route uses the one resolved `active.payTo` (§6) — structurally, no
route can diverge. **Not run against a real deployment** in this session
(no Mainnet facilitator round trip was made, and none should be until
§35's checklist is fully satisfied) — no real Mainnet transaction was
executed, intentionally.

## 35. Mainnet wallet readiness checklist

```text
[ ] MAINNET_PAY_TO is controlled by the project
[ ] MAINNET_PAY_TO is opted in to USDC ASA 31566704
[ ] MAINNET_PAY_TO has sufficient ALGO for transaction fees
[ ] The receiving address has been double-checked character-for-character
[ ] The same MAINNET_PAY_TO is used by every Composite route (structurally
    guaranteed by x402-route-config.builder.ts — nothing to configure per
    route, but worth confirming after any future refactor)
[ ] MAINNET_PAY_TO is intended to remain stable for the whole competition
```

All of the above are operational/wallet-custody actions outside this
codebase — none are checked off by this phase, since none can be verified
without a real, project-controlled Mainnet wallet, which this session does
not have access to. **No private signing key belongs in the server
environment**: this API only ever receives payments (§2); a payer's own
client/wallet does the signing, never this server.

## 36–37. Secrets and dependency audit

See the Phase 11 commit's own report for the actual grep results and
`pnpm audit` output — summarized:

- No mnemonic, private key, seed phrase, password, or provider secret is
  committed anywhere in the repository (`.env` is git-ignored;
  `.env.example`/this document contain placeholders only).
- Web production bundle (`apps/web/dist`) contains only
  `VITE_API_BASE_URL` (a public URL, not a secret) baked in — no API key
  or wallet material.
- `pnpm audit` findings (if any) and dependency-upgrade decisions are
  recorded in the commit report, not duplicated here to avoid drifting out
  of date.

## 38. Performance

Measured locally against the compiled production build
(`apps/api/dist`), no Postgres/Redis reachable (both were unavailable in
this sandboxed session — see §22/§31), single machine, real outbound calls
to the actual public providers. Not representative of real network latency
between a deployed host and these providers, and not a substitute for
measuring against the real deployment once one exists, but real numbers
for this machine's network path:

- **`POST /v1/weather`** (real Open-Meteo call, no cache): first request
  **792ms**, three subsequent identical requests **161ms / 164ms / 180ms**.
  The ~600ms gap on the first request is DNS resolution + TCP/TLS
  handshake + V8 warmup, not steady-state overhead — once warm, Callrack's
  own overhead plus Open-Meteo's real response time is consistently
  ~160-180ms.
- **`POST /v1/academic/search`**: one real OpenAlex call observed at
  **3268ms**; a second identical call was cut off after 60+ seconds with
  no result, which is real, externally-observed OpenAlex/network
  variability from this sandbox, not a Callrack-side hang (the same
  request path has bounded timeouts/retries — see §13 — and the process
  itself remained responsive throughout, per its own logs). **Not
  reliably measurable from this sandboxed environment in the time
  available**; re-run once a real deployment exists, where network
  conditions to OpenAlex will differ.
- **`/v1/news/search`, `/v1/research`**: not completed — deprioritized
  once `/v1/academic/search`'s variability made clear that the limiting
  factor was this sandbox's network path to third-party APIs, not
  application code worth re-measuring here.
- **Cached latency**: not measured — no Redis was reachable in this
  session (§10). `CapabilityCacheService` and its TTLs are unchanged this
  phase and already covered by `apps/api/test/common/cache/capability-cache.service.spec.ts`;
  measure a real cache hit once a deployment has working Redis.
- **x402 overhead**: not isolated from provider latency this phase (would
  need a funded Testnet payer — see §31); the x402 middleware itself does
  no I/O for an *unpaid* request beyond the 402 response, which was
  consistently fast in every manual check in this session (well under
  50ms to produce the 402 body).

## 39. Failure testing

Verified this phase, against the actual compiled production build
(`node apps/api/dist/main.js`, `NODE_ENV=production`):

- **Redis unreachable at startup and throughout**: API still starts,
  `/health` stays `200`, `/health/ready` correctly reports `503`,
  capability responses still succeed (cache simply always misses) — this
  is also what surfaced this phase's one real bug (see the commit report):
  the rate limiter's Redis client originally used ioredis's default
  offline-queueing, which made every request wait through reconnect
  retries while Redis was down instead of failing open. Fixed in
  `packages/redis/src/client.ts` (`enableOfflineQueue: false`) and
  reverified — `pnpm test` for `apps/api` went from 16 failing/timing-out
  tests back to all 592 passing once fixed.
- **Postgres unreachable**: same — `/health/ready` `503`,
  `RequestTrackingService` logs a warning and drops the tracking write
  rather than failing the capability response (observed directly in this
  session's manual checks: `Invalid prisma.capability.upsert() invocation`
  logged as a warning, `POST /v1/weather` still returned `200`).
- **Unpaid request to a paid route**: `402`, never a false `200`.
- **Malformed JSON body, wrong field types, and an invalid
  `PAYMENT-SIGNATURE` header** (all manually checked against the live
  packaged build): all three returned `402`, not a `500` or a bypassed
  request — x402 checks for a valid payment before the request ever
  reaches DTO validation, so an unpaid malformed request gets the same
  402 an unpaid well-formed request would, never a stack trace.
- **Unknown route**: `404`, clean `{error: {code, message}, meta: {requestId}}`
  envelope, request ID present in both the body and the
  `X-Request-ID` header.

Not independently re-simulated this phase (already covered by existing,
passing test suites — see `apps/api/test/providers/provider-http-client.spec.ts`,
`apps/api/test/error-handling.e2e.spec.ts`, and the provider-level specs
under `apps/api/test/providers/`): provider timeout, provider 429,
facilitator unavailable, invalid payment, malformed request.

## 40. Rollback

- **Application/API rollback**: redeploy the previous known-good image tag
  (or previous commit's build) — the API is stateless aside from its
  database/Redis connections, so rolling back the running process is safe
  at any time.
- **Web rollback**: redeploy the previous static build output — most
  static hosts keep prior deployments and support an instant revert.
- **Disable a problematic capability**: set that capability's
  `PRICE_*` env var aside won't remove the route; the cleanest immediate
  mitigation without a code change is to roll back the API deployment to a
  prior version, or route that capability's path away at the reverse
  proxy/CDN layer if the host supports it. There is no per-capability
  feature flag in this codebase today.
- **Restore database from backup**: use the provider's own restore flow
  (§9) — creates a new instance from a snapshot; repoint `DATABASE_URL`
  once verified.
- **Rotate compromised credentials**: rotate the specific credential at
  its source (Postgres password, Redis password/token, provider API key)
  in the host's secret store, then redeploy the API so it picks up the new
  `DATABASE_URL`/`REDIS_URL`/`*_API_KEY` — no code change needed since
  every credential is read from environment configuration, never
  hardcoded. A compromised `MAINNET_PAY_TO`/signing situation does not
  apply — this server never holds a signing key (§2, §35).
- **Do not** automatically roll back a database migration — none of the
  migrations in `packages/db/prisma/migrations` are written as reversible
  down-migrations; a bad migration is fixed forward (a new migration) or
  by restoring from backup, never by an automatic down-migration.

## 41. Release candidate checklist

```text
[x] Production build passes (pnpm build, verified this phase)
[x] API deployable (apps/api/Dockerfile, build steps verified outside Docker)
[x] Web deployable (static build, verified this phase)
[x] PostgreSQL configured (pooling, SSL via DATABASE_URL, documented)
[x] Redis configured (TLS via REDIS_URL, fail-open behavior verified)
[x] Migrations safe (migrate deploy only, documented, CI-tested)
[ ] HTTPS configured (no live deployment yet)
[ ] DNS configured (no live deployment yet)
[x] CORS configured (intentionally open, documented rationale)
[x] Rate limiting configured (implemented and verified this phase)
[x] Security headers configured (helmet, pre-existing, audited)
[x] Secrets audited (this phase — see commit report)
[x] Logs audited (this phase — see commit report)
[x] Health checks work (verified this phase, packaged build)
[x] Readiness checks work (verified this phase, packaged build)
[x] Discovery files work (verified this phase, packaged build)
[x] OpenAPI works (verified this phase, packaged build)
[x] x402 works (verified this phase, packaged build — unpaid request returns 402)
[ ] Testnet payment works (needs a live deployment + funded Testnet account)
[ ] GoPlausible Doctor checked (needs a live deployment)
[x] Mainnet configuration validated (schema-level, no live Mainnet round trip)
[ ] Mainnet payTo verified (needs a real, project-controlled Mainnet wallet)
[ ] Mainnet USDC opt-in verified (needs that same real wallet, on-chain)
```

Unchecked items all share the same real blocker: **no public HTTPS
deployment and no funded Testnet/Mainnet wallet exist yet** — both are
genuinely outside what a code-hardening phase can produce by itself. They
are the concrete work for Phase 12.
