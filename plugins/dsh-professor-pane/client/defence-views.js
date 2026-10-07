/**
 * The defence desk's views: what it draws, and nothing it decides.
 *
 * Each takes `desk`, the object `DefenceDesk` builds every render from its
 * state and its actions — what the session holds, what is recording, and the
 * presses that change it. One object rather than a dozen props each, because
 * the desk is one conversation and almost every view reads half of it; what a
 * view may do is still only what the desk hands it. None of these keeps state
 * of its own.
 */

import { CaptionsLine } from "./defence-captions.js";
import { ListeningDots } from "./defence-dots.js";
import { SpeakButton } from "./defence-marks.js";
import { h, React } from "./react.js";

/** Seconds as m:ss. */
export const clock = (seconds) => Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");

/** An ISO time as hh:mm, or as given if it is not one. */
const clockTime = (iso) => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? iso : String(at.getHours()).padStart(2, "0") + ":" + String(at.getMinutes()).padStart(2, "0");
};

/** Hold to speak, wired to the desk's marks. */
export const speakButtonFor = (desk) =>
  h(SpeakButton, { talking: desk.professorTalking, onDown: desk.speakDown, onUp: desk.speakUp });

/** One take of an answer: its recording, whose words, and — for a whole defence — its parts. */
function TakeView(props) {
  const desk = props.desk;
  const answer = props.answer;
  return h(
    "div",
    { className: "pp-dtake" },
    h(
      "div",
      { className: "pp-dtakehead" },
      "Take " + answer.take + (answer.seconds ? " · " + clock(answer.seconds) : ""),
      h("audio", {
        id: "pp-daudio-" + answer.audio.replace(/[^\w-]/g, "_"),
        controls: true,
        preload: "none",
        src: desk.endpoint("/api/defence/audio", "&file=" + encodeURIComponent(answer.audio)),
      }),
    ),
    // Whose words: the professor's are marked and dimmed, another voice
    // likewise, and a take whose voices could not be told apart says so
    // above its words — it is kept, and never cited as the answer.
    answer.transcript && answer.transcript.speakers && answer.transcript.speakers.unclear
      ? h("div", { className: "pp-dwarn" }, "Voices unclear — not cited as the student's: " + (answer.transcript.speakers.note || ""))
      : null,
    h(VoicePicker, { desk, answer }),
    answer.transcript
      ? h(
          "div",
          { className: "pp-dtranscript" },
          answer.transcript.segments.map((segment, index) => {
            const other = segment.speaker === "professor" ? "You: " : segment.speaker === "unknown" ? "Other voice: " : "";
            return h(
              "span",
              {
                key: index,
                className: (other ? "pp-dother " : "") + (segment.confidence === "low" ? "pp-dlow" : ""),
                title: clock(segment.start) + (segment.confidence === "low" ? " · low confidence — listen to it" : ""),
              },
              other ? h("b", null, other) : null,
              segment.text + " ",
            );
          }),
          answer.transcript.timed ? null : h("span", { className: "pp-dim" }, " (no timestamps from this model)"),
        )
      : h("div", { className: "pp-dim" }, answer.error ? "Not transcribed: " + answer.error : "Transcribing…"),
    answer.question_id === "Q0" ? h(SplitView, { desk, answer }) : null,
  );
}

/*
 * AGT-11: the whole defence divided into its questions, under its
 * recording. Each part says when it starts — pressing the time plays
 * from there — what was asked and which criterion its answer counts
 * for. A draft until the professor says the parts are right.
 */
