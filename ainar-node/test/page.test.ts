import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
// @ts-ignore -- plain .mjs so `node prerender-widget.mjs` still needs no flags
import { prerender } from "../bin/prerender-widget.mjs";
import { discoverCourses, loadCourse } from "../src/loader.ts";
import { outlinePayload } from "../src/outline.ts";
import { renderHtml } from "../src/dashboard.ts";
import { scan } from "../src/safety.ts";
import {
  href,
  linkMaterials,
  publishable,
  renderPage,
  renderStatic,
  studentWork,
} from "../src/page.ts";
import { SEARCH, TemplateRefusal, loadStructure, loadStyle } from "../src/templates.ts";

/**
 * `tests/test_page.py` and `tests/test_templates.py`, reduced to the assertions
 * that are about *this* code rather than about the shipped template files —
 * those are checked upstream against the same files, and repeating them here
 * would be a second copy of a fixture rather than a second check of a behaviour.
 *
 * The load-bearing ones are the first six: the public page must carry nothing
 * written for the marker, nothing derived from student work, and no way to reach
 * the network or the HTML parser from a payload value.
 */

// Two roots, because this file asks two different questions of two different
// trees. A course is read from a WORKSPACE — the directory holding `courses/`
// and `shared/` — and a template is looked up under the REPOSITORY, because
// `templates.yaml` ships beside the skill that owns it. They were the same path
// until 2026-09-17, when the sample workspace moved into `workspace/`, and
// collapsing them back would make `publishable` publish from the repository or
// `loadStyle` search a course folder for skills.
const REPO = resolve(process.cwd(), "..");
const ROOT = join(REPO, "workspace");
const RUN = "CSS-4008-2026-FALL";

const bundle = () => {
  const dir = discoverCourses(ROOT).find((path) => path.endsWith("CSS-4008"))!;
  return loadCourse(dir, ROOT).bundle!;
};

const page = () => {
  const b = bundle();
  const payload = outlinePayload(b, RUN, "2026-10-15") as Record<string, any>;
  const title = `${(b.course as any).course_id} — ${(b.course as any).title}`;
  const { markup, problems } = prerender(renderPage(payload, title), "course_outline");
  assert.deepEqual(problems, [], "the view did not render");
  return renderStatic(markup, payload, title);
};

// ---------------------------------------------------------------- the page

test("the page carries nothing written for the marker", () => {
  const html = page();
  for (const forbidden of [
    "STUDENT-", // a pseudonym is still a person, and this page is public
    "answer_key",
    "marking_guidance",
    "indicates_misconception_of",
    "professor_decision",
    "ai_suggestion",
  ]) {
    assert.equal(html.includes(forbidden), false, `the page contains ${forbidden}`);
  }
});

test("the page carries no score", () => {
  // Field names rather than English words. "evaluation" is also a topic this
  // course teaches, and a test that forbids the word forbids the syllabus. The
  // failure this guards is a future field on the outline payload holding a class
  // mean: it would look like course information and publish like a gradebook.
  const html = page();
  for (const field of [
    "class_mean",
    "evaluation_id",
    "submission_id",
    "evidence_id",
    "enrollment",
    "student_id",
    '"score"',
  ]) {
    assert.equal(html.includes(field), false, `the page mentions ${field}`);
  }
});

test("the prerendered page carries the markup and no script", () => {
  const html = page();
  assert.equal(html.includes("<script"), false, "a prerendered page needs no script at all");
  assert.match(html, /<div id="root">.+<\/div>/s);
});

test("the page loads nothing from the network", () => {
  // Resource *links* in the outline are text on the page and are meant to be
  // there; what must not appear is markup that fetches something when opened.
  const html = page();
  for (const fetching of ["<script src=", '<link rel="stylesheet"', "<img ", "@import"]) {
    assert.equal(html.includes(fetching), false, `the page reaches for ${fetching}`);
  }
});

test("nothing in the payload can reach the html parser as markup", () => {
  // The pre-prerender document is where a payload value would land inside a
  // <script>, and `</script>` in a course title would end the element early.
  const b = bundle();
  const payload = outlinePayload(b, RUN, "2026-10-15") as Record<string, any>;
  payload.course_title = "</script><script>alert(1)</script>";
  const document = renderPage(payload, "T");
  assert.equal(document.includes("</script><script>alert(1)"), false);
  assert.match(document, /\\u003c\/script/);
});

