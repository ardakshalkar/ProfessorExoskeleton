/**
 * What a preview showed, kept until its Send: the one rule every road to a
 * service outside the run follows (server/roads.js).
 *
 * A Send is answered from the snapshot its preview took, never from a check
 * the pane keeps refreshing on its own: that check could be running, or newer
 * than what the professor read, and on 2026-10-25 Sync all refused to send
 * because of it. A snapshot serves one Send. It is refused, with `again`, when
 * it is older than PREVIEW_MS, and when there is none — which is also what a
 * live reload of server/ leaves, since like every module cache here it is
 * empty afterwards. `again` is the pane's cue for a "Preview again" button.
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
 * The preview a Send goes ahead from, used up by asking: `{ last }`, or
 * `{ again }` with the reason in the professor's words.
 */
export const recall = (runId, what) => {
  const last = kept.get(slot(runId, what));
  kept.delete(slot(runId, what));
  if (!last) return { again: "There is no preview to send from: the pane's server may have reloaded since. Preview again." };
  if (Date.now() - Date.parse(last.at) > PREVIEW_MS) return { again: "The preview is more than 15 minutes old. Preview again." };
  return { last };
};
