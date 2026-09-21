#!/usr/bin/env bash
# Boot one professor's harness inside a Cloudflare Container.
#
# Container disk is ephemeral. Cloudflare says so plainly: "All disk is
# ephemeral. When a Container instance goes to sleep, the next time it is
# started, it will have a fresh disk as defined by its container image." A
# harness whose state lived on that disk would lose a professor's sessions,
# their drafts and their roster the first time it idled out overnight. So the
# durable half of a home is on R2, mounted here with FUSE.
#
# ── which half is which, and why the split falls here ───────────────────────
#
# The obvious arrangement — symlink sessions/ and storages/ out of an otherwise
# local home and into R2 — is wrong in a way that is silent until it costs you
# a credential. dsh writes through `dsh-atomic-write`: a temporary file, then
# rename(2) onto the destination. Renaming ONTO a symlink replaces the symlink
# itself, not the file it points at, so `.credentials.yaml` would be durable
# until the first time the Models page wrote it and then quietly local forever.
#
# So the split is inverted: $DSH_HOME *is* on R2, and the two rebuildable
# directories are symlinked OUT of it onto local disk. Every atomic rename then
# happens wholly inside R2, where it belongs, and nothing that matters depends
# on a symlink surviving one.
#
# The two that go local:
#   profiles/         mirrored from the checkout by dsh-user on every boot, and
#                     then filled by the harness itself with several hundred
#                     node_modules links (deploy/README.md, "A home is mostly
#                     links"). Hundreds of symlinks on an object store is both
#                     slow and the part of POSIX a FUSE adapter emulates least
#                     well — and it is rebuilt from the image on each start
#                     anyway, so there is nothing to keep.
#   .agent-presets/   same: links back to the checkout, rewritten every boot.
#
# Everything else — sessions/, storages/, .credentials.yaml, .env, courses/ and
# the private roster — stays on R2. That is the same list deploy/README.md
# names under "Backing up" as the things actually worth keeping.

set -euo pipefail

die() { echo "start.sh: $*" >&2; exit 1; }

: "${DSH_PROFESSOR_SLUG:?the Worker must pass DSH_PROFESSOR_SLUG}"
: "${R2_BUCKET_NAME:?}"
: "${R2_ACCOUNT_ID:?}"
: "${AWS_ACCESS_KEY_ID:?}"
: "${AWS_SECRET_ACCESS_KEY:?}"

# dsh-user refuses a name that could not be a directory component or an OS
# account. The Worker already sanitises, but this is the boundary that actually
# guards a path, so it is restated rather than assumed.
case "$DSH_PROFESSOR_SLUG" in
  *[!a-z0-9._-]* | "" | -* | .* ) die "refusing '$DSH_PROFESSOR_SLUG' as a professor slug" ;;
esac

CHECKOUT=/srv/professor-exoskeleton
MOUNT=/mnt/r2
PORT="${DSH_PORT:-3101}"

# ── the R2 mount ────────────────────────────────────────────────────────────
mkdir -p "$MOUNT"
tigrisfs --endpoint "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
         -f "$R2_BUCKET_NAME" "$MOUNT" &
FUSE_PID=$!

# Wait for the mount rather than sleeping a fixed three seconds and hoping.
# A harness booted onto an unmounted directory would write a full home to
# ephemeral disk and report perfect health while doing it, which is the single
# worst failure this file can produce.
for _ in $(seq 1 30); do
  if mountpoint -q "$MOUNT"; then break; fi
  kill -0 "$FUSE_PID" 2>/dev/null || die "tigrisfs exited before the mount appeared"
  sleep 1
done
mountpoint -q "$MOUNT" || die "R2 did not mount at $MOUNT within 30s"

# Prove it is writable before anything depends on it. A read-only or
# misscoped R2 token mounts perfectly well and fails on first write.
probe="$MOUNT/.write-probe-$$"
: > "$probe" 2>/dev/null || die "R2 mounted but is not writable — check the token's permissions"
rm -f "$probe"

echo "start.sh: R2 bucket $R2_BUCKET_NAME mounted at $MOUNT"

# ── the home, durable by default ────────────────────────────────────────────
#
# DSH_ROOT is what dsh-user builds under, so pointing it into the mount puts
# the whole per-professor tree on R2 without dsh-user needing to know.
export DSH_ROOT="$MOUNT/professors"
export DSH_PORT="$PORT"