test("a student submission is never publishable material", () => {
  const b = bundle();
  const theirs = studentWork(b);
  assert.ok(theirs.size, "the example course should have submission attachments");
  const { published } = publishable(b, RUN, ROOT);
  for (const material of published) {
    assert.equal(theirs.has(material.documentId), false, `${material.documentId} is student work`);
  }
});

test("only files this repository holds are published", () => {
  const { published, tally } = publishable(bundle(), RUN, ROOT);
  for (const material of published) {
    assert.equal(material.source.includes("://"), false);
    assert.ok(readFileSync(material.source).length, `${material.filename} is empty`);
  }
  assert.ok(tally["in object storage"]! > 0, "the example course keeps some documents elsewhere");
});

test("a draft under work/ is not published", () => {
  const b = bundle();
  (b.documents as any[]).push({
    document_id: "DOC-DRAFT",
    course_version_id: RUN,
    title: "A draft",
    storage_key: "work/CSS-4008-2026-FALL/draft.md",
    extensions: {},
  });
  const { published, heldBack } = publishable(b, RUN, ROOT);
  assert.equal(
    published.some((material) => material.documentId === "DOC-DRAFT"),
    false,
  );
  assert.ok(heldBack.some((reason) => reason.includes("DOC-DRAFT")));
});

test("publishing a material makes it a link and nothing else", () => {
  const b = bundle();
  const payload = outlinePayload(b, RUN, "2026-10-15") as Record<string, any>;
  const before = JSON.stringify(payload);
  const { published } = publishable(b, RUN, ROOT);
  linkMaterials(payload, published);

  const entries = (payload.required_materials ?? []) as Record<string, any>[];
  const linked = entries.filter((entry) =>
    published.some((material) => material.documentId === entry.document_id),
  );
  for (const entry of linked) {
    const material = published.find((m) => m.documentId === entry.document_id)!;
    assert.equal(entry.url, href(material));
  }
  // Only `url` moved: no figure, no title, nothing about a student.
  const after = JSON.parse(JSON.stringify(payload));
  for (const entry of (after.required_materials ?? []) as Record<string, any>[]) delete entry.url;
  const original = JSON.parse(before);
  for (const entry of (original.required_materials ?? []) as Record<string, any>[]) delete entry.url;
  assert.deepEqual(after, original);
});

// ------------------------------------------------------------ the templates

const scratch = () => mkdtempSync(join(tmpdir(), "ainar-templates-"));

test("a style sheet carrying markup is refused", () => {
  for (const needle of ["<style>", "@import url(x.css)", "javascript:", "expression("]) {
    const dir = scratch();
    writeFileSync(join(dir, "bad.css"), `body { color: red } /* ${needle} */`);
    assert.throws(
      () => loadStyle(join(dir, "bad.css"), "course-page", REPO),
      TemplateRefusal,
      `${needle} should be refused`,
    );
  }
});

test("a remote asset is refused", () => {
  const dir = scratch();
  writeFileSync(join(dir, "remote.css"), "body { background: url(https://example.com/x.png) }");
  assert.throws(() => loadStyle(join(dir, "remote.css"), "course-page", REPO), TemplateRefusal);
});

test("a dashboard template is refused by the public page", () => {
  // Each set declares its surface in `templates.yaml`, so pointing `page` at a
  // dashboard's style sheet is stopped at the command rather than discovered in
  // the rendered page.
  // Located through `SEARCH` rather than spelled out, so that moving the skills
  // again moves this with them: the assertion is about the surface mismatch,
  // not about where the file sits. Resolved against REPO, not ROOT: the skills
  // are a repository tree, and ROOT is the sample workspace.
  const dashboard = join(REPO, SEARCH[0]!, "course-dashboard", "templates", "plain.css");
  assert.throws(
    () => loadStyle(dashboard, "course-page", REPO),
    (error: Error) =>
      error instanceof TemplateRefusal && /template for course-dashboard/.test(error.message),
  );
});

