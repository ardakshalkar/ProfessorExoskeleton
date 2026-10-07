/**
 * The `/file` routes: a brief, a starter, an outline or a material, served as
 * a page or as the file itself.
 */

import { readFileSync } from "node:fs";
import { basename, resolve, sep } from "node:path";

import { send, sendErrorPage, sendJson } from "./http.js";
// The pane's own text layer: HTML escaping, and the markdown renderer `/file`
// serves a brief and a deck through — see `test/pane-markdown.test.mjs`.
import { escapeText, MARKDOWN_STYLE, renderMarkdown } from "./markdown.js";
import { convertedPdf, CONVERTIBLE, starterReadme } from "./materials.js";
import { documentPage } from "./page.js";
import { viewPayload } from "./workspace.js";

/**
 * The MIME type a material is served as, by extension.
 *
 * A document carries `mime_type`, and that is what this uses when it looks
 * sane. The table is the fallback for a record that does not, and for the one
 * case where the recorded type is actively wrong — a deck registered as
 * `application/octet-stream` downloads as a nameless blob.
 */
const MIME_BY_EXTENSION = {
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
  md: "text/markdown; charset=utf-8",
  markdown: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  json: "application/json; charset=utf-8",
  ndjson: "application/x-ndjson",
  yaml: "text/plain; charset=utf-8",
  yml: "text/plain; charset=utf-8",
  py: "text/plain; charset=utf-8",
  js: "text/plain; charset=utf-8",
  html: "text/html; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
};

/**
 * The extensions this pane renders rather than hands over.
 *
 * Markdown is the project's own working format — `make-materials` writes a
 * deck as Marp markdown, `design-assessment` writes the brief students read as
 * markdown beside the YAML, and both say so in as many words — so it is the
 * one format where "serve the file" and "show the professor the document" are
 * different acts.
 */
const MARKDOWN_EXTENSIONS = new Set(["md", "markdown"]);

/**
 * The one thing a rendered document needs that every other view must not have:
 * a background of its own.
 *
 * `documentPage` paints `body` transparent on purpose — its pages are frames
 * INSIDE the pane's column, and the pane's own surface is meant to show
 * through. A rendered brief is the opposite case: it fills the overlay, and
 * `.pp-modalframe` in the browser half paints that frame `#fff`. So a
 * `dark=1` document, which sets `--fg` to near-white, was drawing pale grey
 * text on white — measured, not guessed. It is fixed here rather than by
 * darkening the frame, because the frame's white is the right default for a
 * FOREIGN HTML handout that assumes a light page and brings its own black
 * text; this is our document and knows its own palette.
 *
 * Both branches, in `documentPage`'s own shape: the harness's explicit choice
 * wins where there is one, and the machine's preference decides where there is
 * not.
 */
const MARKDOWN_GROUND = (dark) =>
  "<style>" +
  (dark
    ? "body{background:#1e1e1e}"
    : "body{background:#fff}" +
      "@media(prefers-color-scheme:dark){body{background:#1e1e1e}}") +
  "</style>";

/**
 * One markdown document as a page.
 *
 * The `<title>` is the document's own, because the overlay's header carries a
 * label and a browser tab does not: `Open in a tab ↗` on a nameless page put
 * `localhost:7411/professor-pane/file` in the tab strip.
 */
const markdownPage = (title, source, dark) =>
  documentPage(
    "<title>" +
      escapeText(title) +
      "</title>" +
      MARKDOWN_GROUND(dark) +
      MARKDOWN_STYLE +
      '<article class="md">' +
      renderMarkdown(source) +
      "</article>",
    dark,
  );

