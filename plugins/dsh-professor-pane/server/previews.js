/**
 * What a preview showed, kept until it is sent: the one rule every road to a
 * service outside the run follows (server/roads.js).
 *
 * A Send is answered from the snapshot its preview took, never from a check
 * the pane keeps refreshing on its own: that check could be running, or newer
 * than what the professor read, and on 2026-10-25 Sync all refused to send
 * because of it. A snapshot may be sent from in parts — one homework, then
 * another — and each key goes once: a send spends the keys it sent, and the
 * snapshot is gone when none is left. It is refused, with `again`, when it is
 * older than PREVIEW_MS, and when there is none — which is also what a reload
 * of server/ leaves, since like every module cache here it is empty
 * afterwards. `again` is the pane's cue for a "Check again" button.
 */

/** How old a preview may be when its Send is pressed. */
export const PREVIEW_MS = 15 * 60 * 1000;

const kept = new Map(); // runId + "|" + what -> { at, keys, snapshot }

const slot = (runId, what) => runId + "|" + what;

/** Keep what a preview showed: the keys a Send may name, and what it sends them from. */
export const remember = (runId, what, keys, snapshot) => {
  const at = new Date().toISOString();
  kept.set(slot(runId, what), { at, keys: keys.map(String), snapshot });
  return at;
};

/**
 * The preview a Send goes ahead from: `{ last }` with the keys not yet sent,
 * or `{ again }` with the reason in the professor's words. Asking spends
 * nothing; `spend` does, once the send has gone.
 */
export const recall = (runId, what) => {
  const last = kept.get(slot(runId, what));
  if (!last) return { again: "There is no check to send from: the pane's server may have restarted since. Check again." };
  if (Date.now() - Date.parse(last.at) > PREVIEW_MS) {
    kept.delete(slot(runId, what));
    return { again: "The check is more than 15 minutes old. Check again." };
  }
  return { last };
};

/**
 * The keys a send is going out with, taken off its preview; the preview goes
 * when none is left. Spent before the send is awaited, so a second press from
 * the same preview, arriving while the first is out, finds them gone.
 */
export const spend = (runId, what, keys) => {
  const last = kept.get(slot(runId, what));
  if (!last) return;
  const gone = new Set(keys.map(String));
  last.keys = last.keys.filter((key) => !gone.has(key));
  if (!last.keys.length) kept.delete(slot(runId, what));
};

/**
 * Keys spent for a send that then did not go — the far side moved before it
 * left — put back on the preview they came from. A newer preview, kept since,
 * is left as it is.
 */
export const unspend = (runId, what, last, keys) => {
  const now = kept.get(slot(runId, what));
  if (now && now !== last) return;
  const back = keys.map(String).filter((key) => !last.keys.includes(key));
  last.keys = last.keys.concat(back);
  kept.set(slot(runId, what), last);
};

/** A snapshot used once and for all — a row's own "keep AINAR" — out of the way. */
export const forget = (runId, what) => {
  kept.delete(slot(runId, what));
};
