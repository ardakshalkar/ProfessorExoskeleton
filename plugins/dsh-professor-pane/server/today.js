/**
 * Today: what the professor sees on opening a course — where the term
 * stands, what is waiting on them, and how the class and the roads out are
 * doing. docs/PROFESSOR-JOURNEY.md §10 argues the shape; BACKLOG E37 is the
 * work.
 *
 * Three bands, each a document the pane already reads, picked rather than
 * re-derived — the navigator's rule:
 *
 * * **Now** — the navigator's own week and next due, and the phase of the
 *   term, so the band can say something other than "week 8" before and after.
 * * **Waiting** — one list across kinds, each item a link into the place
 *   that resolves it. Today never hosts an action; it surfaces one.
 * * **Pulse** — counts that open a place: concepts under the threshold
 *   Evidence marks, concepts nothing has assessed, the last hand-in, and one
 *   chip per service from the syncs document.
 *
 * Which halves: the inbox over the whole course, drafts included (what waits
 * on the professor is the suggested half); class progress over the record,
 * as Evidence reads it. Each band fails alone — a broken sync ledger must not
 * cost the professor the week.
 */

import { enrolledIn } from "@ainar/core/src/bundle.ts";
import { Ledger } from "@ainar/core/src/lms/ledger.ts";

import { navigatorDocument } from "./navigator.js";
import { snoozesOf, todayIso } from "./snooze.js";
import { syncsDocument } from "./syncs.js";
import { unpublishedDocument } from "./unpublished.js";
import { loadedRun, viewPayload } from "./workspace.js";

/** Below this class mean a concept is flagged to revisit — Evidence's line. */
const REVISIT_BELOW = 0.6;

/**
 * Urgency, most urgent first. A waiting list ordered by kind makes the
 * professor do the merge; this is the one order every kind is put in.
 */
const URGENCY = ["overdue", "this_week", "blocks_students", "blocks_assistant", "later"];

/** What each service is called on its chip. */
const SERVICES = { canvas: "Canvas", sheets: "Google Sheets", github: "GitHub", telegram: "Telegram" };

/** Run `read`, or answer `fallback` if it throws. */
const safely = (read, fallback) => {
  try {
    return read();
  } catch {
    return fallback;
  }
};

const plural = (n, one, many) => n + " " + (n === 1 ? one : many);

/** The ISO date a week after `day`, for "due this week". */
const weekAhead = (day) => {
  const at = new Date(day + "T12:00:00");
  at.setDate(at.getDate() + 7);
  return at.toISOString().slice(0, 10);
};

/** The words for one week gap, as the week card's chips say them. */
const GAP_WORDS = {
  module: "no topic",
  deck: "no slides",
  misdated: "a meeting dated outside the week",
  deadline: "no deadline",
  weight: "no weight",
};

/** A record collection as a professor would say it, for the drafts line. */
const COLLECTION_WORDS = {
  item_responses: ["answer read from papers", "answers read from papers"],
  items: ["question", "questions"],
  documents: ["document", "documents"],
  resources: ["material", "materials"],
  activities: ["meeting", "meetings"],
  assessments: ["assessment", "assessments"],
  modules: ["topic", "topics"],
  concepts: ["concept", "concepts"],
  rubrics: ["rubric", "rubrics"],
  evaluations: ["mark", "marks"],
};

/**
 * Every item waiting on the professor, one list. Each carries `open`, the
 * place request that resolves it — the same shapes the navigator sends
 * (`{ mode }`, `{ view, sub }`) plus `{ grade }` and `{ scans }`, which open
 * the Grade view and the Scans window over course mode.
 */
