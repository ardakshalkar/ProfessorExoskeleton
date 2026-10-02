/**
 * Grading question by question (src/grade-board.ts): the board the pane draws,
 * the decisions behind its buttons, and the two rubric writes — on a bundle
 * built by hand, and a course on disk only where a file is rewritten.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import {
  acceptRubric,
  checkGroups,
  chooseProposal,
  decideGrades,
  evaluationId,
  gradeBoard,
  moveAnswer,
  moveGroup,
  pointsOnlyRubric,
  proposalEffect,
  proposalSpread,
  readGroups,
  writeGroups,
  type GroupsFile,
} from "../src/grade-board.ts";
import { scanPlace } from "../src/scans.ts";

const RUN = "CSS-9-2026-FALL";
const QUIZ = "ASSESSMENT-QUIZ-09";
const AT = "2026-10-02T12:00:00+05:00";
const A = "STUDENT-AAAAAA";
const B = "STUDENT-BBBBBB";
const C = "STUDENT-CCCCCC";
const D = "STUDENT-DDDDDD";

const item = (n: number, extra: Record<string, unknown> = {}) => ({
  item_id: `ITEM-Q9-0${n}`,
  assessment_id: QUIZ,
  type: "short_answer",
  prompt: `Question ${n}?`,
  number: n,
  maximum_score: 2,
  options: [],
  ...extra,
});

const rubric = {
  rubric_id: "RUBRIC-Q9",
  criteria: [
    {
      criterion_id: "CRIT-Q9-01",
      rubric_id: "RUBRIC-Q9",
      title: "Q1",
      maximum_score: 2,
      levels: [
        { score: 0, description: "neither" },
        { score: 2, description: "both halves" },
        { score: 1, description: "one half" },
      ],
    },
  ],
};

const sub = (student: string) => `SUB-${student.slice(8)}-QUIZ-09`;

/** A pile of four papers: A and B answered, C left it blank, D not read yet. */
const fixture = (options: { approval?: string; evaluations?: any[]; withRubric?: boolean } = {}) => {
  const base = mkdtempSync(join(tmpdir(), "ainar-grade-"));
  const place = scanPlace(base, RUN, QUIZ);
  for (const [student, answer] of [
    [A, { item: "ITEM-Q9-01", text: "tokens are rare", confidence: "high", page: 1 }],
    [B, { item: "ITEM-Q9-01", text: "the vocabulary has few Kazakh pieces", confidence: "low", page: 1, note: "smudge" }],
    [C, { item: "ITEM-Q9-01", blank: true, page: 1 }],
    [D, { item: "ITEM-Q9-01" }],
  ] as const) {
    mkdirSync(join(place.base, student), { recursive: true });
    writeFileSync(join(place.base, student, "transcript.yaml"), `answers:\n  - ${JSON.stringify(answer)}\n`);
  }
  const bundle: any = {
    course: { course_id: "CSS-9" },
    versions: [{ course_version_id: RUN, instructors: ["USER-PROF"] }],
    assessments: [
      {
        assessment_id: QUIZ,
        course_version_id: RUN,
        title: "Quiz 9",
        maximum_score: 2,
        ...(options.approval ? { approval: options.approval } : {}),
        ...(options.withRubric === false ? {} : { rubric, rubric_id: "RUBRIC-Q9" }),
      },
    ],
    rubrics: [],
    items: [item(1, options.withRubric === false ? {} : { criterion_id: "CRIT-Q9-01" })],
    submissions: [A, B, C, D].map((student) => ({ submission_id: sub(student), assessment_id: QUIZ, student_id: student })),
    item_responses: [
      { response_id: "RESP-A", submission_id: sub(A), item_id: "ITEM-Q9-01", student_id: A, raw_response: "tokens are rare" },
      { response_id: "RESP-B", submission_id: sub(B), item_id: "ITEM-Q9-01", student_id: B, raw_response: "the vocabulary has few Kazakh pieces" },
      { response_id: "RESP-C", submission_id: sub(C), item_id: "ITEM-Q9-01", student_id: C, raw_response: "", extensions: { scan: { blank: true } } },
    ],
    evaluations: options.evaluations ?? [],
  };
  const groups: GroupsFile = {
    assessment_id: QUIZ,
    items: [
      {
        item_id: "ITEM-Q9-01",
        groups: [
          { label: "names the vocabulary", score: 2, students: [B] },
          { label: "says tokens are rare, no cause", score: 1, students: [A], unsure: true },
        ],
      },
    ],
  };
  writeGroups(place, groups);
  return { base, place, bundle };
};