function SplitView(props) {
  const desk = props.desk;
  const answer = props.answer;
  const splitting = desk.splitting;
  if (!answer.transcript || answer.withdrawn) return null;
  const found = ((desk.data && desk.data.splits) || []).find((entry) => entry.question_id === answer.question_id && entry.take === answer.take);
  const busyHere = splitting && splitting.question === answer.question_id && splitting.take === answer.take;
  const play = (seconds) => {
    const audio = document.getElementById("pp-daudio-" + answer.audio.replace(/[^\w-]/g, "_"));
    if (!audio) return;
    audio.currentTime = seconds;
    audio.play().catch(() => {});
  };
  return h(
    "div",
    { className: "pp-dsplit" },
    busyHere
      ? h("div", { className: "pp-dim" }, "Dividing the defence into its questions…")
      : found
        ? h(
            React.Fragment,
            null,
            h(
              "div",
              { className: "pp-dim" },
              found.parts.length + " question(s), divided by " + found.by + (found.approval === "approved" ? " · you checked them" : " · a draft: check the parts"),
            ),
            h(
              "ol",
              { className: "pp-dsplitlist" },
              found.parts.map((part, index) =>
                h(
                  "li",
                  { key: index },
                  h("button", { type: "button", className: "pp-dsplitat", title: "Play from here", onClick: () => play(part.start) }, clock(part.start)),
                  " ",
                  part.question_id ? h("b", null, part.question_id + " ") : h("span", { className: "pp-dim" }, "not prepared · "),
                  part.asked,
                  part.criterion_id ? h("span", { className: "pp-dim" }, " · " + (desk.criteria.get(part.criterion_id) || part.criterion_id)) : null,
                ),
              ),
            ),
            found.notes && found.notes.length ? h("div", { className: "pp-dwarn" }, found.notes.join(" · ")) : null,
            h(
              "div",
              { className: "pp-approverow" },
              found.approval !== "approved"
                ? h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.split(answer.question_id, answer.take, "approve") }, "These are right")
                : null,
              h("button", { type: "button", className: "pp-segbtn", disabled: Boolean(splitting), onClick: () => desk.split(answer.question_id, answer.take) }, "Divide again"),
            ),
          )
        : h(
            "div",
            { className: "pp-approverow" },
            h("button", { type: "button", className: "pp-segbtn", disabled: Boolean(splitting), onClick: () => desk.split(answer.question_id, answer.take) }, "Divide into questions"),
            h("span", { className: "pp-dim" }, "the session's model reads the dialogue, your presses as hints; nothing is graded"),
          ),
  );
}

/*
 * "This voice is me". Offered on a take whose voices were separated but
 * not settled — a whole defence always, an ordinary take when two voices
 * spoke about as much — and on one already settled, to correct it. Each
 * voice is shown by the first thing it said, which is how a professor
 * recognises their own question.
 */
function VoicePicker(props) {
  const answer = props.answer;
  const transcript = answer.transcript;
  if (!transcript) return null;
  const voices = [];
  for (const segment of transcript.segments) {
    if (!segment.speaker_id || voices.some((voice) => voice.id === segment.speaker_id)) continue;
    voices.push({ id: segment.speaker_id, first: segment.text });
  }
  const settled = transcript.speakers && transcript.speakers.professor_voices;
  if (voices.length < 2 || (!transcript.speakers.unclear && !settled)) return null;
  return h(
    "div",
    { className: "pp-approverow pp-dvoices" },
    h("span", { className: "pp-dim" }, settled ? "Your voice:" : "Which voice is yours?"),
    voices.map((voice) =>
      h(
        "button",
        {
          type: "button",
          key: voice.id,
          className: "pp-segbtn",
          "aria-pressed": !!settled && settled.includes(voice.id),
          title: voice.id,
          onClick: () => props.desk.assignVoice(answer, voice.id),
        },
        "“" + (voice.first.length > 48 ? voice.first.slice(0, 46) + "…" : voice.first) + "” is me",
      ),
    ),
  );
}

/*
 * AGT-7: consent. Nothing records until the professor confirms the student
 * agreed to the statement the server wrote from the provider in use; the
 * server refuses a take without it.
 */
export function ConsentPanel(props) {
  const desk = props.desk;
  const previous = desk.data.consent;
  if (desk.consented) {
    return h(
      "div",
      { className: "pp-approverow" },
      h("span", { className: "pp-dim", title: previous.statement }, "The student agreed to be recorded at " + clockTime(previous.at) + "."),
      desk.confirmWithdraw
        ? h(
            React.Fragment,
            null,
            h("button", { type: "button", className: "pp-segbtn pp-drec", disabled: desk.consentBusy, onClick: desk.withdraw }, "Stop and record the withdrawal"),
            h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.setConfirmWithdraw(false) }, "Cancel"),
          )
        : h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.setConfirmWithdraw(true) }, "The student withdraws"),
    );
  }
  return h(
    "div",
    { className: "pp-dconsent" },
    h("b", null, previous && previous.withdrawn_at ? "The student withdrew at " + clockTime(previous.withdrawn_at) + "." : "Before anything is recorded"),
    previous && previous.withdrawn_at
      ? h("div", { className: "pp-dim" }, "Nothing more is recorded. The takes before it are kept and marked withdrawn, so nothing cites them; deleting them is your decision.")
      : h(
          React.Fragment,
          null,
          h("div", null, "Read this to the student, or let them read it on their screen:"),
          h("blockquote", { className: "pp-dstatement" }, desk.data.statement),
          previous && !previous.agreed
            ? h("div", { className: "pp-dwarn" }, "At " + clockTime(previous.at) + " the student did not agree. Nothing is recorded unless they agree now.")
            : null,
          h(
            "div",
            { className: "pp-approverow" },
            h("button", { type: "button", className: "pp-segbtn pp-drec", disabled: desk.consentBusy, onClick: () => desk.answerConsent("agree") }, "The student agreed"),
            h("button", { type: "button", className: "pp-segbtn", disabled: desk.consentBusy, onClick: () => desk.answerConsent("decline") }, "The student did not agree"),
          ),
        ),
  );
}

