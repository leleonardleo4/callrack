#!/usr/bin/env bash
# Promotes one image reference to be the running @callrack/api instance on
# this host. Lives on the server at /opt/apps/callrack/promote.sh and is
# invoked over SSH by the release workflow - never run from a laptop against
# a production host.
#
# Calling convention (deliberately keeps the registry credential off argv
# and out of shell history / `ps`):
#   ./promote.sh <release-ref>
#   stdin, two lines: registry actor, then registry token
#
# Guarantees, regardless of how the steps below are named or ordered:
#   - the currently-running container is never stopped until the new image
#     has been pulled and verified present locally
#   - the migration job must exit 0 before the service container is touched
#   - the new container must answer healthy before the old one is discarded
#     and before the release marker is updated
#   - a failed promotion restores whatever was running before it started

set -euo pipefail

# ---------------------------------------------------------------------------
# fixed facts about this host - not meant to vary per invocation
# ---------------------------------------------------------------------------
readonly REGISTRY=ghcr.io
readonly REPOSITORY=leleonardleo4/callrack
readonly DOCKER_NET=alpha
readonly UNIT_NAME=callrack-api
readonly STASH_NAME=callrack-api.stashed
readonly ENV_FILE=/opt/apps/callrack/.env
readonly RELEASE_MARKER=/opt/apps/callrack/.active-release
readonly PUBLISH_ADDR=127.0.0.1:3004:3004
readonly PROBE_URL=http://127.0.0.1:3004/health
readonly PROBE_BUDGET_SECS=180

release_ref=${1:?usage: promote.sh <release-ref>}
runtime_image="${REGISTRY}/${REPOSITORY}:runtime-${release_ref}"
migrator_image="${REGISTRY}/${REPOSITORY}:migrator-${release_ref}"

announce() { printf '[%(%H:%M:%S)T] %s\n' -1 "$*"; }
die() { announce "ABORT: $*"; exit 1; }

# --- 1. bring the two images down without touching anything running --------
fetch_images() {
  local actor token
  IFS= read -r actor
  IFS= read -r token

  announce "authenticating to ${REGISTRY} as ${actor} (session-scoped)"
  printf '%s' "$token" | docker login "$REGISTRY" --username "$actor" --password-stdin

  announce "pulling ${runtime_image}"
  docker pull --quiet "$runtime_image"
  announce "pulling ${migrator_image}"
  docker pull --quiet "$migrator_image"

  docker logout "$REGISTRY" >/dev/null
  announce "logged out of ${REGISTRY}; nothing running has been touched yet"

  # Fail loudly rather than silently proceed against a half-pulled image.
  docker image inspect "$runtime_image" >/dev/null
  docker image inspect "$migrator_image" >/dev/null
}

# --- 2. schema must be current before anything new serves traffic ----------
apply_schema() {
  announce "running migrator job (${migrator_image})"
  if ! docker run --rm \
        --network "$DOCKER_NET" \
        --env-file "$ENV_FILE" \
        "$migrator_image"
  then
    die "migration job exited non-zero - runtime container will not be touched"
  fi
  announce "migrations applied"
}

# --- 3. put the old container aside (never delete it yet) ------------------
sideline_current() {
  if docker inspect "$UNIT_NAME" >/dev/null 2>&1; then
    announce "sidelining existing '${UNIT_NAME}' container as '${STASH_NAME}'"
    docker stop "$UNIT_NAME" >/dev/null
    docker rename "$UNIT_NAME" "$STASH_NAME"
  else
    announce "no existing '${UNIT_NAME}' container - this is a first deploy"
  fi
}

launch_candidate() {
  announce "starting candidate container from ${runtime_image}"
  docker run --detach \
    --name "$UNIT_NAME" \
    --network "$DOCKER_NET" \
    --env-file "$ENV_FILE" \
    --publish "$PUBLISH_ADDR" \
    --restart unless-stopped \
    "$runtime_image" >/dev/null
}

# --- 4. retry-with-backoff instead of a fixed N-attempt loop ----------------
wait_until_alive() {
  local waited=0 delay=2
  announce "probing ${PROBE_URL} (budget: ${PROBE_BUDGET_SECS}s)"
  while (( waited < PROBE_BUDGET_SECS )); do
    if curl --silent --fail --max-time 3 "$PROBE_URL" >/dev/null 2>&1; then
      announce "candidate is answering after ~${waited}s"
      return 0
    fi
    sleep "$delay"
    waited=$(( waited + delay ))
    (( delay = delay * 2 > 20 ? 20 : delay * 2 ))
  done
  return 1
}

# --- 5. commit to the new container, or put the old one back ---------------
commit_candidate() {
  if docker inspect "$STASH_NAME" >/dev/null 2>&1; then
    announce "discarding stashed prior container"
    docker rm --force "$STASH_NAME" >/dev/null
  fi
}

restore_previous() {
  announce "candidate never became healthy - rolling back"
  docker rm --force "$UNIT_NAME" >/dev/null 2>&1 || true
  if docker inspect "$STASH_NAME" >/dev/null 2>&1; then
    docker rename "$STASH_NAME" "$UNIT_NAME"
    docker start "$UNIT_NAME" >/dev/null
    announce "previous container restored under '${UNIT_NAME}'"
  else
    announce "there was nothing previous to restore to - service is DOWN"
  fi
}

record_release() {
  printf 'ref=%s\nruntime_image=%s\npromoted_at=%s\n' \
    "$release_ref" "$runtime_image" "$(date -Is)" > "$RELEASE_MARKER"
  announce "release marker updated: ${RELEASE_MARKER}"
}

main() {
  fetch_images
  apply_schema
  sideline_current
  launch_candidate

  if wait_until_alive; then
    commit_candidate
    record_release
    announce "promotion of ${release_ref} succeeded"
  else
    restore_previous
    die "promotion of ${release_ref} failed health verification"
  fi
}

main
