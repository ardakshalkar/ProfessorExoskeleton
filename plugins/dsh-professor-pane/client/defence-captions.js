/**
 * Live captions for the take in hand (AGT-5, AGT-8): streamed word by word
 * where the connection can, five-second pieces where it cannot. Provisional
 * and kept nowhere — the transcript that counts is the take's, when it ends.
 */

import { h, React } from "./react.js";

const CAPTION_MS = 5000;

/** Float samples at the microphone's rate to 16-bit PCM at the stream's, as base64. */
const pcmBase64 = (input, ratio, silent) => {
  const length = Math.floor(input.length / ratio);
  const pcm = new Int16Array(length);
  if (!silent) {
    for (let index = 0; index < length; index += 1) {
      // The mean of the samples this one stands for: a plain low-pass.
      const from = Math.floor(index * ratio);
      const to = Math.min(input.length, Math.floor((index + 1) * ratio));
      let sum = 0;
      for (let at = from; at < to; at += 1) sum += input[at];
      const value = Math.max(-1, Math.min(1, sum / Math.max(1, to - from)));
      pcm[index] = value < 0 ? value * 0x8000 : value * 0x7fff;
    }
  }
  const bytes = new Uint8Array(pcm.buffer);
  let binary = "";
  for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(at, at + 0x8000));
  return btoa(binary);
};

/**
 * The captions and the loop that makes them.
 *
 * `captions` is `{ question, pieces: [{ index, text }], partial, mode, from }`
 * for the take in hand. `marks` and `whole` are the desk's refs: nothing is
 * captioned while the professor holds P, or while a whole defence is paused.
 * `endpoint` builds a desk route for this student.
 */
