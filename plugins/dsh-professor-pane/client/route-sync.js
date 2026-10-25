/**
 * The place on screen and the URL's hash, kept in step.
 *
 * shared/route.js says what a place is called (`#/gradebook/policy`); this
 * is the half that lives in the page. The harness has no router — it never
 * writes the URL or listens for `popstate` — so the pane owns the hash:
 *
 * - **Screen → URL.** Each place course mode reports, and each of the three
 *   page-like windows over it (Grade, Scans, the defence desk), becomes the
 *   hash. A new place is a new history entry; a step through Teaching's
 *   weeks, and whatever a link itself opened, replace the one there, so Back
 *   goes to the last place rather than the last week. Closing a window this
 *   pane opened goes Back, so the place is not in history twice.
 * - **URL → screen.** On mount (a reload, a pasted link, a switch of chat —
 *   the pane is per chat, and the hash survives the switch) and on every
 *   `popstate`, the hash is applied: course mode opens on that place with
 *   those windows, and an empty hash closes it, as × does.
 */

import { React } from "./react.js";
import { hashToPlace, placeToHash } from "../shared/route.js";

/** How long after applying the URL a report counts as its echo, not a move. */
const ECHO_MS = 1500;

const windowsOf = (place) => ({ grade: place.grade || null, scans: place.scans || null, desk: place.desk || null });
const withoutWindows = (place) => {
  const rest = Object.assign({}, place);
  delete rest.grade;
  delete rest.scans;
  delete rest.desk;
  return rest;
};

/** The URL with `hash` as its fragment, or none: the page and query kept as they are. */
const urlWith = (hash) => window.location.pathname + window.location.search + (hash || "");

/**
 * `open` is whether course mode is; `windows` the pane's `{ grade, scans,
 * desk }`; `apply(place, same)` opens a place and its windows — `same` when
 * the place is the one on screen and only the windows differ — and
 * `apply(null)` closes course mode. Returns `report(place, how)`, for
 * course mode's `onShown`.
 */
export function usePlaceUrl(props) {
  const applyRef = React.useRef(props.apply);
  applyRef.current = props.apply;
  const appliedAt = React.useRef(0);
  // Course mode's last report, null until it has made one. A step through
  // Teaching's weeks is taken without a redraw — the page steps without one
  // too — by updating the report in place and the URL directly.
  const [shown, setShown] = React.useState(null);
  const shownRef = React.useRef(null);
  shownRef.current = shown;
  const windowsRef = React.useRef(props.windows);
  windowsRef.current = props.windows;
  const report = React.useCallback((place, how) => {
    if (how === "step" && shownRef.current) {
      shownRef.current.place = place;
      const hash = placeToHash(Object.assign({}, place, windowsRef.current));
      if (hash && hash !== window.location.hash) window.history.replaceState(window.history.state, "", urlWith(hash));
      return;
    }
    setShown({ place: place });
  }, []);
  React.useEffect(() => {
    if (!props.open) setShown(null);
  }, [props.open]);
  // The hash the URL should say: "" with course mode closed; null while it is
  // opening and has not said where it is yet, when nothing is written.
  const target = !props.open ? "" : shown ? placeToHash(Object.assign({}, shown.place, props.windows)) : null;

  // URL → screen, on mount and on Back and Forward.
  React.useEffect(() => {
    const take = () => {
      appliedAt.current = Date.now();
      const place = hashToPlace(window.location.hash);
      // Only the windows moved (Back from a Grade window): the place under
      // them is left as it is, scroll and all.
      const same = Boolean(place && shownRef.current && placeToHash(withoutWindows(place)) === placeToHash(shownRef.current.place));
      applyRef.current(place, same);
    };
    if (hashToPlace(window.location.hash)) take();
    window.addEventListener("popstate", take);
    return () => window.removeEventListener("popstate", take);
  }, []);

  // Screen → URL.
  React.useEffect(() => {
    if (target === null || target === window.location.hash || (target === "" && !window.location.hash)) return;
    // Just after the URL was applied — a new chat's pane mounting on a place,
    // or Back — the first render still has course mode closed. That is not
    // the professor closing it, and must not clear the place from the URL.
    if (target === "" && Date.now() - appliedAt.current < ECHO_MS && hashToPlace(window.location.hash)) return;
    const state = window.history.state && window.history.state.professorPane ? window.history.state.professorPane : null;
    // A window closed that this pane opened over the same place: Back to
    // that place, rather than a second entry for it.
    if (state && state.under === target) {
      window.history.back();
      return;
    }
    const echo = Date.now() - appliedAt.current < ECHO_MS;
    const current = hashToPlace(window.location.hash);
    const next = hashToPlace(target);
    const samePlace = current && next && placeToHash(withoutWindows(current)) === placeToHash(withoutWindows(next));
    const hasWindow = (place) => Object.values(windowsOf(place)).some(Boolean);
    // Only a window opened over the place on screen: remember the place, so
    // closing it goes Back to it.
    const under = samePlace && hasWindow(next) && !hasWindow(current) ? window.location.hash : null;
    // A window closed that a link opened (nothing to go Back to), or a step
    // through Teaching's weeks: the entry is the same place, said again.
    const closed = samePlace && hasWindow(current) && !hasWindow(next);
    const stepped =
      current && next && current.mode === "teaching" && next.mode === "teaching" &&
      placeToHash(Object.assign({}, current, { week: null })) === placeToHash(Object.assign({}, next, { week: null }));
    const entry = { professorPane: { under: under } };
    if (echo || closed || stepped) window.history.replaceState(entry, "", urlWith(target));
    else window.history.pushState(entry, "", urlWith(target));
  }, [target]);

  return report;
}

export { withoutWindows };

/**
 * Go to a place by its hash, as a link would: a new history entry, applied
 * by the same listener Back and Forward use, so a crumb or a link drawn as
 * `<a href="#/…">` and a press of Back can never disagree about what opens.
 */
export const navigateTo = (hash) => {
  if (!hash || hash === window.location.hash) return;
  window.history.pushState({ professorPane: { under: null } }, "", urlWith(hash));
  window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
};

/**
 * The click on a link to a place: in place for a plain click, left to the
 * browser for a new tab or window (Ctrl, ⌘, Shift, the middle button), where
 * the harness restores the chat and the hash brings the place.
 */
export const followLink = (event, hash) => {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigateTo(hash);
};
