---
name: course-page
description: Build the public course information page students read — the week-by-week plan, meetings with their dates and rooms, assessments with their declared weights, and the approved materials copied beside it — as static HTML ready to host. Use when the user asks for a course page or website for students, asks to visualise, draw, render or show the course, the term plan, the weeks or the syllabus, wants a widget, chart or picture of the course structure, wants to publish the syllabus or schedule, asks what students can see, or asks to build or refresh the GitHub Pages site. A request for marks, results, a gradebook or how the class is doing is /course-dashboard instead; announcing something to students on Telegram is /publish-telegram.
stage: render
requires: [modules, activities, assessments]
produces: []
writes: site
---

> **Non-negotiables.** This skill proposes; a person decides.
>
> - Write to `work/<RUN_ID>/`, never into `courses/`. Draft identifiers carry a
>   `-DRAFT-` segment so they cannot be mistaken for records.
> - **Claims come from the professor.** Never invent a learning outcome, a
>   rubric criterion or an assessment weight — write `TODO` and say what is
>   missing. Artefacts that serve an existing claim you may draft; that is the
>   job. Concepts and modules may be **proposed** from source material the
>   professor supplied, with `extensions.proposal.source` naming where each came
>   from — proposed, not invented, and inert until approved.
> - **Never run `ainar approve`,** and never `ainar lms push --target canvas-api`
>   or `--target sheets-api`. Approving your own suggestion, or posting a grade a
>   student can see, is the one place a human enters. Show the command instead.
>   **`ainar publish … --confirm` is not a way round that** — it promotes the
>   materials a publication needs, which makes it the same act performed from a
>   different direction. Only `/publish` runs it, and only on the professor's
>   explicit instruction in that request.
> - **No student name, email or institutional number in any file,** including a
>   grading comment or a lesson brief. Write the identifier.
> - Before reporting anything: `bin/ainar validate <COURSE> --drafts
>   work/<RUN_ID>`, and fix every error.
> - Never recompute by hand what a command does exactly — `score-items`,
>   `gradebook`, `extract-evidence`, `roll-up`, `calibration`, `lms plan`.
>
> These are the whole of it. Nothing outside this directory carries
> them, so treat them as the agreement itself rather than a summary of one.

# Build the course page students read

**Needs:** a modelled course, and `ainar page` for the page itself. Node makes it
static; without either, see below. This produces files and prints a command — it
never publishes.

This is **one of two visualisation surfaces and it is the public one.** It draws
the plan. The other — `/course-dashboard` — draws marks and is for the professor
alone. The rule between them has a direction: a figure derived from student work
never reaches this page, and the way to keep that true is not vigilance but
`ainar page`, which builds from the `course_outline` payload and is tested
against its own rendered bytes.

## 1. Choose the template

`templates/` beside this skill holds the style sheets this page can wear. Read
`templates.yaml`, show the professor the list, and use what they pick. If they
express no preference, use the default and say in the report which one that was —
never choose a different one because the course seemed to suit it.

There are two kinds and they answer different questions. A **style** (`.css`) is
how the page looks; `ainar/templates.py` refuses one carrying markup, an
`@import` or a `url()` naming a host, and refuses a `course-dashboard` template
outright. A **structure** (`.tmpl`) is which sections the page has and in what
order — `ainar page --structure compact` — and with none named the command uses
the arrangement it ships with, `ainar/mcp/widget-assets/course-outline.tmpl`,
which is also the file to read if the professor asks what the page contains.

Neither is a second renderer: the same view runs on the same payload, so a figure
derived from student work cannot appear through either. A structure is checked for
the two things markup can do that CSS cannot — run something, fetch something —
and refused if it does. `references/templates.md` has the convention and the list
of what a structure must keep.

## 2. Build it

```bash
bin/ainar page CSS-4008-2026-FALL --static --template plain
```

