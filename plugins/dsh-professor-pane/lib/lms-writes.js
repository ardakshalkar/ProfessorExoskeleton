/**
 * The Canvas catalogue request and the writes to `extensions.lms` on a run or
 * assessment record — the LMS facts the professor records from the pane.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative, sep } from "node:path";

import { assessmentsOf, groupsOf, requireGroups, runById } from "@ainar/core/src/bundle.ts";
import { writeAssessmentLinks } from "@ainar/core/src/lms/link.ts";
// `parseDocument` rather than the plain parse: these writes edit a file a
// professor also writes by hand, and the plain parse would hand back a JS
// object with every comment in `version.yaml` already discarded.
import { parseDocument as parseYamlDocument } from "yaml";

import {
  CANVAS_COURSES_KEY,
  CANVAS_SECTIONS_KEY,
  LMS_EXTENSION,
  lmsString,
  versionRecordPath,
} from "./integrations.js";
import { loadedRun } from "./workspace.js";

/**
 * Canvas's sections and student groups for one course, fetched live.
 *
 * The one outbound request this plugin makes, and everything about how it is
 * reached follows from that:
 *
 * * **POST, not GET.** It is a read as far as Canvas is concerned, so GET would
 *   be the honest verb — but it spends the professor's API quota and sends a
 *   grade-changing token, and this file's rule for that is already written on
 *   `/api/publish`: a side effect behind a GET is one a link, a prefetch, a
 *   refresh or a replayed history entry can fire without anybody having decided
 *   to. A professor pressing `Fetch from Canvas` has decided to.
 * * **No caching.** The answer is a list of sections a registrar edits, and a
 *   stale one would be mapped against by mistake.
 * * **Two read-only endpoints and no others.** There is no branch here that can
 *   write to Canvas.
 *
 * Pagination is Canvas's `Link` header. Bounded at ten pages, because a
 * thousand sections is not a course, it is a wrong course id — and an unbounded
 * follow would sit here spending quota on discovering that.
 */
export const canvasCatalogue = async (courseId, host, token) => {
  const api = host.replace(/\/+$/, "") + "/api/v1";
  const read = async (collection, params) => {
    const rows = [];
    let next =
      `${api}/courses/${encodeURIComponent(courseId)}/${collection}?per_page=100` +
      (params ? `&${params}` : "");
    for (let page = 0; page < 10 && next; page += 1) {
      const response = await fetch(next, {
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!response.ok) {
        // The status and Canvas's own sentence. Never the request, which is
        // where the Authorization header is.
        let detail = "";
        try {
          detail = (await response.text()).slice(0, 400);
        } catch {
          detail = "";
        }
        throw new Error(
          `Canvas answered ${response.status} for ${collection}` + (detail ? `: ${detail}` : ""),
        );
      }
      const body = await response.json();
      if (Array.isArray(body)) rows.push(...body);
      const found = /<([^>]+)>\s*;\s*rel="next"/.exec(response.headers.get("link") || "");
      next = found ? found[1] : null;
    }
    return rows;
  };

  // Both, because both are called "groups" in conversation and guessing which
  // one the professor meant is how this control would end up mapping the wrong
  // thing. Sections are what a registrar-fed course is actually divided by;
  // student groups are the professor's own grouping, and each is labelled as
  // what it is so the choice is theirs rather than this function's.
  const [sections, groups] = await Promise.all([
    read("sections", "include[]=total_students"),
    read("groups", null),
  ]);

  const option = (row, kind) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? row.id ?? ""),
    kind,
    students:
      typeof row.total_students === "number"
        ? row.total_students
        : typeof row.members_count === "number"
          ? row.members_count
          : null,
    sisId: row.sis_section_id ? String(row.sis_section_id) : null,
  });

  return {
    host: host.replace(/\/+$/, ""),
    courseId: String(courseId),
    options: [
      ...sections.map((row) => option(row, "section")),
      ...groups.map((row) => option(row, "group")),
    ].filter((entry) => entry.id !== ""),
  };
};

