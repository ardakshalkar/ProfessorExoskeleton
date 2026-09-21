/**
 * Publishing with the gate folded in, and the line it may not cross.
 *
 * The point of these is one property: `ainar publish` promotes the materials a
 * publication needs and **nothing else**, whatever else is sitting in the same
 * drafts directory. It is asserted against a real workspace rather than a
 * hand-built bundle, because the failure being guarded against is a
 * `work/<RUN>/` holding a term's proposals of every kind at once — which is
 * what a drafts directory actually looks like.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import {
  MATERIAL_COLLECTIONS,
  checkAnnouncement,
  describePublication,
  outstanding,
  pendingMaterials,
  publishPlan,
} from "../src/publish.ts";
import { Ledger } from "../src/lms/ledger.ts";
import { runApproval } from "../src/approve.ts";
import { Workspace } from "../src/workspace.ts";

const SAMPLE = fileURLToPath(new URL("../../workspace", import.meta.url));
const RUN = "CSS-4008-2026-FALL";
const COURSE = "CSS-4008";

/** A copy of the sample course, with a drafts directory of the caller's making. */
const workspaceWith = (drafts: Record<string, string>): string => {
  const root = mkdtempSync(join(tmpdir(), "ainar-publish-"));
  // `shared/` as well as `courses/`: the capabilities the outcomes point at
  // live there, and a copy without them fails validation for a reason that has
  // nothing to do with what is being tested.
  for (const directory of ["courses", "shared"]) {
    cpSync(join(SAMPLE, directory), join(root, directory), { recursive: true });
  }
  const draftsDir = join(root, "work", RUN);
  mkdirSync(draftsDir, { recursive: true });
  for (const [name, body] of Object.entries(drafts)) {
    writeFileSync(join(draftsDir, name), body, "utf-8");
  }
  return root;
};

const DRAFTED_DECK = `documents:
  - document_id: DOC-DRAFT-9001
    title: Week 7 — cross-validation, slides
    storage_key: work/${RUN}/week-07-slides.md
    mime_type: text/markdown
    course_version_id: ${RUN}
    module_id: MODULE-06
`;

const DRAFTED_EVALUATION = `evaluations:
  - evaluation_id: EVAL-DRAFT-9001
    submission_id: SUB-1
    criterion_id: CRIT-01-01
    ai_suggestion:
      score: 8
`;

// ------------------------------------------------------------------ reading

test("a plan names the materials it would promote and counts the rest", () => {
  const root = workspaceWith({
    "documents.yaml": DRAFTED_DECK,
    "evaluations.yaml": DRAFTED_EVALUATION,
  });
  const pending = pendingMaterials(join(root, "work", RUN));

  assert.deepEqual(
    pending.promotions.map((entry) => entry.draftId),
    ["DOC-DRAFT-9001"],
  );
  assert.equal(pending.promotions[0]!.title, "Week 7 — cross-validation, slides");
  // The evaluation is not a promotion and is not silence either: it is counted
  // and named, so the plan can say what it is leaving alone.
  assert.equal(pending.leftAlone.get("evaluations"), 1);
  assert.equal(pending.errors.length, 0);
});

test("the plan says both halves — what it promotes and what it then publishes", () => {
  const root = workspaceWith({ "documents.yaml": DRAFTED_DECK });
  const lines = publishPlan({
    target: "page",
    pending: pendingMaterials(join(root, "work", RUN)),
    actions: ["write dist/pages/" + RUN],
    refusals: [],
  }).join("\n");

  assert.match(lines, /Would promote 1 drafted material/);
  assert.match(lines, /DOC-DRAFT-9001/);
  assert.match(lines, /Would then publish the students' course page/);
});

// ------------------------------------------------------- the line itself

test("publishing promotes a drafted deck and leaves a drafted grade alone", () => {
  const root = workspaceWith({
    "documents.yaml": DRAFTED_DECK,
    "evaluations.yaml": DRAFTED_EVALUATION,
  });
  writeFileSync(join(root, "work", RUN, "week-07-slides.md"), "# Cross-validation\n", "utf-8");

  const bundle = new Workspace(root).findRun(RUN);
  const outcome = runApproval({
    bundle,
    draftsDir: join(root, "work", RUN),
    courseDir: join(root, "courses", COURSE),
    root,
    approver: "USER-ARD-A01",
    collections: MATERIAL_COLLECTIONS,
  });

  assert.equal(outcome.ok, true, outcome.errors.join("\n"));
  assert.deepEqual([...outcome.approval.records.keys()], ["documents"]);
  assert.equal(outcome.leftAlone.get("evaluations"), 1);

  // The deck is a record and its material has moved out of `work/`.
  const written = parse(readFileSync(join(root, "courses", COURSE, "documents/generated.yaml"), "utf-8"));
  assert.deepEqual(
    written.documents.map((entry: Record<string, unknown>) => entry.document_id),
    ["DOC-9001"],
  );
  assert.equal(written.documents[0].storage_key, `courses/${COURSE}/materials/week-07-slides.md`);
  // Size and checksum are the gate's, not the agent's.
  assert.equal(typeof written.documents[0].checksum, "string");

  // And the judgement about a student is still a proposal. This is the whole
  // property: a publication is not an approval of anything but the artefact.
  assert.equal(
    outcome.written.some((path) => path.includes("evaluations")),
    false,
  );
});

test("pressing publish twice does not try to promote the same deck twice", () => {
  const root = workspaceWith({ "documents.yaml": DRAFTED_DECK });
  writeFileSync(join(root, "work", RUN, "week-07-slides.md"), "# Cross-validation\n", "utf-8");

  const promote = (bundle: ReturnType<Workspace["findRun"]>, reject: Set<string>) =>
    runApproval({
      bundle,
      draftsDir: join(root, "work", RUN),
      courseDir: join(root, "courses", COURSE),
      root,
      approver: "USER-ARD-A01",
      collections: MATERIAL_COLLECTIONS,
      reject,
    });

  const first = promote(new Workspace(root).findRun(RUN), new Set());
  assert.equal(first.ok, true, first.errors.join("\n"));

  // Second press. The draft is still in `work/` — `approve` never removes one —
  // and its material has moved, so promoting it again would collide on the
  // identifier and fail on the missing file. It is rejected instead.
  const after = new Workspace(root).findRun(RUN);
  const pending = pendingMaterials(join(root, "work", RUN), after);
  assert.equal(pending.promotions[0]!.recordedAs, "DOC-9001");
  assert.deepEqual(outstanding(pending), []);

  const second = promote(after, new Set(["DOC-DRAFT-9001"]));
  assert.equal(second.ok, true, second.errors.join("\n"));
  assert.equal(second.written.length, 0);
  assert.match(second.lines.join("\n"), /nothing to approve/);
});

test("a drafts directory of only judgements publishes nothing and promotes nothing", () => {
  const root = workspaceWith({ "evaluations.yaml": DRAFTED_EVALUATION });
  const bundle = new Workspace(root).findRun(RUN);
  const outcome = runApproval({
    bundle,
    draftsDir: join(root, "work", RUN),
    courseDir: join(root, "courses", COURSE),
    root,
    approver: "USER-ARD-A01",
    collections: MATERIAL_COLLECTIONS,
  });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.written.length, 0);
  assert.match(outcome.lines.join("\n"), /nothing to approve/);
  assert.match(outcome.lines.join("\n"), /1 draft\(s\) in evaluations left alone/);
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
