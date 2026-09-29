/**
 * Publishing, and the line it keeps: a draft does not reach a student.
 *
 * Since 2026-09-29 a draft is a record in the course marked `approval: draft`,
 * and publishing approves nothing. These assert that against a real workspace
 * rather than a hand-built bundle, because the failure being guarded against is
 * a course holding proposals of every kind at once beside what was accepted.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  UPDATABLE,
  announcementDigest,
  checkAnnouncement,
  describePublication,
  destinations,
  editAnnouncement,
  isUpdate,
  publishPlan,
  unpublishedDrafts,
} from "../src/publish.ts";
import { publishable } from "../src/page.ts";
import { Ledger } from "../src/lms/ledger.ts";
import { Workspace } from "../src/workspace.ts";

const SAMPLE = fileURLToPath(new URL("../../workspace", import.meta.url));
const RUN = "CSS-4008-2026-FALL";
const COURSE = "CSS-4008";

/**
 * A copy of the sample course with records of the caller's making added to it —
 * written into the course, where drafts live now, and not beside it.
 */
const workspaceWith = (files: Record<string, string>): string => {
  const root = mkdtempSync(join(tmpdir(), "ainar-publish-"));
  // `shared/` as well as `courses/`: the capabilities the outcomes point at
  // live there, and a copy without them fails validation for a reason that has
  // nothing to do with what is being tested.
  for (const directory of ["courses", "shared"]) {
    cpSync(join(SAMPLE, directory), join(root, directory), { recursive: true });
  }
  for (const [name, body] of Object.entries(files)) {
    const path = join(root, "courses", COURSE, name);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, body, "utf-8");
  }
  return root;
};

const DECK = (approval: string | null) => `documents:
  - document_id: DOC-9001
    title: Week 7 — cross-validation, slides
    storage_key: courses/${COURSE}/materials/week-07-slides/week-07-slides.md
    mime_type: text/markdown
    course_version_id: ${RUN}
    module_id: MODULE-06
${approval ? `    approval: ${approval}\n` : ""}`;

const DRAFTED_EVALUATION = `evaluations:
  - evaluation_id: EVAL-9001
    submission_id: SUB-1
    criterion_id: CRIT-01-01
    status: suggested
    ai_suggestion:
      score: 8
`;

// ------------------------------------------------------------------ reading