/**
 * Write the Canvas selection into the run record.
 *
 * The third write verb in this pane, and the first that touches `courses/`. Why
 * it is allowed to, where a grade is not:
 *
 * Approval is for DRAFTS — claims about students and about what the course
 * teaches, produced by an agent and marked `approval: draft`, which a professor
 * has to read before anything student-facing uses them. This writes neither. It records which
 * Canvas section corresponds to which subgroup: a fact about the professor's
 * own LMS that only they know, that no skill drafts and no agent can propose,
 * and that therefore has no drafted half to accept. Refusing it
 * would not protect the record — it would mean the fact stays settable only by
 * hand-editing YAML, which is the friction this tab exists to remove.
 *
 * What it borrows from `approve` is the care:
 *
 * * **`extensions.lms.canvas_sections` and nothing else.** The document is
 *   re-read, that one key is replaced, everything else written back untouched.
 *   No path here can reach `start_date`, `status` or `instructors`.
 * * **Comments survive**, through `parseDocument` rather than `parse`.
 *   `version.yaml` opens with a comment explaining the version/run merge, and a
 *   save that silently deleted a professor's writing would be a bug worse than
 *   the friction it removed. `writePreferences` may use the plain emitter
 *   because it owns its file whole; this one does not own the file at all.
 * * **A subgroup this run has never heard of is refused**, by `requireGroups`,
 *   for that function's own reason. A typo'd label would otherwise sit in the
 *   record binding a Canvas section to a cohort that does not exist.
 */
export const writeCanvasSelection = (workspace, root, runId, selections) => {
  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId);
  if (!run) return { error: `no course run '${runId}' in this workspace` };
  if (!run.course_id || !run.term) {
    return { error: `${runId} carries no course_id and term, so its record cannot be located.` };
  }
  if (!Array.isArray(selections)) return { error: "The selection must be a list." };
  if (selections.length > 200) return { error: "That is more than 200 selections." };

  const cleaned = [];
  const seen = new Set();
  for (const entry of selections) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { error: "Each selection must be an object." };
    }
    const id = String(entry.id ?? "").trim();
    if (!id) return { error: "A selection with no Canvas id cannot be recorded." };
    if (!/^[0-9]+$/.test(id)) return { error: `${id} is not a Canvas id.` };
    const kind = entry.kind === "group" ? "group" : "section";
    if (seen.has(`${kind}:${id}`)) continue;
    seen.add(`${kind}:${id}`);
    const group = String(entry.group ?? "").trim();
    // Throws on a label this run does not have, which is the point of asking
    // the bundle rather than trusting the form.
    if (group) requireGroups(bundle, runId, [group]);
    const row = { id, kind };
    const name = String(entry.name ?? "").trim();
    if (name) row.name = name;
    if (group) row.group = group;
    cleaned.push(row);
  }

  const path = versionRecordPath(root, run.course_id, run.term);
  if (!existsSync(path)) return { error: `Nowhere to write: ${path} does not exist.` };

  let original;
  let document;
  try {
    original = readFileSync(path, "utf8");
    document = parseYamlDocument(original);
  } catch (error) {
    return { error: `${path} will not parse: ${String(error?.message ?? error)}` };
  }
  if (document.errors?.length) {
    return { error: `${path} will not parse: ${document.errors[0].message}` };
  }

  if (cleaned.length === 0) {
    // An empty selection REMOVES the key rather than writing an empty list, by
    // the grammar `writePreferences` states: absent and "set to nothing" are
    // different facts about a record, and unmapping every section should leave
    // the file saying nothing at all about Canvas sections. The now-empty
    // parents go with it, so a run that was never wired to Canvas reads exactly
    // as it did before this tab was ever opened.
    document.deleteIn(["extensions", LMS_EXTENSION, CANVAS_SECTIONS_KEY]);
    const emptied = (node) => node && Array.isArray(node.items) && node.items.length === 0;
    if (emptied(document.getIn(["extensions", LMS_EXTENSION]))) {
      document.deleteIn(["extensions", LMS_EXTENSION]);
    }
    if (emptied(document.get("extensions"))) document.delete("extensions");
  } else {
    document.setIn(["extensions", LMS_EXTENSION, CANVAS_SECTIONS_KEY], cleaned);
  }

  // The emitter always produces LF. A `version.yaml` that arrived with CRLF —
  // one edited on Windows in something that is not an editor — would otherwise
  // come back with every line changed, and a one-selection change would show up
  // in `git diff` as a rewrite of the whole record. The endings the professor
  // had are the endings they keep.
  const written = /\r\n/.test(original)
    ? String(document).replace(/\r?\n/g, "\r\n")
    : String(document);
  writeFileSync(path, written, "utf8");
  return {
    written: true,
    path: relative(root, path).split(sep).join("/"),
    count: cleaned.length,
  };
};

