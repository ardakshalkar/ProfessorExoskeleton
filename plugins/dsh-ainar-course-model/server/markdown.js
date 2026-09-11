/**
 * HTML escaping, and markdown to HTML.
 *
 * A deliberate subset, not a markdown implementation, and no dependency added
 * for one: what has to render here is material this project's own skills wrote
 * to their own templates — `make-materials` writes a deck as Marp markdown,
 * `design-assessment` writes the brief students read as markdown beside the
 * YAML — so the failure mode of a construct this does not know is a line that
 * reads as its own source rather than a page that breaks.
 *
 * Two readers, which is why it lives here rather than beside either of them:
 *
 * * `dsh-professor-pane` serves a brief or a deck over loopback, rendered, so
 *   the professor reads the document instead of downloading the file;
 * * `lms assignment-push` sends an assessment's brief to Canvas as the
 *   assignment description, which is HTML.
 *
 * A second copy of these regular expressions would mean a brief that reads one
 * way in the pane and another way to the class.
 *
 * What is escaped and what is refused is the security-relevant part. The input
 * is a file somebody else wrote — a brief downloaded from anywhere, a handout
 * off a colleague's drive — so text is escaped BEFORE anything marks it up,
 * and a `javascript:` URL keeps its words and loses its anchor.
 * `ainar-node/test/markdown.test.ts` pins both.
 */

/**
 * The three characters that would otherwise be markup.
 *
 * Text, not attributes: a value going inside `href="…"` needs the quote
 * closed too, which is `escapeAttribute`.
 */
export const escapeText = (value) =>
  String(value).replace(
    /[&<>]/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character],
  );

/**
 * `escapeText` for a value going inside a quoted attribute.
 *
 * `escapeText` handles `&`, `<` and `>`, which is enough for text between tags
 * and one character short for text inside `href="…"`. Every attribute this
 * renderer writes carries a string out of a markdown file somebody
 * downloaded, so the quote is closed here rather than assumed away.
 */
export const escapeAttribute = (value) => escapeText(value).replace(/"/g, "&quot;");

/**
 * A URL a rendered brief may point at, or null.
 *
 * `http`, `https`, `mailto` and a relative reference. The refusal that matters
 * is `javascript:` — the frame this renders into is served `allow-same-origin`
 * and therefore WITHOUT `allow-scripts`, so a script could not run in it
 * today, but a link whose safety depends on a sandbox flag two files away is a
 * link worth refusing where it is written.
 */
export const markdownHref = (value) => {
  const text = String(value).trim();
  if (text === "") return null;
  if (/^(https?:|mailto:)/i.test(text)) return text;
  // A scheme is anything before a colon that could be one; a path or a
  // fragment has no colon before its first slash.
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return null;
  return text;
};

/**
 * The spans inside one line: code, images, links, bold, italic.
 *
 * Escaped FIRST, then marked up. A brief may quote HTML — an assignment about
 * web scraping certainly will — and escaping afterwards would either undo the
 * tags this function just wrote or leave the file's own through. Working on
 * already-escaped text means every tag on screen is one of ours.
 *
 * Code spans are lifted out before anything else runs, because `**` between
 * backticks is two asterisks a student is meant to type and not emphasis. The
 * placeholder is NUL, written as an escape rather than as the byte, and it
 * works as a sentinel precisely because no text file carries one.
 */
/**
 * The URL inside `](…)`, allowing one level of parentheses within it.
 *
 * `[^)\s]+` was the obvious spelling and it was wrong twice over. A link to
 * `…/wiki/Overfitting_(statistics)` lost its closing bracket, and a REFUSED
 * link — `[x](javascript:alert(1))` — matched only as far as the first `)`,
 * leaving the second one on the page as stray text next to a label whose
 * anchor had rightly been dropped. Nesting deeper than one level is not
 * handled and cannot be by a regular expression; such a URL keeps its label
 * and loses its anchor, which is this function's answer to every address it
 * cannot read.
 */
const URL_IN_PARENS = "((?:[^()\\s]|\\([^()\\s]*\\))+)";

export const markdownInline = (text) => {
  const code = [];
  const html = escapeText(text)
    .replace(/`([^`\n]+)`/g, (_whole, body) => {
      code.push(body);
      return "\u0000" + (code.length - 1) + "\u0000";
    })
    .replace(
      new RegExp("!\\[([^\\]]*)\\]\\(" + URL_IN_PARENS + "\\)", "g"),
      (whole, alt, href) => {
        const url = markdownHref(href);
        return url === null
          ? whole
          : '<img alt="' + escapeAttribute(alt) + '" src="' + escapeAttribute(url) + '">';
      },
    )
    .replace(
      new RegExp("\\[([^\\]]+)\\]\\(" + URL_IN_PARENS + "\\)", "g"),
      (whole, label, href) => {
        const url = markdownHref(href);
        // The label survives a refused URL: a brief that links somewhere this
        // will not follow still reads as a sentence.
        return url === null
          ? label
          : '<a href="' +
              escapeAttribute(url) +
              '" target="_blank" rel="noopener">' +
              label +
              "</a>";
      },
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  return html.replace(
    /\u0000(\d+)\u0000/g,
    (_whole, index) => "<code>" + code[Number(index)] + "</code>",
  );
};

/** The line opens a block, and so ends the paragraph or item above it. */
const startsMarkdownBlock = (line) =>
  line.trim() === "" ||
  /^```/.test(line) ||
  /^#{1,6}\s/.test(line) ||
  /^>/.test(line) ||
  /^\s*([-*+]\s|\d+[.)]\s)/.test(line) ||
  /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
  /^\s*\|/.test(line);