/**
 * Serve one material, addressed by the DOCUMENT that records it.
 *
 * By document id, never by path. The pane runs a web server on the professor's
 * own machine with their whole workspace under it, and a `?path=` parameter
 * would make that server a file browser for anything the process can read —
 * `../../.ssh/id_rsa` included. Addressing by `document_id` means the only
 * readable files are the ones the course record already names, and the record
 * is a thing a person curates.
 *
 * Two further limits, both belt and braces rather than the main defence:
 *
 * - a `storage_key` carrying a scheme (`object://…`) is refused. It is not a
 *   path in this repository and this route has no business resolving it.
 * - the resolved file must still sit inside the workspace root. A record whose
 *   key climbs out with `..` is a record that should not have validated, and
 *   this is the second place that becomes untrue rather than the first.
 *
 * Read-only, and no directory listing: a request that does not name a document
 * gets a sentence, not a browse.
 *
 * One format is transformed rather than served: markdown is rendered to HTML
 * here. See `MARKDOWN_EXTENSIONS` for why that is this route's job and not the
 * browser's.
 */
/**
 * One piece of graded work, as a page the overlay can frame.
 *
 * The chip in the outline used to open a sheet drawn INSIDE the widget's
 * frame, which is the wrong size for the job: the frame is one pane of the
 * harness, so a brief opened there is a dialog inside a column rather than
 * over the window, and it looked nothing like the overlay a deck or a PDF
 * opens into. This route is what lets the brief take that same overlay —
 * `openMaterial` needs a URL, and for the great majority of assessments there
 * is no file to point it at, so the page is composed here from the record.
 *
 * Markdown, and then the ordinary `markdownPage`, rather than markup of its
 * own. A brief that HAS a document already renders through that function, and
 * a brief that has only a description should not arrive in the same overlay
 * looking like it came from somewhere else. It also means the description is
 * treated exactly as every other authored text here is — rendered, not
 * injected; `renderMarkdown` escapes what it does not recognise.
 *
 * Addressed by run and assessment id, never by anything resembling a path. The
 * ids are looked up in the payload the pane already serves, so the only briefs
 * this can print are the ones the course record names — the same rule
 * `sendMaterial` follows, and for the same reason.
 */
export const sendBrief = (res, workspace, root, runId, assessmentId, withDrafts, dark) => {
  if (!runId) return sendJson(res, 200, { error: "no run chosen" });
  if (!assessmentId) return sendJson(res, 200, { error: "no assessment named" });

  let data;
  try {
    data = viewPayload(workspace, "course_outline", runId, null, withDrafts).payload;
  } catch (error) {
    return sendErrorPage(res, String(error.message ?? error));
  }

  const found = (data.assessments ?? []).find((a) => a && a.assessment_id === assessmentId);
  if (!found) {
    return sendErrorPage(res, `no assessment ${assessmentId} in ${runId}`);
  }

  const text = String(found.description ?? "").trim();
  if (!text) {
    return sendErrorPage(
      res,
      `${assessmentId} has no description yet, so there is nothing to read. ` +
        "The brief is the record's own text; write it there and it appears here.",
    );
  }

  // The same facts the chip's sheet carried, in the same order. A definition
  // list in markdown is a bulleted one — the renderer here is small on purpose
  // and this is not the place to grow it a new block type.
  const facts = [];
  const when = [
    found.opens_on ? `opens ${found.opens_on}` : "",
    found.due_on ? `due ${found.due_on}` : "",
  ].filter(Boolean);
  facts.push(`**Dates** — ${when.length ? when.join(", ") : "not scheduled"}`);
  facts.push(
    `**Weight** — ${found.weight == null ? "not set" : Math.round(found.weight * 100) + "%"}`,
  );
  if (found.maximum_score != null) facts.push(`**Out of** — ${found.maximum_score}`);
  const handed = (found.submission_type ?? []).join(", ");
  if (handed) facts.push(`**Handed in as** — ${handed}`);
  const outcomes = (found.outcomes ?? []).join(", ");
  if (outcomes) facts.push(`**Outcomes** — ${outcomes}`);
  facts.push(
    `**Rubric** — ${
      found.criteria
        ? found.criteria + (found.criteria === 1 ? " criterion" : " criteria")
        : "none yet"
    }`,
  );

  const title = String(found.title ?? assessmentId);
  const source = [
    `# ${title}`,
    "",
    ...facts.map((fact) => `- ${fact}`),
    "",
    text,
  ].join("\n");

  return send(res, 200, "text/html; charset=utf-8", markdownPage(title, source, dark === true));
};