/**
 * Write each assessment's Canvas assignment linkage into its own record.
 *
 * The fourth writer here and the only one that edits a file other than
 * `version.yaml`, which brings two things worth stating.
 *
 * **Which file.** `RECORD_GLOBS` accepts `assessments.yaml`
 * and `assessments/*.yaml`, so an assessment sits wherever it
 * was authored or approved into. The file is found by scanning for the id as
 * a value of `assessment_id`, the way `withRecordPaths` does for the same
 * reason: guessing `generated.yaml` is right until somebody hand-authors one,
 * and then it silently edits the wrong record.
 *
 * **The header that says not to.** Files the record writer produces carry a
 * machine-managed header, and this edits them. The line that makes it defensible: approval is a gate on
 * *decisions* — what a student was given, what an outcome claims — and a
 * Canvas assignment id is neither. It is a pointer at another system, it
 * carries no academic content, it changes when somebody rebuilds a Canvas
 * shell, and nothing about it is a judgement anybody should have to re-accept.
 * Every other field in the record is left exactly as it was.
 *
 * A multi-document file is refused rather than rewritten. The emitter would
 * have to reproduce the separators and the per-document formatting, and a
 * half-right rewrite of a professor's records is worse than an honest refusal
 * naming the file.
 */
export const recordAssessmentLinks = (workspace, root, runId, links) => {
  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId);
  if (!run) return { error: `no course run '${runId}' in this workspace` };
  if (!run.course_id || !run.term) {
    return { error: `${runId} carries no course_id and term, so its records cannot be located.` };
  }
  if (!links || typeof links !== "object" || Array.isArray(links)) {
    return { error: "The links must be an object of assessment id to Canvas assignment id." };
  }

  const known = new Set(assessmentsOf(bundle, runId).map((entry) => entry.assessment_id));
  const groups = new Set(groupsOf(bundle, runId));

  // Normalise every entry first, so a single bad value stops the whole write
  // rather than leaving half the assessments edited.
  const wanted = new Map();
  for (const [assessmentId, value] of Object.entries(links)) {
    if (!known.has(assessmentId)) {
      return { error: `${assessmentId} is not an assessment of ${runId}.` };
    }
    if (value === null || value === "" || value === undefined) {
      wanted.set(assessmentId, null);
      continue;
    }
    if (typeof value === "object" && !Array.isArray(value)) {
      const mapping = {};
      for (const [group, id] of Object.entries(value)) {
        if (!groups.has(group)) {
          return { error: `${runId} has no subgroup '${group}'.` };
        }
        const cleaned = String(id ?? "").trim();
        if (!cleaned) continue;
        if (!/^[0-9]+$/.test(cleaned)) {
          return { error: `'${cleaned}' is not a Canvas assignment id — the API takes the number.` };
        }
        mapping[group] = cleaned;
      }
      wanted.set(assessmentId, Object.keys(mapping).length ? mapping : null);
      continue;
    }
    const cleaned = String(value).trim();
    if (!/^[0-9]+$/.test(cleaned)) {
      return { error: `'${cleaned}' is not a Canvas assignment id — the API takes the number.` };
    }
    wanted.set(assessmentId, cleaned);
  }
  if (!wanted.size) return { written: false, count: 0 };

  // ---- and hand the editing to the one writer -----------------------------
  //
  // Finding the file, refusing a multi-document one, editing through the YAML
  // document API so the comments survive, and keeping the line endings — all
  // of that is `lms/link.js`, which `ainar lms assignment-push` also calls.
  // This route used to hold a second copy of it, and two copies of a rule
  // about rewriting a professor's records is one copy too many.
  //
  // What stays here is validation of an untrusted browser payload, above:
  // whether the run exists, whether the assessment is in it, whether a
  // subgroup is one the run has, whether an id is the number the API takes.
  // That belongs where the payload arrives, not in a module the CLI shares.
  try {
    const recorded = writeAssessmentLinks(root, run.course_id, run.term, wanted);
    return { written: recorded.count > 0, count: recorded.count, files: recorded.written };
  } catch (error) {
    // The shared writer throws; this route answers in-band, because its caller
    // is a `fetch` in the browser half and a sentence is what it draws.
    return { error: String(error?.message ?? error) };
  }
};

/**
 * Set or clear one scalar under `extensions.lms` on the run record.
 *
 * The third writer of this file and the last one that needed writing, so it
 * is the general shape the other two are special cases of: edit the document
 * rather than rewrite it, delete the key and its emptied parents rather than
 * write a blank, and keep the line endings the file arrived with.
 */
