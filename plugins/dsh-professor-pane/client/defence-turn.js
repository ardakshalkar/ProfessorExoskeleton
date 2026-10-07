/**
 * The end-of-answer detector, from the microphone's level alone. Pure, so it
 * is tested without a microphone (`test/turn-taking.test.mjs`).
 */

/**
 * When an answer has ended, from the microphone's level alone (AGT-1).
 *
 * Pure, one call per sample, so it can be tested without a microphone. It
 * waits for speech — the level above the room's noise floor for 0.4 s,
 * so a cough or a chair is not an answer — and then for silence: 2.5 s
 * below the floor after speech ends the take. Thinking pauses mid-answer
 * are shorter than that in practice; a student who needs longer presses
 * nothing and the professor presses Space when they are done instead.
 *
 * The floor is learnt, not configured: it follows the level while nobody
 * is speaking, and the threshold is three times it, never below a fixed
 * minimum so a silent room does not make breathing an answer. Three
 * minutes ends a take whatever happens, so a forgotten desk does not
 * record a lecture.
 *
 * The first 0.8 s of a take are not listened to. Without that, the tail of
 * the previous answer — the last word as the professor pressed Space —
 * became the start of the next one, and the next question "ended" on the
 * silence after it. What this cannot tell apart is a voice that is not the
 * student's: a professor who reads the question aloud is heard as the
 * answer. Hands-free therefore expects the question to be read off the
 * screen (AGT-4) until AGT-6 separates the two voices.
 */
const TURN = { settleMs: 800, minSpeechMs: 400, silenceMs: 2500, capMs: 180000, minThreshold: 0.012, ratio: 3 };
export function turnStep(state, level, now, options) {
  const o = Object.assign({}, TURN, options || {});
  const s = state || {
    phase: "waiting",
    floor: Math.min(level, o.minThreshold),
    voicedSince: null,
    silentSince: null,
    startedAt: now,
  };
  const threshold = Math.max(o.minThreshold, s.floor * o.ratio);
  const loud = level > threshold;
  const result = (next, end) => ({
    state: next,
    end: end,
    threshold: threshold,
    silentFor: next.silentSince === null ? 0 : now - next.silentSince,
  });
  if (now - s.startedAt >= o.capMs) return result(s, "cap");
  if (now - s.startedAt < o.settleMs) return result(s, null);
  if (s.phase === "waiting") {
    if (!loud) {
      // Only quiet samples teach the floor, so speech never raises it.
      return result(Object.assign({}, s, { voicedSince: null, floor: s.floor * 0.95 + level * 0.05 }), null);
    }
    const voicedSince = s.voicedSince === null ? now : s.voicedSince;
    return now - voicedSince >= o.minSpeechMs
      ? result(Object.assign({}, s, { phase: "speaking", voicedSince: voicedSince, silentSince: null }), null)
      : result(Object.assign({}, s, { voicedSince: voicedSince }), null);
  }
  if (loud) return result(Object.assign({}, s, { silentSince: null }), null);
  const silentSince = s.silentSince === null ? now : s.silentSince;
  const next = Object.assign({}, s, { silentSince: silentSince, floor: s.floor * 0.98 + level * 0.02 });
  return result(next, now - silentSince >= o.silenceMs ? "silence" : null);
}
