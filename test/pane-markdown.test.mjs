/**
 * The pane's markdown renderer.
 *
 *     node --test test/pane-markdown.test.mjs
 *
 * This is the one part of the pane's server half that is a pure function of a
 * string, and it is the part that most needs pinning: it turns a file somebody
 * else wrote — a brief drafted by a skill, a deck generated from a template, a
 * handout downloaded from anywhere — into HTML that is then framed inside the
 * harness. Two kinds of failure matter, and both are here:
 *
 * - a document that renders as something other than what it says, and
 * - a document that renders as MARKUP it did not ask for.
 *
 * No workspace, no web server, no harness. `lib/markdown.js` imports nothing
 * but itself, which is why the module exists separately from `index.js`.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  escapeAttribute,
  escapeText,
  markdownHref,
  markdownInline,
  renderMarkdown,
} from "../plugins/dsh-professor-pane/lib/markdown.js";

/** The source as one string, written as lines so the test reads like a file. */
const md = (...lines) => lines.join("\n");

// --------------------------------------------------------------- escaping

test("escapeText handles the three characters that would be markup", () => {
  assert.equal(escapeText("a < b && c > d"), "a &lt; b &amp;&amp; c &gt; d");
});

test("escapeAttribute closes the quote too", () => {
  // The difference between the two, and the reason there are two: this string
  // inside href="…" would otherwise end the attribute and start another.
  assert.equal(escapeAttribute('x" onload="boom'), "x&quot; onload=&quot;boom");
});

// -------------------------------------------------------------------- links

test("a brief may link out over http, https and mailto", () => {
  assert.equal(markdownHref("https://example.edu/x"), "https://example.edu/x");
  assert.equal(markdownHref("http://example.edu/x"), "http://example.edu/x");
  assert.equal(markdownHref("mailto:ardak@example.edu"), "mailto:ardak@example.edu");
  assert.equal(markdownHref("figures/plot.png"), "figures/plot.png");
  assert.equal(markdownHref("#rubric"), "#rubric");
});

test("every other scheme is refused", () => {
  for (const hostile of [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "vbscript:msgbox",
    "file:///etc/passwd",
    "   ",
  ]) {
    assert.equal(markdownHref(hostile), null, hostile);
  }
});

test("a URL with parentheses in it survives whole", () => {
  // Wikipedia's disambiguated titles are the common case, and the first
  // version of this stopped at the inner `)` — leaving a broken link and a
  // stray bracket on the page.
  assert.equal(
    markdownInline("[overfitting](https://en.wikipedia.org/wiki/Overfitting_(statistics))"),
    '<a href="https://en.wikipedia.org/wiki/Overfitting_(statistics)"' +
      ' target="_blank" rel="noopener">overfitting</a>',
  );
});

test("a refused link keeps its words and loses its anchor", () => {
  // The sentence still reads. This is the behaviour to preserve: a brief that
  // links somewhere unfollowable is a brief with a dead link in it, not a
  // brief the professor cannot open.
  assert.equal(
    markdownInline("Read [the notes](javascript:alert(1)) first"),
    "Read the notes first",
  );
});

// ------------------------------------------------------------------- inline

test("HTML in the source is text, never markup", () => {
  assert.equal(
    markdownInline("Escape `<` in your output, not <script>alert(1)</script>"),
    "Escape <code>&lt;</code> in your output, not &lt;script&gt;alert(1)&lt;/script&gt;",
  );
});

test("an asterisk inside a code span is an asterisk", () => {
  // The reason code spans are lifted out before emphasis runs: a student told
  // to type `**bold**` must see the asterisks.
  assert.equal(markdownInline("type `**bold**` exactly"), "type <code>**bold**</code> exactly");
});

test("bold and italic, and a bare asterisk left alone", () => {
  assert.equal(markdownInline("**hand in** a *PDF*"), "<strong>hand in</strong> a <em>PDF</em>");
});

test("a number between spaces is not mistaken for the code placeholder", () => {
  // The placeholder is NUL-delimited precisely so that this is impossible; a
  // space-delimited one would have eaten the 4 and printed the code span in
  // its place.
  assert.equal(
    markdownInline("at most 4 pages, and `read_csv` for the data"),
    "at most 4 pages, and <code>read_csv</code> for the data",
  );
});

test("an image keeps its alt text and is escaped both ways", () => {
  assert.equal(
    markdownInline('![a "wide" plot](figures/plot.png)'),
    '<img alt="a &quot;wide&quot; plot" src="figures/plot.png">',
  );
});

// -------------------------------------------------------------------- blocks

test("headings become headings at their own level", () => {
  assert.equal(
    renderMarkdown(md("# Brief", "", "## What to hand in", "", "#### Notes")),
    "<h1>Brief</h1>\n<h2>What to hand in</h2>\n<h4>Notes</h4>",
  );
});

