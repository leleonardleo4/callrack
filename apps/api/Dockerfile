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
# Three separate install stages feed the two final images - deliberately
# not sharing one node_modules tree, because `runtime` must never ship
# devDependencies and `migrator` needs `prisma` (a devDependency of
# `@callrack/db`), so no single install could be correct for both:
#   - `assemble`         full install, all 5 pruned packages, compiles the
#                        API and generates the Prisma Client
#   - `deps-for-runtime` prod-only install, only what `runtime` ships; gets
#                        its generated Prisma Client by copying `assemble`'s
#                        already-generated output rather than running
#                        `prisma generate` itself, since the `prisma` CLI
#                        that would require is a devDependency this install
#                        deliberately excludes
#   - `migrator-deps`    full install of `@callrack/db` ALONE (its own
#                        `turbo prune`, not @callrack/api's) - never pulls in
#                        @nestjs/cli, @swc/core, or any other apps/api-only
#                        devDependency migrator has no use for
#
# `migrator` is built from `migrator-deps` only - it never depends on
# `assemble` and therefore never waits on (or ships) a Nest build.

ARG NODE_MAJOR=22-alpine

# Pinned to the runner's own architecture ($BUILDPLATFORM, a buildx-provided
# arg), never the requested target one - everything derived from this stage
# does real work (pnpm install, prisma generate, nest build). Verified this
# is safe for every generated/native artifact actually produced here, not
# assumed:
#   - Prisma 7 + @prisma/adapter-pg (this repo's driver-adapter setup) has no
#     `binaryTargets`/`previewFeatures` in schema.prisma and generates a
#     SINGLE `query_compiler_fast_bg.wasm` per client - confirmed by
#     inspecting the actual generated output, no per-arch
#     `libquery_engine-<platform>.so.node` files exist anywhere. WASM is
#     interpreted identically on any host CPU, so generating it on
#     $BUILDPLATFORM and running it on a different $TARGETPLATFORM is safe.
#   - the `prisma` CLI itself (used by `migrator`) bundles its own
#     per-datasource wasm engines directly in the npm package - also
#     architecture-independent, also never something this Dockerfile
#     "builds" per-arch.
#   - zero native Node addons anywhere in the resolved tree - confirmed by
#     searching the entire installed pnpm store for `binding.gyp` (the
#     universal marker of a compiled addon): no matches. `pg` (this repo's
#     Postgres driver) is pure JS; `pg-native` is not installed.
#   - `@swc/core`/`esbuild` (used only to compile TS during `assemble`
#     /`migrator-deps`, never present in the final `runtime` image since
#     that install is `--prod`) do ship per-platform native binaries, but
#     only to run the compiler itself on $BUILDPLATFORM - their output
#     (plain compiled JS) carries no architecture information forward.
# Without this pin, building for a non-native target (e.g. arm64 on a
# GitHub-hosted amd64 runner) ran the ENTIRE install+compile step under QEMU
# emulation - confirmed directly: an arm64 build took 30+ minutes on the
# same steps that finish in a couple of minutes natively. Only `runtime`/
# `migrator` below - which just COPY already-built, platform-independent
# files - actually need to target the real requested platform, and copying
# files between stages built for different platforms is always safe (no ELF
# binaries involved).
FROM --platform=$BUILDPLATFORM node:${NODE_MAJOR} AS toolchain
RUN corepack enable
WORKDIR /workspace

# --- slice: only @callrack/api and what it actually needs -------------------
FROM toolchain AS slice
COPY . .
RUN npx turbo prune @callrack/api --docker

# --- slice-db: only @callrack/db - what `migrator` actually needs -----------
# @callrack/db has no workspace dependencies of its own, so this prune drops
# apps/api, @callrack/config, @callrack/redis, and @callrack/types entirely -
# confirmed by running it against this repo: the pruned tree contains only
# packages/db and the root manifest/lockfile.
FROM toolchain AS slice-db
COPY . .
RUN npx turbo prune @callrack/db --docker

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
#
# This node_modules tree - not assemble's - is what `runtime` actually
# ships (see the `runtime` stage below), and `@prisma/client`'s package
# code resolves its generated output (`.prisma/client/...`, the wasm query
# compiler) via a bare `require('.prisma/client/...')` scoped to wherever
# THIS install's own pnpm store landed it - copying `packages/db`'s source
# from `assemble` does NOT carry that along, because that source directory
# only holds a symlink into ITS OWN pnpm store, not the generated files
# themselves. So this stage needs the real generated output physically
# present in ITS OWN store.
#
# It can't get there by running `prisma generate` itself, though: the
# `prisma` CLI is a devDependency of @callrack/db, and this install is
# deliberately `--prod` (`runtime` must never ship devDependencies) - so
# the CLI was never installed here. Confirmed directly: running the
# generate command in this stage fails pnpm's own dependency-status check,
# since `prisma` genuinely isn't present. Rather than accepting `prisma`
# into a "production" install just to run it once, bind-mount `assemble`'s
# ALREADY-generated output (it ran the identical `prisma generate` against
# the identical schema, from its own full/dev install) and copy over just
# the generated `.prisma/client` directory - not the whole node_modules,
# and not a permanent extra layer, since a bind mount only exists for the
# one RUN that declares it. The destination is discovered with a glob
# rather than hardcoded, because pnpm's content-hash suffix for
# `@prisma/client` depends on the full peer-dependency resolution graph
# and isn't something a Dockerfile should pin.
FROM toolchain AS deps-for-runtime
ENV CI=true
COPY --from=slice /workspace/out/json/ .
RUN --mount=type=cache,id=callrack-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile --ignore-scripts
RUN --mount=type=bind,from=assemble,source=/workspace/node_modules/.pnpm,target=/mnt/assembled-pnpm-store \
    sh -euc ' \
      for dir in /mnt/assembled-pnpm-store/@prisma+client@*; do \
        name=$(basename "$dir"); \
        mkdir -p "node_modules/.pnpm/$name/node_modules"; \
        cp -r "$dir/node_modules/.prisma" "node_modules/.pnpm/$name/node_modules/.prisma"; \
      done'