const waitingItems = ({ outline, inbox, held, syncs, unpublished, progress }) => {
  const items = [];
  const asOf = (inbox && inbox.as_of) || todayIso();

  // Holes in this week and the next, still fixable before the class meets.
  for (const week of (outline && outline.weeks) || []) {
    if (week.urgency !== "soon" || !(week.gaps || []).length) continue;
    items.push({
      kind: "week",
      id: "week-" + week.week,
      title: "Week " + week.week + (week.when === "current" ? " (this week)" : " (next week)"),
      detail: week.gaps.map((gap) => GAP_WORDS[gap.kind] || gap.kind).join(" · "),
      urgency: week.when === "current" ? "this_week" : "later",
      open: { mode: "planning" },
    });
  }

  // Marks the assistant suggested and nobody has decided: students wait on them.
  const pending = (inbox && inbox.pending_evaluations && inbox.pending_evaluations.by_assessment) || [];
  for (const entry of pending) {
    if (!entry.pending) continue;
    items.push({
      kind: "marks",
      id: "marks-" + entry.assessment_id,
      title: "Decide marks · " + (entry.title || entry.assessment_id),
      detail:
        plural(entry.pending, "suggestion", "suggestions") +
        (entry.low_confidence ? " · " + entry.low_confidence + " low confidence" : ""),
      count: entry.pending,
      urgency: "blocks_students",
      open: { grade: entry.assessment_id, label: entry.title || entry.assessment_id },
    });
  }

  // Papers placed on nobody: until each is, the assistant cannot read it and
  // whoever wrote it reads as missing.
  for (const pile of held || []) {
    items.push({
      kind: "held",
      id: "held-" + pile.assessment_id,
      title: "Place scanned papers · " + pile.title,
      detail: plural(pile.held, "paper", "papers") + " not matched to a student",
      count: pile.held,
      urgency: "blocks_assistant",
      open: { scans: pile.assessment_id },
    });
  }

  // Sync rows the matcher was not sure of, one item per service, and a
  // Google sign-in that was refused.
  if (syncs && !syncs.error) {
    const byService = new Map();
    for (const row of syncs.waiting || []) {
      const sync = (syncs.syncs || []).find((entry) => entry.id === row.sync);
      const service = sync ? sync.service : "other";
      byService.set(service, (byService.get(service) || 0) + 1);
    }
    for (const [service, n] of byService) {
      items.push({
        kind: "sync",
        id: "sync-" + service,
        title: "Resolve sync matches · " + (SERVICES[service] || service),
        detail: plural(n, "row", "rows") + " the sync was not sure of",
        count: n,
        urgency: "blocks_assistant",
        open: { view: "syncs" },
      });
    }
    if ((syncs.syncs || []).some((entry) => entry.reconnect)) {
      items.push({
        kind: "reconnect",
        id: "reconnect-google",
        title: "Reconnect Google",
        detail: "Google refused the saved sign-in; the grade sheet cannot be read",
        urgency: "blocks_assistant",
        open: { view: "settings", sub: "integrations" },
      });
    }
  }

  // Records an agent wrote and marked `approval: draft`, one item for all of
  // them, said by collection: accepting is the professor's edit, in Tasks.
  const drafts = (inbox && inbox.drafts_awaiting_approval) || [];
  if (drafts.length) {
    const byCollection = new Map();
    for (const draft of drafts) byCollection.set(draft.collection, (byCollection.get(draft.collection) || 0) + 1);
    items.push({
      kind: "drafts",
      id: "drafts",
      title: "Read and accept drafts",
      detail: [...byCollection]
        .sort((a, b) => b[1] - a[1])
        .map(([collection, n]) => {
          const words = COLLECTION_WORDS[collection] || [collection.replace(/_/g, " "), collection.replace(/_/g, " ")];
          return plural(n, words[0], words[1]);
        })
        .join(" · "),
      count: drafts.length,
      urgency: "later",
      // Waiting's Ready lists the drafts, kind by kind.
      open: { view: "tasks", sub: "ready" },
    });
  }

  // Integrity cases still open: a mark may wait on each.
  const cases = (inbox && inbox.open_integrity_cases) || [];
  if (cases.length) {
    items.push({
      kind: "integrity",
      id: "integrity",
      title: "Open integrity cases",
      detail: plural(cases.length, "case", "cases") + " not settled",
      count: cases.length,
      urgency: "blocks_students",
      open: { view: "students" },
    });
  }

  // Marks decided here that Canvas does not have: students cannot see them
  // until they are sent. One item for the run; To Canvas lists them.
  const unsent = ((unpublished && unpublished.marks) || []).map((entry) => ({
    title: entry.title,
    n: (entry.canvas.unsent || 0) + (entry.canvas.changed || 0),
  }));
  const unsentTotal = unsent.reduce((sum, entry) => sum + entry.n, 0);
  if (unsentTotal) {
    items.push({
      kind: "canvas",
      id: "canvas-marks",
      title: "Send marks to Canvas",
      detail: plural(unsentTotal, "mark", "marks") + " across " + plural(unsent.length, "assessment", "assessments") + " that Canvas does not have",
      count: unsentTotal,
      urgency: "blocks_students",
      open: { view: "gradebook", sub: "canvas" },
    });
  }

  // Dated work from the run's action items: the one kind that can be
  // overdue. Mark reviews are left out — "Decide marks" above already
  // says them, counted from the evaluations themselves.
  for (const action of (inbox && inbox.existing_action_items) || []) {
    if (action.status !== "pending" || action.type === "review_grades") continue;
    const due = action.due_at ? String(action.due_at).slice(0, 10) : null;
    items.push({
      kind: "action",
      id: "action-" + action.action_id,
      title: action.title || action.type,
      detail: due ? (due < asOf ? "was due " : "due ") + due : action.type,
      urgency: due && due < asOf ? "overdue" : due && due <= weekAhead(asOf) ? "this_week" : "later",
      open: { view: "tasks", sub: "tasks" },
    });
  }

  // Concept states somebody marked "needs review": the professor confirms
  // them. None are recorded on most runs yet; the item appears when they are.
  const review = progress && Array.isArray(progress.concepts)
    ? progress.concepts.reduce((sum, concept) => sum + concept.cells.filter((cell) => cell.state === "needs_review").length, 0)
    : 0;
  if (review) {
    items.push({
      kind: "review",
      id: "concept-review",
      title: "Confirm concept states",
      detail: plural(review, "student-concept state", "student-concept states") + " marked needs review",
      count: review,
      urgency: "later",
      open: { view: "concepts" },
    });
  }

  // Class-level difficulties the evidence shows, for the concepts view.
  const signals = ((inbox && inbox.open_signals) || []).filter((signal) => !signal.student_id);
  if (signals.length) {
    items.push({
      kind: "signals",
      id: "signals",
      title: "Concepts the class is struggling with",
      detail: plural(signals.length, "open signal", "open signals"),
      count: signals.length,
      urgency: "later",
      open: { view: "concepts" },
    });
  }

  const rank = (item) => URGENCY.indexOf(item.urgency);
  return items.sort((a, b) => rank(a) - rank(b));
};

