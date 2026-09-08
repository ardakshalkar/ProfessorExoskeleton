/**
 * A transport small enough to read, and replaceable so tests never go online.
 * Ported from `ainar/lms/http.py`.
 *
 * Canvas needs four things from an HTTP client: a bearer token, `Link`-header
 * pagination, form-encoded bodies, and honest errors. That is little enough to
 * do with what the platform already has, and avoiding a dependency here matters
 * more than usual — this is the one module in the workspace that can reach out
 * and change a student's grade, so it should be short enough to audit in one
 * sitting.
 *
 * Every client takes its transport as an argument. `RecordedTransport` replays
 * canned responses and remembers what was asked of it, which is how the tests
 * exercise a grade write without one ever leaving the machine.
 *
 * ## The one shape the port had to change
 *
 * Python's `urllib` is synchronous; `fetch` is not, and Node has no synchronous
 * HTTP at all. So every method that reaches the network returns a promise, and
 * the `lms` command awaits it. That is the whole difference — nothing about
 * which requests are made, or when, or what is sent.
 */

export const USER_AGENT = "ainar-course-workspace";

/** `<https://host/api/v1/x?page=2>; rel="next"` — the only rel we follow. */
const NEXT_LINK = /<([^>]+)>\s*;\s*rel="next"/;

/** The request did not complete. Not the same as a refusal from Canvas. */
export class TransportError extends Error {}

export interface Response {
  status: number;
  body: string;
  headers: Record<string, string>;
}

export const json = (response: Response): any => {
  if (!response.body.trim()) return null;
  try {
    return JSON.parse(response.body);
  } catch {
    throw new TransportError(
      `expected JSON from the API, got ${JSON.stringify(response.body.slice(0, 200))}`,
    );
  }
};

export const header = (response: Response, name: string): string | null => {
  for (const [key, value] of Object.entries(response.headers)) {
    if (key.toLowerCase() === name.toLowerCase()) return value;
  }
  return null;
};

export const nextUrl = (response: Response): string | null => {
  const link = header(response, "link") ?? "";
  const match = NEXT_LINK.exec(link);
  return match ? match[1]! : null;
};

export interface Transport {
  request(
    method: string,
    url: string,
    options: { headers: Record<string, string>; body?: Uint8Array | null },
  ): Promise<Response>;
}

/** The real one. Platform `fetch`, and it does not retry by itself. */
export class FetchTransport implements Transport {
  timeout: number;

  constructor(timeout = 30_000) {
    this.timeout = timeout;
  }

  async request(
    method: string,
    url: string,
    { headers, body }: { headers: Record<string, string>; body?: Uint8Array | null },
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    let response: globalThis.Response;
    try {
      response = await fetch(url, {
        method,
        headers: { ...headers, "User-Agent": USER_AGENT },
        body: body ?? undefined,
        signal: controller.signal,
      });
    } catch (error) {
      // A refusal from the far end is a result and arrives below; this branch is
      // "the request never happened", which is a different thing to report.
      throw new TransportError(`could not reach ${url}: ${(error as Error).message}`);
    } finally {
      clearTimeout(timer);
    }

    const collected: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      collected[key] = value;
    });
    return { status: response.status, body: await response.text(), headers: collected };
  }
}

/**
 * Replays canned responses and remembers every call. For tests.
 *
 * Keys are `"GET /api/v1/courses/1/assignments/2"` — method and path, with the
 * query string ignored, because a test should not have to predict a provider's
 * parameter ordering. Paths are decoded first, so a key can be written as
 * `"GET /v4/.../values/'Fall 2026'!A1:ZZ"` rather than in percent-encoding. A
 * trailing `*` matches by prefix, for ranges whose exact extent depends on how
 * wide the grid turned out.
 */
export class RecordedTransport implements Transport {
  responses: Record<string, Response | Response[]>;
  calls: [string, string, string | null][] = [];

  constructor(responses: Record<string, Response | Response[]> = {}) {
    this.responses = responses;
  }

  async request(
    method: string,
    url: string,
    { body }: { headers: Record<string, string>; body?: Uint8Array | null },
  ): Promise<Response> {
    const parsed = new URL(url);
    const key = `${method} ${decodeURIComponent(parsed.pathname)}`;
    this.calls.push([method, url, body ? new TextDecoder().decode(body) : null]);

    let found = this.responses[key];
    if (found === undefined) {
      for (const [pattern, response] of Object.entries(this.responses)) {
        if (pattern.endsWith("*") && key.startsWith(pattern.slice(0, -1))) {
          found = response;
          break;
        }
      }
    }
    if (found === undefined) throw new Error(`no recorded response for ${key}`);
    if (Array.isArray(found)) {
      if (!found.length) throw new Error(`recorded responses for ${key} are exhausted`);
      return found.shift()!;
    }
    return found;
  }

  bodies(method = "POST"): string[] {
    return this.calls.filter(([verb]) => verb === method).map(([, , body]) => body ?? "");
  }
}

/** Canvas's `grade_data[123][posted_grade]` keys, safely encoded. */
export const formEncode = (fields: Record<string, string>): Uint8Array => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) params.append(key, value);
  return new TextEncoder().encode(params.toString());
};