test("a plan names the drafts it leaves out, and nothing it would approve", () => {
  const root = workspaceWith({
    "documents/generated.yaml": DECK("draft"),
    "records/evaluations-extra.yaml": DRAFTED_EVALUATION,
  });
  const bundle = new Workspace(root).findRun(RUN);
  const left = unpublishedDrafts(bundle, RUN);

  // The deck is named. The grade is not: a page never carried one, so saying
  // it was left out would read as though it might have been published.
  assert.deepEqual(
    left.map((draft) => draft.id),
    ["DOC-9001"],
  );

  const lines = publishPlan({
    target: "page",
    drafts: left,
    actions: ["write dist/pages/" + RUN],
    refusals: [],
  }).join("\n");
  assert.match(lines, /Would publish the students' course page/);
  assert.match(lines, /Not published — 1 draft\(s\) nobody has approved yet/);
  assert.match(lines, /DOC-9001  Week 7 — cross-validation, slides/);
  assert.match(lines, /Set `approval: approved`/);
  assert.doesNotMatch(lines, /promote/i, "publishing approves nothing any more");
});

test("an accepted deck is not a draft, and the plan says nothing about it", () => {
  const root = workspaceWith({ "documents/generated.yaml": DECK("approved") });
  const bundle = new Workspace(root).findRun(RUN);
  assert.deepEqual(unpublishedDrafts(bundle, RUN), []);

  const lines = publishPlan({ target: "page", drafts: [], actions: [], refusals: [] }).join("\n");
  assert.doesNotMatch(lines, /Not published/);
});

test("a draft deck is held back from the page by its record, not its folder", () => {
  const root = workspaceWith({ "documents/generated.yaml": DECK("draft") });
  const deck = join(root, "courses", COURSE, "materials", "week-07-slides", "week-07-slides.md");
  mkdirSync(join(deck, ".."), { recursive: true });
  writeFileSync(deck, "# Cross-validation\n", "utf-8");

  const bundle = new Workspace(root).findRun(RUN);
  const { published, heldBack } = publishable(bundle, RUN, root);
  assert.equal(published.some((material) => material.documentId === "DOC-9001"), false);
  assert.ok(heldBack.some((reason) => /DOC-9001: a draft \(approval: draft\)/.test(reason)), heldBack.join("\n"));

  // Accepting it is changing the word — and then it publishes, from where it
  // already was. Nothing moved.
  writeFileSync(join(root, "courses", COURSE, "documents/generated.yaml"), DECK("approved"), "utf-8");
  const after = publishable(new Workspace(root).findRun(RUN), RUN, root);
  const material = after.published.find((entry) => entry.documentId === "DOC-9001");
  assert.ok(material, after.heldBack.join("\n"));
  assert.equal(material!.source, deck);
  assert.ok(existsSync(deck));
});


// ------------------------------------------------- what went out last time

const publication = (materials: Record<string, string>) => ({
  where: "dist/pages/" + RUN,
  at: "2026-09-19T14:02:00+05:00",
  reference: null,
  materials,
});

const titles = new Map([
  ["DOC-1", "Week 7 slides"],
  ["DOC-2", "Week 8 slides"],
]);

test("a destination nothing was ever sent to says so", () => {
  assert.deepEqual(describePublication(null, new Map(), titles), [
    "Nothing has been published here before.",
  ]);
});

test("an unchanged course says publishing again sends the same thing", () => {
  const lines = describePublication(
    publication({ "DOC-1": "sha256:aaa" }),
    new Map([["DOC-1", "sha256:aaa"]]),
    titles,
  );
  assert.match(lines[0]!, /Last published 2026-09-19T14:02:00\+05:00 to dist\/pages/);
  assert.match(lines.join("\n"), /nothing has changed since/);
});

test("the three kinds of change since a publication are each named", () => {
  const lines = describePublication(
    publication({ "DOC-1": "sha256:aaa", "DOC-3": "sha256:ccc" }),
    new Map([
      ["DOC-1", "sha256:zzz"],
      ["DOC-2", "sha256:bbb"],
    ]),
    titles,
  ).join("\n");

  assert.match(lines, /3 thing\(s\) have changed since/);
  assert.match(lines, /DOC-1 changed since then — Week 7 slides/);
  assert.match(lines, /DOC-2 is new since then — Week 8 slides/);
  assert.match(lines, /DOC-3 was published then and is not in the course now/);
});

test("the ledger carries publications beside the gradebook, and older files still load", () => {
  const directory = mkdtempSync(join(tmpdir(), "ainar-ledger-"));

  const ledger = Ledger.load(RUN, directory);
  assert.equal(ledger.lastPublication("page", RUN), null);
  ledger.recordPublication("page", RUN, publication({ "DOC-1": "sha256:aaa" }));
  const path = ledger.save();

  const again = Ledger.load(RUN, directory);
  assert.equal(again.lastPublication("page", RUN)?.where, "dist/pages/" + RUN);
  assert.equal(again.lastPublication("telegram", RUN), null, "one target's entry is not another's");

  // A ledger written before this section existed — the shape every professor
  // already has on disk — loads with an empty one rather than failing.
  writeFileSync(path, JSON.stringify({ version: 4, entries: {}, assignments: {} }), "utf-8");
  const older = Ledger.load(RUN, directory);
  assert.deepEqual(older.publications, {});
  assert.equal(older.lastPublication("page", RUN), null);
});

// ------------------------------------------------------------- the fan-out

const sent = (where: string, at: string) => ({
  where,
  at,
  reference: null,
  handle: null,
  materials: {},
});

test("an update revisits what was published, oldest first", () => {
  const { updating, skipped } = destinations(
    {
      [`page|${RUN}`]: sent("dist/pages", "2026-09-19T14:00:00+05:00"),
      "canvas|ASSESSMENT-01": sent("Canvas course 90210", "2026-09-10T09:00:00+05:00"),
      "homework|ASSESSMENT-03": sent("owner/hw3", "2026-09-14T09:00:00+05:00"),
    },
    RUN,
  );

  assert.deepEqual(
    updating.map((entry) => `${entry.target}:${entry.scope}`),
    ["canvas:ASSESSMENT-01", "homework:ASSESSMENT-03", `page:${RUN}`],
  );
  assert.deepEqual(skipped, []);
});

test("an announcement is not updated, because nothing can re-derive it", () => {
  const { updating, skipped } = destinations(
    {
      [`telegram|${RUN}`]: sent("@css4008", "2026-09-12T09:00:00+05:00"),
      [`page|${RUN}`]: sent("dist/pages", "2026-09-19T14:00:00+05:00"),
    },
    RUN,
  );
  assert.deepEqual(
    updating.map((entry) => entry.target),
    ["page"],
  );
  assert.deepEqual(
    skipped.map((entry) => entry.target),
    ["telegram"],
  );
});

test("a run with nothing published has nothing to update", () => {
  assert.deepEqual(destinations({}, RUN), { updating: [], skipped: [] });
});

test("another run's page is not this run's to update", () => {
  const { updating } = destinations(
    { "page|CSS-4008-2027-SPRING": sent("dist/pages", "2027-02-01T09:00:00+05:00") },
    RUN,
  );
  assert.deepEqual(updating, []);
});

test("update is a mode and every other target is a place", () => {
  assert.equal(isUpdate("update"), true);
  for (const target of ["page", "telegram", "homework", "canvas"] as const) {
    assert.equal(isUpdate(target), false);
  }
  // Telegram must stay out of the automatic set: see `UPDATABLE`.
  assert.equal(UPDATABLE.includes("telegram"), false);
});

// --------------------------------------------------------------- telegram

const ITEMS = [
  { item_id: "ITEM-1", answer_key: "the variance rises as the model memorises the training set" },
];

test("an announcement carrying an answer is refused", () => {
  const checked = checkAnnouncement(
    "Reminder: for question 3, the variance rises as the model memorises the training set.",
    ITEMS,
  );
  assert.equal(checked.refusals.length, 1);
  assert.match(checked.refusals[0]!, /carries an answer/);
});

test("an announcement naming a student is refused, because a channel is everybody", () => {
  const checked = checkAnnouncement("STUDENT-4A19F2 still has not submitted homework 3.", ITEMS);
  assert.match(checked.refusals.join(" "), /STUDENT-4A19F2/);
});

test("an ordinary announcement passes, and an empty one does not", () => {
  assert.deepEqual(checkAnnouncement("Homework 3 is open, due Friday 18:00.", ITEMS).refusals, []);
  assert.match(checkAnnouncement("   ", ITEMS).refusals.join(" "), /empty/);
});

test("more than Telegram accepts is refused here rather than by Telegram", () => {
  const checked = checkAnnouncement("a".repeat(4097), ITEMS);
  assert.match(checked.refusals.join(" "), /4097 characters/);
});

/** A transport that answers whatever the test says, and remembers the call. */
const answering = (body: unknown, status = 200) => {
  const calls: { url: string; body: unknown }[] = [];
  return {
    calls,
    transport: {
      async request(_method: string, url: string, options: { body?: Uint8Array | null }) {
        calls.push({
          url,
          body: options.body ? JSON.parse(new TextDecoder().decode(options.body)) : null,
        });
        return { status, body: JSON.stringify(body), headers: {} };
      },
    },
  };
};

test("a correction edits the message in place rather than posting a second one", async () => {
  const { calls, transport } = answering({ ok: true, result: { message_id: 4471 } });
  const outcome = await editAnnouncement("TOKEN", "@css4008", "4471", "The corrected text", transport);

  assert.equal(outcome, "edited");
  assert.match(calls[0]!.url, /editMessageText$/);
  assert.deepEqual(calls[0]!.body, {
    chat_id: "@css4008",
    message_id: 4471,
    text: "The corrected text",
    disable_web_page_preview: true,
  });
});

test("an edit that changes nothing is a no-op and not an error", async () => {
  const { transport } = answering(
    { ok: false, description: "Bad Request: message is not modified" },
    400,
  );
  assert.equal(
    await editAnnouncement("TOKEN", "@css4008", "4471", "same", transport),
    "unchanged",
  );
});

test("an edit Telegram refuses says what to do instead", async () => {
  const { transport } = answering({ ok: false, description: "message to edit not found" }, 400);
  await assert.rejects(
    () => editAnnouncement("TOKEN", "@css4008", "9999", "text", transport),
    /message to edit not found[\s\S]*correction as a new message/,
  );
});

test("the digest of an announcement is what the ledger keeps, not the words", () => {
  const digest = announcementDigest("  Homework 3 is open.  ");
  assert.match(digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(digest, announcementDigest("Homework 3 is open."), "trimmed before hashing");
  assert.notEqual(digest, announcementDigest("Homework 4 is open."));
});
