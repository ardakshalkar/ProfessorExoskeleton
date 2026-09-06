/** Small, dependency-free guard for the first remote deployment boundary. */

import { timingSafeEqual } from "node:crypto";

export const isLoopbackHost = (host: string): boolean =>
  host === "127.0.0.1" || host === "::1" || host.toLowerCase() === "localhost";

export const bearerMatches = (authorization: string | undefined, token: string): boolean => {
  if (!token || !authorization?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(token, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
};

