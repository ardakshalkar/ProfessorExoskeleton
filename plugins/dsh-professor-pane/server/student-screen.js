/**
 * The student's screen for an oral defence (BACKLOG E26, AGT-4).
 *
 * A window the professor opens from the defence desk and drags onto the
 * projector or a second monitor. It shows the question being asked and
 * whether the desk is listening, and nothing else: no name, no draft score,
 * no reason for a question, no proposal waiting out its five seconds, no
 * questions still to come (LIV-1). A question the professor may still edit or
 * skip is shown only as "the next question is coming".
 *
 * It learns what to show from the desk over a BroadcastChannel and never
 * fetches anything: the session file holds the reasons and the transcripts,
 * and a window on the student's side of the table must not be able to read
 * them, even from the developer tools. The desk is the only sender, and every
 * message is drawn as text, never as markup.
 *
 * Their own words. While a question is being recorded, the screen also shows
 * the live captions of the answer — the student sees what is being heard, and
 * can correct a word the transcription got wrong by saying it again. Only the
 * captions of the question on screen are drawn, and they are cleared the
 * moment it changes or recording stops.
 *
 * Read aloud. With the desk's switch on, the screen speaks each question and
 * says when it has finished. The desk starts listening only after that,
 * because the microphone cannot tell the synthetic voice from the student's.
 * Browsers speak only after the page has been clicked once, hence the
 * "Click to begin" the professor dismisses when the window is in place.
 */

/** The channel a desk and its student screen share: one per student's defence. */
export const screenChannel = (assessmentId, studentId) => `professor-pane-defence:${assessmentId}:${studentId}`;

/**
 * The page. `assessmentId` and `studentId` only name the channel; they are
 * checked by the caller and never shown.
 */
export const studentScreenPage = ({ assessmentId, studentId }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Defence</title>
<style>
:root{--bg:#101114;--fg:#f4f4f6;--dim:#8d8f96;--rec:#e0483e}
html,body{height:100%;margin:0;background:var(--bg);color:var(--fg);font:20px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}
main{min-height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;padding:6vh 8vw;gap:4vh}
#title{color:var(--dim);font-size:clamp(14px,1.6vw,22px);letter-spacing:.04em;text-transform:uppercase}
#label{color:var(--dim);font-size:clamp(16px,2vw,28px)}
#question{font-size:clamp(26px,4.2vw,64px);line-height:1.25;font-weight:600;white-space:pre-wrap;overflow-wrap:anywhere}
#said{max-width:60ch;font-size:clamp(18px,2.4vw,30px);line-height:1.45;color:var(--fg);min-height:1.45em;overflow-wrap:anywhere}
#said .partial{color:var(--dim)}
#status{display:flex;align-items:center;gap:.6em;font-size:clamp(16px,2vw,28px);color:var(--dim)}
#light{width:.8em;height:.8em;border-radius:50%;background:var(--dim);flex:none}
body[data-phase=listening] #light,body[data-phase=hearing] #light{background:var(--rec);animation:pulse 1.4s ease-in-out infinite}
body[data-phase=hearing] #status{color:var(--fg)}
body[data-phase=consent] #question,body[data-phase=stopped] #question{font-size:clamp(20px,2.6vw,36px);font-weight:500}
@keyframes pulse{50%{opacity:.35}}
@media (prefers-reduced-motion:reduce){#light{animation:none!important}}
#begin{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(16,17,20,.92);
  font-size:clamp(18px,2.4vw,32px);cursor:pointer;border:0;color:var(--fg);width:100%}
#begin[hidden]{display:none}
#full{position:fixed;right:16px;bottom:12px;background:none;border:1px solid #33353b;color:var(--dim);border-radius:6px;
  padding:4px 10px;font:inherit;font-size:13px;cursor:pointer}
</style></head>
<body data-phase="idle">
<main>
  <div id="title"></div>
  <div id="label">Waiting for the defence to start</div>
  <div id="question"></div>
  <div id="said" aria-live="polite"></div>
  <div id="status"><span id="light"></span><span id="state">Not recording</span></div>
</main>
<button id="begin" type="button">Click to begin — then put this window on the screen the student can see</button>
<button id="full" type="button">Full screen (F)</button>
<script>
(function () {
  var channel = new BroadcastChannel(${JSON.stringify(screenChannel(assessmentId, studentId))});
  var $ = function (id) { return document.getElementById(id); };
  var STATES = {
    idle: "Not recording",
    consent: "Not recording — please tell your professor whether you agree",
    stopped: "Not recording",
    reading: "Reading the question…",
    listening: "Recording — answer when you are ready",
    hearing: "Recording",
    between: "Thank you — the next question is coming",
    paused: "Paused",
    done: "Thank you — that is the end of the defence"
  };
  var spoken = null;
  function speak(text, lang, id) {
    if (!("speechSynthesis" in window)) return channel.postMessage({ type: "spoken", id: id });
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    if (lang) u.lang = lang;
    var said = function () { if (spoken === id) { spoken = null; channel.postMessage({ type: "spoken", id: id }); } };
    spoken = id;
    u.onend = said;
    u.onerror = said;
    speechSynthesis.speak(u);
  }
  var current = { question: null, phase: "idle" };
  function said(text, partial) {
    var box = $("said");
    box.textContent = text || "";
    if (partial) {
      var span = document.createElement("span");
      span.className = "partial";
      span.textContent = (text ? " " : "") + partial;
      box.appendChild(span);
    }
  }
  channel.onmessage = function (event) {
    var m = event.data || {};
    if (m.type === "caption") {
      // The answer to the question on screen, while it is being recorded.
      if (m.question && m.question === current.question && (current.phase === "listening" || current.phase === "hearing")) {
        said(m.text, m.partial);
      }
      return;
    }
    if (m.type !== "state") return;
    if (m.question !== current.question || (m.phase !== "listening" && m.phase !== "hearing")) said("", "");
    current = { question: m.question || null, phase: m.phase };
    var phase = STATES[m.phase] ? m.phase : "idle";
    document.body.setAttribute("data-phase", phase);
    $("title").textContent = m.title || "";
    $("label").textContent = m.label || (phase === "idle" ? "Waiting for the defence to start" : "");
    // Between questions the next one may still be edited or skipped, so its
    // words are not shown until it is actually asked.
    $("question").textContent = phase === "between" || phase === "done" || phase === "idle" ? "" : (m.text || "");
    $("state").textContent = STATES[phase];
    if (m.speak && m.text) speak(m.text, m.lang, m.id);
    else if (m.speak) channel.postMessage({ type: "spoken", id: m.id });
  };
  $("begin").addEventListener("click", function () {
    $("begin").hidden = true;
    channel.postMessage({ type: "hello", ready: true });
  });
  function full() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(function () {}); }
  $("full").addEventListener("click", full);
  document.addEventListener("keydown", function (e) { if (e.key === "f" || e.key === "F") full(); });
  // Alive every two seconds: a closed window cannot be relied on to say
  // goodbye, so the desk counts silence instead.
  var ready = false;
  $("begin").addEventListener("click", function () { ready = true; });
  channel.postMessage({ type: "hello", ready: false });
  setInterval(function () { channel.postMessage({ type: "alive", ready: ready }); }, 2000);
  window.addEventListener("pagehide", function () { channel.postMessage({ type: "bye" }); });
})();
</script>
</body></html>`;
