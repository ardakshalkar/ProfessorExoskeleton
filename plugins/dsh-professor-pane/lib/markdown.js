/**
 * The pane's half of the markdown layer: the stylesheet a rendered document
 * needs, and nothing else.
 *
 * The renderer itself moved to the course model — `ainar-node/src/markdown.ts`,
 * mirrored into `server/markdown.js` — because a second reader appeared:
 * `lms assignment-push` sends an assessment's brief to Canvas as the
 * assignment description, and a brief that read one way in this pane and
 * another way to the class would be two renderers disagreeing about one file.
 *
 * Re-exported rather than imported directly by `index.js` so that the pane has
 * one place to look for "how does a document become HTML here", and so the
 * stylesheet below sits beside the thing it styles.
 *
 *     node --test test/pane-markdown.test.mjs
 */

export {
  escapeAttribute,
  escapeText,
  markdownHref,
  markdownInline,
  renderMarkdown,
} from "@ainar/core/src/markdown.ts";

/**
 * What a rendered document needs that `documentPage` does not give it.
 *
 * `documentPage` styles an `h2` as a section label — small, uppercase, dim —
 * because in every other view an `h2` IS one. In a brief it is the heading of
 * a section a student reads, so the whole scale is restated here under `.md`,
 * along with the elements no other view in this pane contains: a table, a code
 * block, a blockquote, an image.
 *
 * Wide tables scroll inside their own box. This is framed over the harness at
 * a width nobody chose, and a page that scrolls sideways as a whole is the one
 * thing worse than a column that is too narrow.
 */
export const MARKDOWN_STYLE =
  "<style>" +
  ".md{max-width:46rem;margin:0 auto}" +
  ".md h1,.md h2,.md h3,.md h4,.md h5,.md h6{color:var(--fg);text-transform:none;" +
  "letter-spacing:0;line-height:1.3;margin:1.4em 0 .4em}" +
  ".md>:first-child{margin-top:0}" +
  ".md h1{font-size:20px}.md h2{font-size:17px}.md h3{font-size:15px}" +
  ".md h4,.md h5,.md h6{font-size:13px}" +
  ".md h1,.md h2{border-bottom:1px solid var(--line);padding-bottom:.25em}" +
  ".md p,.md ul,.md ol,.md blockquote,.md pre,.md table{margin:0 0 .9em}" +
  ".md li{margin:0 0 .25em}" +
  ".md ul,.md ol{padding-left:1.4em}" +
  ".md a{color:inherit;text-decoration:underline;text-underline-offset:2px}" +
  ".md strong{font-weight:600}" +
  // Not the `code` of the other views. That one is amber on amber, which is
  // this pane's badge for a decision nobody has made; a backtick in a brief is
  // a filename, and painting it as a warning would be a claim about it.
  ".md code{font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;background:0 0;" +
  "color:inherit;border:1px solid var(--line);border-radius:3px;padding:0 4px}" +
  ".md pre{background:0 0;border:1px solid var(--line);border-radius:4px;padding:9px 11px;" +
  "overflow-x:auto}" +
  ".md pre code{border:none;padding:0;font-size:12px;white-space:pre}" +
  ".md blockquote{margin-left:0;border-left:3px solid var(--line);padding:0 0 0 12px;" +
  "color:var(--dim)}" +
  // `display:block` is what makes `overflow-x` apply to a table at all.
  ".md table{display:block;overflow-x:auto;border-collapse:collapse;font-size:12px;" +
  "max-width:100%}" +
  ".md th,.md td{border:1px solid var(--line);padding:4px 8px;text-align:left;" +
  "vertical-align:top}" +
  ".md th{font-weight:600;color:var(--dim)}" +
  ".md img{max-width:100%;height:auto}" +
  ".md hr{border:none;border-top:1px solid var(--line);margin:1.4em 0}" +
  "</style>";

