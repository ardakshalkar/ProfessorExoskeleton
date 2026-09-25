---
name: course-dashboard
description: Build the professor's private view of how a course run is actually going — class progress by concept, gradebook totals, per-assessment results, item difficulty and what is left to grade — as self-contained pages that never leave their machine. Use when the user asks how the class is doing, wants a dashboard or a progress site, asks to visualise marks, results, scores or a gradebook, asks which assessment went badly, or wants to click through the course while editing it. A request to visualise the course itself — the weeks, the plan, the syllabus — is /course-page instead.
stage: render
requires: [evaluations]
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

# Build the professor's dashboard

**Needs:** a modelled course with graded work in it, and the CLI for every number
on the page. Says below what to do without it, and refuses rather than guessing.

This is **one of two visualisation surfaces and it is the private one.** It draws
marks: class progress by concept, gradebook totals, how one assessment went, who
has not submitted. The other surface — `/course-page` — draws the plan and is
written for a URL students can open. They must not merge, and the direction that
matters is this one: **nothing this skill produces is ever publishable.** If the
professor asks for something students can read, that is `/course-page`, and the
answer is not to trim this output until it looks safe.

## The one rule this skill lives or dies by

**Never compute a number.** Not a total, not a percentage, not a count of
concepts, not a grade share, not a projection. Every figure on every page is
copied from the output of a command:

| For | Run | Never |
| --- | --- | --- |
| identity, outcomes, concepts, current module | `ainar context <RUN>` | read the YAML and summarise it yourself |
| grade share per outcome, coverage matrices | `ainar alignment <RUN>` | multiply weights by criterion maxima yourself |
| one score per student per assessment | `ainar gradebook <RUN> --json` | add up criteria yourself |
| class progress by concept | `ainar dashboard <RUN>` | build your own heatmap |
| how one assessment went, per criterion | `ainar gradebook <RUN> --assessment A --json` | average the criteria yourself |
| item difficulty and what the class chose | `ainar score-items` | count responses yourself |
| what is left to grade | `ainar pending <RUN>` | count missing evaluations yourself |
| agreement between suggestion and decision | `ainar calibration <RUN>` | eyeball the overrides |
| how complete the course is | `ainar stats <COURSE>` | count files |

A hand-computed number on a page that looks official is the worst thing this
skill can produce, and it is also the easiest — the arithmetic is not hard, which
is exactly why it is tempting. It will disagree with `ainar gradebook`
eventually, and when it does the professor has two numbers and no way to tell
which is real.

If a figure they want does not come out of any command, **leave it off the page**
and say so on the page as well as in your report. A grading scheme is the sharp
case: `ainar gradebook` refuses to produce a letter grade because a scheme is a
claim the model has no field for, and supplying one on an HTML page overturns
that refusal in the medium where it is least likely to be questioned.

## 1. Choose the template

`templates/` beside this skill holds the shape of this site. Read
`templates.yaml`, show the professor the choice of style, and use what they pick;
with no preference, use the default and say which it was.

The choice is the style sheet. The **shape is not a choice**: `shell.html` is the
frame every page is filled into and `blocks.html` holds the sections that go in
it, and they are fixed so that two runs a fortnight apart produce the same site
rather than the same data rearranged. The parts a page like this loses first —
the stamp, the command each figure came from, the draft banner, the sentence
saying blank is not zero — are in those files for that reason. Do not delete
them, and do not restructure a block because the data seemed to want a different
table. `references/templates.md` has the convention.

The same style sheet is passed to `ainar dashboard --template <id>`, so the page
that command writes and the ones you build look like one site.

## 2. Read the model

```bash
bin/ainar context CSS-4008-2026-FALL
bin/ainar validate CSS-4008
bin/ainar stats CSS-4008
```

Run the validator and **put its output on the front page**. A site that renders a
course with three coverage warnings and shows none of them makes the course look
finished. Errors and warnings both, with their codes.

Then collect what the pages need in one pass, so the site is one snapshot rather
than a mix of moments:

```bash
bin/ainar alignment CSS-4008-2026-FALL
bin/ainar dashboard CSS-4008-2026-FALL --template plain
bin/ainar gradebook CSS-4008-2026-FALL --json
bin/ainar pending CSS-4008-2026-FALL
bin/ainar calibration CSS-4008-2026-FALL
```

If the run has no approved decisions yet, most of this is empty and the honest
output is small. Say that rather than padding it — and check whether
`/course-page` is what they actually wanted.

## 3. Write the site

Output goes to `work/<RUN_ID>/site/`. Never into `courses/`, never into `dist/`,
which belongs to `ainar export` and to the public page.

```
work/CSS-4008-2026-FALL/site/
  index.html          identity, validation state, what is on the other pages
  progress.html       class progress by concept — ainar dashboard, written in place
  gradebook.html      one score per student per assessment, with blocked rows
  results-<ID>.html   how one assessment actually went
  pending.html        what is still to grade, and who has not submitted
```

Do not reimplement `ainar dashboard`. It already produces a self-contained page:
write it into the folder and link to it. Build the other four from `shell.html`
and `blocks.html`, filling every `{{ slot }}` — an unfilled slot is a visible
defect on a page somebody will still be reading in March.

Six constraints, and each is the reason a page like this usually fails:

- **Self-contained.** Inline CSS, no external stylesheet, no CDN, no web font, no
  script that fetches anything. It has to open from `file://` on a machine with
  no network. Relative links between pages, so the folder can be moved or zipped.