/**
 * A homework's starter README, as a page the overlay can frame.
 *
 * Addressed by run and assessment id, never by path, for `sendMaterial`'s
 * reason: the only READMEs this can serve are ones in a folder the course
 * record already puts under an assessment.
 */
export const sendStarter = (res, workspace, root, runId, assessmentId, withDrafts, dark) => {
  if (!runId) return sendJson(res, 200, { error: "no run chosen" });
  if (!assessmentId) return sendJson(res, 200, { error: "no assessment named" });

  let data;
  try {
    data = viewPayload(workspace, "course_outline", runId, null, withDrafts).payload;
  } catch (error) {
    return sendErrorPage(res, String(error.message ?? error));
  }

  const found = (data.assessments ?? []).find((a) => a && a.assessment_id === assessmentId);
  if (!found) return sendErrorPage(res, `no assessment ${assessmentId} in ${runId}`);

  const full = starterReadme(root, String(data?.run?.course_id ?? ""), found);
  if (!full) return sendErrorPage(res, `${assessmentId} has no starter README on disk.`);

  let text;
  try {
    text = readFileSync(full, "utf8");
  } catch {
    return sendErrorPage(res, `${assessmentId}'s starter README could not be read.`);
  }
  const title = String(found.title ?? assessmentId);
  return send(res, 200, "text/html; charset=utf-8", markdownPage(title, text, dark === true));
};

/**
 * What was READ out of a deck, as a page the overlay can frame.
 *
 * The companion to `sendBrief`, and the same trade: `openMaterial` needs a URL,
 * and a `presentation_plan` is a record rather than a file, so the page is
 * composed here.
 *
 * It exists for one case in particular. A deck this course did not write is
 * registered by `ainar materials import`, which reads its slide text and
 * proposes what it teaches — and a proposal nobody can look at is a proposal
 * nobody can correct. The professor should be able to see the outline that was
 * extracted, how it was obtained, and which slides yielded nothing, WITHOUT
 * opening the .pptx and counting by hand.
 *
 * The caveats lead rather than trail. An outline read from slide text is a
 * different kind of claim from one somebody wrote, and a page that shows it
 * without saying so invites being read as authored.
 */
export const sendOutline = (res, workspace, root, documentId, dark) => {
  if (!documentId) return sendJson(res, 200, { error: "no document named" });

  let found = null;
  for (const courseId of workspace.courseIds()) {
    let loaded;
    try {
      loaded = workspace.load(courseId);
    } catch {
      continue;
    }
    if (loaded.bundle === null) continue;
    found = (loaded.bundle.documents ?? []).find((d) => d.document_id === documentId) ?? found;
    if (found) break;
  }
  if (!found) return sendErrorPage(res, `no document ${documentId} in this workspace`);

  const plan = found.presentation_plan;
  if (!plan || !Array.isArray(plan.slides) || plan.slides.length === 0) {
    return sendErrorPage(
      res,
      `${documentId} carries no presentation plan, so there is no outline to show.`,
    );
  }

  const origin = String(found.extensions?.origin ?? "");
  const readBy = String(found.extensions?.read_by ?? "");
  const silent = plan.slides.filter((s) => (s.concepts ?? []).length === 0).length;

  const source = [`# ${found.title ?? documentId}`, ""];
  if (origin === "imported") {
    source.push(
      "**This outline was read, not written.** " +
        (readBy === "text"
          ? "It comes from the slide text and the speaker notes of a deck this course did not author. "
          : readBy
            ? `It was obtained by ${readBy}. `
            : "") +
        "Each title is that slide's first line of text that is not running chrome, " +
        "and no slide type was inferred. The concepts are a proposal against this " +
        "course's own set — nothing here can name a concept the course does not have.",
      "",
    );
  }

  source.push(`- **Slides** — ${plan.slides.length}`);
  if (silent > 0) {
    source.push(
      `- **Matched no concept** — ${silent}. A text scan finds what is named; a slide ` +
        "that shows rather than names carries nothing it can see.",
    );
  }
  const union = [...new Set(plan.slides.flatMap((s) => s.concepts ?? []))];
  source.push(`- **Concepts across the deck** — ${union.length ? union.join(", ") : "none"}`);
  source.push("");

  for (const slide of plan.slides) {
    const concepts = (slide.concepts ?? []).join(", ");
    source.push(
      `${slide.number}. **${slide.title ?? "(untitled)"}**` +
        (concepts ? ` — ${concepts}` : " — *nothing matched*"),
    );
  }

  const title = String(found.title ?? documentId);
  return send(res, 200, "text/html; charset=utf-8", markdownPage(title, source.join("\n"), dark === true));
};

