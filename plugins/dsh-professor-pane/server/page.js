/**
 * The shell every served page is drawn in — the widget document, the plain
 * page, and the small formatting helpers the views share.
 */

import { embed } from "./http.js";
import { escapeText } from "./markdown.js";

/**
 * One widget document with its payload already in it.
 *
 * `runtime.js` reads `window.openai.toolOutput` and repaints on three events,
 * so a document served with the object already present paints on first load and
 * needs no channel for its data. The only thing that has to travel back out is
 * a button press: the widgets ask the model a question through
 * `sendFollowUpMessage`, deliberately never `callTool`, and here that becomes a
 * `postMessage` the browser half turns into a prompt in the open session.
 *
 * `dark` re-declares the widget's own dark tokens unconditionally. The widget
 * style sheet chooses its scheme with `prefers-color-scheme`, which is the OS
 * setting; DSH's theme is an explicit choice on `body`. Without this an
 * iframe would be light inside a dark harness whenever the two disagree, and
 * the alternative — editing `shell.css` — is editing a file two servers share
 * and a test compares byte for byte.
 */
/**
 * The mark on every press that goes to the chat.
 *
 * A press in this pane either changes a record or asks the assistant, and the
 * two look alike: "Accept rubric" writes a file, "Just one rubric" queues a
 * turn in the session. The mark says which, without a reading of the code.
 * Drawn by CSS on the attribute that does the sending — `data-ask` in the
 * widgets and Course mode, `data-defence` on the Students view — so a button
 * that sends is marked by being one, and the vendored widgets need no edit.
 * `client/style.js` draws the same glyph on the pane's own buttons (`pp-chat`).
 */
export const CHAT_MARK_CSS =
  '[data-ask]::after,[data-defence]::after{content:"\\2726";margin-left:.35em;font-size:.85em;opacity:.75}';

export const widgetDocument = (widget, data, dark) => {
  const shim = `<script>
window.openai = {
  toolOutput: ${embed(data)},
  widgetState: {},
  setWidgetState: function (next) { this.widgetState = next; },
  sendFollowUpMessage: function (message) {
    // '*' rather than an origin, because this document is delivered into a
    // frame sandboxed without allow-same-origin: its own origin is the string
    // "null", which postMessage rejects as a target. The only receiver is the
    // harness page that put the document in the frame, and the payload is one
    // string that becomes a prompt in the professor's own open session.
    parent.postMessage({
      source: 'professor-pane',
      kind: 'ask',
      prompt: message && message.prompt
    }, '*');
  },
  // Show a material over the whole harness instead of in a new browser tab.
  //
  // THIS FUNCTION IS THE FEATURE TEST. runtime.js intercepts a click only
  // where the host offers this, so the same widget served to ChatGPT or Claude
  // Desktop — which have no page to put an overlay on and no route to the file
  // — goes on following its link exactly as before. No payload flag, no
  // second code path in the view: the capability is either here or it is not.
  openMaterial: function (material) {
    parent.postMessage({
      source: 'professor-pane',
      kind: 'view',
      url: material && material.url,
      label: material && material.label,
      format: material && material.format,
      // The versions of an exam, as the JSON the chip carried; the browser
      // half checks every URL in it exactly as it checks \`url\`.
      papers: material && material.papers
    }, '*');
  }
};
</script>`;
  const scheme = dark
    ? `<style>:root{
  --fg:#e8e8e8; --on-fg:#16181c; --muted:#9a9a9a; --line:#2e3239; --panel:#1c1f24;
  --accent:#7fc98d; --flag:#e08c85;
  --b1:#6b3a37; --b2:#6d5730; --b3:#5f5c2c; --b4:#3f5a38; --b5:#2f6b3c;
  --none:#1e2126; --none-fg:#6b6b6b;
}</style>`
    : "";
  return (
    "<!doctype html><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<style>html,body{margin:0;padding:12px 14px 32px}" + CHAT_MARK_CSS + "</style>" +
    shim +
    widget.html() +
    scheme
  );
};


/**
 * An assessment named as the professor reads it, and as the record knows it.
 *
 * The title alone was ambiguous in the way that matters here. A course whose
 * homework is titled "Homework" four times over drew four identical rows, and
 * telling the professor WHICH one carries no deadline is the only thing the
 * Deadlines section is for. The identifier is what distinguishes them, and it
 * is also the string they would grep for under `assessments/`
 * or hand to `ainar` — so it is the useful half of the pair to print, not a
 * debugging leftover.
 *
 * After the title and dimmed, because the title is what is read and the id is
 * what is acted on. The widget documents this pane serves put it in the same
 * place, so the two halves of the pane agree on where to look for it.
 *
 * Suppressed when the record has no title of its own: the fallback already IS
 * the id, and printing it twice reads as a fault in the page rather than in
 * the record.
 */
