/**
 * Marks on their way out: match review, the Canvas marks push, and what has
 * not been published yet.
 */

import { Message } from "./common.js";
import { h, React, ReactDOM } from "./react.js";
import { initials, when } from "./syncs.js";
import { BASE, scoped } from "./tabs.js";

// ---------------------------------------------------------------- scans

/**
 * What the assistant is asked for at the steps that need its judgement.
 * A skill and a target, nothing more: DSH loads the whole skill for any
 * `/name` in a message, and the skill finds where the pile stands itself,
 * so a procedure restated here would only be a second copy to drift. Read
 * is not here — it is a command, run by the pane's own button.
 * Pseudonyms and ids only.
 */
export const STEP_PROMPTS = {
  rubric: (runId, id) => "/import-assessment " + id + " " + runId + " — propose the rubric",
  grade: (runId, id) => "/grade-batch " + id + " " + runId,
  approve: (runId, id) =>
    "Which suggested grades on " + id + " (" + runId + ") are still waiting for my decision, " +
    "least confident first?",
};

/**
 * Every name correspondence in the pile, as big cards over the conversation.
 *
 * Two sections. **Matched** is every paper the roster placed by its name and
 * nobody has confirmed — a close spelling first, since that is where a wrong
 * match would be. They start as yes, because the matcher already decided;
 * pressing a card turns it to "not them". **Suggested** is every held paper
 * with a nearest student; those start as no, because the matcher refused
 * them, and pressing one turns it to yes. One press of Confirm sends the
 * lot: a yes pins the student, a "not them" takes the placement back and
 * holds the paper for the professor to name in the tab.
 */
export function MatchReview(props) {
  const matched = props.papers.filter(
    (paper) => paper.resolved && !paper.pinned && paper.has_name && (paper.lane === "check" || paper.lane === "placed"),
  );
  matched.sort((a, b) => (a.lane === "check" ? 0 : 1) - (b.lane === "check" ? 0 : 1));
  const suggested = props.papers.filter((paper) => paper.lane === "held" && paper.candidates.length);
  const keyOf = (paper) => paper.file + "|" + paper.pages;
  // key → true (yes) or false (not them / leave). Absent means the default.
  const [choice, setChoice] = React.useState({});
  const isYes = (paper, fallback) => (keyOf(paper) in choice ? choice[keyOf(paper)] : fallback);
  const close = props.onClose;
  const busy = props.busy;

  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) {
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, busy]);

  const yesMatched = matched.filter((paper) => isYes(paper, true));
  const notMatched = matched.filter((paper) => !isYes(paper, true));
  const yesSuggested = suggested.filter((paper) => isYes(paper, false));
  const setAll = (list, value) =>
    setChoice((current) => {
      const next = Object.assign({}, current);
      list.forEach((paper) => {
        next[keyOf(paper)] = value;
      });
      return next;
    });

  const submit = () => {
    const papers = []
      .concat(yesMatched.map((paper) => ({ pages: paper.pages, file: paper.file, student: paper.resolved })))
      .concat(notMatched.map((paper) => ({ pages: paper.pages, file: paper.file, reject: paper.resolved })))
      .concat(yesSuggested.map((paper) => ({ pages: paper.pages, file: paper.file, student: paper.candidates[0].student })));
    if (papers.length) props.onSubmit(papers);
  };

  const rcard = (paper, student, name, yes, kind) =>
    h(
      "button",
      {
        type: "button",
        key: keyOf(paper),
        className: "pp-rcard" + (yes ? "" : kind === "matched" ? " pp-rcard-no" : " pp-rcard-off"),
        "aria-pressed": yes,
        disabled: busy,
        title: yes
          ? kind === "matched" ? "Press if this is not them" : "Press to leave it held"
          : kind === "matched" ? "Press to keep the match" : "Press if this is them",
        onClick: () => setChoice((current) => Object.assign({}, current, { [keyOf(paper)]: !yes })),
      },
      props.crops ? h("img", { src: props.cropUrl(paper), alt: "Name line, page " + paper.pages.split("-")[0], loading: "lazy" }) : null,
      h("div", { className: "pp-rwritten" }, paper.written ? "“" + paper.written + "”" : "pages " + paper.pages),
      h("div", { className: "pp-rname" }, name || student),
      h("div", { className: "pp-rid" }, student + " · pp. " + paper.pages),
      h(
        "div",
        { className: "pp-rbadges" },
        kind === "suggested"
          ? h("span", { className: "pp-rbadge pp-rbadge-close" }, "suggested · not placed")
          : paper.lane === "check"
            ? h("span", { className: "pp-rbadge pp-rbadge-close" }, paper.match === "partial" ? "one word" : "close spelling")
            : h("span", { className: "pp-rbadge" }, paper.match === "words" ? "same words" : "exact"),
        h(
          "span",
          { className: "pp-rbadge " + (yes ? "pp-rbadge-yes" : kind === "matched" ? "pp-rbadge-no" : "") },
          yes ? "✓ them" : kind === "matched" ? "✗ not them" : "leave held",
        ),
      ),
    );

  const label =
    "Confirm " + (yesMatched.length + yesSuggested.length) +
    (notMatched.length ? " · reject " + notMatched.length : "");

  return ReactDOM.createPortal(
    h(
      "div",
      {
        className: "pp-veil",
        onMouseDown: (event) => {
          if (event.target === event.currentTarget && !busy) close();
        },
      },
      h(
        "div",
        { className: "pp-modal", role: "dialog", "aria-modal": "true", "aria-label": "Review name matches" },
        h(
          "div",
          { className: "pp-modalhead" },
          h("div", { className: "pp-modaltitle" }, "Who wrote each paper · " + props.title),
          h("button", { type: "button", className: "pp-close", "aria-label": "Close", disabled: busy, onClick: close }, "×"),
        ),
        h(
          "div",
          { className: "pp-review" },
          matched.length
            ? h(
                "div",
                { className: "pp-reviewsec" },
                "Matched by name",
                h("span", null, matched.length + " — every one is them unless you press it"),
                h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: () => setAll(matched, true) }, "All them"),
              )
            : null,
          h("div", { className: "pp-reviewgrid" }, matched.map((paper) => rcard(paper, paper.resolved, paper.resolved_name, isYes(paper, true), "matched"))),
          suggested.length
            ? h(
                "div",
                { className: "pp-reviewsec" },
                "Suggested",
                h("span", null, suggested.length + " held — the nearest student, placed only if you press it"),
                h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: () => setAll(suggested, true) }, "All them"),
                h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: () => setAll(suggested, false) }, "None"),
              )
            : null,
          h(
            "div",
            { className: "pp-reviewgrid" },
            suggested.map((paper) =>
              rcard(paper, paper.candidates[0].student, paper.candidates[0].name, isYes(paper, false), "suggested"),
            ),
          ),
          !matched.length && !suggested.length ? h(Message, null, "Nothing to review: every paper is confirmed or set aside.") : null,
        ),
        h(
          "div",
          { className: "pp-reviewfoot" },
          h(
            "span",
            { className: "pp-as" },
            busy
              ? "Placing — every answer at once, then one apply…"
              : "A rejected paper is taken back and held for you to name in the tab. Nothing here is graded.",
          ),
          h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: close }, "Cancel"),
          h(
            "button",
            {
              type: "button",
              className: "pp-primary",
              disabled: busy || yesMatched.length + notMatched.length + yesSuggested.length === 0,
              onClick: submit,
            },
            busy ? "Placing…" : label,
          ),
        ),
      ),
    ),
    document.body,
  );
}