/**
 * Markdown to HTML, in the subset a brief and a deck are actually written in.
 *
 * Headings, paragraphs, both kinds of list, fenced code, blockquotes, tables,
 * rules, and the inline spans above. Not a markdown implementation, and no
 * dependency added for one: what has to render here is material this
 * project's own skills wrote to their own templates, and the failure mode of a
 * construct this does not know is a line that reads as its own source rather
 * than a page that breaks.
 *
 * YAML front matter is dropped — at the top only, and only when the line after
 * the opening fence looks like a key. A Marp deck opens with
 * `---`, `marp: true`, `---` and then separates its slides with `---`; the key
 * test is what keeps the first one metadata and every later one a rule.
 */
export const renderMarkdown = (source) => {
  const lines = String(source).replace(/\r\n?/g, "\n").split("\n");
  let index = 0;
  if (/^---\s*$/.test(lines[0] ?? "") && /^[A-Za-z_][\w.-]*\s*:/.test(lines[1] ?? "")) {
    for (let scan = 2; scan < lines.length; scan += 1) {
      if (/^(---|\.\.\.)\s*$/.test(lines[scan])) {
        index = scan + 1;
        break;
      }
    }
  }

  const out = [];
  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    // Fenced code. An unclosed fence runs to the end of the file rather than
    // being refused: half a document is still worth reading.
    if (/^```/.test(line)) {
      const body = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1;
      out.push("<pre><code>" + escapeText(body.join("\n")) + "</code></pre>");
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      out.push("<h" + level + ">" + markdownInline(heading[2].trim()) + "</h" + level + ">");
      index += 1;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push("<hr>");
      index += 1;
      continue;
    }

    // A table is a row of pipes UNDER a row of pipes whose cells are dashes.
    // The separator is what tells a rubric from a sentence containing a pipe,
    // so a header row with nothing beneath it falls through to a paragraph
    // rather than opening a one-row table.
    if (/^\s*\|/.test(line) && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[index + 1] ?? "")) {
      const cells = (row) =>
        row
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((cell) => cell.trim());
      const head = cells(line);
      index += 2;
      const body = [];
      while (index < lines.length && /^\s*\|/.test(lines[index])) {
        body.push(cells(lines[index]));
        index += 1;
      }
      out.push(
        "<table><thead><tr>" +
          head.map((cell) => "<th>" + markdownInline(cell) + "</th>").join("") +
          "</tr></thead><tbody>" +
          body
            .map(
              (row) =>
                "<tr>" +
                // Padded to the header's width, so a row that dropped a
                // trailing empty cell does not pull the next column left.
                head
                  .map((_column, at) => "<td>" + markdownInline(row[at] ?? "") + "</td>")
                  .join("") +
                "</tr>",
            )
            .join("") +
          "</tbody></table>",
      );
      continue;
    }

    if (/^>/.test(line)) {
      const body = [];
      while (index < lines.length && /^>/.test(lines[index])) {
        body.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      out.push("<blockquote>" + markdownInline(body.join(" ")) + "</blockquote>");
      continue;
    }

    // Lists, flat. A nested sub-point is flattened to the outer level rather
    // than guessed at: it then reads as a point, which is wrong and legible,
    // where a mis-closed `<ul>` is wrong and is not.
    const bullet = /^\s*([-*+]|\d+[.)])\s+/.exec(line);
    if (bullet) {
      const ordered = /\d/.test(bullet[1]);
      const items = [];
      while (index < lines.length) {
        const next = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(lines[index]);
        if (!next || /\d/.test(next[1]) !== ordered) break;
        const body = [next[2]];
        index += 1;
        // A continuation line — prose under an item, not a new item.
        while (index < lines.length && !startsMarkdownBlock(lines[index])) {
          body.push(lines[index].trim());
          index += 1;
        }
        items.push("<li>" + markdownInline(body.join(" ")) + "</li>");
      }
      out.push((ordered ? "<ol>" : "<ul>") + items.join("") + (ordered ? "</ol>" : "</ul>"));
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && !startsMarkdownBlock(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    out.push("<p>" + markdownInline(paragraph.join(" ")) + "</p>");
  }

  return out.join("\n");
};