/**
 * DEF-5: once answers are in, the session's model proposes the marks, citing
 * the moments in the recording; the professor decides them in the grading
 * view like any other suggestion.
 */
export function GradeRow(props) {
  const desk = props.desk;
  const usable = ((desk.data && desk.data.answers) || []).filter((answer) => answer.transcript && !answer.withdrawn);
  if (!usable.length || desk.handsFree || desk.recording) return null;
  return h(
    "div",
    { className: "pp-approverow" },
    h("button", { type: "button", className: "pp-segbtn pp-chat", onClick: desk.proposeGrade }, "Propose the grade"),
    h(
      "span",
      { className: "pp-dim" },
      "the session's model reads what the student said and the code, and writes suggested marks citing the recording; you decide them",
    ),
  );
}

/** At rest: the two modes, each with its own start, and the desk's switches. */
export function StartRow(props) {
  const desk = props.desk;
  const mode = desk.mode;
  return h(
    "div",
    { className: "pp-approverow" },
    // AGT-11: the two modes, each with its own start; the whole defence first.
    h(
      "span",
      { className: "pp-approverow", role: "group", "aria-label": "Mode" },
      h("button", { type: "button", className: "pp-segbtn", "aria-pressed": mode === "whole", onClick: () => desk.chooseMode("whole") }, "Whole defence"),
      h("button", { type: "button", className: "pp-segbtn", "aria-pressed": mode === "questions", onClick: () => desk.chooseMode("questions") }, "Question by question"),
    ),
    mode === "whole"
      ? h(
          "button",
          {
            type: "button",
            className: "pp-segbtn pp-drec",
            disabled: Boolean(desk.recording || desk.sending),
            title: "One recording of the whole defence, transcribed as you talk. Press Space at each new question; the session's model divides it into its questions afterwards.",
            onClick: desk.recordWhole,
          },
          "● Record the whole defence",
        )
      : h(
          "button",
          {
            type: "button",
            className: "pp-segbtn pp-drec",
            disabled: Boolean(desk.recording || desk.sending),
            title: "Listens continuously: an answer ends after a pause of about two and a half seconds, and the next question comes up by itself.",
            onClick: desk.startHandsFree,
          },
          "● Start hands-free",
        ),
    mode === "questions"
      ? h(
          "label",
          { className: "pp-dim pp-dchooser" },
          h("input", { type: "checkbox", checked: desk.chooser, onChange: (event) => desk.setChooser(event.target.checked) }),
          " the session's model chooses each next question — a follow-up, or the next prepared one",
        )
      : null,
    h(
      "label",
      {
        className: "pp-dim pp-dchooser",
        title: "Every few seconds of speech is transcribed as it is said, through the same provider. Each answer is then transcribed twice: the captions are not kept.",
      },
      h("input", { type: "checkbox", checked: desk.liveCaptions, onChange: (event) => desk.setLiveCaptions(event.target.checked) }),
      " live captions while the student answers",
    ),
    desk.pending > 0 ? h("span", { className: "pp-dim" }, desk.pending + " answer(s) transcribing…") : null,
  );
}

/*
 * AGT-2 and AGT-3: the model's choice of what to ask next, waiting out its
 * five seconds. Ask now, Edit (change the words, then ask), Skip (the next
 * prepared question instead), Pause (stop; nothing is asked).
 */