/** What happens to one student's mark, in the preview's words, and its chip. */
const PLAN_ACTIONS = {
  new: { words: "will be sent", chip: "pp-chip-warn", order: 0 },
  change: { words: "will be updated", chip: "pp-chip-warn", order: 1 },
  drift: { words: "edited in Canvas — left alone", chip: "pp-chip-live", order: 2 },
  unmatched: { words: "not found in Canvas", chip: "pp-chip-live", order: 3 },
  skip: { words: "not sent", chip: "", order: 4 },
  unchanged: { words: "already in Canvas", chip: "pp-chip-ok", order: 5 },
};

const planScore = (value) => (value === null || value === undefined ? "—" : String(Math.round(value * 100) / 100));

/**
 * One Canvas course's preview, student by student: the mark here, what Canvas
 * holds now, and what a send would do — those it would send first.
 */
function PlanTable(props) {
  const rows = props.entry.rows
    .slice()
    .sort(
      (a, b) =>
        (PLAN_ACTIONS[a.action] || PLAN_ACTIONS.skip).order - (PLAN_ACTIONS[b.action] || PLAN_ACTIONS.skip).order ||
        String(a.name || a.student_id).localeCompare(String(b.name || b.student_id)),
    );
  const counts = props.entry.counts || {};
  const sending = (counts.new || 0) + (counts.change || 0);
  const skipWhy = [...new Set(rows.filter((row) => row.action === "skip" && row.reason).map((row) => row.reason))];
  const summary = [
    sending ? sending + " will be sent" : "nothing to send",
    counts.unchanged ? counts.unchanged + " already in Canvas" : null,
    counts.drift ? counts.drift + " edited in Canvas" : null,
    counts.unmatched ? counts.unmatched + " not found in Canvas" : null,
    counts.skip ? counts.skip + " not sent" + (skipWhy.length === 1 ? " (" + skipWhy[0] + ")" : "") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return h(
    "div",
    { className: "pp-plan" },
    h("p", { className: "pp-plansum" }, summary),
    // What the CLI says about the course — host, assignment, scale — is worth
    // having but not worth reading before the names; folded.
    props.entry.notes && props.entry.notes.length
      ? h(
          "details",
          { className: "pp-plannotes" },
          h("summary", null, "About this Canvas course"),
          props.entry.notes.map((note, i) => h("p", { className: "pp-as", key: "n" + i }, note)),
        )
      : null,
    h(
      "table",
      { className: "pp-plantable" },
      h(
        "thead",
        null,
        h("tr", null, h("th", null, "Student"), h("th", { className: "pp-num" }, "Mark"), h("th", { className: "pp-num" }, "Canvas now"), h("th", null, "")),
      ),
      h(
        "tbody",
        null,
        rows.map((row) => {
          const said = PLAN_ACTIONS[row.action] || PLAN_ACTIONS.skip;
          return h(
            "tr",
            { key: row.student_id, className: row.action === "unchanged" ? "pp-planquiet" : "" },
            h("td", { className: "pp-planwho", title: row.student_id }, row.name || row.student_id),
            h("td", { className: "pp-num" }, planScore(row.score) + (row.maximum ? " / " + planScore(row.maximum) : "")),
            h("td", { className: "pp-num" }, planScore(row.current)),
            h(
              "td",
              null,
              // A skipped row says why ("no submission"); the rest say what happens.
              h("span", { className: "pp-chip " + said.chip, title: row.reason || "" }, row.action === "skip" && row.reason ? row.reason : said.words),
            ),
          );
        }),
      ),
    ),
  );
}

/**
 * What a send did, course by course, read from the CLI's own lines: posted
 * and landed, already there and now recorded, still processing in Canvas, or
 * failed — with the CLI's words a press away.
 */
const sendOutcome = (entry) => {
  const out = entry.output || "";
  const posted = /Canvas finished: (\d+) grade/.exec(out);
  const held = /Canvas already holds (\d+)/.exec(out);
  const manual = /posts manually/.test(out);
  if (!entry.ok) {
    const lines = out.split("\n").map((line) => line.trim()).filter(Boolean);
    return { kind: "fail", words: "Not sent — " + (lines[lines.length - 1] || "the send failed") };
  }
  const already = held ? " (" + held[1] + " were already there)" : "";
  if (/has not finished the job yet/.test(out)) {
    return { kind: "wait", count: 0, words: "Canvas accepted the marks but is still processing them" + already + ". Check again in a minute." };
  }
  if (posted) {
    return {
      kind: "ok",
      count: Number(posted[1]) + (held ? Number(held[1]) : 0),
      words:
        "Sent " + posted[1] + " marks" + already +
        (manual ? " — this assignment posts manually: post them in Canvas for students to see" : " — students can see them"),
    };
  }
  if (held) return { kind: "ok", count: Number(held[1]), words: "Canvas already had all " + held[1] + " marks — confirmed" };
  if (/nothing to send/.test(out)) return { kind: "ok", count: 0, words: "Nothing to send — Canvas already matches" };
  return { kind: "ok", count: 0, words: "Done" };
};

function SendResult(props) {
  const outcomes = props.groups.map((entry) => ({ entry, said: sendOutcome(entry) }));
  const worst = outcomes.some((o) => o.said.kind === "fail") ? "fail" : outcomes.some((o) => o.said.kind === "wait") ? "wait" : "ok";
  const landed = outcomes.reduce((n, o) => n + (o.said.count || 0), 0);
  const headline = {
    ok: landed ? "Sent — Canvas has these " + landed + " marks" : "Sent — Canvas is up to date",
    wait: "Sent, but Canvas is still processing",
    fail: "Not everything was sent",
  }[worst];
  return h(
    "div",
    { className: "pp-sendresult pp-sendresult-" + worst, role: "status" },
    h(
      "div",
      { className: "pp-sendresulthead" },
      h("span", { className: "pp-sendresulticon", "aria-hidden": "true" }, { ok: "✓", wait: "…", fail: "!" }[worst]),
      h("b", null, headline),
    ),
    h(
      "ul",
      null,
      outcomes.map((o) =>
        h(
          "li",
          { key: o.entry.group || "run", className: "pp-sendresult-" + o.said.kind },
          h("span", { className: "pp-sendcourse" }, props.name(o.entry)),
          h("span", null, o.said.words),
        ),
      ),
    ),
    h(
      "details",
      { className: "pp-plannotes" },
      h("summary", null, "What the CLI said"),
      outcomes.map((o) => h("pre", { className: "pp-approveout", key: "o" + (o.entry.group || "run") }, o.entry.output)),
    ),
  );
}

/**
 * Where a Canvas send stands, as three steps: check what Canvas has, send,
 * done. Each step is done, the one in progress, or still ahead; a step that
 * failed says so in red.
 */
function SendSteps(props) {
  // `partial`: everything that can go is in Canvas, but some marks have
  // nowhere to go — amber, and saying how many, never a green tick.
  const labels = ["Check Canvas", "Send", props.failed ? "Not sent" : props.partial || "In Canvas"];
  return h(
    "ol",
    { className: "pp-sendsteps", "aria-label": "Canvas send progress" },
    labels.map((label, i) => {
      const state =
        i < props.at
          ? "done"
          : i === props.at
            ? props.failed && i === 2
              ? "fail"
              : props.partial && i === 2
                ? "warn"
                : props.busy
                  ? "busy"
                  : "now"
            : "todo";
      return h(
        "li",
        { key: "s" + i, className: "pp-sendstep pp-sendstep-" + state, "aria-current": i === props.at ? "step" : undefined },
        h("span", { className: "pp-sendstepdot", "aria-hidden": "true" }, state === "done" ? "✓" : state === "fail" || state === "warn" ? "!" : String(i + 1)),
        h("span", null, label),
      );
    }),
  );
}

/**
 * The marks of one assessment, sent to Canvas from beside the pile.
 *
 * Two presses, as everywhere a class can feel the result: **Preview** asks
 * Canvas what it holds for each subgroup's course and changes nothing;
 * only then does the red **Send N marks** exist, and any other press
 * throws the preview away. A subgroup whose course has no assignment for
 * this assessment yet is answered first — link the one already in Canvas,
 * or create it from the course record — because the planner cannot tell a
 * hand-made "Quiz 1" from no Quiz 1 and would otherwise make a second.
 */
export function CanvasMarks(props) {
  const [plan, setPlan] = React.useState(null);
  const [phase, setPhase] = React.useState("idle");
  const [failed, setFailed] = React.useState(null);
  const [lists, setLists] = React.useState({});
  const [picks, setPicks] = React.useState({});
  const [creating, setCreating] = React.useState({});

  const endpoint = (path) => scoped(BASE + path + "?run=" + encodeURIComponent(props.runId || ""), props.sessionId);
  const postJson = (path, body) =>
    fetch(endpoint(path), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((response) =>
      response.json(),
    );

  const marks = (extra, label) => {
    setPhase(label);
    setFailed(null);
    postJson("/api/canvas/marks", Object.assign({ assessment: props.assessmentId, names: Boolean(props.names) }, extra || {}))
      .then((body) => {
        setPhase("idle");
        if (body.error) return setFailed(body.error);
        setPlan(body);
        setCreating({});
        if (body.confirmed) props.onSent();
      })
      .catch((error) => {
        setPhase("idle");
        setFailed(String((error && error.message) || error));
      });
  };

  // A send goes course by course, so the press can show each one landing.
  const [progress, setProgress] = React.useState(null);
  const send = async () => {
    const targets = ((plan && plan.groups) || []).filter((entry) => entry.ok && !entry.unlinked);
    if (!targets.length) return;
    setPhase("sending");
    setFailed(null);
    const results = [];
    for (let i = 0; i < targets.length; i++) {
      const entry = targets[i];
      setProgress({ done: i, total: targets.length, now: entry.group || "Canvas" });
      try {
        const body = await postJson("/api/canvas/marks", {
          assessment: props.assessmentId,
          names: Boolean(props.names),
          confirm: true,
          group: entry.group || "",
        });
        if (body.error) results.push({ group: entry.group, courseId: entry.courseId, ok: false, output: body.error });
        else results.push(...(body.groups || []));
      } catch (error) {
        results.push({ group: entry.group, courseId: entry.courseId, ok: false, output: String((error && error.message) || error) });
      }
    }
    setProgress({ done: targets.length, total: targets.length, now: null });
    setPhase("idle");
    setPlan({ confirmed: true, groups: results });
    setCreating({});
    props.onSent();
  };

  // Opened from a Send… press: the preview only reads Canvas, so it runs at
  // once and the first thing on screen is what would be sent.
  React.useEffect(() => {
    if (props.autoPreview && props.canvas && props.canvas.ready > 0) marks({}, "planning");
  }, []);

  const listFor = (entry) => {
    postJson("/api/canvas/assignments", { courseId: entry.courseId })
      .then((body) => setLists((all) => Object.assign({}, all, { [entry.group]: body.error ? { error: body.error } : body.assignments || [] })))
      .catch((error) => setLists((all) => Object.assign({}, all, { [entry.group]: { error: String(error) } })));
  };

  const create = (entry, confirm) => {
    setPhase("creating");
    setFailed(null);
    postJson("/api/canvas/assignment", { assessment: props.assessmentId, group: entry.group || "", confirm })
      .then((body) => {
        setPhase("idle");
        if (body.error) return setFailed(body.error);
        if (confirm && body.ok) return marks({}, "planning");
        setCreating((all) => Object.assign({}, all, { [entry.group]: body }));
      })
      .catch((error) => {
        setPhase("idle");
        setFailed(String((error && error.message) || error));
      });
  };

  const groups = (plan && plan.groups) || [];
  const unlinked = groups.filter((entry) => entry.unlinked);
  const title = props.title || props.assessmentId;

  /**
   * The mapping, handed to the assistant as a turn in the open session.
   * It may read Canvas and propose; it may link only what the professor
   * confirms in the chat, and it may not send a mark — those stay this
   * component's red button.
   */
  const askToLink = () => {
    const run = props.runId;
    const a = props.assessmentId;
    const where = unlinked.map((entry) => (entry.group ? entry.group + " (Canvas course " + entry.courseId + ")" : "the run's Canvas course")).join(", ");
    props.ask(
      "Link " + a + " (" + title + ") to its Canvas assignment in each course that has none yet: " + where + ".\n\n" +
        "1. Run `bin/ainar lms assignments " + run + " --assessment " + a + "`. It only reads Canvas. Show me, per course, the assignment you think is " + title + " and why — or say that nothing there looks like it.\n" +
        "2. Ask me to confirm each pairing, one line per course. Link nothing I have not confirmed.\n" +
        "3. For each one I confirm, run `bin/ainar lms link " + run + " --assessment " + a + " --group <GROUP> --canvas-assignment <ID>`. It changes nothing in Canvas; it records the id in the course.\n" +
        "4. Where no assignment exists, say so and offer to create it: `bin/ainar lms assignment-plan " + run + " --assessment " + a + " --group <GROUP>` shows what would be created; run `bin/ainar lms assignment-push … --confirm` only when I say yes.\n\n" +
        "Do not send any marks — I send those from the pane once every course is linked.",
    );
  };
  const previewed = plan && !plan.confirmed && groups.length > 0 && !unlinked.length && groups.every((entry) => entry.ok);
  // What the preview says a send would do — not the pane's own count, which
  // is only as current as the ledger.
  const planned = groups.reduce((n, entry) => n + ((entry.counts || {}).new || 0) + ((entry.counts || {}).change || 0), 0);
  // Already in Canvas at our value but never recorded here: a send whose
  // Canvas job finished after the CLI stopped waiting.
  const unrecorded = groups.reduce(
    (n, entry) => n + (entry.rows || []).filter((row) => row.action === "unchanged" && row.last_prepared === null).length,
    0,
  );
  // One send covers both: marks Canvas lacks are posted, and marks Canvas
  // already holds but this machine never noted are confirmed.
  const sendCount = planned + unrecorded;
  const sendable = previewed && sendCount > 0;
  const name = (entry) => entry.group || "the run's Canvas course";
  const busy = phase !== "idle";
  const c = props.canvas || { ready: 0, unsent: 0, changed: 0 };
  const toSend = c.unsent + c.changed;
  const inCanvas = groups.reduce((n, entry) => n + ((entry.counts || {}).unchanged || 0), 0);
  // `lead`: this is the Scans headline's one action. The headline already
  // says how many marks wait, so the count is not repeated.
  const lead = Boolean(props.lead);

  // Where the send stands: 0 checking, 1 ready to send / sending, 3 done.
  const confirmed = Boolean(plan && plan.confirmed);
  const sentFailed = confirmed && groups.some((entry) => !entry.ok);
  // Marks whose student is not in the Canvas course: no send places them.
  const unplaced = groups.reduce((n, entry) => n + ((entry.counts || {}).unmatched || 0), 0);
  const students = (n) => (n === 1 ? "1 student isn't" : n + " students aren't");
  const unplacedWords = unplaced
    ? " " + students(unplaced) + " in the Canvas course, so " + (unplaced === 1 ? "that mark has" : "those marks have") +
      " nowhere to go — add them in Canvas, then check again."
    : "";
  // Done is a green tick only when every mark is placed; otherwise amber,
  // saying how many are in.
  const finished = (previewed && !sendCount) || (confirmed && !sentFailed);
  const partial = finished && unplaced ? inCanvas + " of " + (inCanvas + unplaced) + " in Canvas" : null;
  const at =
    phase === "planning" || !plan ? 0 : phase === "sending" ? 1 : confirmed && sentFailed ? 2 : finished ? (partial ? 2 : 3) : 1;

  // What the preview found, in one sentence — the preview's truth over the
  // pane's own count, which is only as current as this machine's record.
  const headline =
    c.ready === 0
      ? "No whole marks to send yet."
      : phase === "planning"
        ? "Checking what Canvas has for these " + c.ready + " marks…"
        : phase === "sending"
          ? "Sending to Canvas — keep this open until it finishes."
          : confirmed
            ? null
            : previewed
              ? planned
                ? planned + " of " + c.ready + " marks are not in Canvas yet" + (inCanvas ? "; " + inCanvas + " already are." : ".") + unplacedWords
                : unrecorded
                  ? "Canvas already has these " + unrecorded + " marks — sending confirms them here; students see no change." + unplacedWords
                  : unplaced
                    ? "Canvas has " + inCanvas + " of " + (inCanvas + unplaced) + " marks." + unplacedWords
                    : "Canvas has every mark (" + inCanvas + ")."
              : toSend === 0
                ? "Canvas has every mark (" + c.ready + ")."
                : toSend + " of " + c.ready + " marks are not in Canvas.";

  // The forward press: its label and look follow the step it would take.
  const pct = progress && progress.total ? Math.round((100 * progress.done) / progress.total) : 0;
  const forward =
    c.ready === 0 || confirmed
      ? null
      : phase === "planning"
        ? h("button", { type: "button", className: "pp-primary", disabled: true, "aria-busy": "true" }, "Checking Canvas…")
        : phase === "sending"
          ? h(
              "button",
              {
                type: "button",
                className: "pp-primary pp-danger pp-btn-progress",
                disabled: true,
                "aria-busy": "true",
                style: { "--pp-progress": pct + "%" },
              },
              "Sending… " + (progress && progress.total > 1 ? "course " + Math.min(progress.done + 1, progress.total) + " of " + progress.total : ""),
            )
          : sendable
            ? h(
                "button",
                {
                  type: "button",
                  className: "pp-primary pp-danger",
                  disabled: busy,
                  title: "Students see a posted grade within seconds",
                  onClick: send,
                },
                "Send " + sendCount + " marks to Canvas",
              )
            : !plan
              ? h("button", { type: "button", className: "pp-primary", disabled: busy, onClick: () => marks({}, "planning") }, "Check Canvas")
              : null;

  return h(
    "div",
    { className: lead ? "pp-sendflow" : "pp-next pp-sendflow" },
    c.ready > 0 ? h(SendSteps, { at: at, busy: busy, failed: sentFailed, partial: partial }) : null,
    headline && !(lead && !plan && phase === "idle") ? h("p", { className: "pp-sendheadline" }, headline) : null,
    h(
      "div",
      { className: "pp-approverow" },
      forward,
      plan && !busy
        ? h("button", { type: "button", className: "pp-segbtn", onClick: () => marks({}, "planning") }, confirmed ? "Check Canvas again" : "Check again")
        : null,
    ),
    confirmed && phase !== "sending" ? h(SendResult, { groups: groups, name: name }) : null,
    failed ? h("pre", { className: "pp-approveout pp-approveerr" }, failed) : null,
    unlinked.length && props.ask
      ? h(
          "div",
          { className: "pp-linkask" },
          h(
            "p",
            null,
            unlinked.length === groups.length
              ? "None of the Canvas courses has " + title + " linked, so there is nowhere to put these marks yet."
              : unlinked.map((entry) => entry.group).join(", ") + " " + (unlinked.length === 1 ? "has" : "have") + " no " + title + " linked yet.",
          ),
          h(
            "p",
            { className: "pp-as" },
            "The assistant will read each course's assignment list in Canvas (nothing changes there), say which one it thinks is " +
              title +
              " and why, and ask you. Only the pairings you confirm are recorded — in the course record, not in Canvas. " +
              "Where none exists it offers to create it, again only on your yes. It does not send marks.",
          ),
          h(
            "button",
            { type: "button", className: "pp-primary pp-chat", disabled: busy, onClick: askToLink },
            "Ask the assistant to link " + title,
          ),
        )
      : null,
    // The preview, course by course. After a send the result above says it
    // all, so the courses' own sections go.
    (confirmed ? [] : groups).map((entry) =>
      h(
        "div",
        { key: entry.group || "run" },
        h("p", { className: "pp-factgroup" }, name(entry) + (entry.courseId ? " · course " + entry.courseId : "")),
        entry.unlinked
          ? h(
              "div",
              { className: "pp-approverow" },
              h("span", null, "Or by hand:"),
              lists[entry.group] === undefined
                ? h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: () => listFor(entry) }, "Link one already in Canvas…")
                : lists[entry.group].error
                  ? h("span", { className: "pp-as" }, lists[entry.group].error)
                  : h(
                      React.Fragment,
                      null,
                      h(
                        "select",
                        {
                          className: "pp-bindsel",
                          value: picks[entry.group] || "",
                          onChange: (event) => setPicks((all) => Object.assign({}, all, { [entry.group]: event.target.value })),
                        },
                        h("option", { value: "" }, "Choose the assignment…"),
                        lists[entry.group].map((assignment) =>
                          h(
                            "option",
                            { value: assignment.id, key: assignment.id },
                            assignment.name + (assignment.points != null ? " (" + assignment.points + " pts)" : ""),
                          ),
                        ),
                      ),
                      h(
                        "button",
                        {
                          type: "button",
                          className: "pp-segbtn",
                          disabled: busy || !picks[entry.group],
                          onClick: () => marks({ link: { group: entry.group || "", assignmentId: picks[entry.group] } }, "planning"),
                        },
                        "Link",
                      ),
                    ),
              creating[entry.group]
                ? h(
                    "button",
                    { type: "button", className: "pp-segbtn pp-danger", disabled: busy, onClick: () => create(entry, true) },
                    phase === "creating" ? "Creating…" : "Create it in " + name(entry),
                  )
                : h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: () => create(entry, false) }, "Preview creating it"),
            )
          : null,
        entry.rows && !(creating[entry.group] || {}).output ? h(PlanTable, { entry: entry }) : null,
        // An unlinked course's own message is the CLI explaining its data
        // model; the sentence above says the same in the professor's terms.
        (creating[entry.group] || {}).output || (!entry.unlinked && entry.output && !plan.confirmed)
          ? h("pre", { className: "pp-approveout" + (entry.ok || entry.unlinked ? "" : " pp-approveerr") }, (creating[entry.group] || {}).output || entry.output)
          : null,
      ),
    ),
  );
}

