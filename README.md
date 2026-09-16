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

## 📜 Development Conventions

1. **TypeScript First**: Strict mode enabled (`noImplicitAny`, `strictNullChecks`).
2. **Explicit Workspace Dependencies**: Internal packages reference each other via `workspace:*`.
3. **Clean Module Boundaries**: Public exports managed through explicit `index.ts` files.
4. **Environment Driven**: No hardcoded credentials or API keys.