home="$DSH_ROOT/$DSH_PROFESSOR_SLUG/.dsh"

# The local side mirrors the home's SHAPE, `.dsh` and all, and not merely its
# contents. The preset resolves its skill roots three levels up from itself, so
# the number of directories between the preset and the professor's own root is
# load-bearing; flatten it here and "three levels up" lands in /var/lib/dsh,
# shared by every professor on the instance. See the skill-roots section below.
local_root="/var/lib/dsh/$DSH_PROFESSOR_SLUG"
local_home="$local_root/.dsh"

mkdir -p "$home" "$local_home/profiles" "$local_home/.agent-presets"

# The two exceptions, symlinked out onto local disk. `ln -sfn` is safe on a
# symlink and on nothing; if a previous boot left a real directory here — which
# would mean it was written before this script existed — refuse rather than
# nest a link inside it, the same failure dsh-user's link_into_home guards.
for d in profiles .agent-presets; do
  if [ -e "$home/$d" ] && [ ! -L "$home/$d" ]; then
    die "$home/$d is a real directory on R2. It should be a link to local disk.
  Move it aside and restart: the contents are rebuilt from the image."
  fi
  ln -sfn "$local_home/$d" "$home/$d"
done

# ── the professor preset's skill roots ──────────────────────────────────────
#
# The preset names its seven skill roots relative to its OWN directory:
#
#   new URL('../../../plugins/professor-course-skills/skills/', baseUrl)
#
# and its comment says "three levels up is the project root". That is true in
# the checkout, where the preset sits at .dsh/.agent-presets/professor/. It is
# NOT true in a home provisioned by dsh-user, where the same three levels reach
# $DSH_ROOT/<name>/ — a directory with no plugins/ in it. Measured, in this
# image, against a home built exactly as dsh-user builds one: every one of the
# seven roots resolves to a path that does not exist.
#
# The failure is silent in the way the preset's own comment warns about — the
# thirty-five teaching skills are simply absent from the menu, and dsh-skill
# says nothing louder than a log line. So the link is made here rather than
# discovered by a professor wondering where /grade-batch went.
#
# Two candidate parents, because the preset directory is reached through a
# symlink and which spelling the loader takes as its base is its business, not
# ours. Both are cheap and only one needs to be right.
#
# NOTE: this is a bug in deploy/dsh-user, not in this deployment. The server
# arrangement in ../README.md has it too, and has it unfixed — see CONTAINERS.md.
link_plugins() {
  [ -e "$1/plugins" ] || ln -s "$CHECKOUT/plugins" "$1/plugins" 2>/dev/null || return 1
}
link_plugins "$local_root" || die "could not link plugins into $local_root — the
  professor preset would boot with none of its thirty-five teaching skills."
link_plugins "$DSH_ROOT/$DSH_PROFESSOR_SLUG" \
  || echo "start.sh: note — no plugins link on R2 (object storage may not carry
  symlinks). The local one above is the other candidate base and is in place." >&2

# The private roster — names, student numbers, and the HMAC salt the pseudonyms
# derive from — lives at ~/.ainar, outside the checkout. It is the single most
# sensitive thing this deployment holds and it is not under DSH_HOME, so it
# needs its own link or it would be ephemeral.
ainar_state="$DSH_ROOT/$DSH_PROFESSOR_SLUG/ainar"
mkdir -p "$ainar_state"
if [ -e "$HOME/.ainar" ] && [ ! -L "$HOME/.ainar" ]; then rm -rf "$HOME/.ainar"; fi
ln -sfn "$ainar_state" "$HOME/.ainar"

# ── the proxy ───────────────────────────────────────────────────────────────
#
# Started before the harness and left running: it is the only route to 3101,
# and the Container class health-checks port 8080.
caddy start --config /etc/caddy/Caddyfile --adapter caddyfile
echo "start.sh: caddy listening on 0.0.0.0:8080 -> 127.0.0.1:$PORT"

# ── the harness ─────────────────────────────────────────────────────────────
#
# dsh-user does the provisioning — mirrors the profile and the preset out of
# the checkout, writes a first .env, creates the courses workspace — and then
# execs dsh on 127.0.0.1 with --no-open. DSH_PORT above overrides its users.conf
# lookup, which is a table for a machine with several professors on it; this
# container has exactly one.
cd "$CHECKOUT"
exec deploy/dsh-user "$DSH_PROFESSOR_SLUG"