/** `/api/unpublished` for one run, re-read whenever the course is written. */
export function useUnpublished(runId, sessionId, revision) {
  const [state, setState] = React.useState({ phase: "loading", value: null });
  React.useEffect(() => {
    let live = true;
    fetch(scoped(BASE + "/api/unpublished?run=" + encodeURIComponent(runId) + "&r=" + revision, sessionId), {
      headers: { accept: "application/json" },
    })
      .then((response) => response.json())
      .then((value) => live && setState({ phase: "ready", value }))
      .catch((error) => live && setState({ phase: "ready", value: { error: String(error) } }));
    return () => {
      live = false;
    };
  }, [runId, sessionId, revision]);
  return state;
}

/** How old a check of Canvas may be before opening the Gradebook asks again. */
const CANVAS_CHECK_FRESH = 5 * 60 * 1000;

/**
 * `/api/canvas/check` for one run: what Canvas holds, asked of Canvas. The
 * last answer comes back at once; if there is none, or it is older than five
 * minutes, a new check runs in the background. `onChecked` fires when one
 * finishes — the check notes in the ledger what Canvas already holds, so the
 * counts drawn from the ledger are re-read then.
 */
function useCanvasCheck(runId, sessionId, onChecked) {
  const [state, setState] = React.useState({ phase: "loading", value: null });
  const live = React.useRef(true);
  const url = scoped(BASE + "/api/canvas/check?run=" + encodeURIComponent(runId || ""), sessionId);
  const run = React.useCallback(() => {
    setState((current) => Object.assign({}, current, { phase: "running" }));
    fetch(url, { method: "POST", headers: { accept: "application/json" } })
      .then((response) => response.json())
      .then((answer) => {
        if (!live.current) return;
        setState({ phase: "ready", value: answer });
        if (onChecked) onChecked();
      })
      .catch((error) => live.current && setState({ phase: "ready", value: { error: String(error) } }));
  }, [url]);
  React.useEffect(() => {
    live.current = true;
    if (!runId) return undefined;
    fetch(url, { headers: { accept: "application/json" } })
      .then((response) => response.json())
      .then((answer) => {
        if (!live.current) return;
        if (answer.state === "running") return run();
        const stale = answer.state !== "ready" || !answer.at || Date.now() - Date.parse(answer.at) > CANVAS_CHECK_FRESH;
        setState({ phase: "ready", value: answer });
        if (stale) run();
      })
      .catch(() => live.current && run());
    return () => {
      live.current = false;
    };
  }, [url]);
  return [state, run];
}

