/** OAuth 2.1 resource-server primitives shared by Claude and ChatGPT. */
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { type JWTVerifyGetKey } from "jose";
export declare const AINAR_SCOPES: readonly ["courses:read", "students:read", "drafts:write", "approvals:write", "grades:write", "integrations:publish"];
export interface OAuthResourceConfig {
    issuer: string;
    resource: URL;
    jwksUri: URL;
    requiredScopes: string[];
    metadataUrl: URL;
}
export declare const oauthConfigFromEnv: (env?: NodeJS.ProcessEnv) => OAuthResourceConfig | null;
export declare const protectedResourceMetadata: (config: OAuthResourceConfig) => {
    resource: string;
    authorization_servers: string[];
    scopes_supported: ("courses:read" | "students:read" | "drafts:write" | "approvals:write" | "grades:write" | "integrations:publish")[];
};
export declare const oauthChallenge: (config: OAuthResourceConfig) => string;
export declare class OAuthError extends Error {
}
export declare class JwtAccessTokenVerifier {
    private readonly key;
    readonly config: OAuthResourceConfig;
    constructor(config: OAuthResourceConfig, key?: JWTVerifyGetKey);
    verifyAccessToken(token: string): Promise<AuthInfo>;
}
export declare const bearerToken: (authorization: string | undefined) => string | null;
