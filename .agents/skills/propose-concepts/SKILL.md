---
name: propose-concepts
description: Read a syllabus, lecture plan or teaching material and propose the course's concept map — concepts, prerequisite edges and the module that introduces each — as drafts for the professor to revise and approve. Use when the user points at a syllabus or course material and asks to build, extract, draft or fill in the concept map, the knowledge structure, prerequisites, or the weekly module plan. Placing those modules on a calendar with real dates, and the midterm and final shells, is /plan-term afterwards.
stage: design
requires: []
produces: [concepts, modules]
writes: records
---

> **Non-negotiables.** This skill proposes; a person decides.
>
> - **Concepts and modules are written straight into `courses/`,** with final
>   identifiers and no `-DRAFT-` segment. Since 2026-09-05 they are not draftable
>   at all: `concepts` or `modules` in a file under `work/` is refused with
>   `draft.collection`. The structure of a course is the professor's own
>   authoring, and this skill writes it for them rather than proposing it.
>   Everything else this skill touches still goes to `work/<RUN_ID>/` with a
>   `-DRAFT-` identifier.
> - **Claims come from the professor.** Never invent a learning outcome, a
>   rubric criterion or an assessment weight — write `TODO` and say what is
>   missing. Concepts and modules you now write into the record directly, but
>   that raises the bar rather than lowering it: every one must be traceable to
>   a line in the material the professor supplied, because nothing stands between
>   your file and the course any more. Say in your report where each came from,
>   and propose the shape before writing it — §4.
> - **Never run `ainar approve`,** and never `ainar lms push --target canvas-api`
>   or `--target sheets-api`. Approving your own suggestion, or posting a grade a
>   student can see, is the one place a human enters. Show the command instead.
> - **No student name, email or institutional number in any file,** including a
>   grading comment or a lesson brief. Write the identifier.
> - Before reporting anything: `bin/ainar validate <COURSE> --drafts
>   work/<RUN_ID>`, and fix every error.
> - Never recompute by hand what a command does exactly — `score-items`,
>   `gradebook`, `extract-evidence`, `roll-up`, `calibration`, `lms plan`.
>
> These are the whole of it. Nothing outside this directory carries
> them, so treat them as the agreement itself rather than a summary of one.

# Propose a concept map

**Needs:** a course in YAML. Works fully without the CLI.

You are reading source material a person wrote and turning it into the
knowledge structure the rest of the model hangs off. This is transcription with
judgement, not invention: every concept you propose must be traceable to a line
in the source, and the professor decides what survives.

Concepts and modules are **claims** — they state what the course teaches — and
since 2026-09-05 you write them into the record directly, with no approval step
behind you. That is the professor's decision, and it moves the whole safeguard
forward: propose the count and the shape in §4 and wait for an answer, because
that conversation is now the only gate there is.

Learning outcomes remain outside your reach entirely — they are not draftable
and not yours to author. If the source states outcomes and the course has none,
list them in your report and let the professor write them.

## 1. Read what exists first

```bash
bin/ainar context CSS-4008-2026-FALL
```

```bash
bin/ainar stats CSS-4008
```

A course that already has concepts is being **extended**, not populated. Load
`concepts.yaml` and read every existing concept and alias before
proposing anything. The single most damaging output here is a second concept
for something the course already names — evidence then splits across two
identifiers and neither shows the truth.

Note the `course_version_id` you are proposing into. Every draft needs it.

## 2. Read the source

Read what the user pointed at, whole. A syllabus, a lecture plan, a set of
slides, a textbook table of contents, an existing module list.

If they pointed at nothing, look in `imports/` before asking. That is where
material from outside the course is dropped — a colleague's deck, last year's
paper, a PDF someone sent — and "use the thing I put there" is the usual reason
it exists. Say which file you took, so a wrong guess is visible immediately.

Concepts come from what the material **teaches**, not from its section
headings. "Week 5: Evaluation" is a heading; the concepts underneath it might
be train-test separation and metric choice. A heading that introduces nothing
teachable is a module, not a concept.