/** Per assessment, the marks someone changed in Canvas, from the last check. */
const editedIn = (check) => {
  const found = new Map();
  for (const entry of (check && check.value && check.value.value && check.value.value.assessments) || []) {
    const edited = [];
    for (const cell of entry.groups || []) for (const row of cell.edited || []) edited.push(Object.assign({ group: cell.group }, row));
    found.set(entry.assessment_id, edited);
  }
  return found;
};

/**
 * Per assessment, marks that cannot go to Canvas because their student is not
 * in the Canvas course — not "not sent yet", which a press would fix, but
 * "nowhere to send", which only an enrolment in Canvas fixes.
 */
const unplacedIn = (check) => {
  const found = new Map();
  for (const entry of (check && check.value && check.value.value && check.value.value.assessments) || []) {
    found.set(entry.assessment_id, (entry.groups || []).reduce((n, cell) => n + ((cell.counts || {}).unmatched || 0), 0));
  }
  return found;
};

/**
 * One assessment's marking and Canvas, as the few words a row has room for.
 * `unplaced` — marks whose student is not in the Canvas course, from the last
 * check — are taken out of "not in Canvas", which a send would fix, and said
 * on their own, which it would not.
 */
const markState = (entry, unplaced = 0) => {
  const c = entry.canvas;
  const marking =
    entry.submitted === 0 && entry.graded === 0
      ? "nothing handed in"
      : entry.graded + " of " + entry.submitted + " graded" + (entry.partial ? " · " + entry.partial + " part-graded" : "");
  const stuck = Math.min(unplaced, c.unsent);
  const unsent = c.unsent - stuck;
  let canvas = null;
  if (c.ready > 0) {
    canvas =
      unsent === 0 && c.changed === 0
        ? (stuck ? c.ready - stuck + " of " + c.ready : "all " + c.ready) + " in Canvas"
        : [unsent ? unsent + " not in Canvas" : null, c.changed ? c.changed + " changed since sent" : null].filter(Boolean).join(" · ");
  }
  return {
    marking,
    canvas,
    behind: unsent > 0 || c.changed > 0,
    waiting: unsent + c.changed,
    stuck: stuck ? stuck + " not in the Canvas course" : null,
  };
};

