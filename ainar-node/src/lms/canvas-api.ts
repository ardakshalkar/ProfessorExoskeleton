/**
 * The Canvas REST API: the same grades, without the CSV in the middle. Ported
 * from `ainar/lms/canvas_api.py`.
 *
 * What the API adds over the gradebook CSV is not convenience. It is three
 * things the CSV cannot do:
 *
 * * **Comments reach the student.** The gradebook CSV has no feedback column.
 * * **Submission times are real.** The pull stops having to omit `submitted_at`
 *   because a CSV never carried one.
 * * **The assignment can be checked before anything is written.** Canvas will
 *   happily accept 80 on an assignment worth 50 and show the student 160%. The
 *   CSV path could only compare against a "Points Possible" row; here the
 *   assignment itself is readable, so a scale mismatch is caught before the
 *   write.
 *
 * What it also adds is the ability to do real damage. A CSV sits on disk until a
 * person uploads it; this posts a grade a student can see within seconds. So the
 * write is gated three ways: it is never the default, it requires `--confirm`,
 * and no agent may run it.
 *
 * Two Canvas behaviours worth knowing before reading the code:
 *
 * **Grading is asynchronous.** `updateGrades` returns a Progress object, not a
 * result. Reporting success on the 200 would be reporting that Canvas accepted
 * the job, which is not the same as the grades landing — so the client polls
 * until the progress completes or fails.
 *
 * **Posting policy decides visibility.** On an assignment set to manual posting,
 * grades are entered but hidden until the professor posts them. That is worth
 * saying out loud either way, because "did the students see it?" has a different
 * answer in each case.
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { type Directory, type MatchKey } from "./base.ts";
import {
  type Response,
  type Transport,
  FetchTransport,
  TransportError,
  formEncode,
  json,
  nextUrl,
} from "./http.ts";

const API_ROOT = "/api/v1";
const PAGE_SIZE = 100;

/** Where the non-secret half of the configuration lives. */
export const CONFIG_NAME = "lms.toml";
export const TOKEN_ENV = "AINAR_CANVAS_TOKEN";
export const BASE_URL_ENV = "AINAR_CANVAS_URL";

/** Canvas submission states that mean there is no grade to compare against. */
const UNGRADED_STATES = new Set(["unsubmitted", "pending_review"]);

/** Canvas refused, and said why. */
export class CanvasError extends Error {}

/**
 * The two or three keys this tooling reads out of `lms.toml`.
 *
 * A hand-rolled reader rather than a TOML parser, because what is wanted is
 * three string assignments inside one table and nothing else — no arrays, no
 * nesting, no dates. A real parser would be a dependency added to read
 * `base_url = "https://…"`, and the failure mode of getting this wrong is a
 * missing host, which the caller already reports clearly.
 */
export const readTomlTable = (path: string, table: string): Record<string, string> => {
  let text: string;
  try {
    if (!statSync(path).isFile()) return {};
    text = readFileSync(path, "utf-8");
  } catch {
    return {};
  }

  const found: Record<string, string> = {};
  let inside = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("[")) {
      inside = line === `[${table}]`;
      continue;
    }
    if (!inside) continue;
    const equals = line.indexOf("=");
    if (equals === -1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
    }
    if (key && value) found[key] = value;
  }
  return found;
};

export interface CanvasConfig {
  base_url: string;
  token: string;
}

export const apiOf = (config: CanvasConfig): string => config.base_url.replace(/\/+$/, "") + API_ROOT;

/**
 * Host from config or flag; token from the environment, preferably.
 *
 * The token is a credential that can change grades, so the environment is the
 * documented home for it. A `token` in the config file is honoured because a
 * professor may prefer it, but it is never printed and never written by this
 * tooling.
 */
export const loadCanvasConfig = (
  directory: string | null,
  { baseUrl }: { baseUrl?: string | null } = {},
): CanvasConfig => {
  const settings = directory ? readTomlTable(join(directory, CONFIG_NAME), "canvas") : {};
  const resolved = baseUrl || process.env[BASE_URL_ENV] || settings.base_url;
  if (!resolved) {
    throw new Error(
      "no Canvas host configured. Either set AINAR_CANVAS_URL, pass " +
        `--canvas-url, or write ${CONFIG_NAME} beside the roster:\n\n` +
        "    [canvas]\n" +
        '    base_url = "https://narxoz.instructure.com"\n',
    );
  }
  const token = process.env[TOKEN_ENV] || settings.token;
  if (!token) {
    throw new Error(
      `no Canvas token. Export ${TOKEN_ENV} with a token from Canvas → ` +
        "Account → Settings → New Access Token. It is a credential that " +
        "can change grades; keep it out of the repository.",
    );
  }
  return { base_url: resolved, token };
};

/** Canvas's receipt for an asynchronous job. */
export interface Progress {
  id: string;
  state: string;
  completion: number | null;
  message: string | null;
}