/** Concepts in brief: how many, which fall under the line, which have no evidence. */
const conceptPulse = (progress) => {
  if (!progress || !Array.isArray(progress.concepts)) return null;
  const below = progress.concepts
    .filter((concept) => typeof concept.class_mean === "number" && concept.class_mean < REVISIT_BELOW)
    .map((concept) => ({ concept_id: concept.concept_id, title: concept.title, class_mean: concept.class_mean }));
  const totals = progress.totals || {};
  return {
    total: totals.concepts ?? progress.concepts.length,
    below,
    threshold: REVISIT_BELOW,
    no_evidence: Array.isArray(totals.concepts_with_no_evidence) ? totals.concepts_with_no_evidence.length : 0,
  };
};

/**
 * The last piece of work whose deadline has passed, with the inbox's own
 * counts of what came in. ISO strings compare as dates; `as_of` is the
 * inbox's today, so the two agree on what "passed" means.
 */
const lastHandIn = (inbox) => {
  if (!inbox || !Array.isArray(inbox.assessments)) return null;
  const asOf = inbox.as_of || "";
  const past = inbox.assessments
    .filter((entry) => entry.due_at && entry.due_at.slice(0, 10) <= asOf)
    .sort((a, b) => (a.due_at < b.due_at ? 1 : -1));
  const last = past[0];
  if (!last) return null;
  return {
    assessment_id: last.assessment_id,
    title: last.title,
    due_at: last.due_at,
    received: last.submissions_received ?? null,
    enrolled: last.enrolled ?? null,
    missing: Array.isArray(last.missing) ? last.missing.length : null,
  };
};

/** One chip per service: how many roads, how many rows wait, when it last ran. */
const syncStrip = (syncs) => {
  if (!syncs || syncs.error) return [];
  const chips = new Map();
  for (const sync of syncs.syncs || []) {
    if (!sync.enabled) continue;
    const chip = chips.get(sync.service) || {
      service: sync.service,
      label: SERVICES[sync.service] || sync.service,
      roads: 0,
      waiting: 0,
      last: null,
      reconnect: false,
    };
    chip.roads += 1;
    chip.waiting += sync.waiting || 0;
    if (sync.lastSynced && (!chip.last || sync.lastSynced > chip.last)) chip.last = sync.lastSynced;
    if (sync.reconnect) chip.reconnect = true;
    chips.set(sync.service, chip);
  }
  return [...chips.values()];
};