const dueOrder = (a, b) => String(a.due_at || "9999").localeCompare(String(b.due_at || "9999"));

/**
 * "HW2 - A grant office…" as a short tag and the rest, when the title leads
 * with one; otherwise no tag. Only for the eye: the record keeps one title.
 */
const titleParts = (title) => {
  const match = /^(\S{1,8}(?: \d{1,3})?)\s+[-–—:]\s+(.+)$/.exec(String(title || ""));
  return match ? { tag: match[1], rest: match[2] } : { tag: null, rest: String(title || "") };
};

/** A title as tag chip + text, the way both Gradebook strips print it. */
const TitleWithTag = (props) => {
  const parts = titleParts(props.title);
  return h(
    "span",
    { className: "pp-titletag", title: props.title },
    parts.tag ? h("span", { className: "pp-tag" + (/^quiz|^exam|^mid|^final/i.test(parts.tag) ? " pp-tag-quiz" : "") }, parts.tag) : null,
    h("span", { className: "pp-titletext" }, parts.rest),
  );
};

/**
 * Above Progress · Gradebook: per assessment, how far its marking has got
 * and how much of it Canvas has. The gradebook widget is shared with the
 * chat clients and knows nothing of Canvas, so this line is the pane's.
 * Only assessments something was handed in for — a strip of twenty rows
 * saying "nothing handed in" would bury the two that matter.
 */