export function useCaptions(endpoint, marks, whole) {
  const [captions, setCaptions] = React.useState(null);
  const [liveCaptions, setLiveCaptions] = React.useState(true);
  const liveCaptionsRef = React.useRef(true);
  liveCaptionsRef.current = liveCaptions;
  const captionLoop = React.useRef(null);

  /*
   * A second recorder on the same microphone, restarted every few seconds
   * so each piece is a whole little file any provider can read; a piece in
   * which somebody spoke is sent for a caption, a silent one is not.
   */
  const startCaptions = (stream, questionId, type) => {
    stopCaptions();
    setCaptions({ question: questionId, pieces: [], partial: "", mode: null });
    if (!liveCaptionsRef.current) return;
    const loop = { active: true, index: 0, loud: false, recorder: null, timer: null, cleanup: null };
    captionLoop.current = loop;
    // AGT-8: stream where the connection can (Scribe), word by word; else,
    // or if streaming fails, the five-second pieces below.
    fetch(endpoint("/api/defence/realtime"), { method: "POST" })
      .then((response) => response.json())
      .then((result) => {
        if (!loop.active) return;
        if (result.session) startStreaming(loop, stream, result.session, questionId, type);
        else startPieces(loop, stream, questionId, type);
      })
      .catch(() => loop.active && startPieces(loop, stream, questionId, type));
  };

  /*
   * Streaming captions (AGT-8): the microphone, brought down to 16 kHz
   * 16-bit PCM, straight to the provider's socket, with a single-use token
   * the server minted; the key stays on the server. While the professor
   * holds P, silence is sent instead, so their words are never captioned.
   * A socket that fails before it opens hands the take to the pieces.
   */
  const startStreaming = (loop, stream, session, questionId, type) => {
    let socket;
    try {
      socket = new WebSocket(session.url);
    } catch {
      startPieces(loop, stream, questionId, type);
      return;
    }
    let opened = false;
    let audio = null;
    let source = null;
    let node = null;
    const teardown = () => {
      try {
        if (node) node.disconnect();
        if (source) source.disconnect();
        if (audio && audio.state !== "closed") audio.close();
      } catch {}
      node = source = audio = null;
    };
    // A socket that fails before it opens fires both error and close: one
    // fallback, not two caption loops.
    const fallBack = () => {
      teardown();
      if (loop.fellBack || opened || !loop.active) return;
      loop.fellBack = true;
      startPieces(loop, stream, questionId, type);
    };
    socket.onopen = () => {
      opened = true;
      setCaptions((current) => (current && current.question === questionId ? Object.assign({}, current, { mode: "streaming" }) : current));
      try {
        audio = new AudioContext();
        source = audio.createMediaStreamSource(stream);
        node = audio.createScriptProcessor(4096, 1, 1);
        const ratio = audio.sampleRate / session.sampleRate;
        node.onaudioprocess = (event) => {
          // A paused whole defence sends nothing: the gap is not in the recording either.
          if (socket.readyState !== 1 || whole.current.paused !== null) return;
          socket.send(
            JSON.stringify({
              message_type: "input_audio_chunk",
              audio_base_64: pcmBase64(event.inputBuffer.getChannelData(0), ratio, marks.current.held !== null),
              commit: false,
              sample_rate: session.sampleRate,
            }),
          );
        };
        source.connect(node);
        // A script processor runs only while connected onwards; it writes
        // nothing, so the speakers hear silence.
        node.connect(audio.destination);
      } catch {
        socket.close();
      }
    };
    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      const kind = String(message.message_type || "");
      if (kind === "partial_transcript") {
        setCaptions((current) => (current && current.question === questionId ? Object.assign({}, current, { partial: String(message.text || "") }) : current));
      } else if (kind === "committed_transcript") {
        const text = String(message.text || "").trim();
        const index = loop.index;
        loop.index += 1;
        setCaptions((current) =>
          current && current.question === questionId
            ? Object.assign({}, current, { partial: "", pieces: text ? current.pieces.concat([{ index, text }]) : current.pieces })
            : current,
        );
      } else if (/error|exceeded|limited|exhausted/.test(kind)) {
        setCaptions((current) => (current && current.question === questionId ? Object.assign({}, current, { mode: "failed:" + (message.error || kind) }) : current));
        socket.close();
      }
    };
    socket.onerror = () => fallBack();
    socket.onclose = () => fallBack();
    loop.cleanup = () => {
      teardown();
      if (socket.readyState === 1) {
        // Ask for the last words before closing.
        try {
          socket.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: "", commit: true, sample_rate: session.sampleRate }));
        } catch {}
        setTimeout(() => socket.close(), 1500);
      } else if (socket.readyState === 0) {
        socket.close();
      }
    };
  };

  /** The five-second pieces (AGT-5): any provider, a caption per piece in which someone spoke. */
  const startPieces = (loop, stream, questionId, type) => {
    setCaptions((current) => (current && current.question === questionId ? Object.assign({}, current, { mode: "pieces" }) : current));
    const cycle = () => {
      if (!loop.active) return;
      let piece;
      try {
        piece = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      } catch {
        return;
      }
      const chunks = [];
      piece.ondataavailable = (event) => {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      piece.onstop = () => {
        const index = loop.index;
        loop.index += 1;
        const spoke = loop.loud;
        loop.loud = false;
        const blob = new Blob(chunks, { type: (piece.mimeType || type || "audio/webm").split(";")[0] });
        if (spoke && blob.size) caption(questionId, index, blob);
        if (loop.active && stream.active) cycle();
      };
      loop.recorder = piece;
      piece.start();
      loop.timer = setTimeout(() => piece.state !== "inactive" && piece.stop(), CAPTION_MS);
    };
    cycle();
  };
  const stopCaptions = () => {
    const loop = captionLoop.current;
    if (!loop) return;
    loop.active = false;
    clearTimeout(loop.timer);
    if (loop.cleanup) loop.cleanup();
    // The last piece is still captioned: the answer's final words.
    if (loop.recorder && loop.recorder.state !== "inactive") loop.recorder.stop();
    captionLoop.current = null;
  };
  /** Someone is audibly speaking — not the professor holding P — so this piece is worth a caption. */
  const heard = (level, threshold) => {
    const loop = captionLoop.current;
    if (loop && level > threshold && marks.current.held === null && whole.current.paused === null) loop.loud = true;
  };
  const caption = (questionId, index, blob) =>
    fetch(endpoint("/api/defence/caption", "&question=" + encodeURIComponent(questionId)), {
      method: "POST",
      headers: { "Content-Type": blob.type },
      body: blob,
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.error || !String(result.text || "").trim()) return;
        setCaptions((current) =>
          current && current.question === questionId
            ? Object.assign({}, current, {
                pieces: current.pieces.concat([{ index, text: String(result.text).trim() }]).sort((a, b) => a.index - b.index),
              })
            : current,
        );
      })
      .catch(() => {});

  return { captions, setCaptions, liveCaptions, setLiveCaptions, startCaptions, stopCaptions, heard };
}

/** The captions, under whatever is recording. */
export function CaptionsLine(props) {
  const captions = props.captions;
  return captions && captions.question === props.question && (captions.pieces.length || captions.partial)
    ? h(
        "div",
        { className: "pp-dcaption", "aria-live": "polite" },
        h("span", { className: "pp-dim" }, captions.mode === "streaming" ? "Live: " : "Live, every few seconds: "),
        captions.pieces.slice(captions.from || 0).map((piece) => piece.text).join(" "),
        captions.partial ? h("span", { className: "pp-dpartial" }, " " + captions.partial) : null,
      )
    : null;
}
