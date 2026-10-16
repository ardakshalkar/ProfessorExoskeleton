/**
 * Course mode's words: dates, weights, icons by kind, the prompts a press sends.
 *
 * Shared by the course page the server renders (server/course-mode.js) and the
 * React view of course mode (client/course/), so the two say the same thing.
 * No imports and nothing environment-specific: Node and the bundle both load it.
 */

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-10-05` as `Oct 5`, by hand: `Date` reads a bare ISO date as UTC. */
export const shortDate = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}` : "";
};

/** A weight the payload computed, as a percentage; `null` stays `""`. */
export const pct = (value) => (value === null || value === undefined ? "" : `${Math.round(value * 100)}%`);

/**
 * A weight, to two decimals when it has them: a quiz at 0.0133 and one at
 * 0.0057 are 1.33% and 0.57%, and rounding both to "1%" hid a policy that
 * weights them differently. Whole weights stay whole; the total's float dust
 * (0.99999999…) is rounded away.
 */
export const weightPct = (value) =>
  value === null || value === undefined ? "" : `${Number((value * 100).toFixed(2))}%`;


/** The icons, as the inner markup of a 24-unit symbol each (Lucide idiom, stroked in currentColor). */
export const ICONS = {
  lecture: "<path d=\"M2 3h20\"/><path d=\"M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3\"/><path d=\"m7 21 5-5 5 5\"/>",
  lab: "<path d=\"M10 2v7.5a2 2 0 0 1-.2.9L4.7 20.6a1 1 0 0 0 .9 1.4h12.8a1 1 0 0 0 .9-1.4l-5.1-10.2a2 2 0 0 1-.2-.9V2\"/><path d=\"M8.5 2h7\"/><path d=\"M7 16h10\"/>",
  seminar: "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M22 21v-2a4 4 0 0 0-3-3.9\"/><path d=\"M16 3.1a4 4 0 0 1 0 7.8\"/>",
  slides: "<rect x=\"2\" y=\"3\" width=\"20\" height=\"14\" rx=\"2\"/><path d=\"m10 7.5 4.5 2.5-4.5 2.5z\"/><path d=\"M8 21h8\"/><path d=\"M12 17v4\"/>",
  reading: "<path d=\"M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z\"/><path d=\"M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z\"/>",
  data: "<ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\"/><path d=\"M3 5v14a9 3 0 0 0 18 0V5\"/><path d=\"M3 12a9 3 0 0 0 18 0\"/>",
  notebook: "<rect x=\"4\" y=\"2\" width=\"16\" height=\"20\" rx=\"2\"/><path d=\"m10 10-2 2 2 2\"/><path d=\"m14 10 2 2-2 2\"/>",
  file: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/>",
  brief: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/><path d=\"M8 13h8\"/><path d=\"M8 17h5\"/>",
  video: "<rect x=\"2\" y=\"6\" width=\"14\" height=\"12\" rx=\"2\"/><path d=\"m16 10 6-3v10l-6-3\"/>",
  link: "<path d=\"M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7\"/><path d=\"M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7\"/>",
  quiz: "<path d=\"m3 7 2 2 4-4\"/><path d=\"m3 17 2 2 4-4\"/><path d=\"M13 6h8\"/><path d=\"M13 12h8\"/><path d=\"M13 18h8\"/>",
  homework: "<path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z\"/>",
  project: "<path d=\"M4 22V4\"/><path d=\"M4 4h13l-2 4 2 4H4\"/>",
  exam: "<rect x=\"8\" y=\"2\" width=\"8\" height=\"4\" rx=\"1\"/><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"/><path d=\"m9 14 2 2 4-4\"/>",
  outcome: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"5\"/><circle cx=\"12\" cy=\"12\" r=\"1\"/>",
  concept: "<path d=\"M9 18h6\"/><path d=\"M10 22h4\"/><path d=\"M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z\"/>",
  module: "<path d=\"m12 2 10 5-10 5L2 7z\"/><path d=\"m2 17 10 5 10-5\"/><path d=\"m2 12 10 5 10-5\"/>",
  calendar: "<rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M16 2v4\"/><path d=\"M8 2v4\"/><path d=\"M3 10h18\"/>",
  misdated: "<rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M16 2v4\"/><path d=\"M8 2v4\"/><path d=\"M3 10h18\"/><path d=\"M12 13.5v3\"/><path d=\"M12 19.2h.01\"/>",
  weight: "<path d=\"M19 5 5 19\"/><circle cx=\"6.5\" cy=\"6.5\" r=\"2.5\"/><circle cx=\"17.5\" cy=\"17.5\" r=\"2.5\"/>",
  ask: "<path d=\"M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z\"/><path d=\"M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z\"/>",
};

export const MEETING_ICON = { lecture: "lecture", lab: "lab", seminar: "seminar", discussion: "seminar",
  review: "seminar", exercise: "homework", project_work: "project", field_work: "project", reading: "reading" };
export const RESOURCE_ICON = { slides: "slides", reading: "reading", textbook_chapter: "reading", dataset: "data",
  notebook: "notebook", video: "video", link: "link", tool: "notebook" };
export const RESOURCE_WORD = { textbook_chapter: "chapter", dataset: "dataset" };
export const WORK_ICON = { quiz: "quiz", assignment: "homework", project: "project", exam: "exam",
  presentation: "lecture", oral_defense: "seminar", participation: "seminar" };
