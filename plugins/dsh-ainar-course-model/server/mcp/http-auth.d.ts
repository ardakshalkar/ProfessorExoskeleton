/** Small, dependency-free guard for the first remote deployment boundary. */
export declare const isLoopbackHost: (host: string) => boolean;
export declare const bearerMatches: (authorization: string | undefined, token: string) => boolean;