test("the board orders groups, then blanks, then papers not read yet — and never suggests a zero for an unread one", () => {
  const { place, bundle } = fixture();
  const board = gradeBoard({ bundle, runId: RUN, assessmentId: QUIZ, place });
  assert.equal(board.rubric, "accepted");
  assert.equal(board.decided_by, "USER-PROF");
  const [q] = board.items;
  assert.deepEqual(q!.answers.map((answer) => answer.student), [B, A, C, D]);
  const byStudent = new Map(q!.answers.map((answer) => [answer.student, answer]));
  assert.deepEqual(byStudent.get(B)!.suggestion, { score: 2, comment: "names the vocabulary", source: "group", confidence: null });
  assert.equal(byStudent.get(A)!.suggestion!.confidence, 0.5, "an unsure group says so");
  assert.equal(byStudent.get(B)!.confidence, "low");
  assert.equal(byStudent.get(B)!.note, "smudge");
  assert.equal(byStudent.get(C)!.blank, true);
  assert.equal(byStudent.get(C)!.suggestion!.source, "blank");
  assert.equal(byStudent.get(D)!.unread, true);
  assert.equal(byStudent.get(D)!.blank, false);
  assert.equal(byStudent.get(D)!.suggestion, null);
  assert.deepEqual(q!.criterion!.levels.map((level) => level.score), [2, 1, 0], "levels top down");
  assert.deepEqual(q!.counts, { answers: 4, unread: 1, blank: 1, ungrouped: 0, suggested: 3, decided: 0, changed: 0 });
  assert.deepEqual(q!.groups.map((group) => group.count), [1, 1]);
});

test("a rubric written but not accepted is a draft, and with no criterion there is none", () => {
  const draft = fixture({ approval: "draft" });
  assert.equal(gradeBoard({ bundle: draft.bundle, runId: RUN, assessmentId: QUIZ, place: draft.place }).rubric, "draft");
  const none = fixture({ withRubric: false });
  assert.equal(gradeBoard({ bundle: none.bundle, runId: RUN, assessmentId: QUIZ, place: none.place }).rubric, "none");
});

test("a decision keeps the suggestion it was made against, and says approved or overridden", () => {
  const { place, bundle } = fixture();
  const board = gradeBoard({ bundle, runId: RUN, assessmentId: QUIZ, place });
  const result = decideGrades({
    board,
    bundle,
    by: "USER-PROF",
    at: AT,
    via: "group",
    decisions: [
      { student: B, item: "ITEM-Q9-01", score: 2 },
      { student: A, item: "ITEM-Q9-01", score: 0, comment: "no cause given" },
      { student: C, item: "ITEM-Q9-01", score: 0 },
    ],
  });
  assert.equal(result.written, 3);
  const [b, a, c] = result.evaluations;
  assert.equal(b.evaluation_id, evaluationId(B, "CRIT-Q9-01"));
  assert.equal(b.evaluation_id, "EVAL-BBBBBB-Q9-01");
  assert.equal(b.status, "approved");
  assert.equal(b.ai_suggestion.score, 2);
  assert.match(b.ai_suggestion.evidence[0].source_ref, /^private:\/\/submissions\/CSS-9-2026-FALL\/ASSESSMENT-QUIZ-09\/STUDENT-BBBBBB\/scan\.pdf$/);
  assert.deepEqual(b.professor_decision, { score: 2, decided_by: "USER-PROF", decided_at: AT });
  assert.equal(b.extensions.decided_via, "group");
  assert.equal(a.status, "overridden");
  assert.equal(a.professor_decision.comment, "no cause given");
  assert.equal(c.ai_suggestion, undefined, "a blank's zero is not anybody's suggestion");
  assert.equal(c.status, "approved");

  // Read back, the group's suggestion is still the group's, not a grader's.
  bundle.evaluations = result.evaluations;
  const again = gradeBoard({ bundle, runId: RUN, assessmentId: QUIZ, place }).items[0]!.answers.find((answer) => answer.student === A)!;
  assert.equal(again.suggestion!.source, "group");
  assert.deepEqual(again.decision, { score: 0, comment: "no cause given", decided_at: AT });
});