That writes `dist/pages/<RUN>/index.html` with the material copied into
`materials/` beside it. `--static` prerenders through the same widget view the
MCP server serves, so the page needs no JavaScript; without Node it would fall
back to hydrating in the browser, and `--static` makes that a failure instead of
a silent downgrade.

**A picture of this course comes from one of two places, and a general-purpose
drawing tool is neither.** `course_outline` (the MCP tool) renders it beside the
answer; `ainar page` writes it to a file. Both execute the same view over the same
payload — `ainar/mcp/widget-assets/course-outline.tmpl` — so the weeks, the
weights and the blanks are the ones the model holds. Handing hand-written markup
to a widget renderer, a chart tool or an HTML preview produces a picture of
whatever was in the conversation, and it will look exactly as authoritative.

If the tool errors, **say what it said**. `no course run '…'` and `could not be
loaded` mean the course does not load, which is a fact about the files and a
question for the professor — not a cue to draw the course from a source document
instead.

**While the command can run, let it build the page.** Not because a model
cannot write HTML, but because two renderings of one outline disagree eventually
and nothing on either page says which to believe. The command's copy is the one
tested against its own rendered bytes, and it is the same view a model draws
beside its own answer in a conversation. So while `ainar page` works: no
transcribing the YAML, no adapting `/course-dashboard`'s output, and no filling
in `fallback.html` because styling it by hand would be easier. Choosing a
template is choosing how the command's page looks.

Read its report before saying anything. It names every material it published,
everything it held back and why, and any recorded answer the safety scan could
not cover.

**Where `ainar page` is not available, you build the site yourself.** That is a
supported path rather than a fallback to apologise for: a professor on a machine
with no `ainar` on it should still get a course page. What does not change with
the renderer is what may go on the page — *Without the CLI* has the three rules
that travel and the frame to start from.

## 3. Read what it held back, and act on the reasons

The report's lines are the professor's decisions waiting to be made:

- **`a draft under work/, not approved material`** — the file is a proposal.
  Publishing it would make it look approved. Tell them it exists, and that
  either `ainar approve` or `/publish` — which promotes the materials a
  publication needs as its second press — is what changes that. Never move a
  file to make it publishable.
- **`is not a file in this repository`** — a `Document` names a path that is not
  there. That is a modelling error worth reporting; it is not yours to fix by
  pointing the record somewhere else.
- **`not readable as text, so the answer-key scan cannot cover it`** — held back
  deliberately. A PDF handout may be perfectly safe and this cannot tell, so it
  is not published. If they want it out, they hand it out themselves.
- **`in object storage` / `student work`** — normal, and a count rather than a
  list. The application holds those bytes; submissions are never publishable at
  any storage key.

If the command **refuses**, it has found material written for the marker in a
file about to be published. There is no flag for it and you must not look for
one. The fix is to take the material out of the document. Do not push a different
file, edit the check, or publish a copy with the line deleted — a page that
briefly held the answer key held it for whoever was looking, and the git history
keeps it afterwards.

## 4. Look at it

```bash
bin/ainar page CSS-4008-2026-FALL --static --out ~/Desktop/css-4008-site
```

Open `index.html` and read it as a student would:

- **Is every week either planned or honestly unplanned?** A week with no module
  says so. If several are blank, the course plan is incomplete and that is worth
  raising — `/plan-term` is where it gets fixed, not here.
- **Do the weights sum to the whole?** The page prints the total. If it says the
  grading policy is incomplete, the syllabus is incomplete: report it, offer the
  Narxoz 30/30/40 policy as a starting point, and wait. Never fill it in.
- **Do the material links resolve?** They are relative to the page.
- **Does it read with scripting off**, and on a phone? Both are how students will
  meet it.

## 5. Stop before publishing

**Publishing is a decision, and this skill does not make it.** Building the page
and putting it in front of a class are two acts, and this one is the first.
When the professor asks for the second, hand over to `/publish`, which runs
`bin/ainar publish page <RUN>` — the plan first, and the publishing run only on
an explicit instruction in that request. A grade a student can see is a
different thing again: `ainar lms push --target canvas-api` stays theirs.

