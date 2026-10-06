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
import { createHash } from "node:crypto";
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
let consent = null;
const captioned = [];
let streaming = true;
const streamed = { sessions: 0, chunks: 0, loudChunks: 0, commits: 0, sampleRates: [] };
const STATEMENT = "This oral defence will be recorded: your spoken answers, as audio. The recordings are transcribed on this machine (mock) and do not leave it. You may ask to stop at any time.";
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
    if (url.pathname === "/professor-pane/vendor/dots-swarm.js") {
      return res.writeHead(200, { "content-type": "text/javascript" }), res.end(readFileSync(new URL("../vendor/dots-swarm.js", import.meta.url)));
    }
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
        statement: STATEMENT,
        consent,
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
    // AGT-8: a streaming session — the mock Scribe socket below — unless the
    // page was opened with ?stream=0, which tests the fallback.
    if (url.pathname === "/professor-pane/api/defence/realtime" && req.method === "POST") {
      if (!consent?.agreed || consent.withdrawn_at) return json(res, { unavailable: "no recorded consent" });
      if (streaming === false) return json(res, { unavailable: "mock: streaming off" });
      // A socket the browser cannot open, as a page's security policy would refuse it.
      if (streaming === "broken") return json(res, { session: { url: "ws://127.0.0.1:9/nothing-here", sampleRate: 16000, expiresInSeconds: 900 } });
      return json(res, { session: { url: `ws://localhost:${PORT}/mock-scribe?token=single-use`, sampleRate: 16000, expiresInSeconds: 900 } });
    }
    if (url.pathname === "/streamed") return json(res, streamed);
    if (url.pathname === "/stream-off") return (streaming = false), json(res, { ok: true });
    if (url.pathname === "/stream-broken") return (streaming = "broken"), json(res, { ok: true });
    // AGT-5: a caption for a piece of an answer still being given.
    if (url.pathname === "/professor-pane/api/defence/caption" && req.method === "POST") {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        if (!consent?.agreed || consent.withdrawn_at) return json(res, { error: "no recorded consent" });
        captioned.push({ question: url.searchParams.get("question"), bytes: Buffer.concat(chunks).length });
        setTimeout(() => json(res, { text: `(heard piece ${captioned.length}, ${Buffer.concat(chunks).length} bytes)`, segments: [] }), 300);
      });
      return;
    }
    if (url.pathname === "/captioned") return json(res, captioned);
    if (url.pathname === "/decisions") return json(res, { decisions, overrides, consent, answers: answers.map((a) => [a.question_id, !!a.withdrawn]) });
    if (url.pathname === "/professor-pane/api/defence/consent" && req.method === "POST") {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const { action } = JSON.parse(Buffer.concat(chunks).toString() || "{}");
        const at = new Date().toISOString();
        if (action === "withdraw") {
          consent = { ...consent, withdrawn_at: at };
          for (const a of answers) a.withdrawn = true;
        } else consent = { agreed: action === "agree", at, statement: STATEMENT, provider: "mock" };
        json(res, { consent });
      });
      return;
    }
    if (url.pathname === "/professor-pane/api/defence/answer" && req.method === "POST") {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        // As the real server: no take is kept without consent.
        if (!consent?.agreed || consent.withdrawn_at) return json(res, { error: "no recorded consent: the student has to agree to be recorded first" });
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
  .on("upgrade", (req, socket) => {
    // A mock of Scribe's realtime socket, by hand: enough of RFC 6455 for text
    // frames. It decodes each chunk as 16-bit PCM and captions what it hears.
    if (!req.url.startsWith("/mock-scribe")) return socket.destroy();
    const accept = createHash("sha1").update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
    streamed.sessions += 1;
    const send = (value) => {
      const body = Buffer.from(JSON.stringify(value));
      const head = body.length < 126 ? Buffer.from([0x81, body.length]) : Buffer.from([0x81, 126, body.length >> 8, body.length & 255]);
      socket.write(Buffer.concat([head, body]));
    };
    send({ message_type: "session_started", session_id: "mock" });
    let buffer = Buffer.alloc(0);
    let heard = 0;
    let words = 0;
    socket.on("data", (data) => {
      buffer = Buffer.concat([buffer, data]);
      while (buffer.length >= 2) {
        const opcode = buffer[0] & 15;
        let length = buffer[1] & 127;
        let at = 2;
        if (length === 126) { length = buffer.readUInt16BE(2); at = 4; }
        else if (length === 127) { length = Number(buffer.readBigUInt64BE(2)); at = 10; }
        const masked = buffer[1] & 128;
        const need = at + (masked ? 4 : 0) + length;
        if (buffer.length < need) return;
        const mask = masked ? buffer.subarray(at, at + 4) : null;
        const payload = Buffer.from(buffer.subarray(at + (masked ? 4 : 0), need));
        if (mask) for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
        buffer = buffer.subarray(need);
        if (opcode === 8) return socket.end();
        if (opcode !== 1) continue;
        const message = JSON.parse(payload.toString());
        if (message.message_type !== "input_audio_chunk") continue;
        streamed.sampleRates.includes(message.sample_rate) || streamed.sampleRates.push(message.sample_rate);
        if (message.commit) {
          streamed.commits += 1;
          if (heard) send({ message_type: "committed_transcript", text: `(committed: ${heard} loud chunks)` });
          heard = 0;
          continue;
        }
        streamed.chunks += 1;
        const pcm = Buffer.from(message.audio_base_64, "base64");
        let sum = 0;
        for (let i = 0; i + 1 < pcm.length; i += 2) sum += pcm.readInt16LE(i) ** 2;
        const rms = Math.sqrt(sum / Math.max(1, pcm.length / 2)) / 32768;
        if (rms > 0.05) {
          streamed.loudChunks += 1;
          heard += 1;
          words += 1;
          send({ message_type: "partial_transcript", text: `word${words}` });
          if (heard >= 6) {
            send({ message_type: "committed_transcript", text: `(sentence of ${heard} chunks, rms ${rms.toFixed(2)})` });
            heard = 0;
          }
        }
      }
    });
    socket.on("error", () => {});
  })
  .listen(PORT, () => console.log(`defence desk test page: http://localhost:${PORT}  (?voice=1 for the scripted voice)`));