/**
 * Before the term, Now is what is still missing before it can start
 * (BACKLOG E37 HOME-3; PROFESSOR-JOURNEY §2): each line a fact the records
 * already hold, done or not, and where it is fixed. Counted by the outline
 * and the enrollments, not here.
 */
export const readinessOf = ({ outline, enrolled, syncs }) => {
  const gaps = (outline && outline.totals && outline.totals.gaps) || {};
  const weeks = (outline && outline.weeks) || [];
  const first = weeks.find((week) => week.meetings && week.meetings.length) || null;
  const firstDeck = first ? !(first.gaps || []).some((gap) => gap.kind === "deck") : false;
  const outcomes = (outline && outline.outcomes) || [];
  // The concepts the term's topics teach: the outline has no list of its own.
  const concepts = [...new Set(weeks.flatMap((week) => (week.modules || []).flatMap((module) => (module.concepts || []).map((concept) => concept.id))))];
  const canvas = Boolean(syncs && !syncs.error && (syncs.syncs || []).some((sync) => sync.service === "canvas" && sync.enabled));
  const weekWord = (n) => plural(n, "week", "weeks");
  return [
    { id: "outcomes", label: "Learning outcomes stated", done: outcomes.length > 0, detail: outcomes.length ? plural(outcomes.length, "outcome", "outcomes") : "none yet", do: { fill: "/onboard-course " } },
    { id: "concepts", label: "Concept map built", done: concepts.length > 0, detail: concepts.length ? plural(concepts.length, "concept", "concepts") : "none yet", do: { fill: "/propose-concepts {run} " } },
    { id: "topics", label: "Every week has a topic", done: !gaps.module, detail: gaps.module ? weekWord(gaps.module) + " without one" : null, do: { open: { mode: "planning" } } },
    { id: "deadlines", label: "Every assessment has a deadline", done: !gaps.deadline, detail: gaps.deadline ? weekWord(gaps.deadline) + " with work undated" : null, do: { open: { mode: "planning" } } },
    { id: "weights", label: "Every assessment counts in the grade", done: !gaps.weight, detail: gaps.weight ? weekWord(gaps.weight) + " with work unweighted" : null, do: { open: { view: "gradebook", sub: "policy" } } },
    { id: "first-deck", label: "Week 1 has its slides", done: firstDeck, detail: first ? null : "no meeting is planned yet", do: { fill: "/make-materials {run} week 1 " } },
    { id: "roster", label: "Class list imported", done: enrolled > 0, detail: enrolled ? plural(enrolled, "student", "students") : "nobody enrolled yet", do: { open: { view: "students" } } },
    { id: "canvas", label: "Canvas connected", done: canvas, detail: canvas ? null : "no Canvas road on this run", do: { open: { view: "settings", sub: "integrations" } } },
  ];
};

/**
 * After the term, Now is what must be true before it is closed: every mark
 * decided and sent, nothing held, nothing open. The last two are the
 * professor's to do, never checked off by the pane: the reflection
 * (`/course-reflection`) and archiving the run (`bin/ainar archive-run`).
 */
