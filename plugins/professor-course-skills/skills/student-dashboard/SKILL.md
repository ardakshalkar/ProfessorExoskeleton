---
name: student-dashboard
description: Draw what one student has demonstrated — capability levels accumulated across courses, concepts with evidence and concepts without, and the prerequisites underneath each gap — as a self-contained HTML page written outside the repository. Use when the user asks for a student dashboard, asks to visualise or chart a student, wants a picture of one student's progress, asks to see a capability map or a learning trajectory, or wants something to show a student in a meeting. A request for prose — a written report, feedback, a paragraph on how they are doing — is /student-report instead. A picture of the whole class rather than one person is /course-dashboard.
stage: render
requires: [evidence, capability_states]
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

# Draw one student's trajectory

**Needs:** a modelled course with recorded evidence, and the CLI for every figure
on the page. Says below what to do without it, and narrows rather than guesses.

You are drawing a picture of a person. Two rules follow from that and neither is
negotiable.

## 1. Choose the template

`templates/` beside this skill holds the shape of the page. Read
`templates.yaml`, show the professor the choice, and use what they pick; with no
preference, use the default and say which it was.

The style is a choice. The shape is not: `shell.html` and `blocks.html` fix the
three sections and their order, because that order is the argument — what they
can do, what they know, what is missing underneath. The two sentences a page
about a person must not lose are already in the shell, and they are the two a
model writing markup freehand reaches past: that a blank is not a zero, and where
the file lives. `references/templates.md` has the convention.

## 2. It is written outside the repository

`/student-report` writes outside `courses/` and `work/` because a report names a
person. **A chart of the same data is the same kind of document**, and a picture
travels further than prose: it gets screenshotted, pasted into a message, shown
on a projector.

Write to a path the professor names, outside the workspace — their Desktop, their
Documents folder. If they do not name one, ask. Never `courses/`, never `work/`,
never `dist/`.

`ainar student --with-names` already refuses any path inside the workspace, and
the same rule applies to anything you write by hand.

**Pseudonyms unless they ask otherwise.** `STUDENT-JNG7SN` is what the model
holds. If the professor wants the name on it — reasonable for a meeting with that
student — they say so, and then the file is doubly outside the repository and you
say so in the report.

## 3. Never compute a number

Every figure comes from a command:

| For | Run |
| --- | --- |
| outcomes with their evidence, capability levels, gaps with prerequisites | `ainar student STUDENT-… --course-version <ID>` |
| the class row this student sits in | `ainar dashboard <ID>` |
| one score per assessment | `ainar gradebook <ID> --json` |
| what is still ungraded for them | `ainar pending <ID>` |

A percentage you worked out by hand will disagree with `ainar gradebook`
eventually, and on a page about one person that disagreement is a conversation
with a student about which number is real. If a figure comes from no command,
leave it off and name it in the report.

## 4. What the page shows

Three sections, in this order. The order is the argument: what they can do, what
they know, and what is missing underneath.

**Capabilities.** The levels from `capability_states`, each as a ladder with the
level descriptions from the capability itself, the achieved band marked, and the
count of sources behind it. These accumulate **across courses**, so say which
courses contributed — that is the whole reason a capability is not a grade.

Never draw a capability with no evidence as level 0. It has no level.

**Concepts.** Every concept in the course, in teaching order, in three visually
distinct states:

- **demonstrated** — with the proportion, and the evidence count
- **assessed and weak** — a real score, low
- **never assessed** — *not* zero, and this is the distinction the whole page
  rests on

A blank is not a low score. Give it its own treatment, label it in words, and
total the blanks somewhere the reader cannot miss. Reading an unassessed concept
as a failure is the easiest way to do a student an injustice, and a chart makes
it easier still.

**Gaps and what they rest on.** For each weak or missing concept, the
prerequisites underneath it and their state — the chain `ainar student` already
computes:

```
CONCEPT-MODEL-EVALUATION  0%
    needs CONCEPT-TRAIN-TEST-SPLIT: needs_review
    needs CONCEPT-SUPERVISED-LEARNING: no evidence
```

This is the section that makes the page worth drawing. "Struggling with model
evaluation" is a label; *which prerequisite is underneath it, and whether that
one was ever assessed* is something to act on.

## 5. Drawing it

From `shell.html`, with the sections copied out of `blocks.html` and the chosen
template's CSS pasted into the second `<style>` element. Self-contained HTML, one
file. Inline CSS, no CDN, no web font, no script that fetches anything — it opens
from `file://` and it prints, the same property `ainar dashboard` holds. Fill
every `{{ slot }}`; an unfilled one is a visible defect on a page about a
person.

- **Every colour carries its number.** A band encoded only in hue is unreadable
  to a good fraction of any faculty, and unreadable in print, and this will get
  printed or projected.
- **No JavaScript for anything load-bearing.**
- **Stamp it** with the date and the command behind each figure.
- Prefer bars and ladders to anything clever. This page may be read with the
  student sitting next to the professor; it has to be explainable out loud.

## 6. Check it before reporting

```bash
bin/ainar validate <COURSE>
```

Then the page itself:

- **Every number traced** back to the command that produced it.
- **The blanks are visibly not zeros.**
- **The path is outside the workspace.** Check it, do not assume it.
- **No name anywhere** unless the professor asked, including in the filename, the
  title and any HTML comment.
- Open it: no console error, no network request.

## 7. Report

Say what it draws, which command fed each part, and what you left out. Then the
two things that matter about a document like this:

- **Where it is, and that it is deliberately outside the repository.** Say the
  path back to them.
- **What the blanks mean.** If the page has six unassessed concepts on it, that
  is a fact about the assessment plan, not about the student, and the professor
  should hear it in those words before they show anyone.

## Without the CLI

**This narrows rather than degrades.** Its value is that the numbers are
trustworthy, and without the commands there are none.

With no CLI, draw only what needs no arithmetic: the concept graph in teaching
order and the prerequisites underneath each concept, both readable from
`concepts.yaml`. Mark every concept as **unknown**, not as zero, because without
`ainar student` you do not know which were demonstrated.

Leave out capability levels, proportions and gaps entirely, and say on the page
that they are absent because the commands that compute them did not run. A
trajectory chart with invented proportions on it is the exact failure this skill
exists to avoid, and it is worse on a page about a person than anywhere else.

`references/working-without-the-cli.md` carries the file layout and the
identifier patterns. Read it before starting.

## Rules

- **Outside the repository, always.** Not `courses/`, not `work/`, not `dist/`.
- **The templates give the shape; the professor picks the style.** From
  `templates/` beside this skill, and never a `course-page` one — that surface
  is public and this page is about a person.
- **Never compute a figure a command produces**, and leave off what none does.
- **Pseudonyms unless the professor asks**, and never a name in a filename.
- **A blank is never a zero**, in any chart, in any colour, in any total.
- **A capability with no evidence has no level** — it is not level 0.
- **Say what the blanks mean** in the report, before they show it to anyone.