- **No JavaScript for anything load-bearing.** Sorting and filtering are pleasant
  and optional; content that appears only when a script runs is content that
  disappears when the page is printed.
- **Blank is not zero.** A concept with no evidence was never assessed. Show it
  as visually distinct and labelled, never as 0%, and total the blanks where the
  reader cannot miss them. This is the single easiest way to do a student an
  injustice.
- **Every colour carries its number.** A heatmap encoded only in hue is
  unreadable to a good fraction of any faculty, and unreadable in print, and this
  will get printed.
- **Stamp every page.** The date it was generated and the command each figure
  came from. A page with no date is a page somebody will still be reading in
  March.
- **Mark drafts unmistakably.** Anything rendered from `work/` must be impossible
  to mistake for a record — a banner, not a footnote. An unapproved proposal that
  looks approved defeats the point of approval.

### The results page, one per assessment

Build it only for assessments that have been graded. Four things, each straight
from a command:

- **The distribution.** `ainar gradebook --assessment A --json` gives one row per
  student with a `total`, an `exportable` flag and a `blocked` list. Draw the
  spread over the **graded rows only**, which is the mean that command computes.
- **Which criterion cost the marks.** The same payload carries the per-criterion
  columns. A criterion the whole class dropped is a finding about the teaching or
  the criterion's wording, not about the class, and the page should let that read
  as a column rather than as a list of people.
- **Item difficulty, and what the class converged on.** `ainar score-items`
  reports the success rate per item and which distractor collected the wrong
  answers. Two thirds of a class choosing the same wrong option is the most
  useful thing on the page — show the option and the misconception it indicates.
- **Who is not in the numbers.** `blocked` rows: `partially_graded` and
  `not_submitted`. Show them beside the distribution, never folded into it and
  never as a zero. `ainar pending` names who has not submitted.

**Declared difficulty against observed.** Where an item carries `difficulty`, put
it beside the observed rate. The validator flags the disagreement as
`item.difficulty_mismatch`; this page is where a professor sees *why*.

`answer_key`, the correct-option marker, `marking_guidance` and
`indicates_misconception_of` with its note are the **point** of this page. That
is only true because this page is private, and it is the whole reason the public
page is a different skill rather than a flag on this one.

## 4. Check it

```bash
bin/ainar validate CSS-4008 --drafts work/CSS-4008-2026-FALL
```

Then check the site itself, because HTML fails silently:

- **Every number traced.** Walk each figure back to the command that produced it.
  Any you cannot trace, delete.
- **Every link resolves**, relatively — no absolute paths from your machine.
- **No student name anywhere.** Pseudonyms only. `ainar student --with-names` and
  `roster whois` output must never reach a file, and a page is a file.
- **Open it.** No console errors, no request to the network.

## 5. Report

Say what you built, which command fed each page, and what you left off because no
command produced it. Then three things they need to know:

- **The site is a snapshot, not a view.** It does not update when the course
  does. Say when it was generated and that re-running this is how it refreshes.
- **Where it may go.** `work/` is gitignored, which is right for a file carrying
  even pseudonymous class data. Sharing it is their decision to make knowingly,
  and you should say plainly that it carries marks.
- **It is not the students' page.** If they want something to hand out, name
  `/course-page` and stop. Do not offer to strip this one down instead: the
  public surface is built from the outline payload by a command that is tested
  against the rendered bytes, and an edited copy of this site has none of that.

## Without the CLI

**This skill degrades badly, and the honest thing is to narrow it rather than
fake it.** Its whole value is that the numbers are trustworthy, and without the
commands there are no trustworthy numbers.

With no CLI there is no gradebook, no class progress, no item difficulty and no
calibration — all of it is arithmetic over records the loader would have to
assemble first. Say so, build nothing, and offer the part that needs no
arithmetic: the plan, which is `/course-page`'s subject and is transcription
rather than computation.

Do not approximate one of these figures. A grade share multiplied out by hand is
the exact failure this skill exists to avoid, and it is worse on a page than in a
chat message because the page outlives the conversation.

`references/working-without-the-cli.md` carries the file layout and the
identifier patterns. Read it before starting.

## Rules

- **Never compute a figure a command produces.** See the table above. This is the
  rule; everything else here is detail. That includes drawing one: a chart handed
  to a generic visualisation tool is a figure with no command behind it, and it
  looks more authoritative than the number would have.
- **A blank is drawn as a blank.** No enrollments recorded is not `0 enrolled`;
  no weight recorded is not a share that makes the total reach 100%; a date
  computed from a `TODO` is not a date.
- **The templates give the shape; the professor picks the style.** From
  `templates/` beside this skill. A figure no block has a place for is a figure
  no command produced — it goes in the "Not on this page" list, not into a
  block you invented for it.
- **Private, and it stays private.** `work/<RUN_ID>/site/` only. Not `courses/`,
  not `dist/`, and never anything the Pages workflow can reach.
- **No student names, ever.** Not in a page, a filename, a title attribute or an
  HTML comment.
- **Blank is never zero**, in the markup as well as the prose.
- **Self-contained or it does not ship.** One external request is one too many.
- **Drafts are marked as drafts**, prominently.
- **Say what is missing.** A page that omits something because no command
  supplied it must say so where the reader will see it, not only in your report.
