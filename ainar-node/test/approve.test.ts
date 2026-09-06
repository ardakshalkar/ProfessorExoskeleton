/**
 * The promotion rules, unit by unit.
 *
 * `tests/test_approve_parity.py` is the real oracle — it runs both gates and
 * compares the trees. These are the cases that oracle cannot reach cheaply: the
 * ones where a *rule* has to hold rather than a file, and the ones a Python
 * fixture would need a whole broken workspace to express.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { z } from "zod";
import {
  DRAFT_MARKER,
  ID_FIELDS,
  approveDrafts,
  decidedAt,
  floatPaths,
  isRepoKey,
  promoteIdentifier,
  tidy,
  total,
} from "../src/approve.ts";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DRAFTABLE, loadDrafts, type Drafted } from "../src/drafts.ts";
import { IssueList } from "../src/issues.ts";
import type { CourseBundle } from "../src/bundle.ts";

const bundle = (): CourseBundle =>
  ({
    course: { course_id: "CSS-4008" },
    versions: [],
    rubrics: [],
    assessments: [],
  }) as unknown as CourseBundle;

const drafted = (partial: Partial<Drafted>): Drafted =>
  ({
    ...Object.fromEntries(Object.keys(DRAFTABLE).map((key) => [key, []])),
    ...partial,
  }) as Drafted;

const STAMP = "2026-10-18T09:00:00+05:00";

// ------------------------------------------------------------- identifiers

test("the draft marker is stripped once, not everywhere", () => {
  assert.equal(promoteIdentifier("EVAL-DRAFT-9081-0401"), "EVAL-9081-0401");
  assert.equal(promoteIdentifier("EVAL-9081"), "EVAL-9081");
  // A record whose payload happens to contain the marker twice keeps the second.
  assert.equal(promoteIdentifier(`A${DRAFT_MARKER}B${DRAFT_MARKER}C`), `A-B${DRAFT_MARKER}C`);
});

test("a reference to another draft in the same batch is rewritten", () => {
  const issues = new IssueList();
  const approval = approveDrafts(
    bundle(),
    drafted({
      signals: [
        {
          signal_id: "SIGNAL-DRAFT-1",
          course_version_id: "CSS-4008-2026-FALL",
          type: "misconception",
          description: "x",
          evidence_ids: [],
        },
      ],
      action_items: [
        {
          action_id: "ACTION-DRAFT-1",
          course_version_id: "CSS-4008-2026-FALL",
          assigned_to: "USER-ARD-A01",
          type: "review_signal",
          title: "Look at it",
          // Points at the signal above, by its *draft* id.
          source_refs: ["SIGNAL-DRAFT-1"],
        },
      ],
    }),
    { approver: "USER-ARD-A01", decidedAt: STAMP, issues },
  );

  const action = approval.records.get("action_items")![0]!;
  assert.deepEqual(action.source_refs, ["SIGNAL-1"], "the reference still points at a draft");
});

test("an identifier that already exists is a collision, not an overwrite", () => {
  const issues = new IssueList();
  const withSignal = bundle() as unknown as Record<string, unknown[]>;
  withSignal.signals = [{ signal_id: "SIGNAL-1" }];

  approveDrafts(
    withSignal as unknown as CourseBundle,
    drafted({
      signals: [
        {
          signal_id: "SIGNAL-DRAFT-1",
          course_version_id: "CSS-4008-2026-FALL",
          type: "misconception",
          description: "x",
        },
      ],
    }),
    { approver: "USER-ARD-A01", decidedAt: STAMP, issues },
  );

  assert.equal(issues.errors.length, 1);
  assert.equal(issues.errors[0]!.code, "approve.collision");
});

// ------------------------------------------------------------- evaluations

const evaluation = (extra: Record<string, unknown>) => ({
  evaluation_id: "EVAL-DRAFT-1",
  submission_id: "SUB-1",
  criterion_id: "CRIT-01-01",
  ...extra,
});

const approveOne = (record: Record<string, unknown>, issues = new IssueList()) => {
  const approval = approveDrafts(bundle(), drafted({ evaluations: [record] }), {
    approver: "USER-ARD-A01",
    decidedAt: STAMP,
    issues,
  });
  return { approval, issues, record: approval.records.get("evaluations")?.[0] };
};

test("a suggestion with no decision is accepted, and says so", () => {
  const { record } = approveOne(evaluation({ ai_suggestion: { score: 8 } }));
  const decision = record!.professor_decision as Record<string, unknown>;
  assert.equal(decision.score, 8);
  assert.equal(decision.decided_by, "USER-ARD-A01");
  assert.equal(decision.decided_at, STAMP);
  assert.equal(record!.status, "approved");
  // The suggestion survives beside the decision — never under it.
  assert.equal((record!.ai_suggestion as Record<string, unknown>).score, 8);
});

test("a decision that differs from the suggestion is an override, and is noted", () => {
  const { approval, record } = approveOne(
    evaluation({ ai_suggestion: { score: 8 }, professor_decision: { score: 5, comment: "no" } }),
  );
  assert.equal(record!.status, "overridden");
  assert.equal((record!.ai_suggestion as Record<string, unknown>).score, 8, "suggestion lost");
  assert.match(approval.notes[0]!, /professor set 5 against the suggested 8/);
});

test("a decision matching the suggestion is an approval, not an override", () => {
  const { record } = approveOne(
    evaluation({ ai_suggestion: { score: 8 }, professor_decision: { score: 8 } }),
  );
  assert.equal(record!.status, "approved");
});

test("an evaluation with neither a suggestion nor a decision is refused", () => {
  const { issues, record } = approveOne(evaluation({}));
  assert.equal(record, undefined);
  assert.equal(issues.errors[0]!.code, "approve.nothing_to_approve");
});

test("a decision that already names its decider keeps them", () => {
  const { record } = approveOne(
    evaluation({
      ai_suggestion: { score: 8 },
      professor_decision: { score: 8, decided_by: "USER-OTHER", decided_at: "2026-01-01T00:00:00+05:00" },
    }),
  );
  const decision = record!.professor_decision as Record<string, unknown>;
  assert.equal(decision.decided_by, "USER-OTHER");
  assert.equal(decision.decided_at, "2026-01-01T00:00:00+05:00");
});

// ------------------------------------------------------------------ claims

/**
 * The claim path is GONE, not dormant.
 *
 * It went in two steps on 2026-09-05. First `concepts` and `modules` left
 * `DRAFTABLE`, which made the path unreachable; then `CLAIM_FILES`,
 * `approveClaim` and `CLAIM_HEADER` were deleted, because an empty map guarding
 * three branches nothing can enter reads like a feature that still works.
 *
 * The test that used to live here proved the `extensions.approval` stamping. It
 * built its input through `drafted({concepts: …})`, a shape that no longer
 * exists. This replaces it, and proves the rule that now applies instead.
 *
 * `git log -S CLAIM_FILES` restores the whole of it if the policy is reversed.
 */
