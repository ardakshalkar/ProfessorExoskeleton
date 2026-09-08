/**
 * The class as a grid, rendered to a self-contained HTML file. Ported from
 * `ainar/dashboard.py`.
 *
 * Deliberately plain: no scripts, no fonts, no network. It opens from disk, it
 * prints, and it can be handed to a colleague without dragging a toolchain
 * along.
 *
 * Every cell shows its number as well as its colour. A heatmap that only encodes
 * in hue is unreadable to a good fraction of any faculty, and unreadable in
 * print, and this is the kind of thing that gets printed.
 */

import { type CourseBundle } from "./bundle.ts";
import { dashboardPayload } from "./progress.ts";

/**
 * Five bands rather than a continuous ramp — a cohort of twenty-seven does not
 * support the precision a gradient implies.
 */
export const BANDS: [number, string, string][] = [
  [0.85, "b5", "strong"],
  [0.7, "b4", "secure"],
  [0.55, "b3", "mixed"],
  [0.35, "b2", "weak"],
  [0.0, "b1", "very weak"],
];

/**
 * The page's own style sheet, byte for byte as `dashboard.py` declares it.
 *
 * Inline rather than an asset file for the reason it is inline there: the markup
 * below is written in this module too, and a class name that exists in only one
 * of the two files is the bug this arrangement makes impossible to introduce
 * without seeing it.
 */
const STYLE = `
:root {
  --bg: #ffffff; --fg: #1a1a1a; --muted: #6b6b6b; --line: #e0e0e0;
  --b1: #f4c7c3; --b2: #f8ddb8; --b3: #f2ecc0; --b4: #cfe3c4; --b5: #a8d5a2;
  --none: #f6f6f6; --none-fg: #9a9a9a;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #16181c; --fg: #e8e8e8; --muted: #9a9a9a; --line: #2e3239;
    --b1: #6b3a37; --b2: #6d5730; --b3: #5f5c2c; --b4: #3f5a38; --b5: #2f6b3c;
    --none: #1e2126; --none-fg: #6b6b6b;
  }
}
:root[data-theme="dark"] {
  --bg: #16181c; --fg: #e8e8e8; --muted: #9a9a9a; --line: #2e3239;
  --b1: #6b3a37; --b2: #6d5730; --b3: #5f5c2c; --b4: #3f5a38; --b5: #2f6b3c;
  --none: #1e2126; --none-fg: #6b6b6b;
}
:root[data-theme="light"] {
  --bg: #ffffff; --fg: #1a1a1a; --muted: #6b6b6b; --line: #e0e0e0;
  --b1: #f4c7c3; --b2: #f8ddb8; --b3: #f2ecc0; --b4: #cfe3c4; --b5: #a8d5a2;
  --none: #f6f6f6; --none-fg: #9a9a9a;
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 2rem 1.25rem; background: var(--bg); color: var(--fg);
  font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
main { max-width: 78rem; margin: 0 auto; }
h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
h2 { font-size: 1.05rem; margin: 2.5rem 0 .5rem; }
.sub { color: var(--muted); margin: 0 0 1.5rem; font-size: .9rem; }
.scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 6px; }
table { border-collapse: collapse; width: 100%; font-size: .85rem; }
th, td { padding: .45rem .6rem; text-align: center; border-bottom: 1px solid var(--line); }
th { font-weight: 600; white-space: nowrap; }
thead th { position: sticky; top: 0; background: var(--bg); }
th.row { text-align: left; white-space: normal; min-width: 15rem; font-weight: 500; }
th.row small { display: block; color: var(--muted); font-weight: 400; }
td.cell { font-variant-numeric: tabular-nums; }
td.b1 { background: var(--b1); } td.b2 { background: var(--b2); }
td.b3 { background: var(--b3); } td.b4 { background: var(--b4); }
td.b5 { background: var(--b5); }
td.none { background: var(--none); color: var(--none-fg); }
.legend { display: flex; flex-wrap: wrap; gap: .75rem; margin: .75rem 0 0; font-size: .8rem;
          color: var(--muted); align-items: center; }
.swatch { display: inline-block; width: .85rem; height: .85rem; border-radius: 3px;
          vertical-align: -1px; margin-right: .3rem; border: 1px solid var(--line); }
.note { color: var(--muted); font-size: .85rem; margin-top: 1rem; }
.warn { border-left: 3px solid var(--b2); padding: .5rem .75rem; margin-top: 1rem;
        background: var(--none); font-size: .85rem; }
`;

/** Which band a proportion falls in, and what to call it. */
const band = (proportion: number | null): [string, string] => {
  if (proportion === null || proportion === undefined) return ["none", "no evidence"];
  for (const [threshold, css, label] of BANDS) {
    if (proportion >= threshold) return [css, label];
  }
  return ["b1", "very weak"];
};