export function GradebookStatus(props) {
  // Re-read after a check of Canvas: it notes in the ledger what Canvas holds.
  const [checked, setChecked] = React.useState(0);
  const state = useUnpublished(props.runId, props.sessionId, props.revision + "." + checked);
  const [check, recheck] = useCanvasCheck(props.runId, props.sessionId, () => setChecked((value) => value + 1));
  // The one assessment whose Canvas send is open under its row.
  const [open, setOpen] = React.useState(null);
  if (state.phase === "loading" || !state.value || state.value.error) return null;
  const rows = state.value.assessments.filter((entry) => entry.submitted > 0 || entry.graded > 0).sort(dueOrder);
  if (!rows.length) return null;
  const edited = editedIn(check);
  const unplaced = unplacedIn(check);
  const said = new Map(rows.map((entry) => [entry.id, markState(entry, unplaced.get(entry.id) || 0)]));
  const waiting = rows.reduce((n, entry) => n + said.get(entry.id).waiting, 0);
  const answer = check.value || {};
  const checking = check.phase === "running" || check.phase === "loading";
  const unreachable = !checking && (answer.error || (answer.state === "ready" && !answer.value));
  return h(
    "div",
    { className: "pp-bookcard pp-bookstatus" + (open ? " pp-bookstatus-open" : "") },
    h(
      "div",
      { className: "pp-cardhead" },
      h("b", null, "Marking"),
      h(
        "span",
        { className: waiting ? "pp-chip pp-chip-warn" : "pp-chip pp-chip-ok" },
        waiting ? waiting + " marks waiting for Canvas" : "Canvas has every mark",
      ),
      // Where the Canvas figures come from: a check under way, the last one,
      // or this machine's record because Canvas could not be reached.
      h(
        "span",
        { className: "pp-checkstate" + (unreachable ? " pp-checkstate-off" : ""), title: unreachable ? String(answer.error || "") : "" },
        checking
          ? h("span", { className: "pp-checkspin", "aria-hidden": "true" })
          : null,
        checking
          ? "Checking Canvas…"
          : unreachable
            ? "Couldn't reach Canvas — this machine's record"
            : answer.at
              ? "Checked Canvas " + when(answer.at)
              : "",
      ),
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn pp-iconbtn",
          disabled: checking,
          "aria-busy": checking ? "true" : undefined,
          "aria-label": "Check Canvas again",
          title: "Check Canvas again",
          onClick: recheck,
        },
        checking ? "" : "↻",
      ),
    ),
    rows.map((entry) => {
      const state = said.get(entry.id);
      const of = Math.max(entry.submitted, entry.graded, 1);
      const done = Math.min(100, (100 * entry.graded) / of);
      const part = Math.min(100 - done, (100 * (entry.partial || 0)) / of);
      return h(
        React.Fragment,
        { key: entry.id },
        h(
        "div",
        { className: "pp-bookrow" + (open === entry.id ? " pp-bookrow-open" : "") },
        h(TitleWithTag, { title: entry.title }),
        h(
          "span",
          { className: "pp-bookprogress", title: state.marking },
          h(
            "span",
            { className: "pp-bar", "aria-hidden": "true" },
            h("i", { className: "pp-bar-done", style: { width: done + "%" } }),
            part ? h("i", { className: "pp-bar-part", style: { width: part + "%" } }) : null,
          ),
          h("span", { className: "pp-booknum" }, entry.submitted === 0 && entry.graded === 0 ? "—" : entry.graded + "/" + entry.submitted),
        ),
        h(
          "span",
          { className: "pp-bookcanvas" },
          state.canvas ? h("span", { className: "pp-chip " + (state.behind ? "pp-chip-warn" : "pp-chip-ok") }, state.canvas) : null,
          // Nowhere to send these: the student is not in the Canvas course.
          state.stuck
            ? h(
                "span",
                {
                  className: "pp-chip",
                  title: "These students are not enrolled in the Canvas course, so their marks have nowhere to go. Add them in Canvas, then check again.",
                },
                state.stuck,
              )
            : null,
          // Someone changed these in Canvas itself; the check reports them and
          // never adopts them. The preview under Send… shows whose.
          (edited.get(entry.id) || []).length
            ? h(
                "span",
                {
                  className: "pp-chip pp-chip-live",
                  title: "Changed in Canvas, not here. Open Send… to see whose; a send would leave them alone.",
                },
                edited.get(entry.id).length + " changed in Canvas",
              )
            : null,
          state.behind || open === entry.id
            ? h(
                "button",
                { type: "button", className: "pp-segbtn pp-sendbtn", "aria-expanded": open === entry.id, onClick: () => setOpen(open === entry.id ? null : entry.id) },
                open === entry.id ? "Close" : "Send…",
              )
            : null,
        ),
        ),
        open === entry.id
          ? h(
              "div",
              { className: "pp-bookdrawer" },
              h(CanvasMarks, {
                runId: props.runId,
                sessionId: props.sessionId,
                assessmentId: entry.id,
                title: entry.title,
                ask: props.ask,
                names: props.names,
                canvas: entry.canvas,
                autoPreview: true,
                onSent: props.onWrite,
              }),
            )
          : null,
      );
    }),
  );
}

// ---------------------------------------------------------------- sheet activity