export function ProposalPanel(props) {
  const desk = props.desk;
  const current = desk.proposal;
  const question = current.question;
  const left = Math.max(0, Math.ceil((current.deadline - desk.now) / 1000));
  const done = current.decision.action === "done" || !question;
  const notes = current.decision.notes || [];
  return h(
    "div",
    { className: "pp-dproposal" },
    h(
      "div",
      { className: "pp-dhandsline" },
      done
        ? h("b", null, "Done?")
        : h("b", null, question.id + (question.follows ? " ↳ follow-up on " + question.follows : "")),
      current.editing === null ? h("span", { className: "pp-dcount" }, done ? "finishing in " + left + " s" : "asking in " + left + " s") : null,
    ),
    done
      ? h("div", null, current.decision.why || "Nothing left to ask.")
      : current.editing !== null
        ? h("textarea", {
            className: "pp-dedit",
            value: current.editing,
            rows: 2,
            autoFocus: true,
            onChange: (event) => desk.setProposal(Object.assign({}, current, { editing: event.target.value })),
          })
        : h("div", { className: "pp-dqtext" }, question.text),
    !done && current.decision.why ? h("div", { className: "pp-dim" }, "Why: " + current.decision.why) : null,
    notes.length ? h("div", { className: "pp-dwarn" }, notes.join(" · ")) : null,
    h(
      "div",
      { className: "pp-dim" },
      "Chosen by " + current.decision.by + ".",
    ),
    h(
      "div",
      { className: "pp-approverow" },
      current.editing !== null
        ? h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: () => desk.settle("edit", current.editing) }, "Save and ask")
        : h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: () => desk.settle("ask_now") }, done ? "Finish now" : "Ask now"),
      !done && current.editing === null
        ? h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.setProposal(Object.assign({}, current, { editing: question.text })) }, "Edit")
        : null,
      !done ? h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.settle("skip") }, "Skip — next prepared question") : null,
      h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.settle("pause") }, "Pause"),
    ),
  );
}

/** Hands-free in the list view: the question being asked, the meter, and its controls. */
export function HandsPanel(props) {
  const desk = props.desk;
  return h(
    "div",
    { className: "pp-dhands pp-dhandsdots" },
    // One swarm for the whole defence, so it morphs between shapes
    // rather than starting over at each question.
    h(ListeningDots, { phase: desk.proposal ? "proposing" : desk.handsFree.phase, level: desk.handsFree.level }),
    h("div", { className: "pp-dhandsbody" }, h(HandsBody, { desk })),
  );
}

function HandsBody(props) {
  const desk = props.desk;
  const handsFree = desk.handsFree;
  const captions = desk.captions;
  return desk.proposal
    ? h(ProposalPanel, { desk })
    : handsFree.phase === "thinking" || handsFree.phase === "proposing"
      ? h(
          React.Fragment,
          null,
          h("div", { className: "pp-dhandsline" }, "Transcribing the answer and choosing what to ask next…"),
          captions ? h(CaptionsLine, { captions, question: captions.question }) : null,
        )
      : handsFree.phase === "reading"
      ? h("div", { className: "pp-dhandsline" }, h("b", null, handsFree.question), " · being read aloud on the student's screen — listening starts when it finishes")
      : h(
          React.Fragment,
          null,
          h(
            "div",
            { className: "pp-dhandsline" },
            h("b", null, handsFree.question),
            " · ",
            handsFree.phase === "professor"
              ? "you are speaking — the answer waits"
              : handsFree.phase === "speaking"
              ? handsFree.silent
                ? "pause " + (handsFree.silent / 1000).toFixed(1) + " s"
                : "hearing the answer"
              : "listening — waiting for the student to speak",
            h(
              "span",
              { className: "pp-dmeter", "aria-hidden": "true" },
              h("span", {
                className: "pp-dmeterfill" + (handsFree.level > handsFree.threshold ? " pp-dmeteron" : ""),
                style: { width: Math.min(100, Math.round(handsFree.level * 400)) + "%" },
              }),
            ),
          ),
          h(CaptionsLine, { captions, question: handsFree.question }),
          h(
            "div",
            { className: "pp-approverow" },
            h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.endTake("space") }, "End answer (Space)"),
            h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.endTake("skip") }, "Skip, no answer"),
            h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: () => desk.endTake("pause") }, "Pause"),
            speakButtonFor(desk),
          ),
          h(
            "div",
            { className: "pp-dim" },
            "Hold P (or the button) whenever you speak, so your words are not taken for the answer.",
          ),
        );
}

/**
 * A manual take in progress — one question, or the whole defence — with the
 * same dots as hands-free, following the level of the voice.
 */
