/**
 * Adding a connection to the registry, and the read-only probes that check a
 * token before it is stored: who it belongs to, which courses and assignments
 * it can see.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";

import { AINAR_CLI } from "./actions.js";

/**
 * Write one connection into the registry, by spawning the CLI.
 *
 * Spawned rather than written here, for the reason `runPublish` gives about
 * approval: the rules for what a usable connection is — HTTPS only, a numeric
 * Canvas course id, which variable each type defaults to — live in
 * `src/connections/`, and a second writer in this file would have its own
 * version of them, held to nothing. `ainar connections add` refuses what it
 * cannot use and prints why, and that text is what the professor sees.
 *
 * It cannot carry a credential: the command has no `--token` flag. The token
 * goes through the credential seam separately, in the route below.
 */
export const addConnection = (root, fields) =>
  new Promise((resolve) => {
    if (!existsSync(AINAR_CLI)) {
      resolve({ error: `The TypeScript ainar CLI is not at ${AINAR_CLI}.` });
      return;
    }
    const args = ["--experimental-strip-types", AINAR_CLI, "connections", "add", fields.name];
    for (const [flag, value] of [
      ["--type", fields.type],
      ["--base-url", fields.baseUrl],
      ["--course-id", fields.courseId],
      ["--chat-id", fields.chatId],
    ]) {
      if (value) args.push(flag, String(value));
    }
    if (fields.makeDefault) args.push("--default");

    execFile(
      process.execPath,
      args,
      { cwd: root, timeout: 30000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        const output = [stdout, stderr].filter(Boolean).join("\n").trim();
        if (error) {
          resolve({ error: output || String(error.message ?? error) });
          return;
        }
        resolve({ ok: true, output });
      },
    );
  });

/**
 * A name for a host a professor will recognise: `canvas.narxoz.kz` becomes
 * `canvas-narxoz`.
 *
 * Derived rather than asked for. A connection name is a handle, it is editable
 * in the file afterwards, and one more field in a setup form is one more thing
 * to get wrong before anything works. Duplicated from `connections/legacy.ts`,
 * where the same heuristic names what a migration finds.
 */
const GENERIC_HOST_LABELS = new Set([
  "canvas",
  "www",
  "lms",
  "moodle",
  "elearning",
  "learn",
  "instructure",
]);

export const connectionNameFor = (type, baseUrl) => {
  let host;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return `${type}-main`;
  }
  const labels = host.split(".").filter(Boolean);
  const chosen = labels.find(
    (label) => !GENERIC_HOST_LABELS.has(label.toLowerCase()) && label.length > 2,
  );
  return `${type}-${(chosen ?? labels[0] ?? "main").toLowerCase()}`;
};

/**
 * Ask Canvas who the token belongs to. One read, and it proves the pair.
 *
 * Run at the end of setup so that "saved" means "Canvas answered", not "the
 * file was written". A host typed with a typo and a token that is fine are
 * indistinguishable in a config file and obvious the moment something asks.
 */
export const canvasWhoAmI = async (host, token) => {
  const response = await fetch(`${String(host).replace(/\/+$/, "")}/api/v1/users/self/profile`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `Canvas refused the token (${response.status}). Check it is current and belongs ` +
        "to an account that can see this course.",
    );
  }
  if (!response.ok) throw new Error(`Canvas returned ${response.status}.`);
  const body = await response.json();
  return body?.name ?? body?.login_id ?? (body?.id ? String(body.id) : null);
};

/**
 * Ask Telegram who the bot is. The Bot API puts the token in the path and
 * offers no alternative, so this is the one check that cannot keep a
 * credential out of a URL; it goes to api.telegram.org over HTTPS and the URL
 * is never logged or printed here.
 */
export const telegramWhoAmI = async (token) => {
  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
    headers: { accept: "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok !== true) {
    throw new Error(
      `Telegram refused (${response.status}): ${body?.description ?? "no detail"}. ` +
        "The token is the one @BotFather gave you.",
    );
  }
  const bot = body.result ?? {};
  return bot.username ? `@${bot.username}` : (bot.first_name ?? null);
};

