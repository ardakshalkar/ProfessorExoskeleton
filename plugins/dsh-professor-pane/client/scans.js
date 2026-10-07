/**
 * The Scans tab: paper exams, who each paper is, and where the pile stands.
 */

import { Message } from "./common.js";
import { GradeBoard } from "./grade-board.js";
import { CanvasMarks, MatchReview, STEP_PROMPTS } from "./marks.js";
import { h, React } from "./react.js";
import { BASE, scoped } from "./tabs.js";

/**
 * Paper exams: where a pile stands, and who each paper is.
 *
 * Drawn here rather than in the frame for Integrations' reason — it calls
 * back. The document is lib/scans.js; every figure in it arrived computed.
 * Match is the one step drawn in full, because it is the one only the
 * professor can do; the others are a sentence and a press that asks the
 * assistant, since reading, proposing a rubric and grading are its work.
 */
export function ScansTab(props) {
  const [pile, setPile] = React.useState("");
  const [tick, setTick] = React.useState(0);
  const [state, setState] = React.useState({ phase: "loading", value: null });
  const [busy, setBusy] = React.useState(null);
  const [said, setSaid] = React.useState(null);
  const [focus, setFocus] = React.useState(0);
  const [reviewing, setReviewing] = React.useState(false);
  const [grading, setGrading] = React.useState(false);
  // The step whose detail is open; null follows the pile's current step.
  const [openStep, setOpenStep] = React.useState(null);
  const names = props.names;

  const query = (path) =>
    scoped(
      BASE + path + "?run=" + encodeURIComponent(props.runId) +
        (pile ? "&assessment=" + encodeURIComponent(pile) : ""),
      props.sessionId,
    );

  React.useEffect(() => {
    let live = true;
    fetch(query("/api/scans") + (names ? "&names=1" : "") + "&r=" + props.revision + "." + tick, {
      headers: { accept: "application/json" },
    })
      .then((response) => response.json())
      .then((value) => live && setState({ phase: "ready", value }))
      .catch((error) => live && setState({ phase: "ready", value: { error: String(error) } }));
    return () => {
      live = false;
    };
  }, [props.runId, pile, names, props.revision, tick]);

  const doc = state.value;
  const assessmentId = doc && doc.assessment ? doc.assessment.id : "";

  const post = (path, body, label, done) => {
    if (busy) return;
    setBusy(label);
    setSaid(null);
    fetch(query(path).replace(/assessment=[^&]*/, "") + "&assessment=" + encodeURIComponent(assessmentId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    })
      .then((response) => response.json())
      .then((result) => {
        setBusy(null);
        const stale = /no route \/api\/scans/.test(String(result.error || ""));
        setSaid({
          error: Boolean(result.error) || !result.ok,
          text: stale
            ? "The harness was started before this tab existed. Restart it, then try again."
            : result.error || result.output || "Done.",
        });
        setTick((value) => value + 1);
        props.onWrite();
        if (done && !result.error && result.ok) done();
      })
      .catch((error) => {
        setBusy(null);
        setSaid({ error: true, text: String(error) });
      });
  };
  const assign = (paper, to, label) =>
    post("/api/scans/assign", Object.assign({ pages: paper.pages, file: paper.file }, to), label);

  if (state.phase === "loading") return h(Message, null, "Reading the pile…");
  if (doc.error) {
    return h(
      Message,
      { error: true },
      /no route \/api\/scans/.test(doc.error)
        ? "The harness was started before this tab existed. Restart it to see scanned papers here."
        : doc.error,
    );
  }
  if (!doc.assessment) {
    return h(
      Message,
      null,
      "No scanned pile for " + props.runId + " yet. Upload the scans; the assistant works out " +
        "which assessment they are and files them, and they appear here.",
    );
  }

  const who = (id, name) => (name ? name + " · " + id : id);
  const cropUrl = (paper) =>
    query("/api/scans/crop").replace(/assessment=[^&]*/, "") +
    "&assessment=" + encodeURIComponent(assessmentId) +
    "&file=" + encodeURIComponent(paper.file) +
    "&pages=" + encodeURIComponent(paper.pages);
  // A harness started before `also` and `clash` existed serves papers
  // without them; the tab draws those as having none, not as a crash.
  doc.papers.forEach((paper) => {
    paper.also = paper.also || [];
    paper.clash = (paper.clash || []).map((entry) => Object.assign({ page_list: [] }, entry));
    paper.page_list = paper.page_list || [];
  });
  const pageUrl = (paper, page) =>
    query("/api/scans/crop").replace(/assessment=[^&]*/, "") +
    "&assessment=" + encodeURIComponent(assessmentId) +
    "&file=" + encodeURIComponent(paper.file) +
    "&pages=" + encodeURIComponent(paper.pages) +
    "&whole=" + page;
  // Two papers for one student, drawn whole and side by side: a spoiled
  // copy is the nearly blank one, which no name on either can say.
  const sideBySide = (paper) =>
    h(
      "div",
      { className: "pp-clash" },
      [{ file: paper.file, pages: paper.pages, page_list: paper.page_list, own: true }].concat(paper.clash).map((entry) =>
        h(
          "figure",
          { key: entry.file + "#" + entry.pages },
          h(
            "div",
            { className: "pp-clashpages" },
            entry.page_list.map((page) =>
              h("img", { key: page, loading: "lazy", alt: "Page " + page + " of " + entry.file, src: pageUrl(entry, page) }),
            ),
          ),
          h("figcaption", null, (entry.own ? "This paper" : "The other") + " · pp. " + entry.pages),
        ),
      ),
    );
  const reviewable = doc.papers.filter(
    (paper) =>
      (paper.resolved && !paper.pinned && paper.has_name && (paper.lane === "check" || paper.lane === "placed")) ||
      (paper.lane === "held" && paper.candidates.length),
  ).length;
  const work = doc.papers.filter((paper) => paper.lane === "check" || paper.lane === "held");
  const at = Math.min(focus, Math.max(0, work.length - 1));
  const unplaced = doc.class.filter((entry) => !entry.placed);
  const placedPeople = doc.class.filter((entry) => entry.placed);

  const picker = (paper, label) => {
    const id = "pick-" + paper.file + "-" + paper.pages;
    return h(
      "select",
      {
        key: id,
        "aria-label": label,
        value: "",
        disabled: Boolean(busy),
        onChange: (event) => {
          if (event.target.value) assign(paper, { student: event.target.value }, paper.pages);
        },
      },
      h("option", { value: "" }, label + "…"),
      h(
        "optgroup",
        { label: "No paper yet" },
        unplaced.map((entry) => h("option", { value: entry.student, key: entry.student }, who(entry.student, entry.name))),
      ),
      h(
        "optgroup",
        { label: "Already have a paper" },
        placedPeople.map((entry) => h("option", { value: entry.student, key: entry.student }, who(entry.student, entry.name))),
      ),
    );
  };

  const card = (paper, index) => {
    const key = paper.file + "|" + paper.pages;
    const primary =
      paper.lane === "check"
        ? () => assign(paper, { student: paper.resolved }, paper.pages)
        : paper.candidates.length
          ? () => assign(paper, { student: paper.candidates[0].student }, paper.pages)
          : null;
    const pending = busy === paper.pages;
    return h(
      "div",
      {
        key,
        className: "pp-card" + (index === at ? " pp-focus" : ""),
        tabIndex: 0,
        onFocus: () => setFocus(index),
      },
      names && doc.crops
        ? h("img", {
            className: "pp-crop",
            alt: "The top of page " + paper.pages.split("-")[0] + ", where the name is written",
            loading: "lazy",
            src: cropUrl(paper),
          })
        : null,
      h(
        "div",
        null,
        names
          ? paper.written
            ? h("span", null, "Written: ", h("span", { className: "pp-written" }, paper.written))
            : h("span", null, paper.has_name ? "A number is written" : "No name written")
          : h("span", null, "Pages " + paper.pages),
      ),
      names && paper.also.length
        ? h("div", { className: "pp-cardmeta" }, "Also written: ", paper.also.map((text) => "“" + text + "”").join(", "))
        : null,
      paper.lane === "check"
        ? h(
            "div",
            { className: "pp-cardmeta" },
            (paper.match === "partial" ? "Placed on one word of the name: " : "Placed on a close spelling: ") +
              who(paper.resolved, paper.resolved_name),
          )
        : h("div", { className: "pp-cardmeta" }, paper.problem || "Not placed yet"),
      names && doc.crops && paper.clash.length ? sideBySide(paper) : null,
      paper.lane === "held" && paper.candidates.length
        ? h(
            "div",
            { className: "pp-cardmeta" },
            "Nearest: " + paper.candidates.map((entry) => who(entry.student, entry.name)).join("; "),
          )
        : null,
      h(
        "div",
        { className: "pp-actions" },
        paper.lane === "check"
          ? h(
              "button",
              { type: "button", className: "pp-segbtn", disabled: Boolean(busy), onClick: primary },
              "Confirm",
            )
          : null,
        paper.lane === "held"
          ? paper.candidates.map((entry) =>
              h(
                "button",
                {
                  type: "button",
                  className: "pp-segbtn",
                  key: entry.student,
                  disabled: Boolean(busy),
                  onClick: () => assign(paper, { student: entry.student }, paper.pages),
                },
                "It's " + (entry.name ? entry.name.split(/\s+/).slice(0, 2).join(" ") : entry.student),
              ),
            )
          : null,
        paper.clash.length
          ? h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                disabled: Boolean(busy),
                title: "This one is not their paper — a copy they started and gave up, handed in with the real one",
                onClick: () =>
                  assign(paper, { skip: "spoiled copy — the paper is pp. " + paper.clash.map((entry) => entry.pages).join(", ") }, paper.pages),
              },
              "Spoiled copy",
            )
          : null,
        picker(paper, paper.lane === "check" ? "Someone else" : paper.clash.length ? "Someone else's" : "Pick from class"),
        paper.lane === "held" && !paper.clash.length
          ? h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                disabled: Boolean(busy),
                title: "Not one of this run's students — a visitor, or a sheet that is nobody's",
                onClick: () => assign(paper, { skip: "not a student of this run" }, paper.pages),
              },
              "Not a student",
            )
          : null,
        pending ? h("span", { className: "pp-as" }, "Placing…") : null,
      ),
    );
  };

  const onKey = (event) => {
    if (event.target.tagName === "SELECT" || event.target.tagName === "INPUT") return;
    if (event.key === "j" || event.key === "ArrowDown") {
      setFocus((value) => Math.min(value + 1, work.length - 1));
      event.preventDefault();
    } else if (event.key === "k" || event.key === "ArrowUp") {
      setFocus((value) => Math.max(value - 1, 0));
      event.preventDefault();
    } else if (event.key === "Enter" && event.target.classList.contains("pp-card")) {
      const paper = work[at];
      if (!paper) return;
      if (paper.lane === "check") assign(paper, { student: paper.resolved }, paper.pages);
      else if (paper.candidates.length) assign(paper, { student: paper.candidates[0].student }, paper.pages);
      event.preventDefault();
    }
  };

  // A harness from before `now` existed sends none; the tab still draws.
  const now = doc.now || { step: doc.next || null, index: 0, total: doc.stages.length, title: "", body: "", whose: "you", action: null };
  const shown = openStep || now.step || "canvas";
  const stageOf = (id) => doc.stages.find((stage) => stage.id === id) || null;
  const shownStage = stageOf(shown);
  const gradable = doc.answers > 0;
  const check = work.filter((paper) => paper.lane === "check");
  const held = work.filter((paper) => paper.lane === "held");
  const placed = doc.papers.filter((paper) => paper.lane === "placed");
  const skipped = doc.papers.filter((paper) => paper.lane === "skipped");

  const WHOSE = { you: "Your move", assistant: "Assistant", done: "Done" };
  const whose = (value) => h("span", { className: "pp-whose pp-whose-" + value }, WHOSE[value] || value);
  const choosePile = (id) => {
    setOpenStep(null);
    setFocus(0);
    setPile(id);
  };

  // The buttons each step offers. `primary` when it is the one action of
  // the headline; the same button in a step's detail is secondary, so a
  // view never has two primaries.
  const readButton = (primary) =>
    h(
      "button",
      {
        type: "button",
        key: "read",
        className: primary ? "pp-primary" : "pp-segbtn",
        disabled: Boolean(busy),
        title: "Runs `scans read`, then `scans record`: every answer recorded as a draft, the low-confidence ones listed",
        onClick: () => post("/api/scans/read", {}, "read"),
      },
      busy === "read" ? "Reading… a few minutes for a class" : "Read and record the answers",
    );
  const gradeButton = (primary) =>
    h(
      "button",
      {
        type: "button",
        key: "grade",
        className: primary ? "pp-primary" : "pp-segbtn",
        disabled: Boolean(busy),
        title: "Every answer to each question as cards over the conversation — choose the rubric, then mark and decide",
        onClick: () => setGrading(true),
      },
      "Open the Grade view",
    );
  const askButton = (kind, primary) =>
    STEP_PROMPTS[kind]
      ? h(
          "button",
          {
            type: "button",
            key: "ask-" + kind,
            className: primary ? "pp-primary" : "pp-segbtn",
            onClick: () => props.ask(STEP_PROMPTS[kind](props.runId, assessmentId)),
          },
          kind === "grade" ? "Ask the assistant for suggestions" : "Ask the assistant",
        )
      : null;
  const canvasPanel = (lead) =>
    doc.canvas && doc.canvas.ready > 0
      ? h(CanvasMarks, {
          key: "canvas-" + assessmentId,
          lead: lead,
          runId: props.runId,
          sessionId: props.sessionId,
          assessmentId: assessmentId,
          title: doc.assessment.title,
          ask: props.ask,
          canvas: doc.canvas,
          onSent: () => {
            setTick((value) => value + 1);
            props.onWrite();
          },
        })
      : null;

  const nowActions = () => {
    if (now.action === "read") return [readButton(true)];
    if (now.action === "ask") return [askButton(now.ask, true)];
    if (now.action === "grade") return [gradeButton(true), now.ask ? askButton(now.ask, false) : null];
    if (now.action === "match")
      return [
        h(
          "button",
          { type: "button", key: "match", className: "pp-primary", onClick: () => setOpenStep("match") },
          "Show the papers",
        ),
      ];
    return [];
  };

  // The headline: the one step to work on, why, and its one action.
  const nowCard = h(
    "section",
    { className: "pp-now", "aria-label": "What " + doc.assessment.title + " needs now" },
    h(
      "div",
      { className: "pp-nowkick" },
      h("span", null, now.step ? "Step " + (now.index + 1) + " of " + now.total + " · " + ((stageOf(now.step) || {}).label || now.step) : "All " + now.total + " steps done"),
      whose(now.whose),
    ),
    h("h3", null, now.title),
    h("p", null, now.body),
    now.action === "canvas"
      ? canvasPanel(true)
      : h("div", { className: "pp-actions" }, nowActions()),
  );

  // Every pile, each saying where it is: the overview the dropdown hid.
  const pileList = h(
    "div",
    { className: "pp-piles", role: "list", "aria-label": "Scanned exams in " + props.runId },
    doc.piles.map((entry) =>
      h(
        "button",
        {
          type: "button",
          role: "listitem",
          key: entry.id,
          className: "pp-pile",
          "aria-current": entry.id === assessmentId,
          onClick: () => choosePile(entry.id),
        },
        h(
          "span",
          { className: "pp-pilename" },
          h("b", null, entry.title),
          h("span", null, entry.now ? entry.now.phrase : ""),
        ),
        entry.progress
          ? h(
              "span",
              { className: "pp-pilebar", "aria-hidden": "true" },
              entry.progress.map((state, index) =>
                h("i", { key: index, className: state === "done" ? "pp-s-done" : entry.now && index === entry.now.index ? "pp-s-now" : "" }),
              ),
            )
          : null,
        entry.now ? whose(entry.now.whose) : null,
      ),
    ),
  );

  // The seven steps: done, the one to work on, and the rest; each opens
  // its own detail.
  const stepper = h(
    "div",
    { className: "pp-stepper", role: "list", "aria-label": doc.assessment.title + ": the seven steps" },
    doc.stages.map((stage, index) =>
      h(
        "button",
        {
          type: "button",
          role: "listitem",
          key: stage.id,
          className: "pp-stepbtn",
          "aria-pressed": stage.id === shown,
          title: stage.label + ": " + stage.detail,
          onClick: () => setOpenStep(stage.id),
        },
        h(
          "span",
          {
            className:
              "pp-dot" +
              (stage.state === "done" ? " pp-dot-done" : stage.id === now.step ? " pp-dot-now" : stage.state === "yours" ? " pp-dot-yours" : ""),
            "aria-hidden": "true",
          },
          stage.state === "done" ? "✓" : String(index + 1),
        ),
        h("span", null, stage.label),
      ),
    ),
  );

  // Match's tools: the papers that need a person, the review of every
  // match, and what was placed.
  const matchTools = () => [
    !names
      ? h(
          Message,
          { key: "pseudonyms" },
          "Pseudonyms are showing, so the handwritten names and their crops are hidden. Press Names to match papers.",
        )
      : reviewable
        ? h(
            "div",
            { className: "pp-actions", key: "review" },
            h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                disabled: Boolean(busy),
                title: "Every name the pile was matched on, as big cards — confirm them all at once, reject the wrong ones",
                onClick: () => setReviewing(true),
              },
              "Review all " + reviewable + " name matches",
            ),
          )
        : null,
    check.length
      ? h(
          "div",
          { className: "pp-lane", key: "check-lane" },
          "Check",
          h("span", null, "· " + check.length + " placed on a close spelling or one word of the name — confirm, or say who it is"),
        )
      : null,
    ...check.map((paper) => card(paper, work.indexOf(paper))),
    held.length
      ? h("div", { className: "pp-lane", key: "held-lane" }, "Held", h("span", null, "· " + held.length + " not placed"))
      : null,
    ...held.map((paper) => card(paper, work.indexOf(paper))),
    work.length ? h("div", { className: "pp-cardmeta", key: "keys" }, "j / k to move between papers, Enter to confirm") : null,
    h(
      "details",
      { className: "pp-folded", key: "placed" },
      h(
        "summary",
        null,
        placed.length + " placed" + (skipped.length ? " · " + skipped.length + " set aside" : "") + " · " + doc.missing + " enrolled with no paper",
      ),
      h(
        "ul",
        null,
        placed.map((paper) =>
          h(
            "li",
            { key: paper.file + paper.pages },
            "pp. " + paper.pages + " → " + who(paper.resolved, paper.resolved_name) +
              (paper.pinned ? " (confirmed)" : paper.match === "words" ? " (by its words)" : paper.match === "partial" ? " (one word)" : ""),
          ),
        ),
        skipped.map((paper) => h("li", { key: paper.file + paper.pages }, "pp. " + paper.pages + " — " + paper.skip)),
      ),
      h(
        "div",
        { className: "pp-actions" },
        h(
          "button",
          {
            type: "button",
            className: "pp-segbtn",
            disabled: Boolean(busy),
            title: "Run `scans apply` again — after editing plan.yaml by hand, say",
            onClick: () => post("/api/scans/apply", {}, "apply"),
          },
          busy === "apply" ? "Applying…" : "Re-apply the plan",
        ),
      ),
    ),
  ];

  // The open step's detail: what it says, and its tools when they are not
  // already the headline's action.
  const stepTools = () => {
    if (shown === "match") return matchTools();
    if (shown === "read") return now.action === "read" ? [] : [h("div", { className: "pp-actions", key: "a" }, readButton(false))];
    if (shown === "rubric" || shown === "grade" || shown === "approve") {
      if (!gradable || now.action === "grade") return [];
      return [h("div", { className: "pp-actions", key: "a" }, gradeButton(false))];
    }
    if (shown === "canvas") return now.action === "canvas" ? [] : [canvasPanel()];
    return [];
  };
  const detail = shownStage
    ? h(
        "section",
        { className: "pp-stepdetail", "aria-label": shownStage.label },
        h("b", null, shownStage.label),
        " — " + shownStage.detail,
        stepTools(),
      )
    : null;

  return h(
    "div",
    { className: "pp-scroll", onKeyDown: onKey },
    pileList,
    nowCard,
    stepper,
    detail,
    said
      ? h("pre", { className: "pp-approveout" + (said.error ? " pp-approveerr" : "") }, said.text)
      : null,
    grading
      ? h(GradeBoard, {
          runId: props.runId,
          sessionId: props.sessionId,
          assessmentId: assessmentId,
          title: doc.assessment.title,
          names: names,
          revision: props.revision,
          ask: props.ask,
          onWrite: () => {
            setTick((value) => value + 1);
            props.onWrite();
          },
          onClose: () => setGrading(false),
        })
      : null,
    reviewing && names
      ? h(MatchReview, {
          papers: doc.papers,
          title: doc.assessment.title,
          crops: doc.crops,
          cropUrl: cropUrl,
          busy: busy === "review",
          onClose: () => setReviewing(false),
          onSubmit: (papers) =>
            post("/api/scans/assign", { papers: papers }, "review", () => setReviewing(false)),
        })
      : null,
  );
}