test("changing a decision keeps the old one in its history; the same decision again writes nothing", () => {
  const earlier = {
    evaluation_id: "EVAL-AAAAAA-Q9-01",
    submission_id: sub(A),
    criterion_id: "CRIT-Q9-01",
    ai_suggestion: { score: 1, comment: "graded by the batch" },
    professor_decision: { score: 1, decided_by: "USER-PROF", decided_at: "2026-10-01T09:00:00+05:00" },
    status: "approved",
    extensions: { decided_via: "all" },
  };
  const { place, bundle } = fixture({ evaluations: [earlier] });
  const board = gradeBoard({ bundle, runId: RUN, assessmentId: QUIZ, place });
  const byStudent = new Map(board.items[0]!.answers.map((answer) => [answer.student, answer]));
  assert.equal(byStudent.get(A)!.suggestion!.source, "grader", "a grader's own suggestion wins over its group");
  assert.deepEqual(byStudent.get(A)!.decision, { score: 1, comment: null, decided_at: "2026-10-01T09:00:00+05:00" });

  const same = decideGrades({ board, bundle, by: "USER-PROF", at: AT, via: "one", decisions: [{ student: A, item: "ITEM-Q9-01", score: 1 }] });
  assert.equal(same.written, 0);
  assert.equal(same.unchanged, 1);

  const changed = decideGrades({ board, bundle, by: "USER-PROF", at: AT, via: "one", decisions: [{ student: A, item: "ITEM-Q9-01", score: 2 }] });
  assert.equal(changed.replaced, 1);
  const [record] = changed.evaluations;
  assert.equal(record.ai_suggestion.comment, "graded by the batch");
  assert.equal(record.status, "overridden");
  assert.deepEqual(record.extensions.history, [
    { score: 1, comment: null, decided_by: "USER-PROF", decided_at: "2026-10-01T09:00:00+05:00", via: "all" },
  ]);
  assert.equal(record.extensions.decided_via, "one");
});

test("decisions are refused whole: no accepted rubric, a score out of range, a stranger, nobody deciding", () => {
  const draft = fixture({ approval: "draft" });
  const draftBoard = gradeBoard({ bundle: draft.bundle, runId: RUN, assessmentId: QUIZ, place: draft.place });
  const one = [{ student: A, item: "ITEM-Q9-01", score: 1 }];
  assert.throws(() => decideGrades({ board: draftBoard, bundle: draft.bundle, by: "USER-PROF", at: AT, via: "one", decisions: one }), /still a draft/);

  const { place, bundle } = fixture();
  const board = gradeBoard({ bundle, runId: RUN, assessmentId: QUIZ, place });
  const decide = (decisions: any[], by = "USER-PROF") => () => decideGrades({ board, bundle, by, at: AT, via: "one", decisions });
  assert.throws(decide([{ student: A, item: "ITEM-Q9-01", score: 3 }]), /outside 0–2/);
  assert.throws(decide([{ student: "STUDENT-ZZZZZZ", item: "ITEM-Q9-01", score: 1 }]), /has no paper/);
  assert.throws(decide([{ student: A, item: "ITEM-Q9-07", score: 1 }]), /not a written question/);
  assert.throws(decide([one[0], one[0]]), /decided twice/);
  assert.throws(decide(one, ""), /not a USER- id/);
});