/**
 * Ask Moodle for its site info, by POST.
 *
 * Every example in Moodle's documentation puts the token in the query string.
 * POST puts it in the body instead, which keeps a credential out of URLs and
 * proxy logs for the price of one header. Moodle also answers 200 and puts
 * the refusal in the body, so the status alone would report a dead token as a
 * working connection.
 */
export const moodleWhoAmI = async (host, token) => {
  const response = await fetch(`${String(host).replace(/\/+$/, "")}/webservice/rest/server.php`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      wstoken: token,
      wsfunction: "core_webservice_get_site_info",
      moodlewsrestformat: "json",
    }).toString(),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Moodle returned ${response.status}.`);
  if (body?.exception) {
    throw new Error(`Moodle refused the token: ${body.message ?? body.errorcode ?? body.exception}`);
  }
  return body?.sitename ?? body?.username ?? null;
};

/**
 * The id out of a Google Sheets URL, or the id itself.
 *
 * Everyone pastes the URL. Refusing it teaches nothing and extracting the id
 * is one split — the same accommodation `spreadsheetIdOf` makes in
 * `src/lms/sheets.ts`, for the same reason.
 */
export const spreadsheetIdFrom = (value) => {
  const cleaned = String(value ?? "").trim();
  if (!cleaned) return "";
  if (!cleaned.includes("docs.google.com") && !cleaned.startsWith("http")) return cleaned;
  let parts;
  try {
    parts = new URL(cleaned).pathname.split("/").filter(Boolean);
  } catch {
    return cleaned;
  }
  const index = parts.indexOf("d");
  return index >= 0 && index + 1 < parts.length ? parts[index + 1] : cleaned;
};

/**
 * One Canvas course's assignments, so an assessment is bound by picking a name.
 *
 * `points_possible` comes back with each, because it is the one field that
 * makes a suggestion checkable: two assignments can share a name and differ
 * by what they are out of, and a professor scanning a list of twenty-one
 * pairings needs something to disagree with.
 */
export const canvasAssignmentList = async (host, token, courseId) => {
  const url =
    `${String(host).replace(/\/+$/, "")}/api/v1/courses/${encodeURIComponent(courseId)}` +
    "/assignments?per_page=100";
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (response.status === 404) {
    throw new Error(`Canvas has no course ${courseId}, or this token cannot see it.`);
  }
  if (!response.ok) throw new Error(`Canvas returned ${response.status} listing assignments.`);
  const body = await response.json();
  if (!Array.isArray(body)) throw new Error("Canvas did not return a list of assignments.");
  return body
    .filter((entry) => entry && entry.id)
    .map((entry) => ({
      id: String(entry.id),
      name: entry.name ?? `Assignment ${entry.id}`,
      points: entry.points_possible ?? null,
      dueAt: entry.due_at ?? null,
    }));
};

/**
 * The courses this token can teach, so a subgroup is bound by picking a name.
 *
 * `enrollment_type=teacher` rather than every course the account can see: a
 * professor's list is short, and the alternative is a picker holding every
 * course they have ever been enrolled in as a student.
 */
export const canvasCourseList = async (host, token) => {
  const url =
    `${String(host).replace(/\/+$/, "")}/api/v1/courses` +
    "?enrollment_type=teacher&enrollment_state=active&per_page=100";
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Canvas returned ${response.status} listing courses.`);
  const body = await response.json();
  if (!Array.isArray(body)) throw new Error("Canvas did not return a list of courses.");
  return body
    .filter((course) => course && course.id)
    .map((course) => ({
      id: String(course.id),
      name: course.name ?? course.course_code ?? `Course ${course.id}`,
      code: course.course_code ?? null,
      term: course.term?.name ?? null,
    }));
};
