#!/usr/bin/env bash
# `provision-user.sh` — give one professor an account, a home, a port and a service.
#
#   sudo deploy/provision-user.sh ardak 3101
#   sudo deploy/provision-user.sh ardak 3101 --dry-run
#
# Run as root, once per person. Everything it does is idempotent, so running it
# again after a failure finishes the job rather than doubling it.
#
# The OS account is the part that is easy to skip and is the one that matters.
# A professor's session carries bash. Whatever the agent can read, the account
# it runs as can read — so the boundary between two professors' rosters, drafts
# and student records is a Unix boundary or it is nothing. The proxy in front
# decides WHO is asking; this script decides what that answer is allowed to
# touch. Neither substitutes for the other.
#
# It deliberately does NOT touch Caddy. The proxy's user table is the one place
# an identity provider's naming has to be reconciled with this machine's, and
# guessing at that from a shell script would produce a config nobody reviewed.
# The line to paste is printed at the end.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DSH_ROOT="${DSH_ROOT:-/srv/dsh}"
USERS_CONF="${USERS_CONF:-$here/deploy/users.conf}"

die() { echo "provision-user: $*" >&2; exit 1; }
run() { if [ -n "$dry" ]; then echo "  would: $*"; else "$@"; fi; }

user="${1:-}"
port="${2:-}"
dry=""
[ "${3:-}" = "--dry-run" ] && dry=1

[ -n "$user" ] && [ -n "$port" ] || die "usage: sudo deploy/provision-user.sh <name> <port> [--dry-run]"
case "$user" in
  *[!a-z0-9._-]* | -* | .* ) die "refusing '$user' as a name: lowercase letters, digits, dot, dash, underscore" ;;
esac
case "$port" in *[!0-9]*) die "port must be a number, got '$port'" ;; esac
[ "$port" -ge 1024 ] || die "port $port is privileged; pick something above 1024"

if [ -z "$dry" ] && [ "$(id -u)" != "0" ]; then
  die "run as root (it creates an account and a systemd unit), or pass --dry-run"
fi

# ── the port must be unclaimed ──────────────────────────────────────────────
#
# Checked before anything is created, because the failure it prevents is the
# expensive one: two units pointing at one socket, one of them restart-looping,
# and a professor whose harness is up every third minute.
if [ -f "$USERS_CONF" ]; then
  claimed="$(awk -v p="$port" '$1 !~ /^#/ && $2 == p { print $1; exit }' "$USERS_CONF")"
  if [ -n "$claimed" ] && [ "$claimed" != "$user" ]; then
    die "port $port already belongs to '$claimed' in $USERS_CONF"
  fi
fi

echo "provisioning $user on port $port${dry:+ (dry run)}"

# ── the account ─────────────────────────────────────────────────────────────
#
# The home IS the DSH root entry, so that one `chmod 700` covers the sessions,
# the credential file, the course workspace and the private roster at
# ~/.ainar/roster together. A login shell is deliberate: the professor is
# expected to be able to ssh in and run `bin/ainar` by hand.
if id "$user" >/dev/null 2>&1; then
  echo "  account $user exists"
else
  run useradd --create-home --home-dir "$DSH_ROOT/$user" --shell /bin/bash "$user"
fi

run mkdir -p "$DSH_ROOT/$user/courses"
run chown -R "$user:$user" "$DSH_ROOT/$user"
run chmod 700 "$DSH_ROOT/$user"

# ── the port table ──────────────────────────────────────────────────────────
if [ -f "$USERS_CONF" ] && awk -v u="$user" '$1 !~ /^#/ && $1 == u { found = 1 } END { exit !found }' "$USERS_CONF"; then
  echo "  $user already in $USERS_CONF"
elif [ -n "$dry" ]; then
  echo "  would: append '$user $port' to $USERS_CONF"
else
  [ -f "$USERS_CONF" ] || cp "$here/deploy/users.conf.example" "$USERS_CONF"
  printf '%s %s\n' "$user" "$port" >> "$USERS_CONF"
  echo "  added '$user $port' to $USERS_CONF"
fi

# ── the home, built by the launcher itself ──────────────────────────────────
#
# Not repeated here. `dsh-user --check` provisions the profile symlink, the
# preset symlink and the .env, and it runs on every boot anyway; calling it as
# the professor is what keeps the files owned by them rather than by root.
if [ -n "$dry" ]; then
  echo "  would: sudo -u $user deploy/dsh-user $user --check"
else
  sudo -u "$user" env DSH_ROOT="$DSH_ROOT" USERS_CONF="$USERS_CONF" "$here/deploy/dsh-user" "$user" --check
fi

# ── the service ─────────────────────────────────────────────────────────────
unit_src="$here/deploy/dsh@.service"
unit_dst="/etc/systemd/system/dsh@.service"
if [ -n "$dry" ]; then
  echo "  would: install $unit_src at $unit_dst (edit its paths first)"
  echo "  would: systemctl daemon-reload && systemctl enable --now dsh@$user"
else
  if [ ! -f "$unit_dst" ]; then
    echo "  $unit_dst is not installed."
    echo "  Copy $unit_src there, set its paths for this machine, then:"
    echo "    systemctl daemon-reload && systemctl enable --now dsh@$user"
  else
    systemctl daemon-reload
    systemctl enable --now "dsh@$user"
    systemctl --no-pager --lines=0 status "dsh@$user" || true
  fi
fi

cat <<NEXT

Done for $user. Two things this script does not do, on purpose:

  1. The proxy. Add this to the map block in your Caddyfile, then reload Caddy:

         $user "127.0.0.1:$port"

     The left-hand side must be the name your identity provider returns for
     this person, which is not necessarily the account name used here.

  2. The key. $DSH_ROOT/$user/.dsh/.env holds it, or the professor types it
     into the Models page — which works only if the proxy presents the harness
     as loopback. deploy/README.md, "The trust fence", says which you have.
NEXT