test("groups move, answers move between them, and a grouping that breaks a rule is reported", () => {
  const { place } = fixture();
  const groups = readGroups(place)!;
  moveGroup(groups, "ITEM-Q9-01", 1, 0);
  assert.equal(groups.items[0]!.groups[1]!.score, 0);
  moveAnswer(groups, "ITEM-Q9-01", A, 0);
  assert.deepEqual(groups.items[0]!.groups.map((group) => group.students), [[B, A], []]);
  moveAnswer(groups, "ITEM-Q9-01", A, null);
  assert.deepEqual(groups.items[0]!.groups[0]!.students, [B]);
  assert.throws(() => moveGroup(groups, "ITEM-Q9-01", 5, 1), /no group 6/);

  const items = [item(1)];
  assert.deepEqual(checkGroups(groups, items), []);
  groups.items[0]!.groups[1]!.students.push(B);
  groups.items[0]!.groups[0]!.score = 3;
  assert.deepEqual(checkGroups(groups, items), [
    "ITEM-Q9-01 group 1: score 3 is outside 0–2",
    "ITEM-Q9-01: STUDENT-BBBBBB is in group 1 and group 2",
  ]);
  writeGroups(place, groups);
  assert.match(readFileSync(join(place.base, "groups.yaml"), "utf-8"), /^# PRIVATE/);
});

/** A course on disk with Quiz 9 in its own folder, as `import-paper` writes it. */
const courseOnDisk = (assessmentExtra: string) => {
  const root = mkdtempSync(join(tmpdir(), "ainar-grade-root-"));
  const folder = join(root, "courses", "CSS-9", "assessments", QUIZ);
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, "assessment.yaml"),
    "# Written by ainar.\n\nassessments:\n" +
      `- assessment_id: ${QUIZ}\n  course_version_id: ${RUN}\n  title: Quiz 9\n  type: quiz\n${assessmentExtra}` +
      "  # a comment the professor wrote\n  maximum_score: 2.0\n",
  );
  writeFileSync(
    join(folder, "items.yaml"),
    "items:\n" +
      `- item_id: ITEM-Q9-01\n  assessment_id: ${QUIZ}\n  type: short_answer\n  prompt: Question 1?\n  number: 1\n  maximum_score: 2.0\n`,
  );
  return { root, folder };
};