export const isDone = (progress: Progress): boolean =>
  progress.state === "completed" || progress.state === "failed";

export const hasFailed = (progress: Progress): boolean => progress.state === "failed";

const progressOf = (payload: Record<string, any>): Progress => ({
  id: String(payload.id ?? ""),
  state: String(payload.workflow_state ?? "unknown"),
  completion: payload.completion ?? null,
  message: payload.message ?? null,
});

const query = (params: Record<string, any>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) for (const item of value) search.append(key, String(item));
    else search.append(key, String(value));
  }
  return search.toString();
};

const messageOf = (response: Response): string => {
  let payload: any;
  try {
    payload = json(response);
  } catch {
    return response.body.slice(0, 200).trim() || "no detail";
  }
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const errors = payload.errors;
    if (Array.isArray(errors) && errors.length) {
      const first = errors[0];
      return String(first && typeof first === "object" ? (first.message ?? JSON.stringify(first)) : first);
    }
    if (errors && typeof errors === "object") return JSON.stringify(errors);
    for (const key of ["message", "error"]) {
      if (payload[key]) return String(payload[key]);
    }
  }
  return response.body.slice(0, 200).trim() || "no detail";
};

export class CanvasClient {
  config: CanvasConfig;
  transport: Transport;

  constructor(config: CanvasConfig, transport: Transport = new FetchTransport()) {
    this.config = config;
    this.transport = transport;
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.config.token}`, Accept: "application/json" };
  }

  private check(response: Response, what: string): Response {
    if (response.status >= 200 && response.status < 300) return response;
    const detail = messageOf(response);
    if (response.status === 401 || response.status === 403) {
      if (detail.toLowerCase().includes("rate limit")) {
        throw new CanvasError(
          `Canvas rate limit reached while ${what}. Wait a minute and ` +
            "run it again — nothing partial was written by this call.",
        );
      }
      throw new CanvasError(
        `Canvas refused (${response.status}) while ${what}: ${detail}. Check ` +
          "the token is current and that it belongs to an account that can " +
          "grade this course.",
      );
    }
    if (response.status === 404) {
      throw new CanvasError(
        `Canvas has no such thing (${what}): ${detail}. Check the course and ` +
          "assignment ids in extensions.lms.",
      );
    }
    throw new CanvasError(`Canvas returned ${response.status} while ${what}: ${detail}`);
  }

  async get(path: string, params?: Record<string, any>): Promise<any> {
    let url = apiOf(this.config) + path;
    if (params) url += "?" + query(params);
    const response = await this.transport.request("GET", url, { headers: this.headers() });
    return json(this.check(response, `reading ${path}`));
  }

  /** Follow `Link: rel="next"` to the end. Canvas paginates everything. */
  async getAll(path: string, params: Record<string, any> = {}): Promise<Record<string, any>[]> {
    let url: string | null =
      apiOf(this.config) + path + "?" + query({ ...params, per_page: PAGE_SIZE });
    const collected: Record<string, any>[] = [];
    const seen = new Set<string>();
    while (url) {
      // A server that points at itself would loop forever.
      if (seen.has(url)) break;
      seen.add(url);
      const response = this.check(
        await this.transport.request("GET", url, { headers: this.headers() }),
        `reading ${path}`,
      );
      const page = json(response) ?? [];
      if (!Array.isArray(page)) {
        throw new TransportError(`expected a list from ${path}, got ${typeof page}`);
      }
      collected.push(...page);
      url = nextUrl(response);
    }
    return collected;
  }

  // ------------------------------------------------------------------- reads

  assignment(courseId: string, assignmentId: string): Promise<Record<string, any>> {
    return this.get(`/courses/${courseId}/assignments/${assignmentId}`);
  }

  /** Enrolled students, with whatever identifying columns the token can see. */
  students(courseId: string): Promise<Record<string, any>[]> {
    return this.getAll(`/courses/${courseId}/users`, {
      "enrollment_type[]": "student",
      "enrollment_state[]": "active",
    });
  }

  submissions(courseId: string, assignmentId: string): Promise<Record<string, any>[]> {
    return this.getAll(`/courses/${courseId}/assignments/${assignmentId}/submissions`);
  }

  // ------------------------------------------------------------------ writes

  /**
   * Post scores, and comments where given. Returns Canvas's job receipt.
   *
   * The body is built one student at a time so that what is sent is exactly what
   * the plan showed — there is no bulk shortcut here that could include a row the
   * plan left out.
   */
  async updateGrades(
    courseId: string,
    assignmentId: string,
    grades: Map<string, [number, string | null]>,
  ): Promise<Progress> {
    if (!grades.size) throw new Error("no grades to send");
    const fields: Record<string, string> = {};
    for (const userId of [...grades.keys()].sort()) {
      const [score, comment] = grades.get(userId)!;
      fields[`grade_data[${userId}][posted_grade]`] = String(Number(score.toPrecision(6)));
      if (comment) fields[`grade_data[${userId}][text_comment]`] = comment;
    }

    const url =
      `${apiOf(this.config)}/courses/${courseId}/assignments/${assignmentId}` +
      "/submissions/update_grades";
    const response = this.check(
      await this.transport.request("POST", url, {
        headers: { ...this.headers(), "Content-Type": "application/x-www-form-urlencoded" },
        body: formEncode(fields),
      }),
      `grading ${grades.size} submission(s)`,
    );
    return progressOf(json(response) ?? {});
  }

  async progress(progressId: string): Promise<Progress> {
    return progressOf((await this.get(`/progress/${progressId}`)) ?? {});
  }

  /**
   * Poll until Canvas finishes the job, or give up saying so.
   *
   * Giving up is not the same as failing: the grades may still land. The caller
   * reports it that way rather than claiming either outcome.
   *
   * `sleep` is an argument so a test can replace it and not spend ten real
   * seconds proving that an unfinished job is handled.
   */
  async waitFor(
    progress: Progress,
    {
      attempts = 10,
      pause = 1000,
      sleep = (ms: number) => new Promise((done) => setTimeout(done, ms)),
    }: { attempts?: number; pause?: number; sleep?: (ms: number) => Promise<void> } = {},
  ): Promise<Progress> {
    let current = progress;
    for (let index = 0; index < attempts; index += 1) {
      if (isDone(current)) return current;
      await sleep(pause);
      current = await this.progress(current.id);
    }
    return current;
  }
}

// --------------------------------------------------------------------------
// Reading what Canvas said
// --------------------------------------------------------------------------

/** Python's `%g`. */
const g = (value: number): string => String(Number(value.toPrecision(6)));

/**
 * Whether Canvas would rescale what we send. Null when it would not.
 *
 * Canvas stores a raw score against `points_possible`. Sending 80 to an
 * assignment worth 50 shows the student 160%, and Canvas will not object.
 */
export const scaleProblem = (
  assignment: Record<string, any>,
  maximum: number,
): string | null => {
  const points = assignment.points_possible;
  if (points === null || points === undefined) {
    return "the Canvas assignment has no points_possible, so a raw score has nothing to be out of";
  }
  if (Math.abs(Number(points) - Number(maximum)) > 0.01) {
    return (
      `Canvas has this assignment out of ${g(Number(points))} but the assessment ` +
      `here is out of ${g(Number(maximum))}. Sending a raw score would misreport ` +
      "it — change one of the two rather than scaling"
    );
  }
  return null;
};

export const visibilityNote = (assignment: Record<string, any>): string =>
  assignment.post_manually
    ? "This assignment posts manually: grades will be entered but hidden until you post them in Canvas."
    : "This assignment posts automatically: students will see these grades at once.";

/** Which Canvas field carries the key we match on. */
export const identityColumn = (by: MatchKey): string =>
  ({ "sis-id": "sis_user_id", login: "login_id", email: "email" })[by];

/**
 * Map our pseudonyms to Canvas user ids, and report who did not match.
 *
 * The names in the payload are ignored on purpose: this function returns
 * identifiers, so nothing downstream can accidentally write a student's name into
 * the workspace.
 */
export const canvasUserIds = (
  students: Record<string, any>[],
  directory: Directory,
  by: MatchKey,
): { mapped: Map<string, string>; unmatched: string[] } => {
  const fieldName = identityColumn(by);
  const mapped = new Map<string, string>();
  const unmatched: string[] = [];
  for (const student of students) {
    const value = student[fieldName];
    if (!value) {
      unmatched.push(String(student.id ?? "?"));
      continue;
    }
    const studentId = directory.pseudonymFor(String(value), by);
    if (studentId === null) {
      unmatched.push(String(student.id ?? "?"));
      continue;
    }
    mapped.set(studentId, String(student.id));
  }
  return { mapped, unmatched };
};

/**
 * Canvas's current score per pseudonym.
 *
 * An excused submission is not a zero, and neither is an ungraded one. Both read
 * as "no value", which is what keeps them out of a drift report.
 */
export const apiCurrentScores = (
  submissions: Record<string, any>[],
  userToStudent: Map<string, string>,
): Record<string, number | null> => {
  const byUser = new Map([...userToStudent].map(([studentId, userId]) => [userId, studentId]));
  const scores: Record<string, number | null> = {};
  for (const submission of submissions) {
    const studentId = byUser.get(String(submission.user_id));
    if (studentId === undefined) continue;
    if (submission.excused || UNGRADED_STATES.has(submission.workflow_state)) {
      scores[studentId] = null;
      continue;
    }
    const score = submission.score;
    scores[studentId] = score === null || score === undefined ? null : Number(score);
  }
  return scores;
};
