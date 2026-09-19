# syntax=docker/dockerfile:1
#
# Two publishable images come out of this one file: `runtime` (the long-lived
# API process) and `migrator` (a one-shot job that applies Prisma migrations
# and exits). Build either with `--target`:
#
#   docker build -f apps/api/Dockerfile --target runtime  -t callrack:runtime  .
#   docker build -f apps/api/Dockerfile --target migrator -t callrack:migrator .
#
# Built from the monorepo root as context. Workspace slicing goes through
# Turborepo's own `turbo prune` (https://turborepo.com/docs/guides/tools/docker)
# rather than pnpm's still-experimental `deploy` command, which - verified
# against this exact repo - can't resolve `@prisma/client` for
# `@callrack/db`'s `prisma generate` postinstall once its node_modules are
# reshaped by `pnpm deploy`'s isolation.
#
# `runtime` and `migrator` intentionally do NOT share a node_modules layer:
# `migrator` needs the `prisma` CLI (a devDependency of `@callrack/db`),
# `runtime` must never ship devDependencies at all, so each gets its own
# independently-derived install rather than one image trying to serve both.

ARG NODE_MAJOR=22-alpine

FROM node:${NODE_MAJOR} AS toolchain
RUN corepack enable
WORKDIR /workspace

# --- slice: only @callrack/api and what it actually needs -------------------
FROM toolchain AS slice
COPY . .
RUN npx turbo prune @callrack/api --docker

# --- assemble: full (dev-included) install, generate, compile ---------------
FROM toolchain AS assemble
# Skips pnpm's interactive "purge extraneous packages" prompt on later
# reinstalls - there's no TTY in a build step to answer it.
ENV CI=true

# package.json/lockfile only, so this layer survives source-only changes.
# --ignore-scripts holds off @callrack/db's `prisma generate` postinstall,
# which needs prisma/schema.prisma - not present until the full copy below.
COPY --from=slice /workspace/out/json/ .
RUN --mount=type=cache,id=callrack-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# Real source, plus the workspace-root tsconfig.json every package's own
# tsconfig extends (turbo prune copies each package's own files only, not
# shared root config - confirmed: omitting this breaks every build with
# "Cannot find base config file").
COPY --from=slice /workspace/out/full/ .
COPY tsconfig.json ./tsconfig.json

RUN pnpm --filter=@callrack/db run db:generate
RUN pnpm --filter=@callrack/api... build

# --- deps-for-runtime: production-only reinstall, derived independently -----
# Starts fresh from the same pruned json/lockfile rather than pruning
# `assemble`'s node_modules in place, so a stray devDependency can never
# leak into the runtime image through directory reuse.
FROM toolchain AS deps-for-runtime
ENV CI=true
COPY --from=slice /workspace/out/json/ .
RUN --mount=type=cache,id=callrack-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile --ignore-scripts

# --- runtime: the long-lived API process -------------------------------------
FROM node:${NODE_MAJOR} AS runtime
RUN corepack enable
WORKDIR /workspace
ENV NODE_ENV=production
ENV API_PORT=3004

RUN addgroup --system --gid 1001 svc \
  && adduser --system --uid 1001 --ingroup svc svc

COPY --from=deps-for-runtime --chown=svc:svc /workspace/node_modules ./node_modules
COPY --from=assemble --chown=svc:svc /workspace/package.json ./package.json
COPY --from=assemble --chown=svc:svc /workspace/apps/api ./apps/api
COPY --from=assemble --chown=svc:svc /workspace/packages/config ./packages/config
COPY --from=assemble --chown=svc:svc /workspace/packages/db ./packages/db
COPY --from=assemble --chown=svc:svc /workspace/packages/redis ./packages/redis
COPY --from=assemble --chown=svc:svc /workspace/packages/types ./packages/types

USER svc

EXPOSE 3004

# Node's built-in fetch, not curl/wget - keeps the image free of an extra
# HTTP client just for a liveness probe. Honors API_PORT so an override at
# deploy time doesn't desync the healthcheck from the listener.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3004)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec form, no shell wrapper: Node stays PID 1 and receives SIGTERM
# directly, which apps/api/src/bootstrap.ts's `app.enableShutdownHooks()`
# graceful-shutdown path depends on.
CMD ["node", "apps/api/dist/main.js"]

# --- migrator: one-shot, applies pending migrations then exits --------------
FROM node:${NODE_MAJOR} AS migrator
RUN corepack enable
WORKDIR /workspace
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 svc \
  && adduser --system --uid 1001 --ingroup svc svc

# Needs the *full* (dev-included) tree from `assemble` - the Prisma CLI
# itself is a devDependency of @callrack/db and has no place in `runtime`.
COPY --from=assemble --chown=svc:svc /workspace/node_modules ./node_modules
COPY --from=assemble --chown=svc:svc /workspace/package.json ./package.json
COPY --from=assemble --chown=svc:svc /workspace/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=assemble --chown=svc:svc /workspace/packages/db ./packages/db

USER svc

# Same command this repo already documents and runs in CI for a production
# migration (`prisma migrate deploy` - applies existing migrations only,
# never generates a new one, never touched by a plain `migrate dev`/`db push`).
CMD ["pnpm", "--filter=@callrack/db", "run", "db:migrate:deploy"]