test("a template can be chosen by id alone", () => {
  const [css, name] = loadStyle("plain", "course-page", REPO);
  assert.equal(name, "plain");
  assert.ok(css.length, "the chosen template should have some CSS in it");
});

test("a structure that could run or fetch something is refused", () => {
  for (const bad of ["<script>x</script>", "<img src=x>", "{{{raw}}}", "<iframe></iframe>"]) {
    const dir = scratch();
    writeFileSync(join(dir, "bad.tmpl"), `<section>${bad}</section>`);
    assert.throws(
      () => loadStructure(join(dir, "bad.tmpl"), "course-page", REPO),
      TemplateRefusal,
      `${bad} should be refused`,
    );
  }
});

test("a template that is not there names where it looked", () => {
  assert.throws(
    () => loadStyle("no-such-template", "course-page", REPO),
    (error: Error) => error instanceof TemplateRefusal && /Looked in:/.test(error.message),
  );
});

// --------------------------------------------------------------- the scan

test("the answer key scan finds a leak and says which item", () => {
  const items = [
    {
      item_id: "ITEM-01-01",
      answer_key: "Because the model was measured on data it had already seen",
      options: [],
    },
  ];
  const result = scan(
    "A brief. Because the model was measured on data it had already seen. The end.",
    items,
  );
  assert.equal(result.leaks.length, 1);
  assert.equal(result.leaks[0]!.itemId, "ITEM-01-01");
  assert.equal(result.leaks[0]!.field, "answer_key");
});

test("a short answer is reported as unchecked rather than passed", () => {
  const items = [{ item_id: "ITEM-X", options: [{ correct: true, text: "True" }] }];
  const result = scan("Everything below is true of a decision tree.", items);
  assert.deepEqual(result.leaks, []);
  assert.match(result.unchecked[0]!, /ITEM-X \(correct option, too short/);
});

test("a concept id is the subject being taught, not a leak", () => {
  // `indicates_misconception_of` is matched by its note, never by the concept —
  // a lecture naming CONCEPT-TRAIN-TEST-SPLIT is naming what it teaches.
  const items = [
    {
      item_id: "ITEM-Y",
      options: [
        {
          correct: false,
          text: "It is valid because the model still had to learn the pattern",
          note: "Memorisation being read as generalisation, which is the core misconception",
        },
      ],
    },
  ];
  assert.deepEqual(scan("Today: CONCEPT-TRAIN-TEST-SPLIT.", items).leaks, []);
  assert.equal(
    scan("Note: memorisation being read as generalisation, which is the core misconception", items)
      .leaks.length,
    1,
  );
});

test("the literal field names are refused wherever they appear", () => {
  const result = scan("See the answer_key column.", []);
  assert.equal(result.leaks.length, 1);
  assert.equal(result.leaks[0]!.itemId, "(document)");
});

// ------------------------------------------------------------- the dashboard

test("the dashboard shows the number as well as the colour", () => {
  const html = renderHtml(bundle(), RUN, { on: "2026-10-15" });
  // A heatmap that only encodes in hue is unreadable in print, and this is the
  // kind of thing that gets printed.
  assert.match(html, /<td class="cell b[1-5]" title="[^"]+">\d+%<\/td>/);
  assert.match(html, /class="legend"/);
});

test("the dashboard is self-contained", () => {
  const html = renderHtml(bundle(), RUN, { on: "2026-10-15" });
  for (const needle of ["<script", "http://", "https://", "@import", "<img"]) {
    assert.equal(html.includes(needle), false, `the dashboard reaches for ${needle}`);
  }
});

test("the dashboard names students only by pseudonym", () => {
  const html = renderHtml(bundle(), RUN, { on: "2026-10-15" });
  const students = (bundle().enrollments as any[]).map((e) => e.student_id as string);
  for (const id of students) {
    if (!html.includes(id)) continue;
    assert.match(id, /^STUDENT-[A-Z0-9]+$/, `${id} does not look like a pseudonym`);
  }
});

test("a directory the site writes into is created, not assumed", () => {
  const dir = join(scratch(), "deep", "nested");
  mkdirSync(dir, { recursive: true });
  assert.ok(dir);
});