If the material is thin — a one-page syllabus with five bullet points — say so
and propose fewer concepts rather than padding it. Ten well-sourced concepts
beat thirty invented ones.

## 3. Ask how long the term is

A module is a teaching week, so you cannot number modules without knowing how
many weeks there are. Ask before drafting them, and offer the local default
rather than an open question — it is right most of the time here:

> Kazakhstan universities usually run **15 teaching weeks with two meetings a
> week, one lecture and one practice**. Is that this course?

If the source material states its own week count, use that and say where you
read it. If it says nothing and the professor does not either, draft the
concepts and **leave the modules out** — an unsourced week 12 is a claim about
the course that nobody made.

Whatever the answer is, it becomes the modules' `extensions.proposal.source`:
*"professor confirmed 15 weeks"* is a source, and a real one.

You do not need the meeting pattern here — days, times and rooms belong to
`/plan-term`. Ask only for the week count.

## 4. Propose a count before proposing content

Tell the professor what you found and how many concepts you intend to write,
**before** you write them:

> The syllabus has 14 weeks and names 4 outcomes. I can see 11 distinct
> teachable concepts, 3 of which already exist in v3 under different names.
> That gives 8 new concepts and 12 prerequisite edges. Shall I draft that?

Wait for an answer. A concept map is a design decision with a shape, and the
professor may want 6 broad concepts or 30 fine ones — that choice is theirs and
it changes everything downstream.

If the concept count and the week count disagree — 10 concepts across 15 weeks —
say so now rather than stretching one to fit the other. Weeks with no new
concept are a real and common shape, and `/plan-term` handles them explicitly.

## 5. Write the concepts and modules

Write them into the course itself — `courses/<COURSE_ID>/concepts.yaml` and
`courses/<COURSE_ID>/modules.yaml`, or append to `concepts/approved.yaml` and
`modules/approved.yaml` if those already exist. They are **not** drafts and do
not go under `work/`: a file there naming `concepts` or `modules` is refused
outright.

Two consequences for the identifiers, and both matter:

- **No `-DRAFT-` segment.** `CONCEPT-GRADIENT-DESCENT`, not
  `CONCEPT-DRAFT-GRADIENT-DESCENT`. A draft marker in the record raises
  `id.unapproved_draft` on every validate, for something that will never be
  approved because it never was a draft.
- **`extensions.proposal` without `extensions.approval` raises
  `claim.unapproved_proposal`,** for the same reason. Record where a concept came
  from in `description` or a comment instead — the provenance is still worth
  having, it just cannot be spelled as a pending claim.

Read the file before writing it and keep what is there. This is the record now;
an overwrite loses whatever the professor authored by hand.

```yaml
concepts:
  - concept_id: CONCEPT-GRADIENT-DESCENT
    course_version_id: CSS-4008-v3
    title: Gradient descent
    description: >-
      Iteratively adjusting parameters against the gradient of a loss
      function, and what a learning rate controls.
    prerequisites:
      - CONCEPT-LOSS-FUNCTIONS            # written in this same batch
      - CONCEPT-SUPERVISED-LEARNING       # already in the course
    aliases: [steepest descent]
    # Where it came from, recorded as prose rather than as
    # `extensions.proposal` — a proposal with no approval beside it raises
    # `claim.unapproved_proposal`, and these are not pending claims any more.
    # The source still belongs in your REPORT, in full.
    source_note: syllabus-2026-fall.pdf, week 7, "optimisation by gradient descent"

modules:
  - module_id: MODULE-07
    course_version_id: CSS-4008-v3
    title: Optimisation
    week: 7
    outcomes: [LO-02]
    concepts:
      - CONCEPT-LOSS-FUNCTIONS
      - CONCEPT-GRADIENT-DESCENT
    estimated_hours: 6
    source_note: syllabus-2026-fall.pdf, week 7 heading
```

Rules for what you write:

