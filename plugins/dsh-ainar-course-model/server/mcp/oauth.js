/** OAuth 2.1 resource-server primitives shared by Claude and ChatGPT. */
import { createRemoteJWKSet, jwtVerify, } from "jose";
export const AINAR_SCOPES = [
    "courses:read",
    "students:read",
    "drafts:write",
    "approvals:write",
    "grades:write",
    "integrations:publish",
];
const requireSecureUrl = (value, name) => {
    const url = new URL(value);
    const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
        throw new Error(`${name} must use HTTPS except on loopback`);
    }
    return url;
};
export const oauthConfigFromEnv = (env = process.env) => {
    const issuer = (env.AINAR_OAUTH_ISSUER ?? "").trim();
    const resource = (env.AINAR_MCP_RESOURCE ?? "").trim();
    const jwksUri = (env.AINAR_OAUTH_JWKS_URI ?? "").trim();
    if (!issuer && !resource && !jwksUri)
        return null;
    if (!issuer || !resource || !jwksUri) {
        throw new Error("AINAR_OAUTH_ISSUER, AINAR_MCP_RESOURCE and AINAR_OAUTH_JWKS_URI must be set together");
    }
    requireSecureUrl(issuer, "AINAR_OAUTH_ISSUER");
    const resourceUrl = requireSecureUrl(resource, "AINAR_MCP_RESOURCE");
    const jwksUrl = requireSecureUrl(jwksUri, "AINAR_OAUTH_JWKS_URI");
    const metadataUrl = new URL("/.well-known/oauth-protected-resource", resourceUrl.origin);
    const requiredScopes = (env.AINAR_OAUTH_REQUIRED_SCOPES ?? "courses:read students:read")
        .split(/[ ,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean);
    return {
        // OAuth issuer and resource identifiers are exact, case-sensitive values.
        // Do not normalize trailing slashes: the token claims must match metadata.
        issuer,
        resource: resourceUrl,
        jwksUri: jwksUrl,
        requiredScopes,
        metadataUrl,
    };
};
export const protectedResourceMetadata = (config) => ({
    resource: config.resource.href,
    authorization_servers: [config.issuer],
    scopes_supported: [...AINAR_SCOPES],
});
export const oauthChallenge = (config) => {
    const scope = config.requiredScopes.join(" ");
    return `Bearer resource_metadata="${config.metadataUrl.href}", scope="${scope}"`;
};
const scopesOf = (payload) => {
    if (typeof payload.scope === "string")
        return payload.scope.split(/\s+/).filter(Boolean);
    const scp = payload.scp;
    return Array.isArray(scp) ? scp.filter((scope) => typeof scope === "string") : [];
};
export class OAuthError extends Error {
}
export class JwtAccessTokenVerifier {
    key;
    config;
    constructor(config, key = createRemoteJWKSet(config.jwksUri)) {
        this.config = config;
        this.key = key;
    }
    async verifyAccessToken(token) {
        let payload;
        try {
            ({ payload } = await jwtVerify(token, this.key, {
                issuer: this.config.issuer,
                audience: this.config.resource.href,
                requiredClaims: ["sub", "exp"],
            }));
        }
        catch (error) {
            throw new OAuthError(`invalid access token: ${error.message}`);
        }
        const scopes = scopesOf(payload);
        const missing = this.config.requiredScopes.filter((scope) => !scopes.includes(scope));
        if (missing.length)
            throw new OAuthError(`access token is missing scope(s): ${missing.join(", ")}`);
        return {
            token,
            clientId: String(payload.client_id ?? payload.azp ?? "oauth-client"),
            scopes,
            expiresAt: payload.exp,
            resource: this.config.resource,
            extra: {
                subject: payload.sub,
                issuer: this.config.issuer,
                email: typeof payload.email === "string" ? payload.email : undefined,
            },
        };
    }
}
export const bearerToken = (authorization) => {
    const match = /^Bearer\s+(.+)$/i.exec(authorization ?? "");
    return match?.[1]?.trim() || null;
};