/**
 * `html.escape`, which escapes the quote characters as well as the three that
 * open markup. These strings land in `title="…"` as well as in text.
 */
const e = (text: unknown): string =>
  String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

/**
 * `f"{value:.0%}"` — a proportion as a whole-number percentage.
 *
 * Python's format rounds half to even on the double's decimal expansion; the
 * values here are two-decimal proportions, which cannot land on a half percent,
 * so `Math.round` cannot disagree. See `scoring.ts` for the case where it can.
 */
const percent = (value: number): string => `${Math.round(value * 100)}%`;

const cell = (entry: Record<string, any>): string => {
  const [css, label] = band(entry.proportion);
  if (entry.evidence === 0) return '<td class="cell none" title="never assessed">·</td>';
  const text = entry.proportion === null ? "—" : percent(entry.proportion);
  let tooltip = `${label} · ${entry.evidence} piece(s) of evidence`;
  if (entry.state) tooltip += ` · recorded state: ${entry.state}`;
  return `<td class="cell ${css}" title="${e(tooltip)}">${text}</td>`;
};

/**
 * The grid, optionally wearing a template.
 *
 * `style` is appended after `STYLE` and can only restate what is already
 * declared there — the bands, the type, the spacing. It cannot add a column,
 * because it is a style sheet and the markup below is written here.
 */
export const renderHtml = (
  bundle: CourseBundle,
  courseVersionId: string,
  { on, style = "" }: { on?: string; style?: string } = {},
): string => {
  const data = dashboardPayload(bundle, courseVersionId) as Record<string, any>;
  const students = data.students as string[];
  const generated = on ?? new Date().toISOString().slice(0, 10);

  const rows = (data.concepts as Record<string, any>[]).map((row) => {
    const prerequisites = row.prerequisites.length
      ? `<small>after ${e(row.prerequisites.join(", "))}</small>`
      : "";
    const cells = (row.cells as Record<string, any>[]).map(cell).join("");
    const mean = row.class_mean === null ? "—" : percent(row.class_mean);
    return (
      `<tr><th class="row">${e(row.title)}${prerequisites}</th>` +
      `${cells}<td class="cell"><strong>${mean}</strong></td>` +
      `<td class="cell">${e(row.coverage)}</td></tr>`
    );
  });

  const capabilityRows = (data.capabilities as Record<string, any>[]).map((row) => {
    const cells = (row.cells as Record<string, any>[])
      .map(
        (entry) =>
          `<td class="cell${entry.level ? "" : " none"}">${entry.level ? entry.level : "·"}</td>`,
      )
      .join("");
    const top = row.max_level ? `<small>of ${row.max_level}</small>` : "";
    return `<tr><th class="row">${e(row.title)}${top}</th>${cells}</tr>`;
  });

  const headers = students.map((student) => `<th>${e(student)}</th>`).join("");
  const legend = BANDS.map(
    ([, css, label]) =>
      `<span><span class="swatch" style="background:var(--${css})"></span>${label}</span>`,
  ).join("");

  const uncovered = data.totals.concepts_with_no_evidence as string[];
  const warning = uncovered.length
    ? `<div class="warn"><strong>${uncovered.length} concept(s) with no evidence at ` +
      `all:</strong> ${e(uncovered.join(", "))}. Nothing has assessed these, so the ` +
      "blank column is a gap in the assessment plan rather than in the class.</div>"
    : "";

  const capabilitySection = capabilityRows.length
    ? `<h2>Capabilities</h2>` +
      `<div class="scroll"><table><thead><tr><th class="row">Capability</th>` +
      `${headers}</tr></thead><tbody>${capabilityRows.join("")}</tbody></table></div>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(data.run.course_id)} — class progress</title>
<style>${STYLE}${style}</style></head>
<body><main>
<h1>${e(data.run.course_id)} ${e(data.run.title)} — class progress</h1>
<p class="sub">${e(data.run.id)} · ${data.totals.students} students ·
${data.totals.concepts} concepts · ${data.totals.evidence} pieces of evidence ·
generated ${generated}</p>

<h2>Concepts</h2>
<div class="scroll"><table>
<thead><tr><th class="row">Concept</th>${headers}<th>Class</th><th>Covered</th></tr></thead>
<tbody>${rows.join("")}</tbody></table></div>
<div class="legend">${legend}
<span><span class="swatch" style="background:var(--none)"></span>never assessed</span></div>
${warning}
${capabilitySection}

<p class="note">Each cell is the mean proportion of marks earned on evidence tagged with
that concept, and the number is shown as well as the colour. A blank cell means the
concept was never assessed for that student — which is not the same as a low score,
and must not be read as one. Students are shown by pseudonym; use
<code>ainar roster whois</code> to resolve one.</p>
</main></body></html>
`;
};
