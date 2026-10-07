/**
 * The defence desk's stage: one big button that does what the moment calls
 * for, the live transcript under it, and everything else in a drawer.
 */

import { ListeningDots } from "./defence-dots.js";
import { ScreenRow } from "./defence-screen.js";
import {
  clock,
  ConsentPanel,
  GradeRow,
  ProposalPanel,
  QuestionItem,
  speakButtonFor,
  StartRow,
} from "./defence-views.js";
import { h, React } from "./react.js";

/*
 * The big button does the one thing the moment calls for: start, mark the
 * next question of a whole defence (as Space does), resume it, end a
 * hands-free answer, or ask a waiting proposal now — `desk.bigPress`. The
 * other controls of the moment sit in one row beside it — Pause, Stop, Skip,
 * hold to speak — and, at rest, the choice of mode.
 */
export function DefenceStage(props) {
  const desk = props.desk;
  const data = desk.data;
  const recording = desk.recording;
  const handsFree = desk.handsFree;
  const proposal = desk.proposal;
  const captions = desk.captions;
  const splitting = desk.splitting;
  const wholeMarks = desk.wholeMarks;
  const consented = desk.consented;
  const mode = desk.mode;

  const wholeRec = Boolean(recording && recording.question === "Q0");
  const stagePhase = proposal
    ? "proposing"
    : handsFree
      ? handsFree.phase
      : recording
        ? recording.paused
          ? "idle"
          : desk.professorTalking
            ? "professor"
            : desk.manualLevel > 0.02
              ? "speaking"
              : "waiting"
        : splitting
          ? "thinking"
          : "idle";
  const stageQuestionId = handsFree && handsFree.question ? handsFree.question : recording ? recording.question : null;
  const bigLabel =
    !consented
      ? "Consent first"
      : proposal
        ? "Ask now"
        : stagePhase === "thinking" && handsFree
          ? "Choosing…"
          : stagePhase === "reading"
            ? "Reading aloud"
            : wholeRec
              ? recording.paused
                ? "Resume"
                : "Next question"
              : handsFree || recording
                ? "End answer"
                : desk.sending
                  ? "Transcribing…"
                  : splitting
                    ? "Dividing…"
                    : "Start";

  /** The row beside the big button: what else the moment allows. */
  const stageRow = () => {
    if (!consented) return null;
    if (wholeRec) {
      return h(
        React.Fragment,
        null,
        h("button", { type: "button", className: "pp-segbtn", onClick: recording.paused ? desk.resumeWhole : desk.pauseWhole }, recording.paused ? "Resume" : "Pause"),
        h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: desk.stop }, "■ Stop"),
        recording.paused ? null : speakButtonFor(desk),
      );
    }
    if (handsFree && !proposal && handsFree.phase !== "thinking") {
      return h(
        React.Fragment,
        null,
        h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.endTake("skip") }, "Skip"),
        h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: () => desk.endTake("pause") }, "Pause"),
        speakButtonFor(desk),
      );
    }
    if (recording) return speakButtonFor(desk);
    if (handsFree || proposal || desk.sending || splitting) return null;
    return h(
      "span",
      { className: "pp-approverow", role: "group", "aria-label": "Mode" },
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          "aria-pressed": mode === "whole",
          title: "One recording of the whole conversation, transcribed as it goes; divided into its questions afterwards.",
          onClick: () => desk.chooseMode("whole"),
        },
        "Whole defence",
      ),
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          "aria-pressed": mode === "questions",
          title: "Hands-free, one take per question: an answer ends after a pause, and the next question comes up by itself.",
          onClick: () => desk.chooseMode("questions"),
        },
        "Question by question",
      ),
    );
  };

  const questions = (data && data.questions) || [];
  const entry = stageQuestionId ? questions.find((q) => q.id === stageQuestionId) : null;
  const lastId = captions && captions.question;
  const last = lastId ? questions.find((q) => q.id === lastId) : null;
  // Once nothing records, the last words stay under a heading that says
  // whose they were, dimmed, until the next take begins.
  const shown = entry || last;
  const pickedMark = wholeRec && wholeMarks.length ? wholeMarks[wholeMarks.length - 1] : null;
  const picked = pickedMark && pickedMark.question_id ? questions.find((q) => q.id === pickedMark.question_id) : null;
  const latestSplit = ((data && data.splits) || []).filter((entry) => entry.question_id === "Q0").slice(-1)[0] || null;
  const heading = wholeRec
    ? "The whole defence" + (recording.paused ? " · paused" : "") + (wholeMarks.length ? " · question " + (wholeMarks.length + 1) + (picked ? " (" + picked.id + ")" : "") : "")
    : splitting
      ? "Dividing the defence into its questions…"
      : entry
        ? entry.id + (entry.follows ? " · follow-up on " + entry.follows : "") + (entry.criterion_id ? " · " + ((data.criteria || []).find((c) => c.id === entry.criterion_id) || {}).title : "")
        : shown
          ? shown.kind === "whole"
            ? "The whole defence, recorded"
            : shown.id + " answered"
          : consented
            ? "Ready"
            : "Before anything is recorded";
  const words = captions && (!stageQuestionId || captions.question === stageQuestionId) ? captions : null;
  // The stage shows the latest words, to glance at; all of them are in
  // the drawer and, once it ends, in the take's transcript.
  const heardWords = words ? words.pieces.slice(words.from || 0).map((piece) => piece.text).join(" ").split(/\s+/).filter(Boolean) : [];
  const spoken = heardWords.length > 80 ? ["…"].concat(heardWords.slice(-80)) : heardWords;
  const live = stagePhase === "waiting" || stagePhase === "speaking" || stagePhase === "professor";
  const stale = Boolean(words && !recording && !handsFree);
  return h(
    "div",
    { className: "pp-stage" },
    h(
      "div",
      { className: "pp-stagefg" },
      h(
        "div",
        { className: "pp-stageq" },
        h("b", null, heading.replace(/ · undefined$/, "")),
        picked
          ? h("div", null, picked.text)
          : entry && entry.kind !== "whole"
            ? h("div", null, entry.text)
            : !consented
              ? h("div", null, "Open the drawer: the student agrees first.")
              : !recording && !handsFree && !shown
                ? h(
                    "div",
                    null,
                    mode === "whole"
                      ? "One recording of the whole defence, transcribed as you talk. Press Space at each new question; it is divided into its questions afterwards."
                      : "Hands-free, one question at a time: an answer ends after a pause, and the next question comes up.",
                  )
                : null,
      ),
      h(
        "button",
        {
          type: "button",
          className: "pp-stagebtn" + (live ? " pp-stagelive" : ""),
          onClick: desk.bigPress,
          "aria-label": bigLabel,
        },
        h(ListeningDots, { phase: stagePhase, level: handsFree ? handsFree.level : desk.manualLevel, size: 130, className: "pp-stagedots" }),
        h("span", { className: "pp-stagebtnlabel" }, bigLabel + (recording ? " · " + clock(desk.elapsed) : "")),
      ),
      h("div", { className: "pp-approverow pp-stagerow" }, stageRow()),
      h(
        "div",
        { className: "pp-stagetr" + (stale ? " pp-stagetrold" : ""), "aria-live": "polite" },
        words && (spoken.length || words.partial)
          ? h(
              React.Fragment,
              null,
              spoken.join(" "),
              words.partial ? h("span", { className: "pp-dpartial" }, " " + words.partial) : null,
            )
          : h(
              "span",
              { className: "pp-dpartial" },
              recording && recording.paused
                ? "Paused — nothing is recorded or sent until you resume."
                : live
                  ? desk.liveCaptions
                    ? wholeRec
                      ? "Listening — what is said appears here as it is said."
                      : "Listening — the student's words appear here as they speak."
                    : "Live captions are off."
                  : "The transcript appears here as the student speaks.",
            ),
      ),
      h(
        "div",
        { className: "pp-dim" },
        stagePhase === "professor"
          ? "You are speaking — not the answer"
          : handsFree && handsFree.phase === "speaking" && handsFree.silent
            ? "pause " + (handsFree.silent / 1000).toFixed(1) + " s — the answer ends at 2.5 s"
            : splitting
              ? "The session's model is reading the dialogue, your presses as hints."
              : stagePhase === "thinking"
                ? "Transcribing and choosing what to ask next…"
                : proposal
                  ? "The next question is waiting in the drawer"
                  : wholeRec && live
                    ? "Space: a new question · Hold P to speak · Asking this, in the drawer, names a prepared one"
                    : live
                      ? "Hold P to speak · Space ends the answer"
                      : desk.sending
                        ? "Transcribing the recording…"
                        : !recording && !handsFree && latestSplit && mode === "whole"
                          ? "Divided into " + latestSplit.parts.length + " question(s)" + (latestSplit.approval === "approved" ? ", checked" : " — check them in the drawer")
                          : "",
      ),
    ),
    h(
      "div",
      { className: "pp-drawer" },
      h(
        "div",
        { className: "pp-drawerhead" },
        h(
          "button",
          { type: "button", className: "pp-segbtn", "aria-expanded": desk.drawer, onClick: () => desk.setDrawer(!desk.drawer) },
          (desk.drawer ? "▾ " : "▴ ") + "Questions and controls",
        ),
        desk.pending > 0 ? h("span", { className: "pp-dim" }, desk.pending + " recording(s) transcribing…") : null,
      ),
      desk.drawer
        ? h(
            "div",
            { className: "pp-drawerbody" },
            proposal ? h("div", { className: "pp-dhands" }, h(ProposalPanel, { desk })) : null,
            h(ConsentPanel, { desk }),
            h(ScreenRow, desk.screenProps),
            consented && !handsFree && !recording ? h(StartRow, { desk }) : null,
            h(GradeRow, { desk }),
            desk.said ? h("div", { className: desk.said.error ? "pp-dwarn" : "pp-dim" }, desk.said.text) : null,
            h("ol", { className: "pp-dlist" }, questions.map((entry) => h(QuestionItem, { key: entry.id, desk, entry }))),
          )
        : null,
    ),
  );
}
