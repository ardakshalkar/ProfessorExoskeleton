/**
 * The grade board, and the page around it.
 */

import { Message } from "./common.js";
import { h, React, ReactDOM } from "./react.js";
import { BASE, scoped } from "./tabs.js";

/**
 * Grading a written exam, one question at a time, over the conversation.
 *
 * The document is server/grade.js — `ainar grade status --json` with names
 * added — and every figure in it arrived computed. Three readings, chosen
 * by where the rubric stands:
 *
 * * **no rubric** — the question, its marking guidance and the answers as
 *   read, with two ways forward: ask the assistant to group the answers and
 *   propose levels, or grade by points only;
 * * **rubric proposed** — the levels top down, the groups of answers placed
 *   under them, a select on each group to move it, and Accept rubric;
 * * **rubric accepted** — the groups with their answer cards. A card's
 *   buttons decide that answer; a group's Accept decides every undecided
 *   answer in it at its suggestion; Accept all does the question, or every
 *   question.
 *
 * Every write is a POST that spawns `ainar grade …`. A decision is the
 * professor's press, and how it was pressed — one card, a group, all — is
 * kept beside it by the CLI.
 */
export function GradeBoard(props) {
  const [tick, setTick] = React.useState(0);
  const [state, setState] = React.useState({ phase: "loading", value: null });
  const [at, setAt] = React.useState(0);
  const [busy, setBusy] = React.useState(null);
  const [said, setSaid] = React.useState(null);
  const [focus, setFocus] = React.useState(0);
  const [big, setBig] = React.useState(null);
  const [notes, setNotes] = React.useState({});
  const [openGroups, setOpenGroups] = React.useState({});
  const [comparing, setComparing] = React.useState(false);
  const [showRubric, setShowRubric] = React.useState(false);

  // groups.yaml is private, so the course's revision poll never sees the
  // assistant rewrite it. Ask for its time every few seconds while the view
  // is open, and redraw when it moves — a rethought rubric appears here
  // without anybody pressing reload.
  React.useEffect(() => {
    let last = null;
    let live = true;
    const check = () =>
      fetch(scoped(BASE + "/api/grade/stamp?run=" + encodeURIComponent(props.runId) + "&assessment=" + encodeURIComponent(props.assessmentId), props.sessionId))
        .then((response) => response.json())
        .then((value) => {
          if (!live || value.error) return;
          if (last !== null && value.groups !== last) setTick((count) => count + 1);
          last = value.groups;
        })
        .catch(() => {});
    check();
    const timer = setInterval(check, 3000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [props.runId, props.assessmentId, props.sessionId]);
  const close = props.onClose;

  const url = (path) =>
    scoped(
      BASE + path + "?run=" + encodeURIComponent(props.runId) + "&assessment=" + encodeURIComponent(props.assessmentId),
      props.sessionId,
    );

  React.useEffect(() => {
    let live = true;
    fetch(url("/api/grade") + (props.names ? "&names=1" : "") + "&r=" + props.revision + "." + tick, {
      headers: { accept: "application/json" },
    })
      .then((response) => response.json())
      .then((value) => live && setState({ phase: "ready", value }))
      .catch((error) => live && setState({ phase: "ready", value: { error: String(error) } }));
    return () => {
      live = false;
    };
  }, [props.runId, props.assessmentId, props.names, props.revision, tick]);

  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) {
        event.stopPropagation();
        if (big) setBig(null);
        else close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, busy, big]);

  // The card in focus takes the keyboard, so j/k and a digit act on it —
  // unless a comment is being typed.
  React.useEffect(() => {
    const node = document.querySelector(".pp-gcard.pp-focus");
    if (node && document.activeElement && document.activeElement.tagName !== "INPUT") node.focus({ preventScroll: false });
  }, [focus, at, tick, state.phase]);

  const post = (path, body, label) => {
    if (busy) return;
    setBusy(label);
    setSaid(null);
    fetch(url(path), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
      .then((response) => response.json())
      .then((result) => {
        setBusy(null);
        const stale = /no route \/api\/grade/.test(String(result.error || ""));
        const failed = Boolean(result.error) || !result.ok;
        setSaid(
          failed
            ? { error: true, text: stale ? "The harness was started before grading existed. Restart it, then try again." : result.error || result.output }
            : { error: false, text: String(result.output || "Done.").split("\n").filter((line) => !/^wrote /.test(line)).join(" ") },
        );
        setTick((value) => value + 1);
        props.onWrite();
      })
      .catch((error) => {
        setBusy(null);
        setSaid({ error: true, text: String(error) });
      });
  };

  const doc = state.value;
  const shell = (title, body, foot) =>
    ReactDOM.createPortal(
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
          { className: "pp-modal", role: "dialog", "aria-modal": "true", "aria-label": "Grade " + props.title },
          h(
            "div",
            { className: "pp-modalhead pp-ghead" },
            h("div", { className: "pp-modaltitle" }, title),
            doc && doc.items
              ? doc.items.map((item, index) =>
                  h(
                    "button",
                    {
                      type: "button",
                      key: item.item_id,
                      className: "pp-gq" + (index === at ? " pp-gq-on" : "") + (doc.rubric !== "accepted" && !item.criterion ? " pp-gq-missing" : ""),
                      title: doc.rubric !== "accepted" && !item.criterion ? "No rubric chosen for this question yet" : undefined,
                      onClick: () => {
                        setAt(index);
                        setFocus(0);
                      },
                    },
                    "Q" + (item.number || index + 1),
                    h("span", null, " " + item.counts.decided + "/" + item.counts.answers),
                  ),
                )
              : null,
            h("button", { type: "button", className: "pp-close", "aria-label": "Close", disabled: Boolean(busy), onClick: close }, "×"),
          ),
          said ? h("pre", { className: "pp-approveout pp-gsaid" + (said.error ? " pp-approveerr" : "") }, said.text) : null,
          body,
          foot ? h("div", { className: "pp-reviewfoot" }, foot) : null,
        ),
      ),
      document.body,
    );

  if (state.phase === "loading") return shell("Grade · " + props.title, h("div", { className: "pp-review" }, h(Message, null, "Reading the answers…")));
  if (doc.error) {
    return shell(
      "Grade · " + props.title,
      h(
        "div",
        { className: "pp-review" },
        h(Message, { error: true }, /no route \/api\/grade/.test(doc.error) ? "The harness was started before grading existed. Restart it to grade here." : doc.error),
      ),
    );
  }
  if (!doc.items.length) {
    return shell("Grade · " + props.title, h("div", { className: "pp-review" }, h(Message, null, "This assessment has no written questions to grade.")));
  }
  // The browser half is read when the page loads, the host half when the
  // harness starts: a page reloaded after an update meets an older host,
  // whose payload lacks what this view draws. Say so rather than fail.
  if (doc.items.some((entry) => !entry.marks || !entry.proposals)) {
    return shell(
      "Grade · " + props.title,
      h("div", { className: "pp-review" }, h(Message, { error: true }, "The harness is older than this view. Restart the harness, then open grading again.")),
    );
  }

  const item = doc.items[Math.min(at, doc.items.length - 1)];
  const who = (student) => (doc.names && doc.people[student] ? doc.people[student] + " · " + student : student);
  const pageUrl = (answer) =>
    url("/api/grade/page") + "&student=" + encodeURIComponent(answer.student) + "&page=" + encodeURIComponent(answer.page || 1) +
    (doc.names ? "&names=1" : "");
  const max = item.maximum_score;
  // The marks a button can give: the rubric's levels where there are
  // some, otherwise every whole mark — and halves on a short question,
  // where a half is how such a question is usually marked.
  const scale = item.criterion && item.criterion.levels.length
    ? item.criterion.levels.map((level) => level.score).sort((a, b) => a - b)
    : (() => {
        const step = max <= 4 ? 0.5 : 1;
        const out = [];
        for (let value = 0; value <= max + 1e-9; value += step) out.push(Math.round(value * 2) / 2);
        return out;
      })();
  const label = (value) => (Number.isInteger(value) ? String(value) : String(value).replace(/\.5$/, "½").replace(/^0½$/, "½"));
  const levelOf = (score) => (item.criterion ? item.criterion.levels.find((level) => level.score === score) : null);

  const guidance = item.marking_guidance
    ? h("details", { className: "pp-gguide" }, h("summary", null, "Marking guidance"), h("div", null, item.marking_guidance))
    : null;
  const question = h(
    "div",
    { className: "pp-gquestion" },
    h("b", null, "Q" + (item.number || at + 1) + ". "),
    item.prompt,
    h("span", { className: "pp-as" }, "  " + label(max) + " mark" + (max === 1 ? "" : "s")),
    guidance,
  );

  const answerText = (answer) =>
    answer.unread
      ? h("div", { className: "pp-gtext pp-gmuted" }, "Not read yet — the page is the only record of this answer.")
      : answer.blank
        ? h("div", { className: "pp-gtext pp-gmuted" }, "Nothing written.")
        : h("div", { className: "pp-gtext" }, answer.text);

  // Where this question stands. The rubric is accepted for the whole
  // assessment at once, but chosen question by question, so a question
  // with no criterion yet is "none" even while another is a draft.
  const itemState = !item.criterion ? "none" : doc.rubric === "accepted" ? "accepted" : "draft";
  const qName = "Q" + (item.number || at + 1);
  const without = doc.items.filter((entry) => !entry.criterion).map((entry, index) => "Q" + (entry.number || index + 1));

  // One line: the skill's "Where to start" maps it to §7, which holds the how.
  const ask = (several) =>
    "/import-assessment " + props.assessmentId + " " + props.runId + " — " + (several ? "propose the rubric" : "propose one rubric");

  // The proposed rubrics for this question, side by side: each one's levels
  // with how many answers it puts at each, and the mean it gives the class.
  const compare = () => {
    const answered = item.counts.answers - item.counts.unread - item.counts.blank;
    return h(
      "div",
      { className: "pp-gcompare" },
      item.proposals.map((proposal) => {
        const mine = item.chosen === proposal.id;
        const everywhere = doc.items.every((entry) => entry.proposals.some((other) => other.id === proposal.id));
        return h(
          "div",
          { className: "pp-gprop" + (mine ? " pp-gprop-on" : ""), key: proposal.id },
          h("div", { className: "pp-gprophead" }, h("b", null, proposal.title), mine ? h("span", { className: "pp-gstate" }, "in use") : null),
          proposal.summary ? h("div", { className: "pp-as" }, proposal.summary) : null,
          h(
            "div",
            { className: "pp-gmean" },
            proposal.spread.mean === null ? "nothing placed" : "class mean " + proposal.spread.mean + " / " + label(max),
            h("span", null, " · " + proposal.spread.placed + " of " + answered + " answers placed"),
          ),
          proposal.levels.map((level) => {
            const count = proposal.spread.at[String(level.score)] || 0;
            const names = item.groups.filter((group) => proposal.scores[group.index] === level.score);
            return h(
              "div",
              { className: "pp-gplevel", key: level.score },
              h(
                "div",
                { className: "pp-gplevelhead" },
                h("b", null, label(level.score)),
                h("span", { className: "pp-gbar" }, h("span", { style: { width: Math.round((count / Math.max(1, answered)) * 100) + "%" } })),
                h("span", { className: "pp-as" }, String(count)),
              ),
              h("div", { className: "pp-gpdesc" }, level.description),
              names.length
                ? h(
                    "div",
                    { className: "pp-gpgroups" },
                    names.map((group) =>
                      h(
                        "span",
                        { key: group.index, className: proposal.unsure.indexOf(group.index) !== -1 ? "pp-gpunsure" : "" },
                        group.label + " (" + group.count + ")",
                      ),
                    ),
                  )
                : null,
            );
          }),
          h(
            "div",
            { className: "pp-actions" },
            h(
              "button",
              {
                type: "button",
                className: mine ? "pp-segbtn" : "pp-primary",
                disabled: Boolean(busy) || item.counts.decided > 0,
                title: item.counts.decided ? qName + " already has marks decided against its rubric" : "Write this as " + qName + "'s rubric, as a draft to review",
                onClick: () => post("/api/grade/choose", { proposal: proposal.id, item: item.item_id }, "choose"),
              },
              busy === "choose" ? "Writing…" : mine ? "Use again for " + qName : "Use for " + qName,
            ),
            everywhere && doc.items.length > 1
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pp-segbtn",
                    disabled: Boolean(busy) || doc.items.some((entry) => entry.counts.decided > 0),
                    onClick: () => post("/api/grade/choose", { proposal: proposal.id }, "choose"),
                  },
                  "Use for every question",
                )
              : null,
          ),
        );
      }),
    );
  };

  // Accept rubric accepts the whole assessment's rubric, so while some
  // question has none the press waits — and this says so where it is
  // read, with the one press that usually settles it: the same proposal
  // for the rest.
  const missingBar = () => {
    const rest = doc.items.filter((entry) => !entry.criterion);
    const same = item.chosen
      ? item.proposals.find((proposal) => proposal.id === item.chosen)
      : null;
    const coversRest = same && rest.every((entry) => entry.proposals.some((proposal) => proposal.id === same.id));
    return h(
      "div",
      { className: "pp-gmissing" },
      h("span", null, without.join(", ") + (without.length === 1 ? " still needs" : " still need") + " a rubric before the quiz's rubric can be accepted."),
      coversRest
        ? h(
            "button",
            {
              type: "button",
              className: "pp-primary",
              disabled: Boolean(busy) || rest.some((entry) => entry.counts.decided > 0),
              onClick: () => post("/api/grade/choose", { proposal: same.id, items: rest.map((entry) => entry.item_id) }, "choose"),
            },
            busy === "choose" ? "Writing…" : "Use “" + same.title + "” for " + without.join(", "),
          )
        : null,
      rest.map((entry) =>
        h(
          "button",
          {
            type: "button",
            key: entry.item_id,
            className: "pp-segbtn",
            onClick: () => {
              setAt(doc.items.indexOf(entry));
              setFocus(0);
            },
          },
          "Choose for Q" + (entry.number || doc.items.indexOf(entry) + 1),
        ),
      ),
    );
  };

  // ----------------------------------------------------------- no rubric
  if (itemState === "none") {
    const proposed = item.proposals.length > 0;
    return shell(
      "Grade · " + props.title + (proposed ? " · choose a rubric" : " · no rubric yet"),
      h(
        "div",
        { className: "pp-review" },
        question,
        h(
          "div",
          { className: "pp-gnone" },
          h(
            "div",
            null,
            proposed
              ? item.proposals.length + " rubrics proposed for " + qName + " over the same groups of answers. Pick one to review; you accept it afterwards."
              : "Nothing to grade against yet. Group the answers and propose levels — or mark by points, without a rubric.",
          ),
          h(
            "div",
            { className: "pp-actions" },
            h(
              "button",
              { type: "button", className: proposed ? "pp-segbtn" : "pp-primary", disabled: Boolean(busy), onClick: () => { props.ask(ask(true)); close(); } },
              proposed ? "Ask for other rubrics" : "Ask the assistant to propose rubrics",
            ),
            !proposed
              ? h(
                  "button",
                  { type: "button", className: "pp-segbtn", disabled: Boolean(busy), onClick: () => { props.ask(ask(false)); close(); } },
                  "Just one rubric",
                )
              : null,
            doc.rubric === "none" && !doc.items.some((entry) => entry.criterion)
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pp-segbtn",
                    disabled: Boolean(busy),
                    title: "One criterion per question, worth its marks, accepted now — then 0…" + label(max) + " buttons on every answer",
                    onClick: () => post("/api/grade/points-only", {}, "points"),
                  },
                  busy === "points" ? "Writing…" : "Grade by points only",
                )
              : null,
          ),
        ),
        proposed ? compare() : null,
        !proposed
          ? [
              h("div", { className: "pp-reviewsec", key: "sec" }, "The answers", h("span", null, item.counts.answers - item.counts.unread - item.counts.blank + " written · " + item.counts.blank + " blank · " + item.counts.unread + " not read yet")),
              item.answers
                .filter((answer) => !answer.unread && !answer.blank)
                .map((answer) => h("div", { className: "pp-gplain", key: answer.student }, h("div", { className: "pp-gwho" }, who(answer.student)), answerText(answer))),
            ]
          : null,
      ),
    );
  }

  // ------------------------------------------------------------- rubric
  if (itemState === "draft") {
    const levels = item.criterion && item.criterion.levels.length
      ? item.criterion.levels
      : scale.slice().reverse().map((score) => ({ score: score, label: null, description: "" }));
    const placedAt = (score) => item.groups.filter((group) => group.score === score);
    const unplaced = item.groups.filter((group) => group.score === null || !levels.some((level) => level.score === group.score));
    const groupChip = (group) => {
      const open = openGroups[item.item_id + "|" + group.index];
      const members = item.answers.filter((answer) => answer.group === group.index);
      return h(
        "div",
        { className: "pp-ggroup" + (group.unsure ? " pp-ggroup-unsure" : ""), key: group.index },
        h(
          "div",
          { className: "pp-ggrouphead" },
          h(
            "button",
            {
              type: "button",
              className: "pp-glink",
              onClick: () => setOpenGroups((current) => Object.assign({}, current, { [item.item_id + "|" + group.index]: !open })),
            },
            (open ? "▾ " : "▸ ") + group.label,
          ),
          h("span", { className: "pp-as" }, group.count + (group.unsure ? " · unsure" : "")),
          h(
            "select",
            {
              "aria-label": "Move this group to a level",
              value: group.score === null ? "" : String(group.score),
              disabled: Boolean(busy),
              onChange: (event) =>
                post(
                  "/api/grade/move",
                  { item: item.item_id, group: group.index, score: event.target.value === "" ? null : Number(event.target.value) },
                  "move",
                ),
            },
            h("option", { value: "" }, "not placed"),
            levels.map((level) => h("option", { value: String(level.score), key: level.score }, label(level.score) + (level.label ? " · " + level.label : ""))),
          ),
        ),
        group.reason ? h("div", { className: "pp-as" }, group.reason) : null,
        open ? members.map((answer) => h("div", { className: "pp-gplain", key: answer.student }, answerText(answer))) : null,
      );
    };
    return shell(
      "Grade · " + props.title + " · rubric proposed",
      h(
        "div",
        { className: "pp-review" },
        question,
        item.proposals.length
          ? h(
              "div",
              { className: "pp-gfrom" },
              item.chosen
                ? "Taken from the proposal “" + ((item.proposals.find((proposal) => proposal.id === item.chosen) || {}).title || item.chosen) + "”. "
                : "",
              h(
                "button",
                { type: "button", className: "pp-segbtn", onClick: () => setComparing(!comparing) },
                comparing ? "Hide the proposals" : "Compare the " + item.proposals.length + " proposals",
              ),
            )
          : null,
        comparing && item.proposals.length ? compare() : null,
        without.length ? missingBar() : null,
        !doc.grouped
          ? h(Message, null, "The levels are written, and the answers are not grouped yet. Ask the assistant to group them, or accept the rubric and grade each answer yourself.")
          : null,
        levels.map((level) =>
          h(
            "div",
            { className: "pp-glevel", key: level.score },
            h(
              "div",
              { className: "pp-glevelhead" },
              h("b", null, label(level.score)),
              h("span", null, level.description || (level.label || "")),
              h("span", { className: "pp-as" }, placedAt(level.score).reduce((sum, group) => sum + group.count, 0) + " answers"),
            ),
            placedAt(level.score).map(groupChip),
          ),
        ),
        unplaced.length
          ? h("div", { className: "pp-glevel" }, h("div", { className: "pp-glevelhead" }, h("b", null, "?"), h("span", null, "Not placed at a level")), unplaced.map(groupChip))
          : null,
        item.counts.ungrouped
          ? h(Message, null, item.counts.ungrouped + " answer(s) to this question are in no group; they are graded one by one once the rubric is accepted.")
          : null,
        doc.group_problems.length ? h(Message, { error: true }, doc.group_problems.join("; ")) : null,
      ),
      [
        h(
          "span",
          { className: "pp-as", key: "hint" },
          without.length
            ? without.join(", ") + (without.length === 1 ? " has" : " have") + " no rubric yet — choose one there before accepting."
            : "Accepting the rubric accepts it for every question of " + props.title + ". Change a level's wording in chat.",
        ),
        h(
          "button",
          {
            type: "button",
            key: "accept",
            className: "pp-primary",
            disabled: Boolean(busy) || without.length > 0,
            onClick: () => post("/api/grade/accept-rubric", {}, "accept"),
          },
          busy === "accept" ? "Accepting…" : "Accept rubric",
        ),
      ],
    );
  }

  // -------------------------------------------------------------- grade
  const decide = (list, via, labelText) =>
    post(
      "/api/grade/decide",
      {
        via: via,
        decisions: list.map((entry) =>
          Object.assign({ item: entry.item || item.item_id, student: entry.student, score: entry.score }, notes[entry.student + "|" + (entry.item || item.item_id)] ? { comment: notes[entry.student + "|" + (entry.item || item.item_id)] } : {}),
        ),
      },
      labelText,
    );
  const waiting = (answers) => answers.filter((answer) => !answer.decision && answer.suggestion);
  // A decided mark the rubric, as it now stands, would suggest differently.
  const disagrees = (answer) => answer.decision && answer.now !== null && answer.now !== answer.decision.score;
  const sections = [];
  item.groups.forEach((group) =>
    sections.push({
      key: "g" + group.index,
      title: group.label,
      score: group.score,
      unsure: group.unsure,
      answers: item.answers.filter((answer) => answer.group === group.index && !answer.blank && !answer.unread),
    }),
  );
  sections.push({
    key: "none",
    title: item.groups.length ? "In no group" : "Answers",
    score: null,
    answers: item.answers.filter((answer) => answer.group === null && !answer.blank && !answer.unread),
  });
  sections.push({ key: "blank", title: "Blank", score: 0, answers: item.answers.filter((answer) => answer.blank) });
  sections.push({ key: "unread", title: "Not read yet — read the page, or run `scans read`", score: null, answers: item.answers.filter((answer) => answer.unread) });
  const visible = sections.filter((section) => section.answers.length);
  const order = [].concat.apply([], visible.map((section) => section.answers));
  const current = Math.min(focus, Math.max(0, order.length - 1));

  // The mark an answer stands at, as a badge you can read across the room:
  // green once decided, grey while it is only the suggestion.
  const badge = (answer) => {
    const decided = answer.decision ? answer.decision.score : null;
    const suggested = answer.suggestion ? answer.suggestion.score : null;
    const value = decided !== null ? decided : suggested;
    return h(
      "div",
      { className: "pp-gmark" + (decided !== null ? " pp-gmark-done" : value !== null ? " pp-gmark-sug" : " pp-gmark-none") },
      h("b", null, value === null ? "—" : label(value)),
      h("span", null, decided !== null ? "of " + label(max) + " ✓" : value !== null ? "suggested" : "no mark"),
    );
  };

  const card = (answer) => {
    const index = order.indexOf(answer);
    const decided = answer.decision ? answer.decision.score : null;
    const suggested = answer.suggestion ? answer.suggestion.score : null;
    const key = answer.student + "|" + item.item_id;
    return h(
      "div",
      {
        key: answer.student,
        className: "pp-gcard" + (index === current ? " pp-focus" : "") + (decided !== null ? " pp-gcard-done" : ""),
        tabIndex: 0,
        onFocus: () => setFocus(index),
        onMouseDown: () => setFocus(index),
      },
      badge(answer),
      h(
        "div",
        { className: "pp-gbody" },
        h("div", { className: "pp-gwho" }, who(answer.student), answer.page ? h("span", null, " · p." + answer.page) : null),
        answerText(answer),
        answer.confidence && answer.confidence !== "high" || answer.note
          ? h(
              "div",
              { className: "pp-gnote" + (answer.confidence === "low" ? " pp-glow" : "") },
              (answer.confidence && answer.confidence !== "high" ? answer.confidence + " confidence" : "") +
                (answer.note ? (answer.confidence && answer.confidence !== "high" ? " · " : "") + answer.note : ""),
            )
          : null,
        answer.suggestion && answer.suggestion.source === "grader" && answer.suggestion.comment
          ? h("div", { className: "pp-as" }, "Suggested " + label(answer.suggestion.score) + ": " + answer.suggestion.comment)
          : null,
        disagrees(answer)
          ? h(
              "div",
              { className: "pp-gdisagree" },
              "The rubric now suggests " + label(answer.now) + ". ",
              h(
                "button",
                { type: "button", className: "pp-segbtn", disabled: Boolean(busy), onClick: () => decide([{ student: answer.student, score: answer.now }], "one", "one") },
                "Give " + label(answer.now),
              ),
              h("span", { className: "pp-as" }, " or keep " + label(decided)),
            )
          : null,
        h(
          "div",
          { className: "pp-gbtns" },
          scale.map((value) =>
            h(
              "button",
              {
                type: "button",
                key: value,
                className: "pp-gscore" + (decided === value ? " pp-gscore-on" : decided === null && suggested === value ? " pp-gscore-next" : ""),
                title: (levelOf(value) ? levelOf(value).description + " — " : "") + "give " + label(value),
                disabled: Boolean(busy),
                onClick: () => decide([{ student: answer.student, score: value }], "one", "one"),
              },
              label(value),
            ),
          ),
          h("input", {
            className: "pp-gcomment",
            placeholder: answer.decision && answer.decision.comment ? answer.decision.comment : "comment",
            value: notes[key] || "",
            onChange: (event) => {
              const text = event.target.value;
              setNotes((current) => Object.assign({}, current, { [key]: text }));
            },
            onKeyDown: (event) => {
              if (event.key === "Enter" && (decided !== null || suggested !== null)) {
                decide([{ student: answer.student, score: decided !== null ? decided : suggested }], "one", "one");
              }
              event.stopPropagation();
            },
          }),
          answer.history ? h("span", { className: "pp-as" }, "changed " + answer.history + "×") : null,
        ),
      ),
    );
  };

  const onKey = (event) => {
    if (event.target.tagName === "SELECT" || event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA" || busy) return;
    const answer = order[current];
    // After a mark, on to the next answer nobody has decided — the one
    // that still needs reading — or simply the next if none is left.
    const onward = () => {
      const later = order.findIndex((entry, index) => index > current && !entry.decision);
      setFocus(later === -1 ? Math.min(current + 1, order.length - 1) : later);
    };
    if (event.key === "j" || event.key === "ArrowDown") {
      setFocus(Math.min(current + 1, order.length - 1));
      event.preventDefault();
    } else if (event.key === "k" || event.key === "ArrowUp") {
      setFocus(Math.max(current - 1, 0));
      event.preventDefault();
    } else if (answer && event.key === "Enter") {
      // Enter takes the suggestion on an undecided answer only. On one
      // already decided it moves on: a decision is changed by pressing a
      // mark, never by the key that means "agree".
      if (!answer.decision && answer.suggestion) decide([{ student: answer.student, score: answer.suggestion.score }], "one", "one");
      onward();
      event.preventDefault();
    } else if (answer && /^[0-9]$/.test(event.key) && scale.indexOf(Number(event.key)) !== -1) {
      decide([{ student: answer.student, score: Number(event.key) }], "one", "one");
      onward();
      event.preventDefault();
    }
  };

  const allHere = waiting(item.answers);
  const allEverywhere = [].concat.apply(
    [],
    doc.items.map((entry) => waiting(entry.answers).map((answer) => ({ item: entry.item_id, student: answer.student, score: answer.suggestion.score }))),
  );
  const disagreeing = item.answers.filter(disagrees);

  // Where the question stands: per mark, how many answers sit there —
  // decided in green, still only suggested in grey — and the mean.
  const marksKeys = scale.slice().reverse().filter((value) => item.marks.at[String(value)] || (item.criterion && item.criterion.levels.some((level) => level.score === value)));
  const answeredCount = Math.max(1, item.counts.answers - item.counts.unread);
  const picture = h(
    "div",
    { className: "pp-gpicture" },
    h(
      "div",
      { className: "pp-gpicturehead" },
      h("b", null, item.marks.mean === null ? "No marks yet" : "Mean " + item.marks.mean + " of " + label(max)),
      h("span", null, item.counts.decided + " of " + item.counts.answers + " decided" + (item.counts.unread ? " · " + item.counts.unread + " not read yet" : "")),
      disagreeing.length ? h("span", { className: "pp-gwarn" }, disagreeing.length + " decided mark(s) differ from the rubric now") : null,
      disagreeing.length
        ? h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              disabled: Boolean(busy),
              title: "Each keeps its old mark in its history",
              onClick: () => decide(disagreeing.map((answer) => ({ student: answer.student, score: answer.now })), "group", "remark"),
            },
            busy === "remark" ? "Re-marking…" : "Re-mark all " + disagreeing.length + " at the rubric's suggestion",
          )
        : null,
    ),
    marksKeys.map((value) => {
      const slot = item.marks.at[String(value)] || { decided: 0, suggested: 0 };
      const level = levelOf(value);
      return h(
        "div",
        { className: "pp-gdist", key: value, title: level ? level.description : "" },
        h("b", null, label(value)),
        h(
          "span",
          { className: "pp-gdistbar" },
          h("span", { className: "pp-gdist-done", style: { width: (slot.decided / answeredCount) * 100 + "%" } }),
          h("span", { className: "pp-gdist-sug", style: { width: (slot.suggested / answeredCount) * 100 + "%" } }),
        ),
        h("span", { className: "pp-gdistn" }, String(slot.decided + slot.suggested)),
      );
    }),
  );

  // The rubric, open while grading. Moving a group re-suggests every
  // answer in it at once; another proposal — the one the assistant wrote
  // after "rethink" — shows what it would change before it is used.
  const levelsNow = item.criterion && item.criterion.levels.length
    ? item.criterion.levels
    : scale.slice().reverse().map((score) => ({ score: score, label: null, description: "" }));
  const others = item.proposals.filter((proposal) => proposal.id !== item.chosen);
  const nextRev = "rev-" + (doc.proposals.filter((proposal) => /^rev-\d+$/.test(proposal.id)).length + 1);
  // The professor's words, and what the skill needs to place them: which
  // question, and the id the Grade view will look for. The how is §7's.
  const rethinkPrompt = (text) =>
    "/import-assessment " + props.assessmentId + " " + props.runId + " — rethink the rubric for " + qName +
    " (" + item.item_id + ") as `" + nextRev + "`: " + text.trim();
  const rubricPanel = h(
    "div",
    { className: "pp-grubric" },
    h(
      "div",
      { className: "pp-grubrichead" },
      h("b", null, "Rubric for " + qName),
      item.chosen ? h("span", { className: "pp-as" }, "from “" + ((item.proposals.find((proposal) => proposal.id === item.chosen) || {}).title || item.chosen) + "”") : null,
    ),
    levelsNow.map((level) => {
      const here = item.groups.filter((group) => group.score === level.score);
      return h(
        "div",
        { className: "pp-grlevel", key: level.score },
        h("div", { className: "pp-grlevelhead" }, h("b", null, label(level.score)), h("span", null, level.description)),
        here.map((group) =>
          h(
            "div",
            { className: "pp-grgroup", key: group.index },
            h("span", { className: "pp-grgroupname" }, group.label, group.unsure ? h("i", null, " unsure") : null),
            h("span", { className: "pp-as" }, String(group.count)),
            h(
              "select",
              {
                "aria-label": "Move " + group.label + " to another mark",
                value: group.score === null ? "" : String(group.score),
                disabled: Boolean(busy),
                onChange: (event) =>
                  post("/api/grade/move", { item: item.item_id, group: group.index, score: event.target.value === "" ? null : Number(event.target.value) }, "move"),
              },
              h("option", { value: "" }, "no mark"),
              levelsNow.map((option) => h("option", { value: String(option.score), key: option.score }, "→ " + label(option.score))),
            ),
          ),
        ),
      );
    }),
    others.map((proposal) => {
      const effect = proposal.effect;
      const nameOf = (index) => (item.groups[index] ? item.groups[index].label : "group " + (index + 1));
      return h(
        "div",
        { className: "pp-grother", key: proposal.id },
        h("div", { className: "pp-grubrichead" }, h("b", null, proposal.title), h("span", { className: "pp-as" }, "mean " + (proposal.spread.mean === null ? "—" : proposal.spread.mean))),
        proposal.summary ? h("div", { className: "pp-as" }, proposal.summary) : null,
        effect.moves.length
          ? h(
              "ul",
              { className: "pp-grmoves" },
              effect.moves.map((move) =>
                h("li", { key: move.group }, nameOf(move.group) + ": " + (move.from === null ? "—" : label(move.from)) + " → " + (move.to === null ? "—" : label(move.to)) + " (" + move.count + ")"),
              ),
            )
          : h("div", { className: "pp-as" }, "Changes no suggestion."),
        h(
          "div",
          { className: "pp-actions" },
          h(
            "button",
            {
              type: "button",
              className: "pp-primary",
              disabled: Boolean(busy),
              title: "Write it as " + qName + "'s rubric, accepted. Marks already given stay; any it disagrees with are flagged.",
              onClick: () => post("/api/grade/choose", { proposal: proposal.id, item: item.item_id, keepMarks: true, accept: true }, "revise"),
            },
            busy === "revise" ? "Applying…" : "Use this",
          ),
          h(
            "span",
            { className: "pp-as" },
            effect.changes + " suggestion(s) change" + (effect.disagree ? " · " + effect.disagree + " of your marks would differ" : ""),
          ),
        ),
      );
    }),
    h(
      "div",
      { className: "pp-grethink" },
      h("textarea", {
        rows: 2,
        placeholder: "What should change? e.g. “morphology-only answers deserve the mark”, “half marks for a consequence without numbers”",
        value: notes["rethink|" + item.item_id] || "",
        onChange: (event) => {
          const text = event.target.value;
          setNotes((current) => Object.assign({}, current, { ["rethink|" + item.item_id]: text }));
        },
        onKeyDown: (event) => event.stopPropagation(),
      }),
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          disabled: !(notes["rethink|" + item.item_id] || "").trim(),
          onClick: () => {
            props.ask(rethinkPrompt(notes["rethink|" + item.item_id]));
            setNotes((current) => Object.assign({}, current, { ["rethink|" + item.item_id]: "" }));
            setSaid({ error: false, text: "Asked the assistant to rethink " + qName + ". Its revision appears here, under the rubric, as soon as it is written." });
          },
        },
        "Ask the assistant to rethink " + qName,
      ),
    ),
  );

  // The page of the answer in focus, at a size handwriting can be read at,
  // beside the list rather than shrunk into every card.
  const shown = order[current];
  const side = h(
    "div",
    { className: "pp-gside" },
    showRubric ? rubricPanel : null,
    shown && doc.pages
      ? [
          h("div", { className: "pp-gwho", key: "who" }, who(shown.student) + " · page " + (shown.page || 1) + " · press the page to enlarge"),
          h("img", {
            key: "page",
            src: pageUrl(shown),
            alt: "Page " + (shown.page || 1) + " of " + shown.student + "'s paper",
            title: "Enlarge",
            onClick: () => setBig(shown),
          }),
        ]
      : h(Message, null, doc.pages ? "Choose an answer to see its page." : "pdftoppm is not installed, so pages cannot be drawn."),
  );

  return shell(
    "Grade · " + props.title,
    h(
      "div",
      { className: "pp-gsplit" },
      h(
        "div",
        { className: "pp-review", onKeyDown: onKey },
        question,
        big ? h(GradePage, { src: pageUrl(big), onClose: () => setBig(null) }) : null,
        picture,
        h(
          "div",
          { className: "pp-actions", style: { marginBottom: "6px" } },
          h(
            "button",
            { type: "button", className: "pp-segbtn", onClick: () => setShowRubric(!showRubric) },
            showRubric ? "Hide the rubric" : "Rubric and rethink" + (others.length ? " · " + others.length + " other proposal(s)" : ""),
          ),
          h("span", { className: "pp-as" }, "decided as " + (doc.decided_by || "nobody — the run lists no instructor")),
        ),
        visible.map((section) => {
          const open = waiting(section.answers);
          return h(
            React.Fragment,
            { key: section.key },
            h(
              "div",
              { className: "pp-gsection" },
              section.score !== null && section.key !== "unread"
                ? h("span", { className: "pp-gsecmark" }, label(section.score))
                : h("span", { className: "pp-gsecmark pp-gsecmark-none" }, "—"),
              h("b", null, section.title),
              section.unsure ? h("i", null, "unsure") : null,
              h("span", { className: "pp-as" }, section.answers.length + " answer" + (section.answers.length === 1 ? "" : "s")),
              open.length && section.key !== "unread"
                ? h(
                    "button",
                    {
                      type: "button",
                      className: "pp-segbtn",
                      disabled: Boolean(busy),
                      onClick: () => decide(open.map((answer) => ({ student: answer.student, score: answer.suggestion.score })), "group", "group"),
                    },
                    busy === "group" ? "Accepting…" : "Accept " + open.length + " at " + label(open[0].suggestion.score),
                  )
                : null,
            ),
            section.answers.map(card),
          );
        }),
      ),
      side,
    ),
    [
      h(
        "span",
        { className: "pp-as", key: "hint" },
        busy ? "Writing…" : "j / k move · " + scale.filter((value) => Number.isInteger(value) && value < 10).join(" ") + " give a mark · Enter takes the suggestion · Esc closes",
      ),
      h(
        "button",
        {
          type: "button",
          key: "all-q",
          className: "pp-segbtn",
          disabled: Boolean(busy) || !allHere.length,
          onClick: () => decide(allHere.map((answer) => ({ student: answer.student, score: answer.suggestion.score })), "all", "all"),
        },
        "Accept all " + allHere.length + " for " + qName,
      ),
      h(
        "button",
        {
          type: "button",
          key: "all",
          className: "pp-primary",
          disabled: Boolean(busy) || !allEverywhere.length,
          onClick: () => decide(allEverywhere, "all", "all"),
        },
        busy === "all" ? "Accepting…" : "Accept all " + allEverywhere.length + " suggestions",
      ),
    ],
  );
}

/** One page of a paper, over the grading view: the handwriting at a readable size. */
function GradePage(props) {
  return ReactDOM.createPortal(
    h(
      "div",
      { className: "pp-veil pp-gbig", onMouseDown: props.onClose },
      h("img", { src: props.src, alt: "The page", className: "pp-gbigimg" }),
    ),
    document.body,
  );
}