export const closingOf = ({ inbox, unpublished, held }) => {
  const pending = (inbox && inbox.pending_evaluations && inbox.pending_evaluations.total) || 0;
  const unsent = ((unpublished && unpublished.marks) || []).reduce((sum, entry) => sum + (entry.canvas.unsent || 0) + (entry.canvas.changed || 0), 0);
  const cases = ((inbox && inbox.open_integrity_cases) || []).length;
  const papers = (held || []).reduce((sum, pile) => sum + pile.held, 0);
  const drafts = ((inbox && inbox.drafts_awaiting_approval) || []).length;
  return [
    { id: "decided", label: "Every mark decided", done: !pending, detail: pending ? plural(pending, "suggestion", "suggestions") + " waiting" : null, do: { open: { view: "tasks", sub: "tasks" } } },
    { id: "sent", label: "Marks sent to Canvas", done: !unsent, detail: unsent ? plural(unsent, "mark", "marks") + " Canvas does not have" : null, do: { open: { view: "gradebook", sub: "canvas" } }, outward: true },
    { id: "integrity", label: "Integrity cases settled", done: !cases, detail: cases ? plural(cases, "case", "cases") + " open" : null, do: { open: { view: "students" } } },
    { id: "papers", label: "Every scanned paper placed", done: !papers, detail: papers ? plural(papers, "paper", "papers") + " on nobody" : null, do: { open: { view: "files" } } },
    { id: "drafts", label: "Drafts accepted or dropped", done: !drafts, detail: drafts ? plural(drafts, "draft", "drafts") + " left" : null, do: { open: { view: "tasks", sub: "ready" } } },
    { id: "reflect", label: "Reflect on the term", done: null, detail: "what worked, what to change next year", do: { fill: "/course-reflection {run} " } },
    { id: "archive", label: "Archive the run", done: null, detail: "bin/ainar archive-run moves the term's files to archive/", do: null },
  ];
};

/**
 * Where the term is: `before`, `teaching` or `after`, from the run's own
 * dates against the inbox's today (the machine's, when there is no inbox).
 * Computed every time, never stored — WORKFLOWS.md §2.
 */
const phaseOf = (run, inbox) => {
  const now = new Date();
  const today =
    (inbox && inbox.as_of) ||
    now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  if (run.start_date && today < run.start_date) return "before";
  if (run.end_date && today > run.end_date) return "after";
  return "teaching";
};

/**
 * @param workspace - the course workspace the session stands in.
 * @param root - its folder.
 * @param askedRun - `?run=`, when the pane already knows which.
 * @param askedPhase - `?phase=before|after`, to look at the other phases'
 *   Now before they come; the document says so (`now.previewing`).
 */
export const todayDocument = (workspace, root, askedRun, askedPhase = null) => {
  const nav = navigatorDocument(workspace, root, askedRun);
  if (!nav.run) return { run: null };
  const runId = nav.run.run_id;

  const outline = safely(() => viewPayload(workspace, "course_outline", runId, undefined, false).payload, null);
  const inbox = safely(() => viewPayload(workspace, "action_inbox", runId, undefined, true).payload, null);
  const progress = safely(() => viewPayload(workspace, "class_progress", runId, undefined, false).payload, null);
  const syncs = safely(() => syncsDocument(workspace, runId), { error: "unread" });
  const unpublished = safely(
    () => unpublishedDocument({ bundle: loadedRun(workspace, runId).bundle, runId, root, ledger: Ledger.load(runId) }),
    null,
  );

  // One list in one order; what the professor snoozed is set aside until its
  // day, and said apart so it is never lost (HOME-5).
  const snoozed = safely(() => snoozesOf(runId), {});
  const all = waitingItems({ outline, inbox, held: nav.held, syncs, unpublished, progress });
  const waiting = all.filter((item) => !snoozed[item.id]);
  const later = all.filter((item) => snoozed[item.id]).map((item) => Object.assign({}, item, { until: snoozed[item.id] }));

  const readiness = inbox && inbox.readiness ? inbox.readiness : null;
  const real = phaseOf(nav.run, inbox);
  const phase = askedPhase === "before" || askedPhase === "after" || askedPhase === "teaching" ? askedPhase : real;
  const enrolled = safely(() => enrolledIn(loadedRun(workspace, runId).bundle, runId).length, 0);
  return {
    run: nav.run,
    now: {
      phase,
      previewing: phase !== real,
      // The phase's own list: what is missing before the term, what must be
      // true to close it after. Teaching has the week instead.
      checklist:
        phase === "before"
          ? readinessOf({ outline, enrolled, syncs })
          : phase === "after"
            ? closingOf({ inbox, unpublished, held: nav.held })
            : null,
      week: nav.week,
      next_due: nav.next_due,
      // Before the term, Now is what to build next.
      next_step: readiness && readiness.next_step ? readiness.next_step : null,
      gaps: nav.gaps,
    },
    waiting,
    snoozed: later,
    pulse: {
      concepts: conceptPulse(progress),
      hand_in: lastHandIn(inbox),
      syncs: syncStrip(syncs),
    },
  };
};