test("a draft file may not carry the course's structure", () => {
  const issues = new IssueList();
  const root = mkdtempSync(join(tmpdir(), "ainar-claim-"));
  writeFileSync(
    join(root, "concepts-draft.yaml"),
    "concepts:\n  - concept_id: CONCEPT-DRAFT-X\n    course_id: CSS-4008\n    title: Loss functions\n",
    "utf-8",
  );

  loadDrafts(root, issues);

  const refusal = issues.errors.find((issue) => issue.code === "draft.collection");
  assert.ok(refusal, "a concepts draft must be refused, not silently ignored");
  assert.match(
    refusal!.message,
    /concepts/,
    "the refusal names the collection, so the author knows what to move",
  );
});

/**
 * The sharp edge the removal exposed.
 *
 * `loadDrafts` refuses a non-draftable collection at the file, so this is only
 * reachable by a caller assembling `Drafted` by hand. It used to crash there
 * with "Cannot read properties of undefined (reading 'safeParse')" — a stack
 * trace that names neither the collection nor the reason.
 */
test("a collection that is not draftable is refused by name, not by crash", () => {
  const issues = new IssueList();
  const approval = approveDrafts(
    bundle(),
    { concepts: [{ concept_id: "CONCEPT-DRAFT-X", title: "Orphan" }] } as never,
    { approver: "USER-ARD-A01", decidedAt: STAMP, issues },
  );
  assert.equal(total(approval), 0);
  assert.equal(issues.errors[0]!.code, "approve.not_draftable");
  assert.match(issues.errors[0]!.message, /concepts/);
});

// ----------------------------------------------------------- only / reject

