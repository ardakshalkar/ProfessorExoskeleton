#!/usr/bin/env bash
# `setup.sh` — one professor's harness on a free VM, behind Cloudflare.
#
#   sudo TUNNEL_TOKEN=eyJ... bash deploy/oracle/setup.sh ardak
#
# Written for Oracle Cloud's Always Free Ampere A1 shape (Ubuntu 24.04, arm64),
# and nothing in it is Oracle-specific: any Ubuntu/Debian box, either arch.
#
# The route it builds is deploy/cloudflare/README.md's, with no inbound port:
#
#   browser → Cloudflare Access → Tunnel (outbound from here)
#           → 127.0.0.1:8080 Caddy → 127.0.0.1:3101 harness
#
# Nothing listens on a public interface. Oracle's default security list opens
# 22 and nothing else, and that is exactly what this needs — do NOT add ingress
# rules for 8080 or 3101. The Caddy rewrite is safe only while the Tunnel is the
# sole route to it (deploy/README.md, "The trust fence").
#
# Idempotent: re-running after a failure finishes the job.
set -euo pipefail

die() { echo "setup: $*" >&2; exit 1; }

user="${1:-ardak}"
port="${PORT:-3101}"
EXO_HOME=/srv/professor-exoskeleton
REPO="${REPO:-https://github.com/ardakshalkar/ProfessorExoskeleton.git}"

[ "$(id -u)" = 0 ] || die "run as root (sudo)"
: "${TUNNEL_TOKEN:?set TUNNEL_TOKEN to the token Zero Trust shows for the tunnel}"

export DEBIAN_FRONTEND=noninteractive

# ── packages ────────────────────────────────────────────────────────────────
apt-get update
apt-get install -y --no-install-recommends \
  bash ca-certificates curl git gnupg debian-keyring debian-archive-keyring apt-transport-https

if ! command -v node >/dev/null || ! node -v | grep -q '^v22\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update && apt-get install -y caddy
fi

if ! command -v cloudflared >/dev/null; then
  mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
    > /usr/share/keyrings/cloudflare-main.gpg
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
    > /etc/apt/sources.list.d/cloudflared.list
  apt-get update && apt-get install -y cloudflared
fi

# ── the checkout, shared and read-only ──────────────────────────────────────
if [ -d "$EXO_HOME/.git" ]; then
  git -C "$EXO_HOME" pull --ff-only
else
  git clone "$REPO" "$EXO_HOME"
fi
(cd "$EXO_HOME" && npm install --legacy-peer-deps --no-audit --no-fund)
chmod +x "$EXO_HOME/deploy/dsh-user" "$EXO_HOME/deploy/provision-user.sh"

# ── the service and the professor ───────────────────────────────────────────
# dsh@.service already names /srv/professor-exoskeleton and /srv/dsh.
install -m 0644 "$EXO_HOME/deploy/dsh@.service" /etc/systemd/system/dsh@.service
systemctl daemon-reload
"$EXO_HOME/deploy/provision-user.sh" "$user" "$port"

# ── Caddy: loopback only, the single-professor rewrite ──────────────────────
sed "s/127.0.0.1:3101/127.0.0.1:$port/g" \
  "$EXO_HOME/deploy/cloudflare/Caddyfile.example" > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl enable caddy
systemctl restart caddy

# ── the Tunnel ──────────────────────────────────────────────────────────────
if ! systemctl is-enabled cloudflared >/dev/null 2>&1; then
  cloudflared service install "$TUNNEL_TOKEN"
fi
systemctl restart cloudflared

# ── checks: the same ones deploy/README.md ends on ──────────────────────────
sleep 5
echo
echo "harness  /           $(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/")   (want 200)"
echo "fence    forged Host $(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Host: evil.example' "http://127.0.0.1:$port/api/session.list")   (want 403)"
echo "caddy    /           $(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/)   (want 200)"
echo "listening on public interfaces (want nothing but :22):"
ss -ltn | awk 'NR>1 && $4 !~ /^(127\.0\.0\.1|\[::1\]|127\.0\.0\.53)/ { print "  " $4 }'
echo
echo "Next, in Zero Trust: give the tunnel its public hostname → http://127.0.0.1:8080,"
echo "with Protect with Access on. deploy/oracle/README.md says which."