export const writeRunLmsValue = (workspace, root, runId, key, value) => {
  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId);
  if (!run) return { error: `no course run '${runId}' in this workspace` };
  if (!run.course_id || !run.term) {
    return { error: `${runId} carries no course_id and term, so its record cannot be located.` };
  }

  const path = versionRecordPath(root, run.course_id, run.term);
  if (!existsSync(path)) return { error: `Nowhere to write: ${path} does not exist.` };

  let original;
  let document;
  try {
    original = readFileSync(path, "utf8");
    document = parseYamlDocument(original);
  } catch (error) {
    return { error: `${path} will not parse: ${String(error?.message ?? error)}` };
  }
  if (document.errors?.length) {
    return { error: `${path} will not parse: ${document.errors[0].message}` };
  }

  const cleaned = String(value ?? "").trim();
  if (!cleaned) {
    document.deleteIn(["extensions", LMS_EXTENSION, key]);
    const emptied = (node) => node && Array.isArray(node.items) && node.items.length === 0;
    if (emptied(document.getIn(["extensions", LMS_EXTENSION]))) {
      document.deleteIn(["extensions", LMS_EXTENSION]);
    }
    if (emptied(document.get("extensions"))) document.delete("extensions");
  } else {
    document.setIn(["extensions", LMS_EXTENSION, key], cleaned);
  }

  const written = /\r\n/.test(original)
    ? String(document).replace(/\r?\n/g, "\r\n")
    : String(document);
  writeFileSync(path, written, "utf8");
  return { written: true, path: relative(root, path).split(sep).join("/"), key, cleared: !cleaned };
};

/**
 * Write `extensions.lms.canvas_courses` — one Canvas course per subgroup.
 *
 * The same shape and the same care as `writeCanvasSelection` next door: the
 * document is edited rather than rewritten so a professor's comments and key
 * order survive, an empty mapping removes the key and its emptied parents
 * rather than writing `{}`, and the line endings the file arrived with are the
 * ones it leaves with.
 *
 * Two refusals of its own:
 *
 * **A subgroup this run does not have is rejected**, by `requireGroups`, for
 * that function's reason — a typo'd label would sit in the record binding a
 * Canvas course to a cohort that does not exist, and at push time it reads as
 * "that subgroup has no Canvas course" rather than as the typo it is.
 *
 * **Writing this while `canvas_course_id` is set is rejected.** The validator
 * calls that `lms.both_course_forms` and so does this: two answers to which
 * Canvas course a run is would be settled by whichever code path read first,
 * and the cost of reading wrong is one cohort's marks in another's gradebook.
 * The professor is told to clear the single id first, in those words.
 */
export const writeCanvasCourses = (workspace, root, runId, mapping) => {
  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId);
  if (!run) return { error: `no course run '${runId}' in this workspace` };
  if (!run.course_id || !run.term) {
    return { error: `${runId} carries no course_id and term, so its record cannot be located.` };
  }
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
    return { error: "The mapping must be an object of subgroup to Canvas course id." };
  }

  const entries = Object.entries(mapping);
  if (entries.length > 100) return { error: "That is more than 100 subgroups." };

  const cleaned = {};
  for (const [group, value] of entries) {
    const label = String(group ?? "").trim();
    if (!label) return { error: "A mapping entry with no subgroup cannot be recorded." };
    const id = String(value ?? "").trim();
    // An entry with no id is an unmapping, not an error: the form sends every
    // subgroup it drew, and the ones still to be decided arrive empty.
    if (!id) continue;
    if (!/^[0-9]+$/.test(id)) {
      return {
        error:
          `'${id}' is not a Canvas course id. The API takes the number, which is the ` +
          "one in the course URL.",
      };
    }
    requireGroups(bundle, runId, [label]);
    cleaned[label] = id;
  }

  const singleId = lmsString(run, "canvas_course_id");
  if (Object.keys(cleaned).length && singleId) {
    return {
      error:
        `This run already sets extensions.lms.canvas_course_id to ${singleId}, which says ` +
        "the whole run is one Canvas course. Clear that first — a record holding both " +
        "forms has two answers to which course a push should reach.",
    };
  }

  const path = versionRecordPath(root, run.course_id, run.term);
  if (!existsSync(path)) return { error: `Nowhere to write: ${path} does not exist.` };

  let original;
  let document;
  try {
    original = readFileSync(path, "utf8");
    document = parseYamlDocument(original);
  } catch (error) {
    return { error: `${path} will not parse: ${String(error?.message ?? error)}` };
  }
  if (document.errors?.length) {
    return { error: `${path} will not parse: ${document.errors[0].message}` };
  }

  if (!Object.keys(cleaned).length) {
    document.deleteIn(["extensions", LMS_EXTENSION, CANVAS_COURSES_KEY]);
    const emptied = (node) => node && Array.isArray(node.items) && node.items.length === 0;
    if (emptied(document.getIn(["extensions", LMS_EXTENSION]))) {
      document.deleteIn(["extensions", LMS_EXTENSION]);
    }
    if (emptied(document.get("extensions"))) document.delete("extensions");
  } else {
    document.setIn(["extensions", LMS_EXTENSION, CANVAS_COURSES_KEY], cleaned);
  }

  const written = /\r\n/.test(original)
    ? String(document).replace(/\r?\n/g, "\r\n")
    : String(document);
  writeFileSync(path, written, "utf8");
  return {
    written: true,
    path: relative(root, path).split(sep).join("/"),
    count: Object.keys(cleaned).length,
  };
};