Hosting is still the professor's own: prepare the files, print the commands, say
what each will do:

```bash
git push origin main
gh variable set AINAR_PAGES_RUN --body CSS-4008-2026-FALL
```

Then Settings → Pages → Source: GitHub Actions. Say plainly what that means: the
site is world-readable, the repository being private does not make the site
private, and the course plan — not the marks — is what goes public.

`.github/workflows/pages.yml` rebuilds nightly as well as on a push, because the
page marks the current week from the day it was built. It refuses to publish a
course that does not validate, and it refuses to guess which run to publish.

## 6. Report

What the page shows, what it held back and why, and what the professor still has
to decide. If anything on the page looked wrong, name the skill that fixes it
rather than fixing it here: `/plan-term` for empty weeks, `/design-assessment`
for a missing rubric, `/make-materials` for material that does not exist yet.

## Without the CLI

The page is transcription rather than computation, so this is the surface that
degrades best. **Build the site yourself here** — the professor should get a
course page from a workspace with no CLI in it, and a refusal would be the wrong
answer to a machine that has not had `pip install` run on it.

Read the model directly: `courses/<C>/course.yaml`,
`version.yaml`, `modules.yaml`, `activities.yaml` and
`assessments/`. Weeks, what is taught in each, meetings with their dates,
assessments with the weights **as recorded**. Every one of those is copying a
value out of a file, which is the safe half of what the command does.

`templates/fallback.html` is the frame to start from: fill its slots and paste
the chosen template's CSS into the second `<style>` element. It carries the
hand-written notice already, and it has no slot for a score, a mean, an
enrollment or a material file. Extend it where the course needs it — a second
page per module, a printable schedule — as long as everything below still holds.

What the command would have done and now will not, so you must:

- **Publish no material file.** The answer-key scan is what makes that safe and
  it is not running. Name the materials; do not copy them.
- **Show no figure derived from student work.** No score, no mean, no submission
  count, no enrollment.
- **Write no weight that is not in the file.** A blank weight is reported as
  blank.

Say on the page and in the report that it was written by hand and not checked by
`ainar validate`, and say it where a reader meets it rather than in a comment.
That notice is what makes this an honest second renderer instead of a silent one:
whoever opens the file can see which of the two produced it, and re-running
`ainar page` once the CLI exists is what replaces it.

`references/working-without-the-cli.md` carries the layout and the identifier
patterns.

## Rules

- **The picture comes from `course_outline` or `ainar page`.** Never from a
  generic visualisation, chart or HTML-preview tool: those draw the conversation,
  not the model, and nothing on the result says which it was.
- **`ainar page` builds it wherever it can run**, and nothing renders alongside
  a working command. Where it cannot, you build the site — from `fallback.html`,
  and the page says on its face that it was written by hand and not validated.
- **A template is appearance, and the professor picks it.** From `templates/`
  beside this skill, offered as a list. Never a dashboard's template, never one
  edited into a new shape, and `fallback.html` only when the CLI cannot run.
- **Nothing derived from student work.** No mark, no mean, no rank, no
  submission, no enrollment, not even aggregated. If the professor asks for
  class progress on this page, the answer is that it belongs to
  `/course-dashboard` and stays private.
- **Nothing written for the marker.** `answer_key`, the correct-option marker,
  `marking_guidance`, `indicates_misconception_of` and its note. The refusal has
  no override and you must not route around it.
- **Only approved material, only what the repository holds.** A draft under
  `work/` published looks exactly like a handout.
- **You do not publish here.** Not `git push`, not enabling Pages, not `gh api`.
  Print the command, say what it does, stop. Putting the page in front of the
  class is `/publish`, on the professor's explicit instruction in that request.
- **Say what is incomplete.** A hollow grading section, an unplanned half of the
  term, a material that does not exist — report it rather than making the page
  look finished.