/** `/api/marks-activity` for one run: what each grade-sheet sync brought in. */
function useMarksActivity(runId, sessionId, revision, names) {
  const [state, setState] = React.useState({ phase: "loading", value: null });
  React.useEffect(() => {
    if (!runId) return undefined;
    let live = true;
    fetch(
      scoped(BASE + "/api/marks-activity?run=" + encodeURIComponent(runId) + (names ? "&names=1" : "") + "&r=" + revision, sessionId),
      { headers: { accept: "application/json" } },
    )
      .then((response) => response.json())
      .then((value) => live && setState({ phase: "ready", value }))
      .catch((error) => live && setState({ phase: "ready", value: { error: String(error) } }));
    return () => {
      live = false;
    };
  }, [runId, sessionId, revision, names]);
  return state;
}

/** How often an open pane asks whether the sheet changed. The server asks Google at most every two minutes. */
const SHEET_CHECK_EVERY = 5 * 60 * 1000;

/**
 * `/api/sheet-check` for one run: has each grade sheet changed in Google
 * since its last sync? Asked on load, after every write here, and every five
 * minutes while the pane is on screen — a hidden pane does not spend
 * Google's quota.
 */
export function useSheetCheck(runId, sessionId, revision) {
  const [value, setValue] = React.useState(null);
  React.useEffect(() => {
    if (!runId) return undefined;
    let live = true;
    const ask = () => {
      if (document.visibilityState === "hidden") return;
      fetch(scoped(BASE + "/api/sheet-check?run=" + encodeURIComponent(runId) + "&r=" + revision, sessionId), {
        headers: { accept: "application/json" },
      })
        .then((response) => response.json())
        .then((answer) => live && setValue(answer))
        .catch(() => {});
    };
    ask();
    const timer = setInterval(ask, SHEET_CHECK_EVERY);
    const onShow = () => document.visibilityState === "visible" && ask();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [runId, sessionId, revision]);
  return value;
}

/** What a dismissal of "the sheet changed" is about: this edit, or — when Drive gives no time — until the next sync. */
const changeMark = (check) => check.sync + "|" + (check.modified || check.last_synced || "");

/**
 * The last sync this browser has shown, per run. A per-viewer convenience:
 * lost in a private window, and then the notice shows once more.
 */
const sheetSeenKey = (runId) => "pp-sheet-seen:" + runId;
const readSheetSeen = (runId) => {
  try {
    return window.localStorage.getItem(sheetSeenKey(runId));
  } catch {
    return null;
  }
};
const writeSheetSeen = (runId, at) => {
  try {
    window.localStorage.setItem(sheetSeenKey(runId), at);
  } catch {
    // Nothing kept; the notice comes back on the next load.
  }
};

/** "3 new · 1 changed · 1 taken back" */
const countWords = (event) =>
  [
    event.added ? event.added + " new" : null,
    event.changed ? event.changed + " changed" : null,
    event.removed ? event.removed + " taken back" : null,
  ]
    .filter(Boolean)
    .join(" · ");

/** Where the sheet was read from, and how old it was. */
const sourceWords = (event) =>
  event.read === "sheet"
    ? "read from the sheet in Google"
    : "from the copy downloaded " + (when(event.saved) || "at an unknown time");

/** One mark's move: "P (10)", "P → L · 10 → 8", "taken back (was P)". */
const markWords = (change) => {
  const points = (value) => (value === null || value === undefined ? "—" : String(value));
  if (change.from === null && change.score_from === null) return (change.to || "?") + (change.score_to !== null ? " · " + points(change.score_to) : "");
  if (change.to === null && change.score_to === null) return "taken back (was " + (change.from || "a mark") + ")";
  const words = change.from === change.to ? change.to || "" : (change.from || "—") + " → " + (change.to || "—");
  const scores = change.score_from === change.score_to ? "" : points(change.score_from) + " → " + points(change.score_to);
  return [words, scores].filter(Boolean).join(" · ");
};

/**
 * A notice over the pane when a grade-sheet sync brought marks in that this
 * browser has not shown yet — whoever ran it: the Syncs view, the CLI or the
 * assistant. It says how many, when, and from what; Gradebook shows which.
 */
export function SheetNotice(props) {
  return h(
    React.Fragment,
    null,
    h(SheetChangedNotice, props),
    h(SheetSyncedNotice, props),
  );
}

/**
 * "Your grade sheet changed in Google since the last sync" — asked of Google
 * by the server, on a machine with a Google login. The press goes to the
 * Syncs view, where Preview shows what would come in; nothing syncs here.
 */
function SheetChangedNotice(props) {
  const answer = useSheetCheck(props.runId, props.sessionId, props.revision);
  const storeKey = "pp-sheet-change-seen:" + props.runId;
  const [dismissed, setDismissed] = React.useState(() => {
    try {
      return window.localStorage.getItem(storeKey);
    } catch {
      return null;
    }
  });
  if (!answer || !answer.available || !answer.checks) return null;
  const changed = answer.checks.find((check) => check.state === "changed" && changeMark(check) !== dismissed);
  if (!changed) return null;
  const dismiss = () => {
    const mark = changeMark(changed);
    try {
      window.localStorage.setItem(storeKey, mark);
    } catch {
      // Not kept; it shows again on the next load.
    }
    setDismissed(mark);
  };
  return h(
    "div",
    { className: "pp-sheetnotice pp-sheetnotice-changed", role: "status" },
    h("span", { className: "pp-svc pp-svc-sheets pp-svc-small", "aria-hidden": "true" }, "GS"),
    h(
      "span",
      { className: "pp-sheetnoticetext" },
      h("b", null, "Your grade sheet changed in Google"),
      (changed.modified ? " — edited " + when(changed.modified) : "") +
        (changed.last_synced ? "; last synced " + when(changed.last_synced) : "") +
        ". Nothing has come in yet.",
    ),
    props.onSync
      ? h(
          "button",
          {
            type: "button",
            className: "pp-segbtn",
            onClick: () => {
              dismiss();
              props.onSync();
            },
          },
          "Preview the sync",
        )
      : null,
    h("button", { type: "button", className: "pp-close", "aria-label": "Dismiss", onClick: dismiss }, "×"),
  );
}

function SheetSyncedNotice(props) {
  const state = useMarksActivity(props.runId, props.sessionId, props.revision, false);
  const [seen, setSeen] = React.useState(() => readSheetSeen(props.runId));
  React.useEffect(() => setSeen(readSheetSeen(props.runId)), [props.runId]);
  if (state.phase === "loading" || !state.value || state.value.error) return null;
  const latest = (state.value.events || []).find((event) => event.changes.length);
  if (!latest) return null;
  // Never seen anything on this browser: a sync from the last two days is
  // still news; an older one is not.
  const fresh = seen ? Date.parse(latest.at) > Date.parse(seen) : Date.now() - Date.parse(latest.at) < 2 * 86400000;
  if (!fresh) return null;
  const dismiss = () => {
    const newest = state.value.events[0].at;
    writeSheetSeen(props.runId, newest);
    setSeen(newest);
  };
  return h(
    "div",
    { className: "pp-sheetnotice", role: "status" },
    h("span", { className: "pp-svc pp-svc-sheets pp-svc-small", "aria-hidden": "true" }, "GS"),
    h(
      "span",
      { className: "pp-sheetnoticetext" },
      h("b", null, "Grade sheet synced " + (when(latest.at) || "")),
      " — marks: " + countWords(latest) + "; " + sourceWords(latest) + ".",
    ),
    props.onOpen
      ? h(
          "button",
          {
            type: "button",
            className: "pp-segbtn",
            onClick: () => {
              dismiss();
              props.onOpen();
            },
          },
          "See in Gradebook",
        )
      : null,
    h("button", { type: "button", className: "pp-close", "aria-label": "Dismiss", onClick: dismiss }, "×"),
  );
}

/**
 * Above the Gradebook: the marks the grade sheet brought in last, newest
 * run first — when each run happened, what it read and how old that was,
 * and each mark that came, moved or went. A run that changed nothing is a
 * line of its own, so "did my sync work?" has an answer too.
 */
export function RecentMarks(props) {
  const state = useMarksActivity(props.runId, props.sessionId, props.revision, props.names);
  const [open, setOpen] = React.useState(false);
  if (state.phase === "loading" || !state.value || state.value.error) return null;
  const events = state.value.events || [];
  if (!events.length) return null;
  const SHOWN = 6;
  const shown = open ? events : events.slice(0, 2);
  const more = events.length > 2 || shown.some((event) => event.changes.length > SHOWN);
  return h(
    "div",
    { className: "pp-bookcard pp-recentmarks" },
    h(
      "div",
      { className: "pp-cardhead" },
      h("span", { className: "pp-svc pp-svc-sheets pp-svc-small", "aria-hidden": "true" }, "GS"),
      h("b", null, "Last added from the grade sheet"),
      more ? h("button", { type: "button", className: "pp-segbtn", onClick: () => setOpen(!open) }, open ? "Fewer" : "Show all") : null,
    ),
    shown.map((event) => {
      const rows = open ? event.changes : event.changes.slice(0, SHOWN);
      return h(
        "div",
        { className: "pp-recentrun" + (event.changes.length ? "" : " pp-recentquiet"), key: event.sync + event.at },
        h(
          "div",
          { className: "pp-recentwhen", title: "Synced " + new Date(event.at).toLocaleString() + (event.saved ? "; sheet as of " + new Date(event.saved).toLocaleString() : "") },
          h("span", null, when(event.at)),
          event.changes.length ? h("span", { className: "pp-chip pp-chip-ok" }, countWords(event)) : h("span", { className: "pp-chip" }, "nothing changed"),
          h("span", { className: "pp-as" }, sourceWords(event)),
        ),
        rows.length
          ? h(
              "ul",
              { className: "pp-recentlist" },
              rows.map((change) =>
                h(
                  "li",
                  { key: change.student + change.assessment },
                  h("span", { className: "pp-avatar", "aria-hidden": "true" }, initials(change.name || change.student)),
                  h("span", { className: "pp-recentwho" }, change.name || change.student),
                  h(TitleWithTag, { title: change.title }),
                  h(
                    "span",
                    { className: change.to === null && change.score_to === null ? "pp-behind" : "pp-recentmark" },
                    markWords(change),
                  ),
                ),
              ),
            )
          : null,
        event.changes.length > rows.length
          ? h("div", { className: "pp-as" }, "… and " + (event.changes.length - rows.length) + " more")
          : null,
      );
    }),
  );
}

/**
 * Tasks · Unpublished: everything the course holds that has not gone out.
 * Each line carries the press that sends it — the marks as the Scans tab
 * sends them, a moved material through the Publish dialog — except a
 * draft, which only the professor's edit to its record can accept.
 */
export function Unpublished(props) {
  const state = useUnpublished(props.runId, props.sessionId, props.revision);
  const [open, setOpen] = React.useState(null);
  if (state.phase === "loading") return h(Message, null, "Reading what has gone out…");
  const doc = state.value;
  if (doc.error) return h(Message, { error: true }, doc.error);
  const nothing = !doc.marks.length && !doc.drafts.length && !doc.moved.length;
  const section = (title, rows) => (rows.length ? h(React.Fragment, null, h("p", { className: "pp-factgroup" }, title), rows) : null);

  return h(
    "div",
    { className: "pp-scroll" },
    h(
      "p",
      { className: "pp-as" },
      "Read from this machine: the gradebook, what Canvas confirmed receiving, and what was last published. Canvas is not asked, so an edit made there by hand does not show.",
    ),
    nothing ? h(Message, null, "Everything decided here is out: no marks waiting for Canvas, no drafts held back, no material changed since it was published.") : null,
    section(
      "Marks not in Canvas",
      doc.marks.sort(dueOrder).map((entry) => {
        const said = markState(entry);
        const binding =
          entry.binding.state === "none"
            ? "no Canvas assignment yet"
            : entry.binding.state === "some"
              ? "no Canvas assignment in " + entry.binding.missing.join(", ")
              : null;
        return h(
          "div",
          { key: entry.id },
          h(
            "div",
            { className: "pp-approverow" },
            h("b", null, entry.title),
            h("span", null, said.canvas),
            binding ? h("span", { className: "pp-behind" }, binding) : null,
            h(
              "button",
              { type: "button", className: "pp-segbtn", onClick: () => setOpen(open === entry.id ? null : entry.id) },
              open === entry.id ? "Close" : "Send…",
            ),
          ),
          open === entry.id
            ? h(CanvasMarks, {
                key: entry.id,
                runId: props.runId,
                sessionId: props.sessionId,
                assessmentId: entry.id,
                title: entry.title,
                ask: props.ask,
                names: props.names,
                canvas: entry.canvas,
                autoPreview: true,
                onSent: props.onWrite,
              })
            : null,
        );
      }),
    ),
    section(
      "Changed since published",
      doc.moved.map((entry) =>
        h(
          "div",
          { className: "pp-approverow", key: entry.documentId + "|" + entry.target + "|" + entry.scope },
          h("b", null, entry.title),
          h("span", null, "changed since it went to " + entry.where + " on " + String(entry.at).slice(0, 10)),
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              onClick: () => props.openPublish(entry.target, entry.target === "page" || entry.target === "telegram" ? {} : { assessment: entry.scope }),
            },
            "Publish again…",
          ),
        ),
      ),
    ),
    section(
      "Drafts a publication leaves out",
      doc.drafts.length
        ? [
            h(
              "p",
              { className: "pp-as", key: "how" },
              "Accepting one is your edit: change approval: draft to approved in its record, then publish.",
            ),
          ].concat(
            doc.drafts.map((entry) =>
              h(
                "div",
                { className: "pp-approverow", key: entry.collection + "|" + entry.id },
                h("b", null, entry.title || entry.id),
                h("span", { className: "pp-as" }, entry.collection + " · " + entry.id),
              ),
            ),
          )
        : [],
    ),
  );
}