test("a hash with no space is not a heading", () => {
  assert.equal(renderMarkdown("#hashtag"), "<p>#hashtag</p>");
});

test("wrapped lines are one paragraph", () => {
  assert.equal(
    renderMarkdown(md("Prepare the dataset", "and report what you chose.", "", "Then hand it in.")),
    "<p>Prepare the dataset and report what you chose.</p>\n<p>Then hand it in.</p>",
  );
});

test("both kinds of list, and the switch between them", () => {
  assert.equal(
    renderMarkdown(md("- one", "- two", "", "1. first", "2. second")),
    "<ul><li>one</li><li>two</li></ul>\n<ol><li>first</li><li>second</li></ol>",
  );
});

test("a list item's continuation line belongs to the item", () => {
  assert.equal(
    renderMarkdown(md("- A report of at most", "  four pages, as PDF.", "- The notebook.")),
    "<ul><li>A report of at most four pages, as PDF.</li><li>The notebook.</li></ul>",
  );
});

test("a rubric table, padded to the header's width", () => {
  // The last row is short by a cell — a thing real markdown files do — and
  // must not pull the next column left.
  assert.equal(
    renderMarkdown(
      md(
        "| Criterion | Excellent | Weak |",
        "|---|:--|---|",
        "| Reasoning | justified | absent |",
        "| Reproducibility | runs |",
      ),
    ),
    "<table><thead><tr><th>Criterion</th><th>Excellent</th><th>Weak</th></tr></thead><tbody>" +
      "<tr><td>Reasoning</td><td>justified</td><td>absent</td></tr>" +
      "<tr><td>Reproducibility</td><td>runs</td><td></td></tr>" +
      "</tbody></table>",
  );
});

test("a line of pipes with no separator under it is a sentence", () => {
  // `a | b` is prose in a brief about shell commands, and opening a table on it
  // would swallow the paragraph.
  assert.equal(renderMarkdown("| grep is a pipe, not a table"), "<p>| grep is a pipe, not a table</p>");
});

test("a fenced block keeps its own characters, and its newlines", () => {
  assert.equal(
    renderMarkdown(md("```python", 'df = read_csv("marks.csv")', "if a < b: pass", "```")),
    '<pre><code>df = read_csv("marks.csv")\nif a &lt; b: pass</code></pre>',
  );
});

test("an unclosed fence runs to the end rather than being refused", () => {
  assert.equal(renderMarkdown(md("```", "half a file")), "<pre><code>half a file</code></pre>");
});

test("a blockquote, joined into one", () => {
  assert.equal(
    renderMarkdown(md("> Late work loses 10% a day,", "> as the policy says.")),
    "<blockquote>Late work loses 10% a day, as the policy says.</blockquote>",
  );
});

test("three dashes are a rule", () => {
  assert.equal(renderMarkdown(md("before", "", "---", "", "after")), "<p>before</p>\n<hr>\n<p>after</p>");
});

// -------------------------------------------------------------- front matter

test("a Marp deck loses its front matter and keeps its slide breaks", () => {
  // The whole reason the front-matter test looks at the SECOND line: `---` is
  // both the opening fence and, three slides later, a slide break. A key after
  // it is what distinguishes the two.
  assert.equal(
    renderMarkdown(
      md("---", "marp: true", "theme: default", "---", "", "# Slide one", "", "---", "", "# Slide two"),
    ),
    "<h1>Slide one</h1>\n<hr>\n<h1>Slide two</h1>",
  );
});

test("a document that opens with a rule keeps it", () => {
  assert.equal(renderMarkdown(md("---", "", "# Not front matter")), "<hr>\n<h1>Not front matter</h1>");
});

test("an unterminated front matter block is not front matter", () => {
  // Nothing closes it, so dropping to the end of the file would render an
  // empty page for a document that has content in it.
  assert.equal(
    renderMarkdown(md("---", "marp: true", "", "# Still here")),
    "<hr>\n<p>marp: true</p>\n<h1>Still here</h1>",
  );
});

// --------------------------------------------------------------------- misc

test("an empty document renders as nothing, not as a failure", () => {
  assert.equal(renderMarkdown(""), "");
  assert.equal(renderMarkdown("\n\n  \n"), "");
});

test("CRLF is normalised, so a Windows checkout renders the same", () => {
  assert.equal(renderMarkdown("# One\r\n\r\nTwo\r\n"), "<h1>One</h1>\n<p>Two</p>");
});

test("no NUL survives into the output", () => {
  // The code-span placeholder. A leftover would reach the browser as a raw
  // control character inside the harness's own frame.
  const rendered = renderMarkdown(md("Use `a` and `b` and `c`.", "", "| a | b |", "|---|---|", "| `x` | y |"));
  assert.ok(!rendered.includes("\u0000"), rendered);
});