# --- migrator-deps: full install of @callrack/db ALONE, nothing else -------
# `prisma migrate deploy` does not read the generated Prisma Client at all -
# confirmed by inspecting the installed `prisma` CLI package directly: it
# bundles its own per-datasource `query_compiler_fast_bg.<engine>.wasm` and
# `prisma_schema_build_bg.wasm` files, entirely separate from whatever
# `@prisma/client` generates for the app. The only references to
# `@prisma/client` inside the CLI bundle are template metadata for the
# `prisma generate` subcommand itself, never touched by `migrate deploy`.
# So this stage skips `db:generate` entirely - there is nothing for it to
# produce that this image's one command actually reads.
FROM toolchain AS migrator-deps
ENV CI=true
COPY --from=slice-db /workspace/out/json/ .
RUN --mount=type=cache,id=callrack-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts
COPY --from=slice-db /workspace/out/full/packages/db/prisma ./packages/db/prisma
COPY --from=slice-db /workspace/out/full/packages/db/prisma.config.ts ./packages/db/prisma.config.ts

# --- runtime: the long-lived API process -------------------------------------
FROM node:${NODE_MAJOR} AS runtime
RUN corepack enable
WORKDIR /workspace
ENV NODE_ENV=production
ENV API_PORT=3004

RUN addgroup --system --gid 1001 svc \
  && adduser --system --uid 1001 --ingroup svc svc

# `WORKDIR` above created /workspace while still root (svc didn't exist
# yet) - the `--chown` on the COPY instructions below only sets ownership
# on what they copy in, never on /workspace itself, so left alone it stays
# root-owned and `svc` can never write anything new directly into it.
# apps/api's own runtime process has no documented need to do that today,
# but `migrator`'s does (see that stage below, where this exact gap broke
# it) - fixed here too so both final images hold the same invariant.
RUN chown svc:svc /workspace

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

# `WORKDIR` above created /workspace while still root - see the identical
# comment in `runtime` above. This one isn't theoretical for `migrator`:
# it's the confirmed cause of a real runtime EACCES failure. `pnpm` writes
# its own scratch files (e.g. `_tmp_<pid>_<hash>`) relative to CWD as part
# of ordinary operation, not just during install - CMD below runs as
# `svc`, and a root-owned /workspace refused that write.
RUN chown svc:svc /workspace

COPY --from=migrator-deps --chown=svc:svc /workspace/package.json ./package.json

# `corepack enable` only installs the dispatcher shim - it does not
# download pnpm itself. That happens lazily on first invocation, into
# $COREPACK_HOME (defaults to the invoking user's own $HOME). Nothing in
# THIS stage ever invokes pnpm during the build (only `migrator-deps`, a
# separate stage whose filesystem - and whatever corepack cached inside
# it - is never copied forward), so left alone, the container's one and
# only command would BE that first invocation: running as `svc`, at
# runtime, needing network access to a registry a production container may
# have no egress for, and a writable cache dir that was never populated
# for `svc` in the first place. Confirmed this is exactly what the
# original failure was - not the /workspace ownership gap above, but the
# combination of both. Fixed by preparing the exact pnpm version this
# repo's own package.json pins, at build time (network + root available),
# into a fixed location any user can read - so the container never needs
# network or install access just to run `prisma migrate deploy`.
ENV COREPACK_HOME=/opt/corepack-cache
RUN corepack prepare "$(node -p "require('./package.json').packageManager")" --activate \
  && chown -R svc:svc /opt/corepack-cache

# From `migrator-deps`, never `assemble` - this image never needs (and must
# never wait on) the Nest build. `migrator-deps` is its own `turbo prune`
# scoped to @callrack/db alone, so this node_modules tree carries the
# `prisma` CLI (a devDependency of @callrack/db) without pulling in any of
# apps/api's own devDependencies (@nestjs/cli, @swc/core, etc.) the way
# reusing `assemble`'s tree would have.
COPY --from=migrator-deps --chown=svc:svc /workspace/node_modules ./node_modules
COPY --from=migrator-deps --chown=svc:svc /workspace/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=migrator-deps --chown=svc:svc /workspace/packages/db ./packages/db

USER svc

# Same command this repo already documents and runs in CI for a production
# migration (`prisma migrate deploy` - applies existing migrations only,
# never generates a new one, never touched by a plain `migrate dev`/`db push`).
CMD ["pnpm", "--filter=@callrack/db", "run", "db:migrate:deploy"]
