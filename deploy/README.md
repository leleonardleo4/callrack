# Standing up callrack-api on the edge VM

This is the one-time setup for a fresh OCI Ampere (ARM64) Ubuntu 24.04
host. It assumes the shared infrastructure already exists on this box:
Docker Engine, the external `alpha` bridge network, a running `postgres`
container reachable as `postgres` on that network, a running `redis`
container reachable as `redis`, and Caddy already terminating TLS for
`*.callrack.xyz`. None of that is provisioned by anything in this
directory - `promote.sh` refuses to touch it, and this guide only tells
you where callrack's own pieces plug into it.

## 1. Give callrack its own database

Run this once against the shared Postgres, from wherever you'd normally
reach it (`docker exec -it postgres psql -U postgres`, or a client on the
`alpha` network):

```sql
CREATE ROLE callrack_owner WITH LOGIN PASSWORD 'pick-a-real-password';
CREATE DATABASE callrack_db OWNER callrack_owner;
```

Nothing in this repo creates the database or the role - `promote.sh`'s
migrator step only ever runs `prisma migrate deploy` against whatever
`DATABASE_URL` already points at.

## 2. Lay down the deploy directory

```bash
sudo mkdir -p /opt/apps/callrack
sudo cp deploy/.env.example /opt/apps/callrack/.env
sudo cp deploy/promote.sh /opt/apps/callrack/promote.sh
sudo chmod 700 /opt/apps/callrack/promote.sh
sudo chmod 600 /opt/apps/callrack/.env
```

Edit `/opt/apps/callrack/.env` by hand: real `DATABASE_URL` password (from
step 1), real `MAINNET_PAY_TO`, and confirm the sixteen `PRICE_*` values
match what you actually intend to charge. **This file is never written to
by CI/CD** - `promote.sh` only ever reads it.

## 3. Register the systemd unit

```bash
sudo cp deploy/callrack.service /etc/systemd/system/callrack.service
sudo systemctl daemon-reload
sudo systemctl enable callrack.service
```

Don't start it yet - there's no `callrack-api` container to start until
the first promotion runs (step 6).

## 4. Point Caddy at the container

Add to Caddy's config (wherever this host keeps it - a `Caddyfile` or a
snippet under `/etc/caddy/conf.d/`):

```
api.callrack.xyz {
    reverse_proxy 127.0.0.1:3004
}
```

Reload Caddy (`sudo systemctl reload caddy` or your usual equivalent).
Port 3004 is published to loopback only by `promote.sh` - it is never
reachable from outside this host except through Caddy.

## 5. Let GitHub Actions in

**SSH access.** Generate a dedicated keypair (don't reuse a human's):

```bash
ssh-keygen -t ed25519 -f ./callrack-deploy-key -N ""
```

Append `callrack-deploy-key.pub` to the deploy user's
`~/.ssh/authorized_keys` on this VM. That user needs passwordless `docker`
access (in the `docker` group) since `promote.sh` calls `docker` directly.

**Registry access.** Create a GitHub PAT (classic, `read:packages` scope
only) that the *server* uses to pull from GHCR - this is separate from the
token GitHub Actions itself uses to push, which is the automatic
`GITHUB_TOKEN` and never leaves the runner.

**Repository secrets** (Settings -> Secrets and variables -> Actions):

| Secret | Value |
|---|---|
| `EDGE_HOST` | `129.213.16.57` |
| `EDGE_USER` | the deploy user on this VM |
| `EDGE_SSH_KEY` | contents of `callrack-deploy-key` (the private half) |
| `REGISTRY_ACTOR` | `leleonardleo4` (or whichever account owns the PAT) |
| `REGISTRY_TOKEN` | the `read:packages` PAT from above |

**Environment gate.** Create a GitHub Environment named `production`
(Settings -> Environments) and add at least one required reviewer. The
`rollout` job in `.github/workflows/ship.yml` runs under this environment,
so nothing ever reaches this VM without both a manual workflow dispatch
*and* that approval.

## 6. First promotion

Trigger **Ship callrack-api** from the Actions tab (`workflow_dispatch`,
no inputs needed - it builds from whatever ref you run it against).
Watch it through `preflight` -> `forge` -> `publish`, approve the
`production` gate when it reaches `rollout`.

`promote.sh` will report "no existing 'callrack-api' container - this is a
first deploy" and skip straight to launching one - that message only
appears on this very first run.

## 7. Confirm it's actually up

```bash
curl -s https://api.callrack.xyz/health
systemctl status callrack
docker ps --filter name=callrack-api
cat /opt/apps/callrack/.active-release
```

## Redeploying by hand

`promote.sh` never needs GitHub Actions to run - it only needs a release
ref that was already built and pushed. From this VM:

```bash
printf '%s\n%s\n' "$REGISTRY_ACTOR" "$REGISTRY_TOKEN" | \
  sudo /opt/apps/callrack/promote.sh <short-sha>
```

This is also how you roll back: pass the short SHA of a previous, known-good
build (visible in `/opt/apps/callrack/.active-release`'s history if you've
been keeping copies, or in the GHCR package's own tag list) instead of the
latest one.
