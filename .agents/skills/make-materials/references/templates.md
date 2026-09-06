# Output templates

A template is a **fixed shape for something a skill produces**, kept in a file
next to that skill, so the shape is chosen once by the professor rather than
re-decided by a model on every run.

Without them, two runs of `/course-dashboard` a fortnight apart produce two sites
that are the same course in different clothes — different headings, different
order, a stamp on one and not the other. Nothing is wrong with either, and that
is the problem: there is no version to compare against, and no way to say "the
usual one".

## Where they live

```
skills/<skill>/templates/
    templates.yaml      the menu, and the only place a template is named
    <id>.css            a style sheet, for a surface a command renders
    <id>.tmpl           a markup template: which sections, in what order
    <id>.md             a document skeleton, for a surface a skill writes
    shell.html          the frame a hand-built page is filled into
    blocks.html         the parts that frame is filled with
```

They live beside the skill and not in one shared directory on purpose. The public
page and the private dashboards are different jobs, and a shared pile is a pile
somebody eventually points at the wrong one.

`plugin/sync_skills.py` copies the whole directory into the shipped plugin, so a
colleague with the plugin and no repository has the same menu.

## The menu

`templates.yaml` is what the skill reads out loud:

```yaml
surface: course-page      # the skill these are for; a command refuses a mismatch
public: true              # true only for the one surface students can open
default: plain            # what to use when the professor expresses no preference
templates:
  - id: plain
    file: plain.css
    name: Plain
    suits: reading on a phone, which is how most students will meet it
```

Every listed file must exist and every file must be listed —
`tests/test_templates.py` checks both, because a menu that offers a template that
is not there fails after the professor has chosen.

## How a skill uses one

1. Read `templates.yaml` from its own directory and **show the professor the
   list**, marking the default.
2. Use what they choose. If they express no preference, use the default and say
   in the report which one that was — never pick a different one because the
   content seemed to suit it.
3. Fill the template. Do not restructure it: a heading you thought redundant is a
   heading the next run will also think redundant, and then the two documents
   have different sections again.
4. If the material genuinely does not fit any template, **say so and ask**. A
   template edited into a new shape is a new template nobody chose.

## What a template may and may not do

**May:** colours, type, spacing, page-break behaviour, the order and wording of
the standing sections, placeholders, the notes and legends a surface always
carries.

**May not:**

- **Carry a claim.** No outcome, no concept, no criterion, no weight — not even
  as an example that could be mistaken for one. A placeholder in a template is
  `TODO` or an obvious slot, never a plausible sentence.
- **Carry a figure.** No number, no total, no percentage. A template with a
  number in it is a number nobody computed.
- **Run something, or fetch something.** A style sheet may carry no markup, no
  `@import` and no `url()` naming a host; a structure may carry no `<script>`,
  `src=`, `<img>`, `<iframe>` or `javascript:`. Both are refused by
  `ainar/templates.py` rather than sanitised. The page is written for a URL
  students can open, and it is asserted to carry no script and make no request.
- **Show a figure the payload does not have.** This is a bound rather than a
  rule: the public page's structure can only interpolate what
  `ainar/outline.py` produced, and that payload carries no mark, no submission
  and no enrollment — `tests/test_outline.py` asserts it.
- **Cross surfaces.** A `course-dashboard` template styles blocks the public page
  does not have. The command stops rather than rendering it.

## Structure templates

The public page is the one surface whose markup is a template file rather than a
function: `ainar/mcp/widget-assets/course-outline.tmpl` holds which sections the
page has and in what order, and `ainar page --structure <id>` renders a different
arrangement from `templates/`.

It is still not a second renderer. The same view runs, handed the same payload
from `ainar/outline.py`, and a template cannot show a mark because there is no
mark in what it can see. What it is checked for is the two things markup can do
that a style sheet cannot — run something and fetch something — and both are
refused: no `<script>`, no `src=`, no `<img>`, no `<iframe>`, no `javascript:`.

The language has escaped `{{ paths }}`, `{% if %}` and `{% for %}`, and nothing
else. No filters, no expressions, no arithmetic, and **no way to ask for
unescaped output** — `{{{` is a parse error. That last one is the reason it is
not Twig or Handlebars: every general engine ships an escape hatch, and this page
is written for a URL a student opens.

Three statements must survive any edit to a structure, and
`tests/test_templates.py` asserts each against every listed one: an unplanned
week says it is unplanned, a weight nobody set says so rather than printing a
number, and the closing note says the page carries nothing derived from student
work.

The default arrangement is not listed in `templates.yaml`, deliberately — with no
`default_structure`, the command uses the one it ships with. A copy of it beside
the skill would be the same markup twice, and the two would disagree within a
term.

## Style sheets

Appended after the surface's own CSS, so they restate rather than replace. Keep
to custom properties and the classes the surface already emits; a selector for a
class that does not exist is a template that silently does nothing.

Self-contained, always: no `@import`, no web font fetched over the network, no
remote image. These pages open from `file://` on a machine with no connection,
and that property is worth more than a typeface.

## Skeletons

`shell.html` is the frame — head, title, the stamp, the banner a draft carries —
with `{{ slots }}` in it. `blocks.html` holds the repeating parts, each between
`<!-- block: name -->` markers, to be copied and filled.

Two rules when filling one:

- **No `{{ slot }}` survives into the output.** An unfilled slot is a visible
  defect on a page somebody will read months later.
- **A slot with nothing to put in it gets the honest words, not a zero.** Every
  skeleton here carries the phrasing for that — "never assessed", "no command
  produces this" — because that is exactly the sentence a model reaches past when
  it is writing markup freehand.

## Adding one

Write the file, add the entry to `templates.yaml` — `templates:` for a style,
`structures:` for a layout — run `python -m pytest tests/test_templates.py`, and
regenerate the plugin with `python plugin/sync_skills.py`. If the new template is for a surface a command renders,
check it against a real course before offering it — CSS fails silently and a
template nobody tried is a page nobody can read.