- **No `-DRAFT-` anywhere.** The identifier you choose is the permanent one and
  nothing will rewrite it later, so choose it as if it were — because it is.
- **Say where each came from, and keep saying it.** The record has no field for
  a pending claim, so the trace lives in `description`, in a `source_note`, and
  above all in your report to the professor. A concept they cannot trace back is
  one they have to re-derive, which is worse than not having it.
- **Prerequisites within the batch reference the final ids.** There is no
  rewriting step to fix them afterwards.
- **Never point a proposed concept at an outcome that does not exist.** Modules
  name outcomes; if the source implies a new one, leave `outcomes: []` and say
  what you saw.
- **Do not touch weights, criteria or outcomes**, in this draft or any other.

## 6. Check it

```bash
bin/ainar validate CSS-4008 --drafts work/CSS-4008-2026-FALL
```

Three failures matter most here and all three are real design problems, not
formatting:

- `graph.cycle` — you have made A require B and B require A. One of the two
  edges is wrong; work out which and say why.
- `concept.duplicate_name` — a title or alias already names another concept.
  Merge them and keep the **existing** identifier.
- `ref.concept` — a prerequisite that does not exist in the course or the
  batch. Usually a typo in a draft id.

Coverage warnings (a concept no module teaches, an outcome nothing assesses)
are worth reporting but are not yours to fix.

## 7. Report, then hand over

Report in this order:

1. **The shape**: how many concepts, how many edges, how many roots (concepts
   with no prerequisites), and the longest prerequisite chain. A map with one
   root and a chain of nine is a different course from one with six roots.
2. **What each concept came from** — the concept and its source line, as a
   table. This is the part the professor actually reviews.
3. **What you could not source**: anything the material implies but never
   states. Leave these out of the draft and list them here.
4. **Judgement calls**: every place you merged two mentions into one concept or
   split one into two, and why.

Then stop. **Do not run `ainar approve` yourself.**

```bash
bin/ainar approve work/CSS-4008-2026-FALL --as USER-ARD-A01
```

Tell them they can edit the draft first — rename a concept, delete one, redraw
an edge — and that `--only` and `--reject` approve a subset. Approval strips
the `-DRAFT-` marker, stamps `extensions.approval` with who accepted it, and
writes the result into `concepts/approved.yaml`, which is course
content they can edit freely from then on.

Then name what comes next, because a concept map on its own teaches nobody:
once the concepts are approved, `/plan-term` lays them onto the calendar — the
lecture and practice meetings for each week with real dates, and shells for the
midterms and the final. It asks for the meeting pattern; you already established
the week count here.

## Without the CLI

This skill degrades well, because its inputs are a document and a list of
concepts, and both can be read.

Read `concepts.yaml` in full — every title **and every alias** —
before proposing anything. Then do these two checks yourself, because they are
the two that matter most here and both are catchable by reading:

- **Duplicate names.** Compare each proposed title and alias against every
  existing one, case-insensitively. A second identifier for one idea splits a
  term's evidence between them and neither reads as the truth.
- **Cycles.** Trace each proposed prerequisite chain to its root. These graphs
  are small; a cycle is visible if you follow every edge once.

Report both as checked, and say plainly that the rest of `ainar validate` did
not run.

`references/working-without-the-cli.md` carries the file layout, the identifier patterns, the read-based checks and how approval works by hand. Read it before starting.

## Rules

- **A concept the source does not support does not get written.** Not with a
  low confidence score, not with a `TODO` — leave it out and name it in the
  report. The report is where speculation belongs.
- **Prefer the existing identifier, always.** Extending a course means adding
  to its graph, not restating it.
- **Prerequisites are claims about learning order**, not about topic order in
  the syllabus. Week 5 following week 4 does not make one a prerequisite of the
  other. Only assert an edge when the material shows the second genuinely
  depends on the first, and say which edges you were unsure about.
- **Descriptions come from the source's language.** Do not improve the
  professor's phrasing; they will notice, and the concept is theirs.
- **No student names anywhere**, including in a source citation.