export const sendMaterial = (res, workspace, root, documentId, dark, asPdf) => {
  if (!documentId) return sendJson(res, 200, { error: "no document named" });

  let found = null;
  for (const courseId of workspace.courseIds()) {
    let loaded;
    try {
      loaded = workspace.load(courseId);
    } catch {
      continue;
    }
    if (loaded.bundle === null) continue;
    found = (loaded.bundle.documents ?? []).find((row) => row.document_id === documentId);
    if (found) break;
  }
  if (!found) return sendJson(res, 200, { error: `no document ${documentId} in this workspace` });

  const key = String(found.storage_key ?? "");
  if (!key || key.includes("://")) {
    return sendJson(res, 200, {
      error: `${documentId} is stored outside this repository (${key || "no storage_key"}), so the pane cannot serve it`,
    });
  }

  const full = resolve(root, key);
  const inside = resolve(root) + sep;
  if (!full.startsWith(inside)) {
    return sendJson(res, 200, { error: `${documentId} resolves outside the workspace` });
  }

  let body;
  try {
    body = readFileSync(full);
  } catch {
    return sendJson(res, 200, { error: `${key} is recorded but not on disk` });
  }

  let extension = (key.split(".").pop() ?? "").toLowerCase();

  // The professor asked to read a deck rather than download it, and this
  // machine has something that can render one. The original is untouched and
  // the overlay's "Open in a tab" still reaches it; what is served here is a
  // rendering, which is the only form of a .pptx a browser will paint.
  if (asPdf && CONVERTIBLE.has(extension)) {
    try {
      const pdf = convertedPdf(documentId, full);
      body = readFileSync(pdf);
      extension = "pdf";
    } catch (error) {
      // Said in words, in the panel, rather than as a blank frame. A professor
      // who sees "no LibreOffice on this machine" can act on it; one who sees
      // an empty box cannot tell that from a broken deck.
      return sendJson(res, 200, {
        error: `${documentId} could not be rendered for reading — ${String(error.message || error)}. ` +
          "It still opens in a tab, which is what the browser does with it.",
      });
    }
  }

  // Markdown becomes a page. The name it downloads under becomes `.html` with
  // it, because a file whose bytes are HTML and whose name ends `.md` is a
  // file the professor's editor opens as source.
  let name = basename(full);
  // A rendering downloads as a PDF, for the reason markdown downloads as HTML
  // below: a file whose bytes are one thing and whose name says another is a
  // file the professor's machine opens with the wrong application.
  if (asPdf && extension === "pdf" && !/\.pdf$/i.test(name)) {
    name = name.replace(/\.[^.]+$/, "") + ".pdf";
  }
  if (MARKDOWN_EXTENSIONS.has(extension)) {
    body = Buffer.from(
      markdownPage(String(found.title ?? name), body.toString("utf8"), dark === true),
      "utf8",
    );
    name = name.replace(/\.[^.]+$/, "") + ".html";
  }

  const type = MARKDOWN_EXTENSIONS.has(extension)
    ? "text/html; charset=utf-8"
    : (MIME_BY_EXTENSION[extension] ??
      (typeof found.mime_type === "string" && found.mime_type
        ? found.mime_type
        : "application/octet-stream"));

  res.setHeader("Content-Type", type);
  // `inline` so a deck opens in whatever the browser has rather than landing in
  // Downloads, and the filename so that when it does download it keeps its name.
  res.setHeader("Content-Disposition", `inline; filename="${name.replace(/"/g, "")}"`);
  res.setHeader("Content-Length", String(body.length));
  res.writeHead(200);
  res.end(body);
};
