// The defence desk alone, in a browser, against a mock API.
//
//   node plugins/dsh-professor-pane/test/desk-page.mjs        # then open http://localhost:3091
//
// The desk lives inside the harness and records a real student, which makes it
// hard to look at while building it. This serves `lib/client.js` on a page of
// its own with React from a CDN, answers the three `/api/defence/*` routes
// from memory, and — with `?voice=1` — replaces the microphone with a tone
// switched on and off on a script, so hands-free can be watched ending each
// answer and moving on with nobody speaking. Nothing here touches a workspace
// or a provider.

import http from "node:http";
import { readFileSync } from "node:fs";
import { studentScreenPage } from "../lib/student-screen.js";
import { labelSpeakers } from "../../../ainar-node/src/transcribe.ts";

const PORT = Number(process.env.PORT ?? 3091);
const client = new URL("../lib/client.js", import.meta.url);

const questions = [
  { id: "Q1", kind: "opening", text: "Walk me through what your homework does and how it is organised.", criterion_id: null, why: "Sets the baseline.", evidence: [], approval: "draft" },
  { id: "Q2", kind: "probe", text: "Why do you split the data at row 80 in split()?", criterion_id: "CRIT-HW1-SPLIT", why: "Shows whether they know the rows are ordered.", evidence: [{ path: "train.py", lines: "3-4" }], approval: "draft" },
  { id: "Q3", kind: "probe", text: "What would your accuracy mean if the classes were imbalanced?", criterion_id: "CRIT-HW1-EVAL", why: "Probes the choice of metric.", evidence: [{ path: "eval.py", lines: "10-18" }], approval: "draft" },
];
const answers = [];
const received = [];
const decisions = [];
const overrides = [];

const page = `<!doctype html>
<html><head><meta charset="utf-8"><title>Defence desk — test page</title>
<style>body{font:14px system-ui;margin:0;background:#f4f4f6}#log{position:fixed;left:8px;bottom:8px;font:11px monospace;color:#555;z-index:5000;white-space:pre}</style>
<script src="https://unpkg.com/react@18.3.1/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"></script>
</head><body><div id="root"></div><div id="log"></div>
<script>
window.__desk = { asks: [] };
// A scripted voice instead of a microphone: [on?, seconds] repeated.
if (new URLSearchParams(location.search).get("voice") === "1") {
  navigator.mediaDevices.getUserMedia = async () => {
    const audio = new AudioContext();
    const tone = audio.createOscillator();
    tone.frequency.value = 220;
    const gain = audio.createGain();
    gain.gain.value = 0;
    const out = audio.createMediaStreamDestination();
    tone.connect(gain).connect(out);
    tone.start();
    const script = [[0, 1], [1, 3], [0, 4], [1, 2], [0, 1.5], [1, 2], [0, 4], [1, 4], [0, 5]];
    let at = audio.currentTime;
    for (let round = 0; round < 4; round++) for (const [on, seconds] of script) { gain.gain.setValueAtTime(on ? 0.3 : 0, at); at += seconds; }
    return out.stream;
  };
}
window.__ModuleLoader__ = { load: ({ factory }) => {
  window.__client = factory((name) => (name === "react" ? React : ReactDOM));
}};
</script>
<script src="/client.js"></script>
<script>
const h = React.createElement;
function App() {
  const [open, setOpen] = React.useState(true);
  const [reload] = React.useState(0);
  return open
    ? h(window.__client.DefenceDesk, { runId: "RUN-TEST", sessionId: "", assessment: "ASSESSMENT-HW1", student: "STUDENT-TEST01",
        reload, ask: (prompt) => { window.__desk.asks.push(prompt); }, onClose: () => setOpen(false) })
    : h("p", null, "closed");
}
ReactDOM.createRoot(document.getElementById("root")).render(h(App));
setInterval(() => fetch("/received").then((r) => r.json()).then((list) => {
  document.getElementById("log").textContent = list.map((x) => x.question + " " + x.bytes + "B " + x.seconds + "s").join("\\n");
}), 1000);
</script></body></html>`;

