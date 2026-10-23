/**
 * The action catalogue: every thing a professor does in the course, as data.
 * BACKLOG E37 HOME-11; the list is docs/PROFESSOR-JOURNEY.md §9.
 *
 * One entry per action, keyed by the §9 id, saying what a professor would
 * type to find it (`words`) and where it lives (`do`):
 *
 *   { open: request }   a place, in the navigator's request shapes —
 *                       `{ view, sub }`, `{ mode }`, `{ grade }`, `{ scans }`
 *   { fill: text }      a skill for the session, put into the field to be
 *                       finished, never sent: `{run}` is the run's id
 *   { press: name }     a window the header opens: `publish`, `upload`
 *
 * `outward` marks what other people see the result of: the command field
 * says so beside it, and the window it opens still asks before anything goes.
 *
 * The command field (HOME-12) reads this file; so may anything else that
 * needs to know where an action is. An action's home is declared here once.
 */

export const ACTIONS = [
  // ---- the course and the term
  { id: "T1", label: "Set up a course", words: "onboard new course start setup", do: { fill: "/onboard-course " } },
  { id: "T2", label: "Connect Canvas, Google, GitHub", words: "integrations connect canvas google github telegram token address", do: { open: { view: "settings", sub: "integrations" } } },
  { id: "T4", label: "Build the concept map", words: "propose concepts map prerequisites", do: { fill: "/propose-concepts {run} " } },
  { id: "T5", label: "Plan the term", words: "planning weeks plan term schedule calendar move topic", do: { open: { mode: "planning" } } },
  { id: "T6", label: "Grading policy", words: "policy weights blocks grading scheme reweight", do: { open: { view: "gradebook", sub: "policy" } } },
  { id: "T6b", label: "Propose a grading policy change", words: "grading proposal reweight drop assignment", do: { fill: "/grading-proposal {run} " } },
  { id: "T7", label: "Check outcomes against assessments", words: "syllabus review alignment outcomes", do: { fill: "/syllabus-review {run} " } },
  { id: "T8", label: "Publish", words: "publish course page site announcement repository brief", do: { press: "publish" }, outward: true },
  { id: "T10", label: "Reflect on the term", words: "reflection retrospective post-mortem end of term", do: { fill: "/course-reflection {run} " } },

  // ---- the week
  { id: "W1", label: "This week", words: "teaching current week now today class", do: { open: { mode: "teaching" } } },
  { id: "W2", label: "Weeks with gaps", words: "gaps missing deck deadline room planning", do: { open: { mode: "planning" } } },
  { id: "W3", label: "Draft materials", words: "make materials slides deck handout lecture lab", do: { fill: "/make-materials {run} " } },
  { id: "W4", label: "Read and accept drafts", words: "drafts accept approve ready", do: { open: { view: "tasks", sub: "ready" } } },
  { id: "W7", label: "Prepare the lesson", words: "prepare lesson brief next class revisit", do: { fill: "/prepare-lesson {run} " } },
  { id: "W8", label: "Announce to students", words: "announce telegram post message channel", do: { fill: "/publish-telegram {run} " }, outward: true },
  { id: "W9", label: "All weeks", words: "term all weeks overview", do: { open: { mode: "term" } } },

  // ---- assessments
  { id: "E1", label: "Design an assessment", words: "design assignment quiz exam homework project write", do: { fill: "/design-assessment {run} " } },
  { id: "E2", label: "Import an exam already given", words: "import existing exam paper record", do: { fill: "/import-assessment {run} " } },
  { id: "E4", label: "Upload scans", words: "upload scans papers pdf recordings exam paper key", do: { press: "upload" } },
  { id: "E4b", label: "Grade scanned exams", words: "grade scans paper handwritten", do: { fill: "/grade-scans {run} " } },
  { id: "E5", label: "Scans and recordings", words: "files scans piles held papers recordings audio", do: { open: { view: "files" } } },
  { id: "E8", label: "Grade a whole class", words: "grade batch submissions everyone", do: { fill: "/grade-batch {run} " } },
  { id: "E9", label: "Decide marks", words: "marks decide suggested grade review pending", do: { open: { view: "tasks", sub: "tasks" } } },
  { id: "E11", label: "Send marks to Canvas", words: "release marks canvas send grades to canvas", do: { open: { view: "gradebook", sub: "canvas" } }, outward: true },
  { id: "E12", label: "Gradebook", words: "gradebook marks grid scores results", do: { open: { view: "gradebook", sub: "marks" } } },
  { id: "E13", label: "Assessments", words: "assessments list weights due", do: { open: { view: "materials", sub: "assessments" } } },

  // ---- students
  { id: "P1", label: "Students", words: "class list roster students subgroup", do: { open: { view: "students" } } },
  { id: "P3", label: "Write a student report", words: "student report feedback progress", do: { fill: "/student-report {run} " } },

  // ---- concepts
  { id: "C1", label: "Concepts", words: "concepts grid class by concept coverage", do: { open: { view: "concepts" } } },
  { id: "C4", label: "Why a concept is not landing", words: "find gaps struggling difficulty why", do: { fill: "/find-gaps {run} " } },
  { id: "C6", label: "How the class is doing", words: "evidence progress how is the class doing week by week", do: { open: { mode: "evidence" } } },
  { id: "C7", label: "Course dashboard", words: "dashboard visualise marks results", do: { fill: "/course-dashboard {run} " } },

  // ---- integrations
  { id: "I3", label: "Sync all", words: "sync canvas sheet in step differences sync all", do: { open: { view: "syncs" } } },
  { id: "I4", label: "Resolve unsure matches", words: "names to confirm unsure matches sheet", do: { open: { view: "syncs" } } },
  { id: "I5", label: "Re-import students from Canvas", words: "sync roster reimport class list canvas", do: { fill: "/sync-roster {run} " } },
  { id: "I6", label: "Accounts", words: "accounts reconnect sign in google token credentials", do: { open: { view: "settings", sub: "accounts" } } },
  { id: "I7", label: "Preferences", words: "preferences settings assumptions", do: { open: { view: "settings", sub: "preferences" } } },

  // ---- overview
  { id: "O0", label: "Today", words: "today home landing", do: { open: { view: "today" } } },
  { id: "O1", label: "What is waiting on me", words: "waiting inbox todo tasks pending snooze", do: { open: { view: "tasks", sub: "waiting" } } },
  { id: "O3", label: "Status across all courses", words: "course status all courses database", do: { fill: "/course-status " } },
  { id: "O4", label: "Slides", words: "slides decks lectures", do: { open: { view: "materials", sub: "slides" } } },
  { id: "O5", label: "Exams", words: "exams papers keys variants", do: { open: { view: "materials", sub: "exams" } } },
];

