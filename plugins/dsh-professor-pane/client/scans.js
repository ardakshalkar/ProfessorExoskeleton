/**
 * The Scans tab: paper exams, who each paper is, and where the pile stands.
 */

import { Message } from "./common.js";
import { GradeBoard } from "./grade-board.js";
import { CanvasMarks, MatchReview, STEP_PROMPTS } from "./marks.js";
import { h, React, ReactDOM } from "./react.js";
import { enqueuePlacement, placementKey, placementsWaiting, usePlacements } from "./scans-queue.js";
import { BASE, scoped } from "./tabs.js";

/**
 * Paper exams: where a pile stands, and who each paper is.
 *
 * Drawn here rather than in the frame for Integrations' reason — it calls
 * back. The document is server/scans.js; every figure in it arrived computed.
 * Match is the one step drawn in full, because it is the one only the
 * professor can do; the others are a sentence and a press that asks the
 * assistant, since reading, proposing a rubric and grading are its work.
 */
function ScansTab(props) {
  const [pile, setPile] = React.useState(props.pile || "");
  const [tick, setTick] = React.useState(0);
  const [state, setState] = React.useState({ phase: "loading", value: null });
  // A whole-pile write in flight (read, apply, the review's Confirm), or null.
  // Placing one paper is not one: those wait in line (client/scans-queue.js).
  const [busy, setBusy] = React.useState(null);
  const placements = usePlacements();
  // Read, apply and the review rewrite the whole plan, so they wait for the
  // line to empty, and the line waits for them.
  const blocked = Boolean(busy) || placementsWaiting(placements);
  const [said, setSaid] = React.useState(null);
  // Match's desk: the paper chosen in its list (file|pages, or null for the
  // first that waits), which papers the list shows, and the class search.
  const [selected, setSelected] = React.useState(null);
  const [laneView, setLaneView] = React.useState(props.lane === "held" ? "held" : "all");
  const [search, setSearch] = React.useState("");
  const searchBox = React.useRef(null);
  const [reviewing, setReviewing] = React.useState(false);
  const [grading, setGrading] = React.useState(false);
  // The step whose detail is open; null follows the pile's current step.
  // `props.step` opens on one: Match, when the press was on its held papers.
  const [openStep, setOpenStep] = React.useState(props.step || null);
  // `props.lane === "held"`: opened from the navigator's Held papers, so
  // the desk lists the held papers and is scrolled to once it draws.
  const deskRef = React.useRef(null);
  const scrolled = React.useRef(false);
  React.useEffect(() => {
    if (props.lane !== "held" || scrolled.current || state.phase !== "ready" || !deskRef.current) return;
    scrolled.current = true;
    deskRef.current.scrollIntoView({ block: "start" });
  });
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
    if (blocked) return;
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
  // One paper: into the line, so the next can be pressed at once. Each
  // answer is said as it comes back, and the pile is read again after it.
  const assign = (paper, to) => {
    if (busy) return;
    setSaid(null);
    enqueuePlacement({
      runId: props.runId,
      sessionId: props.sessionId,
      assessment: assessmentId,
      file: paper.file,
      pages: paper.pages,
      answer: to,
      onDone: (result) => {
        const stale = /no route \/api\/scans/.test(String(result.error || ""));
        const failed = Boolean(result.error) || !result.ok;
        setSaid({
          error: failed,
          text: stale
            ? "The harness was started before this tab existed. Restart it, then try again."
            : (failed ? "pp. " + paper.pages + " was not placed: " : "") + (result.error || result.output || "Done."),
        });
        setTick((value) => value + 1);
        props.onWrite();
      },
    });
  };
  // "placing", "queued" or null, for one paper of this pile.
  const statusOf = (paper) => {
    const key = placementKey(assessmentId, paper.file, paper.pages);
    return placements.running === key ? "placing" : placements.queued.includes(key) ? "queued" : null;
  };

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

  // ---------------------------------------------------------- Match's desk
  //
  // One line per paper that needs the professor, and the chosen one in full
  // beside it: the name line, the class ranked by how near each student is to
  // what is written, a search over the whole class, and who has no paper yet.
  // It replaced a card per paper, which put 36 papers a long scroll apart.
  const keyOf = (paper) => paper.file + "|" + paper.pages;
  const held = doc.papers.filter((paper) => paper.lane === "held");
  const check = doc.papers.filter((paper) => paper.lane === "check");
  const placed = doc.papers.filter((paper) => paper.lane === "placed");
  const skipped = doc.papers.filter((paper) => paper.lane === "skipped");
  // Held first: they are the papers nobody is placed on. A filter left empty
  // — the last held paper just placed — shows all that still need a person.
  const view = (laneView === "held" && !held.length) || (laneView === "check" && !check.length) ? "all" : laneView;
  const work = view === "held" ? held : view === "check" ? check : held.concat(check);
  const current =
    work.find((paper) => keyOf(paper) === selected) || work.find((paper) => !statusOf(paper)) || work[0] || null;
  const noPaper = doc.class.filter((entry) => !entry.placed);
  const hasPaper = new Set(doc.class.filter((entry) => entry.placed).map((entry) => entry.student));
  const waiting = doc.papers.filter((paper) => statusOf(paper)).length;

  // The next paper still to press, after this one, round to the top.
  const nextAfter = (paper) => {
    const index = work.indexOf(paper);
    return work.slice(index + 1).concat(work.slice(0, Math.max(0, index))).find((entry) => entry !== paper && !statusOf(entry)) || null;
  };
  // Place a paper and go on to the next, so a run of presses works down the list.
  const place = (paper, to) => {
    if (busy || !paper || statusOf(paper)) return;
    assign(paper, to);
    const next = nextAfter(paper);
    setSelected(next ? keyOf(next) : null);
    setSearch("");
  };

  // Typed names meet roster names in any script: the roster's side arrives
  // as `search`, a skeleton the server made; this is the same for Latin typed.
  const skeleton = (word) =>
    word
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/kh|x/g, "h")
      .replace(/zh/g, "j")
      .replace(/q/g, "k")
      .replace(/w/g, "u")
      .replace(/y/g, "i")
      .replace(/(.)\1+/g, "$1")
      .replace(/[^a-z0-9]/g, "");
  const found = (entry, text) =>
    text
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .every((word) => {
        const latin = skeleton(word);
        return (
          String(entry.name || "").toLowerCase().includes(word) ||
          entry.student.toLowerCase().includes(word) ||
          (latin !== "" && String(entry.search || "").includes(latin))
        );
      });
  const searched = search.trim()
    ? noPaper.filter((entry) => found(entry, search)).concat(doc.class.filter((entry) => entry.placed && found(entry, search))).slice(0, 12)
    : [];

  const NEAR = { close: "close", possible: "possible", far: "far" };
  const studentLine = (paper, student) =>
    student === paper.resolved ? "placed here now" : hasPaper.has(student) ? "has a paper" : "no paper yet";
  const rankRow = (paper, entry, index, off) =>
    h(
      "li",
      { key: entry.student },
      h(
        "button",
        {
          type: "button",
          className: "pp-rankrow" + (entry.student === paper.resolved ? " pp-rankrow-now" : ""),
          disabled: off,
          title: "Place pp. " + paper.pages + " on " + who(entry.student, entry.name) + (index < 9 ? " — key " + (index + 1) : ""),
          onClick: () => place(paper, { student: entry.student }),
        },
        h("span", { className: "pp-ranknum" }, index < 9 ? String(index + 1) : ""),
        h("span", { className: "pp-rankname" }, entry.name || entry.student),
        entry.near
          ? h(
              "span",
              { className: "pp-near pp-near-" + entry.near, title: NEAR[entry.near] + " · distance " + entry.distance },
              h("i", { style: { width: Math.round(Math.max(0.06, 1 - Math.min(1, entry.distance)) * 100) + "%" } }),
            )
          : h("span"),
        h("span", { className: "pp-as" + (hasPaper.has(entry.student) && entry.student !== paper.resolved ? " pp-as-warn" : "") }, studentLine(paper, entry.student)),
      ),
    );

  const deskDetail = (paper) => {
    if (!paper) return h("div", { className: "pp-mdetail pp-as" }, "Nothing here needs you.");
    const status = statusOf(paper);
    const off = Boolean(busy) || Boolean(status);
    const ranked = paper.ranked && paper.ranked.length ? paper.ranked : paper.candidates;
    return h(
      "div",
      { className: "pp-mdetail" },
      names && doc.crops
        ? h("img", {
            key: keyOf(paper),
            className: "pp-crop",
            alt: "The top of page " + paper.pages.split(/[-,]/)[0] + ", where the name is written",
            src: cropUrl(paper),
          })
        : null,
      h(
        "div",
        { className: "pp-mhead" },
        names
          ? paper.written
            ? h("span", null, "Read as ", h("span", { className: "pp-written" }, paper.written))
            : h("span", null, paper.has_name ? "A number is written" : "No name written")
          : null,
        h("span", { className: "pp-as" }, "pp. " + paper.pages + (paper.variant ? " · variant " + paper.variant : "")),
        status ? h("span", { className: "pp-qchip" }, status === "placing" ? "Placing…" : "Queued") : null,
      ),
      names && paper.also.length
        ? h("div", { className: "pp-cardmeta" }, "Also written: ", paper.also.map((text) => "“" + text + "”").join(", "))
        : null,
      h(
        "div",
        { className: "pp-cardmeta" },
        paper.lane === "check"
          ? (paper.match === "partial" ? "Placed on one word of the name: " : "Placed on a close spelling: ") + who(paper.resolved, paper.resolved_name)
          : paper.problem || "Not placed yet",
      ),
      names && doc.crops && paper.clash.length ? sideBySide(paper) : null,
      paper.lane === "check"
        ? h(
            "div",
            { className: "pp-actions" },
            h(
              "button",
              { type: "button", className: "pp-primary", disabled: off, onClick: () => place(paper, { student: paper.resolved }) },
              "Confirm " + (paper.resolved_name ? paper.resolved_name.split(/\s+/).slice(0, 2).join(" ") : paper.resolved),
            ),
            h("span", { className: "pp-as" }, "Enter"),
          )
        : null,
      ranked.length
        ? h(
            React.Fragment,
            null,
            h("div", { className: "pp-mlabel" }, "Possible matches, nearest first"),
            h("ol", { className: "pp-ranked" }, ranked.map((entry, index) => rankRow(paper, entry, index, off))),
          )
        : h("div", { className: "pp-cardmeta" }, "No enrolled student is near what is written — search the class below."),
      h("input", {
        ref: searchBox,
        className: "pp-msearch",
        type: "search",
        value: search,
        disabled: off,
        placeholder: "Someone else — type a name or number  ( / )",
        "aria-label": "Search the class for who wrote pp. " + paper.pages,
        onChange: (event) => setSearch(event.target.value),
      }),
      search.trim()
        ? searched.length
          ? h(
              "ol",
              { className: "pp-ranked" },
              searched.map((entry, index) => rankRow(paper, { student: entry.student, name: entry.name }, index + 100, off)),
            )
          : h("div", { className: "pp-cardmeta" }, "Nobody in the class matches “" + search.trim() + "”.")
        : noPaper.length
          ? h(
              "details",
              { className: "pp-folded pp-nopaper" },
              h("summary", null, noPaper.length + (noPaper.length === 1 ? " student has" : " students have") + " no paper yet"),
              h(
                "div",
                { className: "pp-chips" },
                noPaper.map((entry) =>
                  h(
                    "button",
                    {
                      type: "button",
                      key: entry.student,
                      className: "pp-segbtn",
                      disabled: off,
                      title: "Place pp. " + paper.pages + " on " + who(entry.student, entry.name),
                      onClick: () => place(paper, { student: entry.student }),
                    },
                    entry.name || entry.student,
                  ),
                ),
              ),
            )
          : null,
      h(
        "div",
        { className: "pp-actions" },
        paper.clash.length
          ? h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                disabled: off,
                title: "This one is not their paper — a copy they started and gave up, handed in with the real one",
                onClick: () => place(paper, { skip: "spoiled copy — the paper is pp. " + paper.clash.map((entry) => entry.pages).join(", ") }),
              },
              "Spoiled copy",
            )
          : null,
        paper.lane === "held" && !paper.clash.length
          ? h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                disabled: off,
                title: "Not one of this run's students — a visitor, or a sheet that is nobody's",
                onClick: () => place(paper, { skip: "not a student of this run" }),
              },
              "Not a student",
            )
          : null,
      ),
    );
  };

  const deskRow = (paper) => {
    const status = statusOf(paper);
    const guess = paper.lane === "check" ? paper.resolved_name || paper.resolved : (paper.candidates[0] || {}).name || (paper.candidates[0] || {}).student;
    return h(
      "button",
      {
        type: "button",
        key: keyOf(paper),
        className: "pp-mrow" + (paper === current ? " pp-mrow-on" : ""),
        "aria-current": paper === current ? "true" : undefined,
        onClick: () => {
          setSelected(keyOf(paper));
          setSearch("");
        },
      },
      h("span", { className: "pp-mdot pp-mdot-" + paper.lane, title: paper.lane === "check" ? "Weak match, to check" : "Held — placed on nobody" }),
      h(
        "span",
        { className: "pp-mrowmain" },
        h("b", null, names && paper.written ? paper.written : "pp. " + paper.pages),
        h("span", null, (names && paper.written ? "pp. " + paper.pages : paper.lane === "check" ? "to check" : "held") + (guess ? " → " + guess : "")),
      ),
      status ? h("span", { className: "pp-qchip" }, status === "placing" ? "Placing…" : "Queued") : null,
    );
  };

  // Keys: j/k through the list, 1–9 a ranked match, Enter the first (or the
  // confirm), / the search, and in the search Enter its first answer.
  const onKey = (event) => {
    if (shown !== "match" || !current) return;
    if (event.target.tagName === "INPUT") {
      if (event.key === "Enter" && searched.length) {
        place(current, { student: searched[0].student });
        event.preventDefault();
      } else if (event.key === "Escape" && search) {
        setSearch("");
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    if (event.target.tagName === "SELECT" || event.target.tagName === "TEXTAREA") return;
    const index = work.indexOf(current);
    const ranked = current.ranked && current.ranked.length ? current.ranked : current.candidates;
    if (event.key === "j" || event.key === "ArrowDown") {
      const next = work[Math.min(index + 1, work.length - 1)];
      if (next) setSelected(keyOf(next));
      event.preventDefault();
    } else if (event.key === "k" || event.key === "ArrowUp") {
      const next = work[Math.max(index - 1, 0)];
      if (next) setSelected(keyOf(next));
      event.preventDefault();
    } else if (/^[1-9]$/.test(event.key) && ranked[Number(event.key) - 1]) {
      place(current, { student: ranked[Number(event.key) - 1].student });
      event.preventDefault();
    } else if (event.key === "Enter" && !event.target.closest("button")) {
      if (current.lane === "check") place(current, { student: current.resolved });
      else if (ranked.length) place(current, { student: ranked[0].student });
      event.preventDefault();
    } else if (event.key === "/" && searchBox.current) {
      searchBox.current.focus();
      event.preventDefault();
    }
  };

  // Confirm every weak match at once: one `scans assign --assignments`, as
  // the review's Confirm sends it, so the plan is checked whole and applied once.
  const confirmAll = () => {
    const papers = check.filter((paper) => !statusOf(paper)).map((paper) => ({ file: paper.file, pages: paper.pages, student: paper.resolved }));
    if (!papers.length) return;
    const ok = window.confirm(
      "Confirm all " + papers.length + " weak matches? Each paper stays on the student it was matched to, and is marked as confirmed by you.",
    );
    if (ok) post("/api/scans/assign", { papers: papers }, "confirm-all");
  };

  // A harness from before `now` existed sends none; the tab still draws.
  const now = doc.now || { step: doc.next || null, index: 0, total: doc.stages.length, title: "", body: "", whose: "you", action: null };
  const shown = openStep || now.step || "canvas";
  const stageOf = (id) => doc.stages.find((stage) => stage.id === id) || null;
  const shownStage = stageOf(shown);
  const gradable = doc.answers > 0;

  const WHOSE = { you: "Your move", assistant: "Assistant", done: "Done" };
  const whose = (value) => h("span", { className: "pp-whose pp-whose-" + value }, WHOSE[value] || value);
  const choosePile = (id) => {
    setOpenStep(null);
    setLaneView("all");
    setSelected(null);
    setSearch("");
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
        disabled: blocked,
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
            className: (primary ? "pp-primary" : "pp-segbtn") + " pp-chat",
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

  // Match's tools: where the pile stands in one bar, the presses that act on
  // many papers, then the desk, then what was placed.
  const matchTools = () => {
    const counted = placed.length + check.length + held.length;
    const share = (n) => (counted ? (100 * n) / counted : 0) + "%";
    const filter = (id, label, n) =>
      h(
        "button",
        {
          type: "button",
          key: id,
          className: "pp-segbtn",
          "aria-pressed": view === id,
          onClick: () => {
            setLaneView(id);
            setSelected(null);
            setSearch("");
          },
        },
        label + " " + n,
      );
    return [
      h(
        "div",
        { className: "pp-msum", key: "sum" },
        h(
          "div",
          { className: "pp-mbar", role: "img", "aria-label": placed.length + " placed, " + check.length + " to check, " + held.length + " held" },
          h("i", { className: "pp-mbar-placed", style: { width: share(placed.length) } }),
          h("i", { className: "pp-mbar-check", style: { width: share(check.length) } }),
          h("i", { className: "pp-mbar-held", style: { width: share(held.length) } }),
        ),
        h(
          "div",
          { className: "pp-mkey" },
          h("span", null, h("i", { className: "pp-mdot pp-mdot-placed" }), placed.length + " of " + counted + " placed"),
          check.length ? h("span", null, h("i", { className: "pp-mdot pp-mdot-check" }), check.length + " weak matches to check") : null,
          held.length ? h("span", null, h("i", { className: "pp-mdot pp-mdot-held" }), held.length + " held") : null,
          waiting ? h("span", null, waiting + " queued") : null,
          h("span", { className: "pp-as" }, doc.missing + " enrolled with no paper"),
        ),
      ),
      !names
        ? h(
            Message,
            { key: "pseudonyms" },
            "Pseudonyms are showing, so the handwritten names and their crops are hidden. Press Names to match papers.",
          )
        : null,
      check.length || (names && reviewable)
        ? h(
            "div",
            { className: "pp-actions", key: "many" },
            check.length
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pp-primary",
                    disabled: blocked,
                    title: "Keep every weak match on the student it was matched to, as one write — or check them one by one below",
                    onClick: confirmAll,
                  },
                  busy === "confirm-all" ? "Confirming…" : "Confirm all " + check.length + " weak matches",
                )
              : null,
            names && reviewable
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pp-segbtn",
                    disabled: blocked,
                    title: "Every name the pile was matched on, as big cards — confirm them all at once, reject the wrong ones",
                    onClick: () => setReviewing(true),
                  },
                  "Review all " + reviewable + " name matches",
                )
              : null,
          )
        : null,
      held.length + check.length
        ? h(
            "div",
            { className: "pp-desk", key: "desk", ref: deskRef },
            h(
              "div",
              { className: "pp-mside" },
              h(
                "div",
                { className: "pp-mfilter" },
                filter("held", "Held", held.length),
                filter("check", "To check", check.length),
                filter("all", "All", held.length + check.length),
              ),
              h(
                "div",
                { className: "pp-mlist", role: "list", "aria-label": "Papers that need you" },
                work.length ? work.map(deskRow) : h("div", { className: "pp-as pp-mempty" }, "None here."),
              ),
              h("div", { className: "pp-as pp-mkeys" }, "j / k move · 1–9 pick · Enter first · / search"),
            ),
            deskDetail(current),
          )
        : h("div", { className: "pp-cardmeta", key: "none" }, "Every paper is placed on a student."),
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
              disabled: blocked,
              title: "Run `scans apply` again — after editing plan.yaml by hand, say",
              onClick: () => post("/api/scans/apply", {}, "apply"),
            },
            busy === "apply" ? "Applying…" : "Re-apply the plan",
          ),
        ),
      ),
    ];
  };

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

/**
 * The Scans tab as a window, opened on one pile from a chip in course mode.
 *
 * The same component the tab draws, over course mode rather than in the
 * column, so the professor checks a pile and comes back to the week they were
 * reading. Escape is heard in the bubbling phase: the Grade view and the
 * match review inside it take it first, in capture, and stop it there.
 */
export function ScansModal(props) {
  const close = props.onClose;
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
  return ReactDOM.createPortal(
    h(
      "div",
      {
        className: "pp-veil",
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) close();
        },
      },
      h(
        "div",
        {
          className: "pp-modal pp-scansmodal",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "Scans",
          onMouseDown: (event) => event.stopPropagation(),
        },
        h(
          "div",
          { className: "pp-modalhead" },
          h("div", { className: "pp-modaltitle" }, "Scans · " + props.runId),
          h("button", { type: "button", className: "pp-close", "aria-label": "Close", onClick: close }, "×"),
        ),
        h(ScansTab, {
          runId: props.runId,
          sessionId: props.sessionId,
          names: props.names,
          ask: props.ask,
          onWrite: props.onWrite,
          revision: props.revision,
          pile: props.pile,
          step: props.step,
          lane: props.lane,
        }),
      ),
    ),
    document.body,
  );
}