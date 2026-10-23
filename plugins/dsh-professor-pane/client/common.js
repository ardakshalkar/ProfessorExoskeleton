/**
 * Small pieces every tab uses: fetching JSON, the dark-mode flag, and the
 * message line.
 */

import { h, React } from "./react.js";

// ------------------------------------------------------------- fetching

/**
 * One JSON read, with a network failure turned into the same `{ error }`
 * shape the route uses for a course-model failure.
 *
 * The pane has exactly one way to say "this did not work", and it prints
 * whatever text it was given. That is deliberate: the interesting failures
 * here are the course model's own sentences — "no course run 'X' in this
 * workspace", "AINAR_WORKSPACE is not set" — and a pane that classified
 * them into its own categories would be paraphrasing the only useful part.
 */
export function useJson(url) {
  const [state, setState] = React.useState({ phase: "loading" });
  React.useEffect(() => {
    if (url === null) return undefined;
    let live = true;
    setState({ phase: "loading" });
    fetch(url, { headers: { accept: "application/json" } })
      .then((response) => response.json())
      .then((value) => {
        if (live) setState({ phase: "ready", value: value });
      })
      .catch((error) => {
        if (live) setState({ phase: "ready", value: { error: String(error.message || error) } });
      });
    return () => {
      live = false;
    };
  }, [url]);
  return state;
}

/**
 * The draft loader's complaints, off the response header.
 *
 * A header value carries no newlines and nothing outside Latin-1, so the
 * route percent-encodes one line and this is the other half of that. A
 * header that is absent means the loader had nothing to say, which is not
 * the same as drafts being off — `x-professor-pane-drafts` says that.
 */
export function decodeIssues(raw) {
  if (!raw) return [];
  try {
    return decodeURIComponent(raw).split(" | ").filter(Boolean);
  } catch {
    return [];
  }
}

/** Whether the harness is currently painting dark, read off the body. */
export function useDark() {
  const read = () =>
    typeof document !== "undefined" && document.body.hasAttribute("data-ds-dark-theme");
  const [dark, setDark] = React.useState(read);
  React.useEffect(() => {
    // `ui-layout`'s theme presenter writes the attribute on every resolved
    // theme change, so watching the attribute catches a theme switch
    // without this package having to inject the `theme` service and hold a
    // second subscription to the same fact.
    const observer = new MutationObserver(() => setDark(read()));
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

// ---------------------------------------------------------------- views

export function Message(props) {
  return h("div", { className: "pp-msg" + (props.error ? " pp-err" : "") }, props.children);
}

/** Where the drafts banner's fold is kept: a reading preference, per browser. */
const BANNER_KEY = "professor-pane:drafts-banner-folded";
const BANNER_EVENT = "professor-pane:drafts-banner";

const bannerFolded = () => {
  try {
    return window.localStorage.getItem(BANNER_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * The line over a view computed with drafts in it. The pane never shows that
 * half silently, so the banner never goes; what changes is its size. The
 * paragraph is said in full until the professor folds it, then once as a
 * line that opens it again (docs/RIBBONS.md R4). The fold is remembered in
 * this browser, for every view that draws the banner.
 *
 * `issues` — what the draft read complained of — are always shown.
 */
export function DraftBanner(props) {
  const [folded, setFolded] = React.useState(bannerFolded);
  // The weeks stay mounted under a course-wide view, so two banners can be
  // in the page at once; a fold in one is told to the other.
  React.useEffect(() => {
    const onFold = (event) => setFolded(Boolean(event.detail));
    window.addEventListener(BANNER_EVENT, onFold);
    return () => window.removeEventListener(BANNER_EVENT, onFold);
  }, []);
  const fold = (value) => {
    try {
      window.localStorage.setItem(BANNER_KEY, value ? "1" : "0");
    } catch {
      // A private window: folded until the page reloads.
    }
    window.dispatchEvent(new CustomEvent(BANNER_EVENT, { detail: value }));
  };
  const issues = props.issues && props.issues.length ? h("span", { className: "pp-issues" }, props.issues.join("  ·  ")) : null;
  if (folded) {
    return h(
      "div",
      { className: "pp-banner pp-banner-folded" },
      h("b", null, "Including drafts"),
      " — records nobody has accepted yet.",
      h("button", { type: "button", className: "pp-linkbtn", onClick: () => fold(false) }, "What this means"),
      issues,
    );
  }
  return h(
    "div",
    { className: "pp-banner" },
    h("b", null, "Record + drafts. "),
    "Everything below includes records marked ",
    h("code", null, "approval: draft"),
    ", which nobody has accepted yet. Accepting one is changing that word to ",
    h("code", null, "approved"),
    " in its record, and that is yours to do.",
    h("button", { type: "button", className: "pp-linkbtn", onClick: () => fold(true) }, "Got it"),
    issues,
  );
}