const norm = (text) =>
  String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}/]+/gu, " ")
    .trim();

/**
 * How well `query` finds `haystack`: every word typed must begin a word of
 * the haystack. Higher is better; 0 is no match. A query equal to the label
 * scores highest, and is `exact`.
 */
const score = (query, label, extra) => {
  const q = norm(query);
  if (!q) return { score: 0, exact: false };
  const name = norm(label);
  if (q === name) return { score: 100, exact: true };
  const words = (name + " " + norm(extra)).split(" ");
  const typed = q.split(" ");
  if (!typed.every((part) => words.some((word) => word.startsWith(part)))) return { score: 0, exact: false };
  // Words of the label itself count for more than words only in the aliases.
  const inLabel = typed.filter((part) => name.split(" ").some((word) => word.startsWith(part))).length;
  return { score: 10 + inLabel * 5 + (name.startsWith(q) ? 20 : 0) - name.length / 50, exact: false };
};

/**
 * What the command field offers for what has been typed: actions from the
 * catalogue, and the run's own weeks, students, assessments and concepts from
 * `index` (`/api/command-index`). Best first, at most `limit`.
 *
 * Each entry: `{ key, label, hint, kind, do, outward, exact }`.
 */
export const matchCommand = (query, index, limit = 7) => {
  const q = norm(query);
  if (!q || q.length < 2) return [];
  const found = [];
  const add = (entry, result) => {
    if (result.score > 0) found.push(Object.assign({}, entry, { score: result.score, exact: result.exact }));
  };

  for (const action of ACTIONS) {
    add({ key: "a:" + action.id, label: action.label, hint: action.do.fill ? action.do.fill.trim().split(" ")[0] : action.outward ? "students see it" : null, kind: "action", do: action.do, outward: Boolean(action.outward) }, score(q, action.label, action.words));
  }

  const idx = index || {};
  // "week 7", "wk 7", "w7": a week by its number, exactly.
  const weekAsked = /^(?:week|wk|w)\s*(\d{1,2})$/.exec(q);
  for (const week of idx.weeks || []) {
    const label = "Week " + week.week;
    const result = weekAsked && Number(weekAsked[1]) === week.week ? { score: 100, exact: true } : score(q, label + " " + (week.title || ""), "");
    add({ key: "w:" + week.week, label: label + (week.title ? " · " + week.title : ""), hint: "teaching", kind: "week", do: { open: { mode: "teaching", week: week.week } } }, result);
  }
  for (const student of idx.students || []) {
    const name = student.name || student.id;
    const result = norm(q) === norm(name) || norm(q) === norm(student.id) ? { score: 100, exact: true } : score(q, name, student.id);
    add({ key: "s:" + student.id, label: name, hint: "their concepts", kind: "student", do: { open: { view: "concepts", student: student.id } } }, result);
  }
  for (const assessment of idx.assessments || []) {
    const result = score(q, assessment.title, assessment.id);
    add({ key: "e:" + assessment.id, label: assessment.title, hint: "grade", kind: "assessment", do: { open: { grade: assessment.id, label: assessment.title } } }, result);
  }
  for (const concept of idx.concepts || []) {
    const result = score(q, concept.title, concept.id);
    add({ key: "c:" + concept.id, label: concept.title, hint: "the class on it", kind: "concept", do: { open: { view: "concepts", concept: concept.id } } }, result);
  }

  return found.sort((a, b) => b.score - a.score).slice(0, limit);
};