export function RecordingPanel(props) {
  const desk = props.desk;
  const recording = desk.recording;
  const wholeMarks = desk.wholeMarks;
  const whole = recording.question === "Q0";
  const phase = desk.professorTalking ? "professor" : desk.manualLevel > 0.02 ? "speaking" : "waiting";
  return h(
    "div",
    { className: "pp-dhands pp-dhandsdots" },
    h(ListeningDots, { phase, level: desk.manualLevel }),
    h(
      "div",
      { className: "pp-dhandsbody" },
      h(
        "div",
        { className: "pp-dhandsline" },
        h("b", null, whole ? "The whole defence" + (wholeMarks.length ? " · question " + (wholeMarks.length + 1) : "") : recording.question),
        (recording.paused ? " · paused at " : " · recording ") + clock(desk.elapsed) + (phase === "speaking" ? " · hearing a voice" : phase === "professor" ? " · you are speaking" : ""),
      ),
      h(CaptionsLine, { captions: desk.captions, question: recording.question }),
      h(
        "div",
        { className: "pp-approverow" },
        whole && !recording.paused ? h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.markQuestion(null) }, "Next question (Space)") : null,
        whole ? h("button", { type: "button", className: "pp-segbtn", onClick: recording.paused ? desk.resumeWhole : desk.pauseWhole }, recording.paused ? "Resume" : "Pause") : null,
        h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: desk.stop }, "■ Stop"),
        speakButtonFor(desk),
      ),
      whole
        ? h(
            "div",
            { className: "pp-dim" },
            "Ask as you go. Press Space at each new question, or Asking this beside a prepared one — hints for dividing it afterwards. Hold P while you speak.",
          )
        : null,
    ),
  );
}

/** One question in the list: what it asks and why, its press, and its takes. */
export function QuestionItem(props) {
  const desk = props.desk;
  const entry = props.entry;
  const recording = desk.recording;
  const handsFree = desk.handsFree;
  const wholeMarks = desk.wholeMarks;
  const takes = desk.answers.filter((answer) => answer.question_id === entry.id);
  const live = (recording && recording.question === entry.id) || (handsFree && handsFree.question === entry.id);
  return h(
    "li",
    { className: "pp-dq" + (live ? " pp-dlive" : "") },
    h(
      "div",
      { className: "pp-dqtext" },
      h("b", null, entry.id + (entry.follows ? " ↳ " + entry.follows : "") + " "),
      entry.text,
    ),
    h(
      "div",
      { className: "pp-dim" },
      [
        entry.kind === "opening" ? "opening" : entry.kind === "follow_up" ? "follow-up" : null,
        entry.criterion_id ? desk.criteria.get(entry.criterion_id) || entry.criterion_id : null,
        (entry.evidence || []).map((cite) => cite.path + (cite.lines ? ":" + cite.lines : "")).join(", ") || null,
      ]
        .filter(Boolean)
        .join(" · "),
      entry.why ? h("div", null, entry.why) : null,
    ),
    h(
      "div",
      { className: "pp-approverow" },
      handsFree && handsFree.question === entry.id
        ? h("span", { className: "pp-drec pp-dlivemark" }, "● being asked — hands-free")
        : recording && recording.question === "Q0" && entry.kind !== "whole"
        ? // AGT-11: in a whole defence, say which prepared question you are asking.
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              "aria-pressed": wholeMarks.length > 0 && wholeMarks[wholeMarks.length - 1].question_id === entry.id,
              disabled: Boolean(recording.paused),
              onClick: () => desk.markQuestion(entry.id),
            },
            wholeMarks.some((mark) => mark.question_id === entry.id) ? "Asking this again" : "Asking this",
          )
        : live
        ? h(React.Fragment, null, h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: desk.stop }, "■ Stop · " + clock(desk.elapsed)), speakButtonFor(desk))
        : h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              disabled: Boolean(recording || desk.sending || handsFree || !desk.consented),
              onClick: () => desk.start(entry.id),
            },
            desk.sending === entry.id ? "Transcribing…" : takes.length ? "● Record again" : "● Record answer",
          ),
      takes.length
        ? h(
            "button",
            { type: "button", className: "pp-segbtn pp-chat", disabled: Boolean(recording || handsFree), onClick: () => desk.followUp(entry.id) },
            "Follow-up question",
          )
        : null,
    ),
    takes.map((answer) => h(TakeView, { key: answer.audio, desk, answer })),
  );
}