export const titleWithId = (row) => {
  const id = row.assessment_id ?? null;
  const title = row.title ?? id ?? "untitled";
  return (
    escapeText(title) +
    (id !== null && title !== id ? ' <span class="id">' + escapeText(id) + "</span>" : "")
  );
};

/**
 * The click that shows a material over the harness instead of in a new tab.
 *
 * The pane's own pages have no `window.openai`, so they cannot reuse the shim
 * the widgets get; this is the same contract written out in eight lines. It
 * posts the identical `view` message, and the browser half accepts the URL
 * only if it addresses this app's material route — see `materialUrl` there.
 *
 * Three ways out of it, all deliberate. A page opened directly in a tab has
 * `parent === window`, nobody listening, and so takes no clicks at all. A
 * modified click — ctrl, cmd, shift, middle — keeps the tab it always opened.
 * And an anchor with no `data-view` is untouched, which is how a `.pptx` and a
 * reading hosted on somebody else's server go on behaving as before.
 */
export const VIEW_SCRIPT =
  "<script>(function(){if(parent===window)return;" +
  "document.addEventListener('click',function(e){" +
  "var p=e.target.closest&&e.target.closest('button[data-publish]');" +
  "if(p){e.preventDefault();parent.postMessage({source:'professor-pane'," +
  "kind:'publish',assessment:p.getAttribute('data-publish')," +
  "label:p.getAttribute('data-label')||''},'*');return;}" +
  "var a=e.target.closest&&e.target.closest('a[data-view]');if(!a)return;" +
  "if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;" +
  "e.preventDefault();" +
  "parent.postMessage({source:'professor-pane',kind:'view'," +
  "url:a.getAttribute('href'),label:a.getAttribute('data-view')," +
  "format:a.getAttribute('data-format'),papers:a.getAttribute('data-papers')},'*');" +
  "});})();<\/script>";

/**
 * A failure on a `/view/` path, as a page rather than as JSON.
 *
 * The `/view/` routes answer an iframe, and an iframe handed
 * `{"error":"no course run 'X' in this workspace"}` renders that as the literal
 * text of a JSON document. The sentence is the useful part; this puts it in a
 * page so the professor reads the sentence and not the braces around it. The
 * `/api/` paths keep JSON, because their caller is `fetch` and can read it.
 */
/**
 * The shell the two hand-drawn views share.
 *
 * The widget views are documents from `dsh-ainar-course-model` and bring their
 * own styling; these two have no widget behind them, so the chrome lives here.
 * Kept deliberately close to `sendErrorPage`'s: transparent background so the
 * pane's own surface shows through, system font, and a dark variant driven by
 * the `dark=1` the pane already passes to every view.
 */
