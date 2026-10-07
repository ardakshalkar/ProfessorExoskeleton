/**
 * The pane's HTTP plumbing: the route prefix, reading a request body, and
 * writing a response. Nothing here knows about a course.
 */

import { escapeText } from "./markdown.js";

/** Where every route in this file lives. Keep it in step with `lib/client.js`. */
export const BASE = "/professor-pane";

/**
 * A request body, with a ceiling on it.
 *
 * The two routes that read one — the preference form and the Canvas selection.
 * The cap is enforced on what arrives rather than trusted from
 * `content-length`, because that header is the sender's claim about the body
 * and this is the body.
 */
export const readBody = (req, limit = 256 * 1024) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("the request body is too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

/**
 * `text` embedded in a `<script>` as a JSON literal that cannot end the element.
 *
 * `JSON.stringify` alone is not enough: a payload containing the six characters
 * `</script` closes the element from inside a string literal, and course data
 * carries free text — a resource title, an outcome statement, a professor's
 * note. Escaping `<` costs nothing and is the same precaution
 * `dsh-ainar-course-model`'s own `jsString` takes, for the same reason.
 */
export const embed = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

export const send = (res, status, type, body) => {
  res.writeHead(status, {
    "content-type": type,
    // The pane is the professor's machine looking at the professor's course.
    // Nothing here should be sitting in a cache when the underlying YAML has
    // moved on, and the whole point of the pane is that a reload is current.
    "cache-control": "no-store",
  });
  res.end(body);
};

export const sendJson = (res, status, value) =>
  send(res, status, "application/json; charset=utf-8", JSON.stringify(value));

/** A request body as bytes, refused past `limit`. For a recorded answer. */
export const readBytes = (req, limit) =>
  new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error(`the recording is larger than ${Math.round(limit / 1024 / 1024)} MB`));
        req.destroy?.();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => (size ? resolveBody(Buffer.concat(chunks)) : reject(new Error("the recording is empty"))));
    req.on("error", reject);
  });

export const sendErrorPage = (res, text) =>
  send(
    res,
    200,
    "text/html; charset=utf-8",
    '<!doctype html><meta charset="utf-8">' +
      "<style>body{margin:0;padding:14px 16px;font:13px/1.55 system-ui,-apple-system,\"Segoe UI\",sans-serif;" +
      "color:#6b6b6b;background:transparent}" +
      "p{margin:0;border-left:3px solid currentColor;padding-left:10px}" +
      "@media(prefers-color-scheme:dark){body{color:#9a9a9a}}</style>" +
      "<p>" +
      escapeText(text) +
      "</p>",
  );
