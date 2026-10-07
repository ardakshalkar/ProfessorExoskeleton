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
