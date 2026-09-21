// The front door. Everything this deployment does about identity happens here.
//
// deploy/README.md states the stake in one line: a session carries `bash`, so
// reaching the API is a shell on the machine. The harness has no authentication
// of its own and says so in three places. This Worker is the layer that decides
// who is asking, and it fails closed — a request without a valid Cloudflare
// Access token does not reach a container at all.
//
// Isolation between professors is the Durable Object id. On a Linux server that
// job is done by Unix accounts (deploy/README.md, "Why not one process with
// logins in it"); here each identity addresses its own Durable Object, which
// owns its own container instance, which Cloudflare runs in its own VM. One
// professor per VM is a stronger split than one professor per Unix account, and
// it is the reason nothing inside the container needs to know about tenancy.

import { Container, getContainer } from "@cloudflare/containers";
import { createRemoteJWKSet, jwtVerify } from "jose";

interface Env {
	PROFESSOR_HARNESS: DurableObjectNamespace<ProfessorHarness>;

	// Vars, in wrangler.jsonc.
	ACCESS_TEAM_DOMAIN: string; // e.g. "your-team.cloudflareaccess.com"
	ACCESS_AUD: string; // the Access application's AUD tag
	R2_BUCKET_NAME: string;
	R2_ACCOUNT_ID: string;

	// Secrets, via `wrangler secret put`.
	AWS_ACCESS_KEY_ID: string;
	AWS_SECRET_ACCESS_KEY: string;
}

// Internal only. Set by the Worker after it has verified the token, read by the
// Durable Object, and deleted before the request reaches the container — so a
// client that sends this header itself cannot have it believed.
const SLUG_HEADER = "X-DSH-Professor-Slug";

export class ProfessorHarness extends Container<Env> {
	defaultPort = 8080; // Caddy. The harness is on 3101 and is not published.
	sleepAfter = "30m";

	// The harness calls a model provider on every message. Without egress it
	// boots fine and fails on first use.
	enableInternet = true;

	override async fetch(request: Request): Promise<Response> {
		// Remembered so a restart after sleep — which is a fresh disk, and may
		// be in a different Cloudflare location entirely — lands on the same R2
		// prefix as before. It is also what a WebSocket upgrade runs on: those
		// arrive unmodified, carrying no header, because rewriting an upgrade
		// request is not reliably allowed.
		const known = await this.ctx.storage.get<string>("slug");

		// The header may be believed only on a request the Worker rebuilt, where
		// its `set` overwrote anything the client sent. An upgrade is forwarded
		// verbatim, so on one of those this header is client data — and
		// believing it on a not-yet-established object would let an
		// authenticated professor name someone else's home and have it mounted.
		const fromHeader = isWebSocketUpgrade(request) ? null : request.headers.get(SLUG_HEADER);

		if (fromHeader && known && fromHeader !== known) {
			// This object's id is derived from the slug, so a mismatch means an
			// id collision. Refuse rather than mount one professor's roster for
			// another.
			return new Response("identity mismatch on this instance", { status: 500 });
		}
		if (fromHeader && !known) await this.ctx.storage.put("slug", fromHeader);

		const slug = fromHeader ?? known;
		if (!slug) {
			// An upgrade that arrived before any ordinary request established
			// the identity. The UI always loads the page first, so this is a
			// reconnect against an object that has never served one.
			return new Response("no established identity for this instance", { status: 409 });
		}

		// Per-instance, not the class-level `envVars` field: the slug differs
		// per professor and the class field is shared by every instance.
		await this.startAndWaitForPorts({
			ports: [this.defaultPort],
			startOptions: {
				envVars: {
					DSH_PROFESSOR_SLUG: slug,
					R2_BUCKET_NAME: this.env.R2_BUCKET_NAME,
					R2_ACCOUNT_ID: this.env.R2_ACCOUNT_ID,
					AWS_ACCESS_KEY_ID: this.env.AWS_ACCESS_KEY_ID,
					AWS_SECRET_ACCESS_KEY: this.env.AWS_SECRET_ACCESS_KEY,
				},
			},
		});

		if (isWebSocketUpgrade(request)) return this.containerFetch(request);

		const forwarded = new Request(request);
		forwarded.headers.delete(SLUG_HEADER);
		return this.containerFetch(forwarded);
	}
}

// One JWKS fetcher per isolate. `createRemoteJWKSet` caches the keys and
// refetches on rotation, so this must not be rebuilt per request.
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let jwksFor: string | undefined;

function keySet(teamDomain: string) {
	if (!jwks || jwksFor !== teamDomain) {
		jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
		jwksFor = teamDomain;
	}
	return jwks;
}

// A professor's identity becomes a directory name on R2 and an argument to
// deploy/dsh-user, which refuses anything outside [a-z0-9._-].
//
// The trailing hash is not decoration. Sanitising alone is lossy — `a+b@x.edu`
// and `a_b@x.edu` both flatten to the same string — and two identities sharing
// one slug would share one home, one session history and one roster. The hash
// is taken over the full address, so the mapping cannot collide even though the
// readable part can.
async function slugFor(email: string): Promise<string> {
	const normalised = email.trim().toLowerCase();
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalised));
	const hash = [...new Uint8Array(digest)]
		.slice(0, 4)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	const readable = normalised
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/^[-.]+/, "")
		.slice(0, 40);

	return `${readable || "professor"}-${hash}`;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		// Access presents the token as a header on every request, and as a
		// cookie on the first navigation after a sign-in.
		const token =
			request.headers.get("Cf-Access-Jwt-Assertion") ??
			cookie(request, "CF_Authorization");

		if (!token) {
			// No token means this request did not come through Access. That is
			// the workers.dev hostname, or a route that was never put behind an
			// Access application — both of which would otherwise be an
			// unauthenticated shell.
			return new Response(
				"This deployment is reachable only through Cloudflare Access.\n",
				{ status: 401 },
			);
		}

		let email: string;
		try {
			const { payload } = await jwtVerify(token, keySet(env.ACCESS_TEAM_DOMAIN), {
				issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
				audience: env.ACCESS_AUD,
			});
			// `email` is what Access puts on a token for a human identity. A
			// service token has `common_name` instead and no email, and is
			// refused here: a service token is not a professor, and giving one
			// a home would create a shell nobody is accountable for.
			if (typeof payload.email !== "string" || !payload.email) {
				return new Response("token carries no user identity\n", { status: 403 });
			}
			email = payload.email;
		} catch {
			return new Response("invalid Access token\n", { status: 403 });
		}

		const slug = await slugFor(email);
		const instance = getContainer(env.PROFESSOR_HARNESS, slug);

		// A WebSocket upgrade is forwarded exactly as it arrived. Copying one to
		// add a header is not dependably permitted, and the session updates the
		// professor pane redraws from are carried on it — so the identity for an
		// upgrade comes from what the object already stored, not from the wire.
		// The object's id is derived from the slug, so this loses no safety:
		// only this professor's requests can reach this object in the first
		// place.
		if (isWebSocketUpgrade(request)) return instance.fetch(request);

		const upstream = new Request(request);
		upstream.headers.set(SLUG_HEADER, slug);
		return instance.fetch(upstream);
	},
} satisfies ExportedHandler<Env>;

function isWebSocketUpgrade(request: Request): boolean {
	return request.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

function cookie(request: Request, name: string): string | null {
	const header = request.headers.get("Cookie");
	if (!header) return null;
	for (const part of header.split(";")) {
		const eq = part.indexOf("=");
		if (eq === -1) continue;
		if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
	}
	return null;
}
