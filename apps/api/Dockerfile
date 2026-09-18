# syntax=docker/dockerfile:1
#
# Production image for @callrack/api. Built from the monorepo root as the
# build context, e.g.:
#   docker build -f apps/api/Dockerfile -t callrack-api .
#
# Uses Turborepo's documented `turbo prune` pattern for pnpm monorepos
# (https://turborepo.com/docs/guides/tools/docker) rather than pnpm's own
# `deploy` command: the latter is still marked experimental and, as tested
# against this repo, fails to resolve `@prisma/client` for `@callrack/db`'s
# `prisma generate` postinstall in its isolated node_modules layout.
# `turbo prune` produces a real (non-experimental), verified-working subset
# of the workspace instead.

ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS base
RUN corepack enable
WORKDIR /app

# --- 1. Prune the workspace down to @callrack/api + its dependencies -------
FROM base AS pruner
COPY . .
RUN npx turbo prune @callrack/api --docker

# --- 2. Install dependencies, then build ------------------------------------
FROM base AS builder
# CI=true skips pnpm's interactive "confirm modules purge" prompt during the
# later --prod reinstall, which would otherwise hang with no TTY attached.
ENV CI=true

# Dependency layer: only package.json/lockfile from the pruned set, so this
# layer is cached across builds unless a dependency actually changes.
# --ignore-scripts defers @callrack/db's `prisma generate` postinstall,
# which needs prisma/schema.prisma - not present until the "full" copy below.
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile --ignore-scripts

# Real source, plus the root tsconfig.json every package's tsconfig extends
# (turbo prune only copies each package's own files, not the workspace
# root's shared config - verified locally; omitting this produces a
# "Cannot find base config file" warning from every package's build).
COPY --from=pruner /app/out/full/ .
COPY tsconfig.json ./tsconfig.json

RUN pnpm --filter=@callrack/db run db:generate
RUN pnpm --filter=@callrack/api... build

# Drop devDependencies now that the build output exists.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# --- 3. Minimal runtime image ------------------------------------------------
FROM node:${NODE_VERSION} AS runner
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 callrack \
  && adduser --system --uid 1001 --ingroup callrack callrack

# Only what's needed to run: pruned production node_modules, built dist
# output, and package.json files (Node's ESM/CJS resolution and Prisma's
# generated client both consult package.json at runtime).
COPY --from=builder --chown=callrack:callrack /app/node_modules ./node_modules
COPY --from=builder --chown=callrack:callrack /app/package.json ./package.json
COPY --from=builder --chown=callrack:callrack /app/apps/api ./apps/api
COPY --from=builder --chown=callrack:callrack /app/packages/config ./packages/config
COPY --from=builder --chown=callrack:callrack /app/packages/db ./packages/db
COPY --from=builder --chown=callrack:callrack /app/packages/redis ./packages/redis
COPY --from=builder --chown=callrack:callrack /app/packages/types ./packages/types

USER callrack

EXPOSE 3000

# Uses Node's built-in fetch rather than adding curl/wget to keep the image
# minimal. Reads API_PORT so this works if the deployment overrides the
# default port.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec form (no shell wrapper) so Node is PID 1 and receives SIGTERM
# directly - required for apps/api/src/bootstrap.ts's
# `app.enableShutdownHooks()` graceful-shutdown path to actually run.
CMD ["node", "apps/api/dist/main.js"]