export const documentPage = (bodyHtml, dark) =>
  '<!doctype html><meta charset="utf-8">' +
  "<style>" +
  ":root{--fg:#1f1f1f;--dim:#6b6b6b;--line:#e3e3e3;--warn:#8a6d1f;--warnbg:#fdf6e3;" +
  "--info:#3a5f8a;--infobg:#eef2f8}" +
  (dark
    ? ":root{--fg:#e8e8e8;--dim:#9a9a9a;--line:#3a3a3a;--warn:#d8b55a;--warnbg:#2e2a1e;" +
      "--info:#8fb0d8;--infobg:#1e242e}"
    : "@media(prefers-color-scheme:dark){:root{--fg:#e8e8e8;--dim:#9a9a9a;--line:#3a3a3a;" +
      "--warn:#d8b55a;--warnbg:#2e2a1e;--info:#8fb0d8;--infobg:#1e242e}}") +
  "body{margin:0;padding:14px 16px;font:13px/1.55 system-ui,-apple-system,'Segoe UI',sans-serif;" +
  "color:var(--fg);background:transparent}" +
  "h2{font-size:13px;margin:0 0 2px;letter-spacing:.04em;text-transform:uppercase;color:var(--dim)}" +
  "section{margin:0 0 18px}" +
  "p{margin:0 0 8px}" +
  ".dim{color:var(--dim)}" +
  // An identifier, wherever one sits beside a title. Monospaced rather than
  // merely dim, because `.dim` is the heading colour too and an id inside an
  // `h2` would otherwise be indistinguishable from the title it qualifies —
  // and the transforms are reset for the same reason: `text-transform` on a
  // heading must not reach a string the professor may have to type back.
  ".id{font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dim);" +
  "text-transform:none;letter-spacing:0;font-weight:400}" +
  ".row{display:flex;gap:10px;justify-content:space-between;padding:5px 0;" +
  "border-bottom:1px solid var(--line)}" +
  ".row:last-child{border-bottom:none}" +
  ".k{min-width:0;overflow-wrap:anywhere}" +
  ".v{color:var(--dim);white-space:nowrap}" +
  ".todo{background:var(--warnbg);color:var(--warn);border-radius:3px;padding:0 5px;" +
  "font-size:12px;white-space:nowrap}" +
  // Drafted, not missing. A second badge rather than a second shade of the
  // TODO amber, because the two say opposite things about whose move it is:
  // amber is "nobody has written this", blue is "it is written and waiting for
  // you to approve it". One colour with two meanings would make the Checklist
  // unreadable at a glance, which is the only thing it is for.
  ".draft{background:var(--infobg);color:var(--info);border-radius:3px;padding:0 5px;" +
  "font-size:12px;white-space:nowrap}" +
  // The count row under a heading: `4 in the course · 2 drafted · 1 missing`.
  ".tally{color:var(--dim);font-size:12px;margin:0 0 6px}" +
  "code{font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;background:var(--warnbg);" +
  "color:var(--warn);border-radius:3px;padding:1px 5px}" +
  ".empty{border-left:3px solid var(--line);padding-left:10px;color:var(--dim)}" +
  // The filter row. Shaped after `pp-segbtn` in the browser half rather than
  // sharing it: that stylesheet belongs to the pane's own chrome and does not
  // reach inside a srcdoc frame, and one of the two had to own these five
  // lines.
  //
  // Not sticky, though a long class list argues for it. `body` here is
  // deliberately transparent so the pane's own surface shows through, and a
  // sticky bar needs an opaque background to be worth having — which would
  // mean guessing the pane's colour and painting a strip that does not quite
  // match it. A row that scrolls away beats a row that looks wrong.
  ".chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 0 10px}" +
  ".chip{font:inherit;font-size:11px;cursor:pointer;padding:2px 9px;border-radius:20px;" +
  "background:0 0;color:var(--dim);border:1px solid var(--line)}" +
  ".chip[aria-pressed=true]{color:var(--fg);font-weight:600;border-color:var(--fg)}" +
  // A link that opens a document. Shaped like the format buttons the Slides
  // list writes inline, and written here instead because two views now need
  // it — the same five declarations copied a third time is how the two halves
  // of one control start to drift apart.
  ".chip-link{color:inherit;text-decoration:none;border:1px solid var(--line);" +
  "border-radius:3px;padding:0 5px;font-size:11px;letter-spacing:.04em;white-space:nowrap}" +
  ".chip-link:hover{border-color:var(--fg)}" +
  CHAT_MARK_CSS +
  "</style>" +
  bodyHtml;

/**
 * A value the professor has not filled in yet.
 *
 * The AINAR scaffolds write the literal string `TODO` into a record where a
 * decision is owed, and it reaches here as data. Drawing it as if it were a
 * grading policy would be worse than saying nothing: the pane would show a
 * course whose policy is "TODO" and look like it had one.
 */
export const isTodo = (value) =>
  value === undefined ||
  value === null ||
  value === "" ||
  (typeof value === "string" && value.trim().toUpperCase() === "TODO");

export const todoOr = (value) =>
  isTodo(value) ? '<span class="todo">not set yet</span>' : escapeText(String(value));

/**
 * The three list views of the Course outline tab.
 *
 * Week by week answers "what happens when"; these answer "what have I got",
 * which is a different question and was previously only answerable by scrolling
 * sixteen weeks and holding the answer in your head.
 *
 * All three read the SAME `course_outline` payload the week view does, and none
 * of them computes a figure. A weight shown here and a weight shown there are
 * one number from one command — the first version of `gradingDocument` did its
 * own arithmetic and reported a correct scheme as broken, and that is the
 * mistake this whole pane is shaped to avoid.
 */

/** `2026-09-18T09:00:00+05:00` as `2026-09-18 09:00`, in the run's own offset. */
export const stamp = (value) => {
  const text = String(value ?? "");
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(text);
  if (!match) return text.slice(0, 10);
  // Sliced, not parsed: `new Date(...)` would re-render this in the machine's
  // timezone, and a deadline is a claim in the course's.
  return `${match[1]} ${match[2]}`;
};

export const rows = (entries) =>
  entries
    .map(
      ([key, value]) =>
        '<div class="row"><span class="k">' + key + '</span><span class="v">' + value + "</span></div>",
    )
    .join("");