const json = (res, value) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
};

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/") return res.writeHead(200, { "content-type": "text/html" }), res.end(page);
    if (url.pathname === "/client.js") return res.writeHead(200, { "content-type": "text/javascript" }), res.end(readFileSync(client));
    if (url.pathname === "/received") return json(res, received);
    if (url.pathname === "/professor-pane/defence/screen") {
      return res.writeHead(200, { "content-type": "text/html" }), res.end(studentScreenPage({ assessmentId: "ASSESSMENT-HW1", studentId: "STUDENT-TEST01" }));
    }
    if (url.pathname === "/professor-pane/api/defence/session") {
      return json(res, {
        assessment: { id: "ASSESSMENT-HW1", title: "Homework 1" },
        student: "STUDENT-TEST01",
        languages: ["en"],
        criteria: [{ id: "CRIT-HW1-SPLIT", title: "Train/test split" }, { id: "CRIT-HW1-EVAL", title: "Evaluation" }],
        pin: { commit: "abc1234def", pinned_by: "submitted_at" },
        questions,
        answers,
        transcription: { name: "mock", provider: "openai", model: "none", local: true, pricePerMinute: 0 },
      });
    }
    if (url.pathname === "/professor-pane/api/defence/audio") return res.writeHead(404), res.end();
    // AGT-2, scripted: a follow-up after Q1, then the prepared questions, then done.
    if (url.pathname === "/professor-pane/api/defence/next" && req.method === "POST") {
      const after = url.searchParams.get("after");
      const answered = new Set(answers.map((a) => a.question_id));
      let decision;
      let question = null;
      if (after === "Q1" && !questions.some((q) => q.follows === "Q1")) {
        question = { id: `Q${questions.length + 1}`, kind: "follow_up", follows: "Q1", text: "You said it trains a model — which model, and why that one?", criterion_id: null, why: "", evidence: [], approval: "draft" };
        questions.push(question);
        decision = { after, action: "follow_up", question_id: question.id, why: "The answer named no model.", by: "mock/scripted", at: new Date().toISOString() };
      } else {
        question = questions.find((q) => !answered.has(q.id)) ?? null;
        decision = question
          ? { after, action: "next", question_id: question.id, why: "Its criterion has no evidence yet.", by: "mock/scripted", at: new Date().toISOString() }
          : { after, action: "done", question_id: null, why: "Every criterion has been asked about.", by: "mock/scripted", at: new Date().toISOString() };
      }
      decisions.push(decision);
      return setTimeout(() => json(res, { decision, index: decisions.length - 1, question }), 300);
    }
    if (url.pathname === "/professor-pane/api/defence/override" && req.method === "POST") {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
        if (decisions[body.index]) decisions[body.index].overridden = body.override;
        let question = null;
        if (body.override === "edit") {
          question = questions.find((q) => q.id === body.question);
          if (question) question.text = body.text;
        }
        overrides.push(body);
        json(res, { ok: true, question });
      });
      return;
    }
    if (url.pathname === "/decisions") return json(res, { decisions, overrides });
    if (url.pathname === "/professor-pane/api/defence/answer" && req.method === "POST") {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const question = url.searchParams.get("question");
        const seconds = Number(url.searchParams.get("seconds"));
        const bytes = Buffer.concat(chunks).length;
        const professor = (url.searchParams.get("professor") ?? "").split(",").filter(Boolean).map((p) => p.split("-").map(Number));
        received.push({ question, bytes, seconds, type: req.headers["content-type"], professor });
        const take = answers.filter((a) => a.question_id === question).length + 1;
        const answer = {
          question_id: question, take, audio: `answers/${question}-${take}.webm`, mime: "audio/webm",
          recorded_at: new Date().toISOString(), seconds,
          // One mock segment a second, so the professor's marked stretches
          // can be seen cut out by the real labelSpeakers.
          transcript: labelSpeakers({ text: "(mock)", language: "en", seconds, timed: true, provider: "openai", model: "none", at: "", cost_usd: 0,
            segments: Array.from({ length: Math.max(1, Math.ceil(seconds)) }, (_, i) => ({ start: i, end: Math.min(seconds, i + 1), text: `second${i + 1}` })) }, professor),
        };
        setTimeout(() => {
          answers.push(answer);
          json(res, { answer });
        }, 400);
      });
      return;
    }
    res.writeHead(404);
    res.end();
  })
  .listen(PORT, () => console.log(`defence desk test page: http://localhost:${PORT}  (?voice=1 for the scripted voice)`));