test("accepting the rubric changes one word and keeps the professor's comments", () => {
  const { root, folder } = courseOnDisk("  approval: draft\n");
  const { place, bundle } = fixture({ approval: "draft" });
  const board = gradeBoard({ bundle, runId: RUN, assessmentId: QUIZ, place });
  assert.equal(acceptRubric({ root, bundle, board }), true);
  const text = readFileSync(join(folder, "assessment.yaml"), "utf-8");
  assert.match(text, /approval: approved/);
  assert.match(text, /# a comment the professor wrote/);

  const accepted = fixture();
  assert.equal(acceptRubric({ root, bundle: accepted.bundle, board: gradeBoard({ bundle: accepted.bundle, runId: RUN, assessmentId: QUIZ, place: accepted.place }) }), false);
  const none = fixture({ withRubric: false });
  assert.throws(
    () => acceptRubric({ root, bundle: none.bundle, board: gradeBoard({ bundle: none.bundle, runId: RUN, assessmentId: QUIZ, place: none.place }) }),
    /no rubric/,
  );
});

test("points only: one criterion per question, worth its marks, written into the assessment and its items", () => {
  const { root, folder } = courseOnDisk("");
  const { place, bundle } = fixture({ withRubric: false });
  const board = gradeBoard({ bundle, runId: RUN, assessmentId: QUIZ, place });
  const written = pointsOnlyRubric({ root, bundle, board, items: bundle.items });
  assert.equal(written.length, 2);
  const assessment = parse(readFileSync(join(folder, "assessment.yaml"), "utf-8")).assessments[0];
  assert.equal(assessment.rubric_id, "RUBRIC-QUIZ-09");
  assert.deepEqual(assessment.rubric.criteria[0], {
    criterion_id: "CRIT-Q9-01",
    rubric_id: "RUBRIC-QUIZ-09",
    title: "Question 1",
    maximum_score: 2,
    levels: [],
  });
  // The assessment's own folder is ainar's file, written back by ainar's emitter.
  assert.match(readFileSync(join(folder, "assessment.yaml"), "utf-8"), /^# Written by ainar\./);
  assert.equal(assessment.title, "Quiz 9");
  assert.equal(parse(readFileSync(join(folder, "items.yaml"), "utf-8")).items[0].criterion_id, "CRIT-Q9-01");

  const withOne = fixture();
  assert.throws(
    () => pointsOnlyRubric({ root, bundle: withOne.bundle, board: gradeBoard({ bundle: withOne.bundle, runId: RUN, assessmentId: QUIZ, place: withOne.place }), items: withOne.bundle.items }),
    /already has a rubric/,
  );
});

/** Two rubrics over the same two groups of Q1: the marking key's, and a kinder one. */
const withProposals = (groups: GroupsFile): GroupsFile => ({
  ...groups,
  proposals: [
    {
      id: "key",
      title: "From your marking key",
      summary: "1 for the vocabulary cause, 1 for a consequence.",
      items: [
        {
          item_id: "ITEM-Q9-01",
          levels: [
            { score: 2, description: "cause and consequence" },
            { score: 1, description: "one of the two" },
            { score: 0, description: "neither" },
          ],
          scores: [2, 0],
          unsure: [1],
        },
      ],
    },
    {
      id: "class",
      title: "From what the class wrote",
      items: [
        {
          item_id: "ITEM-Q9-01",
          levels: [
            { score: 2, description: "names the vocabulary" },
            { score: 1, description: "says tokens are rare" },
            { score: 0, description: "nothing" },
          ],
          scores: [2, 1],
        },
      ],
    },
  ],
});

test("proposals are checked against the questions and the grouping, and their spread is counted", () => {
  const { place } = fixture();
  const groups = withProposals(readGroups(place)!);
  assert.deepEqual(checkGroups(groups, [item(1)]), []);
  assert.deepEqual(proposalSpread(groups.proposals![0]!.items[0]!, [3, 5]), { at: { "2": 3, "1": 0, "0": 5 }, placed: 8, mean: 0.75 });

  const broken = withProposals(readGroups(place)!);
  broken.proposals![0]!.items[0]!.scores = [2];
  broken.proposals![1]!.items[0]!.scores = [2, 1.5];
  broken.proposals![1]!.items[0]!.levels = [{ score: 1.5, description: "x" }, { score: 0, description: "y" }];
  assert.deepEqual(checkGroups(broken, [item(1)]), [
    "proposal key ITEM-Q9-01: 1 score(s) for 2 group(s)",
    "proposal class ITEM-Q9-01: no level reaches the full 2",
    "proposal class ITEM-Q9-01: group 1 at 2, which is not one of its levels",
  ]);
});

test("the board lays the proposals side by side, per question", () => {
  const { place, bundle } = fixture({ withRubric: false });
  writeGroups(place, withProposals(readGroups(place)!));
  const board = gradeBoard({ bundle, runId: RUN, assessmentId: QUIZ, place });
  assert.deepEqual(board.proposals.map((proposal) => proposal.id), ["key", "class"]);
  const [key, kind] = board.items[0]!.proposals;
  assert.deepEqual(key!.spread, { at: { "2": 1, "1": 0, "0": 1 }, placed: 2, mean: 1 });
  assert.deepEqual(kind!.spread, { at: { "2": 1, "1": 1, "0": 0 }, placed: 2, mean: 1.5 });
  assert.equal(board.items[0]!.chosen, null);
});

test("choosing a proposal writes its levels as a draft rubric and places the groups; marks already given refuse it", () => {
  const { root, folder } = courseOnDisk("");
  const { place, bundle } = fixture({ withRubric: false });
  const groups = withProposals(readGroups(place)!);
  const board = gradeBoard({ bundle, runId: RUN, assessmentId: QUIZ, place });
  const result = chooseProposal({ root, bundle, board, groups, proposalId: "key" });
  assert.deepEqual(result.items, ["ITEM-Q9-01"]);
  const assessment = parse(readFileSync(join(folder, "assessment.yaml"), "utf-8")).assessments[0];
  assert.equal(assessment.approval, "draft");
  assert.equal(assessment.rubric_id, "RUBRIC-QUIZ-09");
  assert.deepEqual(assessment.rubric.criteria[0].levels.map((level: any) => level.score), [2, 1, 0]);
  assert.equal(parse(readFileSync(join(folder, "items.yaml"), "utf-8")).items[0].criterion_id, "CRIT-Q9-01");
  assert.deepEqual(groups.items[0]!.groups.map((group) => [group.score, group.unsure ?? false]), [[2, false], [0, true]]);
  assert.deepEqual(groups.chosen, { "ITEM-Q9-01": "key" });
  assert.throws(() => chooseProposal({ root, bundle, board, groups, proposalId: "nope" }), /no proposal nope/);

  const marked = fixture({
    evaluations: [
      {
        evaluation_id: "EVAL-AAAAAA-Q9-01",
        submission_id: sub(A),
        criterion_id: "CRIT-Q9-01",
        professor_decision: { score: 1, decided_by: "USER-PROF", decided_at: AT },
        status: "approved",
      },
    ],
  });
  const markedBoard = gradeBoard({ bundle: marked.bundle, runId: RUN, assessmentId: QUIZ, place: marked.place });
  assert.throws(
    () => chooseProposal({ root, bundle: marked.bundle, board: markedBoard, groups: withProposals(readGroups(marked.place)!), proposalId: "class" }),
    /already has 1 mark/,
  );
});
test("a proposal's effect: suggestions that change, and decided marks it would suggest differently", () => {
  const answers = [
    { group: 0, blank: false, unread: false, suggestion: { score: 1 }, decision: null },
    { group: 0, blank: false, unread: false, suggestion: { score: 1 }, decision: { score: 1 } },
    { group: 1, blank: false, unread: false, suggestion: { score: 0 }, decision: null },
    { group: null, blank: true, unread: false, suggestion: { score: 0 }, decision: null },
  ];
  const effect = proposalEffect({ item_id: "ITEM-Q9-01", levels: [], scores: [2, 0] }, answers);
  assert.deepEqual(effect, { changes: 1, disagree: 1, moves: [{ group: 0, from: 1, to: 2, count: 2 }] });
});

test("revising a rubric that has marks keeps them, and can be accepted in the same press", () => {
  const { root, folder } = courseOnDisk("");
  const marked = fixture({
    evaluations: [
      {
        evaluation_id: "EVAL-AAAAAA-Q9-01",
        submission_id: sub(A),
        criterion_id: "CRIT-Q9-01",
        professor_decision: { score: 1, decided_by: "USER-PROF", decided_at: AT },
        status: "approved",
      },
    ],
  });
  const board = gradeBoard({ bundle: marked.bundle, runId: RUN, assessmentId: QUIZ, place: marked.place });
  const groups = withProposals(readGroups(marked.place)!);
  chooseProposal({ root, bundle: marked.bundle, board, groups, proposalId: "key", keepMarks: true, accept: true });
  assert.equal(parse(readFileSync(join(folder, "assessment.yaml"), "utf-8")).assessments[0].approval, "approved");
  // A's group now sits at 0; A's decided 1 stays, and the board says it differs.
  writeGroups(marked.place, groups);
  const again = gradeBoard({ bundle: marked.bundle, runId: RUN, assessmentId: QUIZ, place: marked.place }).items[0]!;
  const a = again.answers.find((answer) => answer.student === A)!;
  assert.equal(a.decision!.score, 1);
  assert.equal(a.now, 0);
  assert.deepEqual(again.marks.at["1"], { decided: 1, suggested: 0 });
});