test("--reject leaves a draft behind and records that it did", () => {
  const issues = new IssueList();
  const records = [
    { signal_id: "SIGNAL-DRAFT-1", course_version_id: "CSS-4008-2026-FALL", type: "misconception", description: "a" },
    { signal_id: "SIGNAL-DRAFT-2", course_version_id: "CSS-4008-2026-FALL", type: "misconception", description: "b" },
  ];
  const approval = approveDrafts(bundle(), drafted({ signals: records }), {
    approver: "USER-ARD-A01",
    decidedAt: STAMP,
    issues,
    reject: new Set(["SIGNAL-DRAFT-2"]),
  });
  assert.equal(total(approval), 1);
  assert.deepEqual(approval.skipped, ["SIGNAL-DRAFT-2"]);
});

test("--only approves nothing else", () => {
  const issues = new IssueList();
  const records = [
    { signal_id: "SIGNAL-DRAFT-1", course_version_id: "CSS-4008-2026-FALL", type: "misconception", description: "a" },
    { signal_id: "SIGNAL-DRAFT-2", course_version_id: "CSS-4008-2026-FALL", type: "misconception", description: "b" },
  ];
  const approval = approveDrafts(bundle(), drafted({ signals: records }), {
    approver: "USER-ARD-A01",
    decidedAt: STAMP,
    issues,
    only: new Set(["SIGNAL-DRAFT-1"]),
  });
  assert.equal(total(approval), 1);
  assert.equal((approval.records.get("signals")![0]! as Record<string, unknown>).signal_id, "SIGNAL-1");
});

// ------------------------------------------------------------------- shape

test("an empty extensions map is dropped and the rest sinks to the end", () => {
  const tidied = tidy({ extensions: {}, a: 1 }) as Record<string, unknown>;
  assert.deepEqual(Object.keys(tidied), ["a"]);

  const kept = tidy({ extensions: { x: 1 }, a: 1 }) as Record<string, unknown>;
  assert.deepEqual(Object.keys(kept), ["a", "extensions"]);

  // At any depth, including inside a list.
  const nested = tidy({ items: [{ extensions: {}, b: 2 }] }) as { items: Record<string, unknown>[] };
  assert.deepEqual(Object.keys(nested.items[0]!), ["b"]);
});

test("float-ness is read off the schema, the way pydantic reads it", () => {
  const paths = floatPaths(z.object({ score: z.number(), count: z.number().int() }), ["r"]);
  assert.ok(paths.has("r.score"), "a plain number is a float");
  assert.ok(!paths.has("r.count"), "an int was treated as a float");
});

test("a nullable or defaulted number keeps its float-ness", () => {
  const schema = z.object({
    a: z.number().nullish(),
    b: z.number().default(1),
    c: z.object({ d: z.number() }),
    e: z.array(z.object({ f: z.number() })),
  });
  const paths = floatPaths(schema, ["r"]);
  for (const path of ["r.a", "r.b", "r.c.d", "r.e.f"]) {
    assert.ok(paths.has(path), `${path} lost its float-ness`);
  }
});

test("only the two state collections lack an id field, as in Python", () => {
  // `concept_states` and `capability_states` are keyed by student and concept
  // rather than by an identifier of their own, so promotion skips the rewrite
  // for them. Python's `ID_FIELDS` omits exactly these two; if that list grows
  // here without growing there, the two gates promote different things.
  const without = Object.keys(DRAFTABLE).filter((collection) => !ID_FIELDS[collection]);
  assert.deepEqual(without.sort(), ["capability_states", "concept_states"]);
});

// -------------------------------------------------------------- timestamps

test("a storage key with a scheme is not a repository path", () => {
  assert.ok(isRepoKey("courses/CSS-4008/versions/2026-FALL/materials/x.md"));
  assert.ok(!isRepoKey("object://bucket/x.md"));
});

test("the stamp carries the run's offset, not the machine's", () => {
  const stamp = decidedAt("Asia/Almaty", new Date("2026-10-18T04:00:00Z"));
  assert.equal(stamp, "2026-10-18T09:00:00+05:00");
});

test("an unknown timezone falls back to +05:00 rather than to UTC", () => {
  // Silently substituting UTC would misreport when a person decided, by five
  // hours — the same fallback `run_timezone` makes.
  const stamp = decidedAt("Not/AZone", new Date("2026-10-18T04:00:00Z"));
  assert.ok(stamp.endsWith("+05:00"), stamp);
});

test("the stamp has no sub-second part", () => {
  const stamp = decidedAt("Asia/Almaty", new Date("2026-10-18T04:00:00.123Z"));
  assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+\d{2}:\d{2}$/.test(stamp), stamp);
});
