# One professor's harness, as a Cloudflare Container image.
#
# Build context is the REPOSITORY ROOT, not this directory — the image carries
# the checkout. `wrangler.jsonc` says so with `image_build_context`.
#
# Two processes run here, for the reason deploy/README.md gives at length: the
# harness refuses `--host 0.0.0.0` because binding wider would expose remote
# code execution to the network, and a Cloudflare Container is reached on a
# port that is by definition not loopback. So Caddy takes the non-loopback port
# and is the only thing that speaks to the harness, rewriting Host and Origin
# to the loopback authority the privileged APIs require. That is the same
# substitution deploy/cloudflare/Caddyfile.example makes on a Linux server, and
# it is valid here for the same reason: nothing else can reach 3101.

FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# fuse3 for the R2 mount, curl/ca-certificates to fetch tigrisfs and Caddy,
# bash because deploy/dsh-user is a bash script and uses process substitution.
RUN apt-get update && apt-get install -y --no-install-recommends \
      bash ca-certificates curl fuse3 tar \
 && rm -rf /var/lib/apt/lists/*

# tigrisfs — the FUSE adapter Cloudflare's own R2 example uses. Pinned, because
# "latest" in a build is a different image every time it is rebuilt.
ARG TIGRISFS_VERSION=1.2.2
RUN curl -fsSL "https://github.com/tigrisdata/tigrisfs/releases/download/v${TIGRISFS_VERSION}/tigrisfs_${TIGRISFS_VERSION}_linux_amd64.tar.gz" \
      -o /tmp/tigrisfs.tar.gz \
 && tar -xzf /tmp/tigrisfs.tar.gz -C /usr/local/bin/ tigrisfs \
 && rm /tmp/tigrisfs.tar.gz \
 && chmod +x /usr/local/bin/tigrisfs

# Caddy, as a single binary rather than the apt repository: one layer, one
# version, and nothing that needs a systemd unit.
ARG CADDY_VERSION=2.11.4
RUN curl -fsSL "https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_linux_amd64.tar.gz" \
      -o /tmp/caddy.tar.gz \
 && tar -xzf /tmp/caddy.tar.gz -C /usr/local/bin/ caddy \
 && rm /tmp/caddy.tar.gz \
 && chmod +x /usr/local/bin/caddy

# The shared, read-only checkout — the container equivalent of
# /srv/professor-exoskeleton in deploy/README.md.
WORKDIR /srv/professor-exoskeleton

# Manifests first so a change to course content does not invalidate the install
# layer. The `file:` dependencies are real directories in this tree, so they
# have to be present before `npm install` can resolve them.
COPY package.json package-lock.json ./
COPY patches/ ./patches/
COPY ainar-node/ ./ainar-node/
COPY plugins/ ./plugins/

# --legacy-peer-deps is required, not preferred. package.json's own `comments`
# field explains it: without the flag npm's peer resolver does not converge on
# this graph. The peers it then skips are listed as direct dependencies, which
# is why this install is sound despite the flag.
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . .

COPY deploy/cloudflare/container/Caddyfile /etc/caddy/Caddyfile
COPY deploy/cloudflare/container/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh /srv/professor-exoskeleton/deploy/dsh-user

# Where the rebuildable half of a home lives. The durable half is on R2; see
# start.sh for which is which and why the split falls where it does.
RUN mkdir -p /var/lib/dsh

EXPOSE 8080

CMD ["/usr/local/bin/start.sh"]