// `assignment` is the model's word; `homework` is the professor's.
export const WORK_WORD = { assignment: "homework", oral_defense: "defence" };
export const GAP = {
  module: { icon: "module", verb: "Plan module" },
  deck: { icon: "slides", verb: "Draft deck" },
  misdated: { icon: "misdated", verb: "Check date" },
  deadline: { icon: "calendar", verb: "Set dates" },
  weight: { icon: "weight", verb: "Set weight" },
  brief: { icon: "brief", verb: "Write brief" },
};

/**
 * What a hole's press asks, naming the records.
 *
 * The context packet in words: the week, the module, the meetings or the
 * assessment — every identifier the model would otherwise spend a search on.
 * Ids only, never a name: this text goes to a model.
 */
export const promptFor = (kind, week, run, ref) => {
  const module = (week.modules ?? [])[0];
  const about = `week ${week.week} of ${run.id}` + (module ? ` (${module.module_id}, "${module.title}")` : "");
  const gap = (week.gaps ?? []).find((g) => g.kind === kind) ?? { ids: [] };
  switch (kind) {
    case "deck":
      return `Draft the slides for ${about} with /make-materials. It meets in ${gap.ids.join(", ") || "its meetings"}` +
        " and has no deck. Register it as a resource marked approval: draft.";
    case "module":
      return `Week ${week.week} of ${run.id} has no module. Propose what it should teach, given the weeks either` +
        " side, as a draft module for me to read. Change nothing else.";
    case "misdated":
      return `${ref} is drawn under ${about}, but its date falls outside that week. Which is wrong: its date,` +
        " its module's week, or the run's start date? Tell me what you find and change nothing until I say.";
    case "weight":
      return `What should ${gap.ids.join(", ")} in ${about} be worth? The weight is mine to set; propose one and wait.`;
    case "brief":
      return `${ref} in ${about} has no brief students can read. Draft one from its rubric and outcomes with` +
        " /design-assessment, as a draft for me to read.";
    default:
      return `For ${about}, what is still missing?`;
  }
};

/** The undated-work prompt, the widget's own wording: two dates nobody has written down. */
export const datesPrompt = (a, run) =>
  "Ask me this now, in your first message, before running any command: what are the open and due dates for " +
  `${a.assessment_id} ("${a.title}")? Skip the usual opening validate and inbox sweep, and do not read any ` +
  "file first: these two dates exist only in my head, so nothing on disk can answer this. Once I have " +
  `answered, set opens_at and due_at on the ${a.assessment_id} entry in ` +
  (a.source_file ?? `courses/${run.course_id}/versions/${run.term}/assessments/ (grep for the id)`) +
  ", and then just confirm what you wrote.";

/**
 * When a hole bites: this week and next, later, or a week already taught.
 * The payload's own `urgency`; the fallback is the same rule, for a payload
 * built before the field existed.
 */
export const tierOf = (week, current) => {
  if (week.urgency) return week.urgency;
  if (week.when === "past") return "past";
  if (current !== null && week.week <= current + 1) return "soon";
  return "later";
};

export const hasBrief = (a) => Boolean(a.url || a.brief_url || String(a.description ?? "").trim());

export const titleOf = (w) => (w.modules ?? []).map((m) => m.title).join(" · ");
export const conceptsOf = (w) => (w.modules ?? []).flatMap((m) => m.concepts ?? []);

/** Each kind of graded work: its word in the weight cards and its bar's colour. */
const KINDS = { quiz: ["Quizzes", "q"], assignment: ["Homework", "hw"], project: ["Project", "pj"], exam: ["Exams", "ex"] };
export const kindOf = (type) => KINDS[type] ?? ["Other", "ot"];

/**
 * Planning's columns, and the kinds each holds. Exams and quizzes share one:
 * both are sat on a day, so a midterm reads among the quizzes it sits between.
 * A bar keeps its kind's colour; the column is only where it goes.
 */
export const LANES = [["test", "Exams & Quizzes", "q", ["quiz", "exam"]], ["assignment", "Homework", "hw", ["assignment"]], ["project", "Project", "pj", ["project"]]];
export const laneOf = (type) => LANES.find((l) => l[3].includes(type)) ?? ["other", "Other", "ot", []];

/**
 * The offset a new date is written with, for work that has none yet: the
 * run's own time zone on the day the run starts, else the offset the run's
 * other dates already carry, else UTC. A record's timestamp always carries
 * one; the form never makes a naive time.
 */
export const runOffset = (data) => {
  const run = data.run ?? {};
  try {
    if (run.timezone && run.start_date) {
      const name = new Intl.DateTimeFormat("en-US", { timeZone: run.timezone, timeZoneName: "longOffset" })
        .formatToParts(new Date(`${run.start_date}T12:00:00Z`))
        .find((p) => p.type === "timeZoneName")?.value ?? "";
      const m = /GMT([+-]\d{2}:\d{2})?/.exec(name);
      if (m) return m[1] ?? "+00:00";
    }
  } catch {
    // An unknown zone name falls through to the records' own offset.
  }
  for (const a of data.assessments ?? []) {
    const m = /([+-]\d{2}:\d{2}|Z)$/.exec(String(a.due_at ?? a.opens_at ?? ""));
    if (m) return m[1] === "Z" ? "+00:00" : m[1];
  }
  return "+00:00";
};

export const REVISIT_BELOW = 0.6;

