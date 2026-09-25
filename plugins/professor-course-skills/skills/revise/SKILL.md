---
name: revise
description: Make a small change to something that already exists — fix a word on a slide, correct a figure in a handout, reword a brief, change a deadline — without regenerating the whole thing. Use when the user asks to change, fix, correct, reword, replace, update or tweak part of a deck, handout, brief, quiz or any recorded detail, or points at a specific slide, question, week or field. Producing a material that does not exist yet is /make-materials; sending the corrected version out is /publish.
stage: any
requires: []
produces: [documents, resources]
writes: record
---

> **Non-negotiables.** This skill proposes; a person decides.
>
> - **The smallest edit that does the job.** A word is a word. Never regenerate
>   a deck, a brief or an assessment because one line of it is wrong — the
>   professor's own edits are in that file, and a regeneration silently
>   discards them.
> - **Never invent a new identifier, and never write `supersedes` by hand.** A
>   recorded material is edited in place; the record catches up when it is
>   published. Both of those were the old answer and both are wrong now.
> - **Claims come from the professor.** Correcting a typo is yours; changing a
>   weight, a deadline, an outcome or a mark is theirs. Propose, show, wait.
> - **Never run `ainar approve`,** and never `ainar lms push --target
>   canvas-api` or `--target sheets-api`. `ainar publish … --confirm` is not a
>   way round that either — see `/publish`, which owns the publishing verb.
> - **No student name, email or institutional number** in any file you touch.
> - After editing anything the record describes: `bin/ainar validate <COURSE>`.

# Revise something that already exists

**Needs:** `bin/ainar impact`, which answers what the thing is and what hangs
off it. Without the CLI you can still edit the file; what you lose is knowing
what the edit breaks, so say that plainly rather than guessing.

## 1. Decide what kind of change this is, first

Four kinds, and they have four different answers. Getting this wrong is the
whole failure mode this skill exists to prevent.

| What they asked to change | What it is | What to do |
| --- | --- | --- |
| a word, a figure, a slide, a paragraph | **the content of a material** | edit that file in place — §2 |
| a deadline, a weight, a room, a title | **a field of a record** | §4. It is not a material and there is no file to edit |
| "this question is wrong" | **an item in an assessment** | the item is a record; §4, and the brief may need §2 as well |
| "we should cover X instead" | **not a revision** | that is `/plan-term` or `/make-materials`. Say so |

If the request is ambiguous — *"fix week 7"* — ask which. Do not pick the
largest reading, and do not pick the smallest one silently.

## 2. Ask what the thing is before touching it

```bash
bin/ainar impact DOC-4410 --run CSS-4008-2026-FALL
```

It writes nothing. It says which file, whether that file is a draft or a
record, whether anything has been rendered from it, what points at it, where it
has already been published, and what follows. Read it before editing, because
two of those change what you should do:

- **`a draft`** — the file is under `work/` and nobody has accepted it. Edit it
  freely; it is a proposal either way.
- **`a record`** — the course stands behind it and students may already have
  it. Edit it in place anyway: that is now supported and is the intended path.
  Say in your report that the change is live once it is published.
- **`rendered … STALE`** — a `.pptx` or `.pdf` built from the file you are
  about to edit. Your edit does not reach it. Name it, and name the rebuild.
- **`published … BEHIND`** — students are reading the old version right now.
  This is the fact the professor most needs and the one they cannot see.

Finding the identifier is yours: `course_outline` for the week, the Slides
table for a deck, `assessment_rubric` for an item. If two things match, list
them and ask. Never edit a document you found by guessing at a filename.

## 3. Make the edit, and only the edit

Change the line. Leave the rest of the file — the formatting, the comments, the
slide order, the professor's wording elsewhere — exactly as it was. A diff that
touches more than the request touched is a diff nobody can review.

Then check what the edit was supposed to leave alone:

```bash
bin/ainar validate CSS-4008
bin/ainar deck fit courses/CSS-4008/materials/MODULE-06-slides.md   # a deck
```

`deck fit` matters for slides specifically: three added words can push a slide
off the page, and the render refuses a deck whose markdown disagrees with its
plan. If the edit changed a slide's title, the plan in the record has to match.

## 4. A field, not a file

A deadline, a weight, a room, an assessment's title, a question's text: these
are records and there is no material to edit. Nothing drafts them either, so
there is no `work/` half and nothing for approval to promote.

Say which file and which line, show the change, and let the professor make it —
or, where the harness has a control for it, point at that: the pane's Tasks tab
sets a missing deadline, and its Integrations tab holds the LMS ids. Do not
hand-edit `courses/` YAML on their behalf without being asked to; when asked,
change the one key and nothing around it.

## 5. Hand over what follows

Copy the `What follows` lines out of `ainar impact` rather than composing your
own — they are assembled from the same facts as the report, so they cannot
recommend a step the report does not justify. In practice it is one of:

```bash
bin/ainar materials build CSS-4008-2026-FALL     # a rendering is stale
bin/ainar publish update CSS-4008-2026-FALL      # somewhere has the old version
```

Both are `/publish`'s to run, and only on an explicit instruction. What you owe
the professor here is the list and the order, not the press.

## Rules

- **Smallest edit, every time.** Regenerating a whole artefact for a wording
  change is the failure this skill exists to prevent.
- **No new identifiers, no `supersedes`, no copies of the file.** Edit in
  place; the record catches up when it is published.
- **Read `impact` before, not after.** A stale rendering and a published copy
  are the two things that make a one-word change bigger than it looks.
- **Say what is now out of date**, even when fixing it is somebody else's
  press. A professor who does not know the page is behind thinks they are done.
- **A claim is not a typo.** Weights, deadlines, outcomes and marks are the
  professor's to change, whatever the request sounded like.
