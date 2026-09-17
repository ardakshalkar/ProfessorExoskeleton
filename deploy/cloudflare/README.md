# Cloudflare front door for a single Professor Harness instance

The DHS web app runs as a long-lived Node process with a writable course workspace and shell tools. Keep it on a Linux server as described in [`../README.md`](../README.md). Cloudflare Tunnel provides the public route; Cloudflare Access restricts who can open it. This is a single-professor starting configuration, not a multi-tenant deployment.

## Required inputs

- A Linux server or VM where `dsh@<user>` can run and where `cloudflared` can connect to Cloudflare.
- A domain active in the Cloudflare account and the intended private hostname, for example `professor.example.edu`.
- The professor's Cloudflare Access identity and a policy allowing only that identity.

## Route

```text
browser → Cloudflare Access → Cloudflare Tunnel → 127.0.0.1:8080 Caddy → 127.0.0.1:3101 DHS
```

1. Provision and start one user with [`../provision-user.sh`](../provision-user.sh), keeping DHS bound to `127.0.0.1:3101`.
2. Install Caddy on the same server. Copy [`Caddyfile.example`](Caddyfile.example) to the server's Caddy configuration and validate it. Keep its listener on `127.0.0.1`.
3. In Cloudflare Zero Trust, create a **Self-hosted** Access application for the entire intended hostname. Add an Allow policy for the professor's identity. Verify unauthenticated access is denied.
4. Create a Cloudflare Tunnel on that server. Add a **Published application** route for the same hostname with service URL `http://127.0.0.1:8080`. Enable **Protect with Access** on the route so `cloudflared` validates the Access token.
5. Check that unauthenticated requests cannot reach `/`, `/api`, `/professor-pane/`, or WebSocket endpoints. Sign in as the allowed professor and verify the course pane, Models page, a session, and WebSocket updates.

The `Host` and `Origin` rewrites in the local Caddyfile preserve the loopback authority DHS requires for its privileged methods. They are safe only while the proxy and DHS ports are bound to loopback and the Tunnel is the sole remote route. Do not create an unprotected Quick Tunnel to DHS.

For multiple professors, use the process and Unix-account isolation in [`../README.md`](../README.md). Design and test identity-to-instance routing separately; this single-user configuration should not be copied into a shared process.
