/**
 * Marks on their way out: match review, the Canvas marks push, and what has
 * not been published yet.
 */

import { Message } from "./common.js";
import { h, React, ReactDOM } from "./react.js";
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
    postJson("/api/canvas/marks", Object.assign({ assessment: props.assessmentId }, extra || {}))
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
  const sendable = plan && !plan.confirmed && groups.length > 0 && !unlinked.length && groups.every((entry) => entry.ok);
  const name = (entry) => entry.group || "the run's Canvas course";
  const busy = phase !== "idle";
  const c = props.canvas || { ready: 0, unsent: 0, changed: 0 };
  const toSend = c.unsent + c.changed;
  // `lead`: this is the Scans headline's one action. The headline already
  // says how many marks wait, so the count is not repeated, and Preview is
  // the view's primary button.
  const lead = Boolean(props.lead);

  return h(
    "div",
    { className: lead ? "" : "pp-next" },
    h(
      "div",
      { className: "pp-approverow" },
      lead
        ? null
        : h(
            "span",
            null,
            c.ready === 0
              ? "No whole marks to send yet."
              : toSend === 0
                ? "Canvas has every mark (" + c.ready + ")."
                : toSend + " of " + c.ready + " marks are not in Canvas. ",
          ),
      c.ready > 0
        ? h(
            "button",
            { type: "button", className: lead && !plan ? "pp-primary" : "pp-segbtn", disabled: busy, onClick: () => marks({}, "planning") },
            phase === "planning" ? "Asking Canvas…" : plan ? "Preview again" : "Preview the Canvas send",
          )
        : null,
      sendable
        ? h(
            "button",
            {
              type: "button",
              className: "pp-segbtn pp-danger",
              disabled: busy,
              title: "Students see a posted grade within seconds",
              onClick: () => marks({ confirm: true }, "sending"),
            },
            phase === "sending" ? "Sending…" : "Send " + (toSend || c.ready) + " marks to Canvas",
          )
        : null,
    ),
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
    groups.map((entry) =>
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
        // An unlinked course's own message is the CLI explaining its data
        // model; the sentence above says the same in the professor's terms.
        (creating[entry.group] || {}).output || !entry.unlinked
          ? h("pre", { className: "pp-approveout" + (entry.ok || entry.unlinked ? "" : " pp-approveerr") }, (creating[entry.group] || {}).output || entry.output)
          : null,
      ),
    ),
  );
}

/** `/api/unpublished` for one run, re-read whenever the course is written. */
function useUnpublished(runId, sessionId, revision) {
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

/** One assessment's marking and Canvas, as the few words a row has room for. */
const markState = (entry) => {
  const c = entry.canvas;
  const marking =
    entry.submitted === 0 && entry.graded === 0
      ? "nothing handed in"
      : entry.graded + " of " + entry.submitted + " graded" + (entry.partial ? " · " + entry.partial + " part-graded" : "");
  let canvas = null;
  if (c.ready > 0) {
    canvas =
      c.unsent === 0 && c.changed === 0
        ? "all " + c.ready + " in Canvas"
        : [c.unsent ? c.unsent + " not in Canvas" : null, c.changed ? c.changed + " changed since sent" : null].filter(Boolean).join(" · ");
  }
  return { marking, canvas, behind: c.unsent > 0 || c.changed > 0 };
};

const dueOrder = (a, b) => String(a.due_at || "9999").localeCompare(String(b.due_at || "9999"));

/**
 * Above Progress · Gradebook: per assessment, how far its marking has got
 * and how much of it Canvas has. The gradebook widget is shared with the
 * chat clients and knows nothing of Canvas, so this line is the pane's.
 * Only assessments something was handed in for — a strip of twenty rows
 * saying "nothing handed in" would bury the two that matter.
 */
export function GradebookStatus(props) {
  const state = useUnpublished(props.runId, props.sessionId, props.revision);
  if (state.phase === "loading" || !state.value || state.value.error) return null;
  const rows = state.value.assessments.filter((entry) => entry.submitted > 0 || entry.graded > 0).sort(dueOrder);
  if (!rows.length) return null;
  return h(
    "div",
    { className: "pp-next pp-bookstatus" },
    rows.map((entry) => {
      const said = markState(entry);
      return h(
        "div",
        { className: "pp-approverow", key: entry.id },
        h("b", null, entry.title),
        h("span", null, said.marking),
        said.canvas ? h("span", { className: said.behind ? "pp-behind" : "pp-as" }, said.canvas) : null,
        said.behind
          ? h("button", { type: "button", className: "pp-segbtn", onClick: () => props.openUnpublished() }, "Send…")
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
                canvas: entry.canvas,
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
