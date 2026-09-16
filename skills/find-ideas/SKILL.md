---
name: find-ideas
description: Survey how other universities teach a topic — find published courses at Stanford, MIT, CMU and elsewhere, read their syllabi, slides and assignments, and report what they cover, in what order, and how they assess it, against what this course already does. Use when the user asks how others teach something, wants ideas or inspiration for a course or a topic, asks what Stanford or MIT does, asks to compare their course against similar ones, or asks what they might be missing. A request for what is missing from this course as built — unfinished structure, pending decisions — is /action-inbox instead.
stage: research
requires: []
produces: []
writes: prose
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
> - **No student name, email or institutional number in any file,** including a
>   grading comment or a lesson brief. Write the identifier.
> - Before reporting anything: `bin/ainar validate <COURSE> --drafts
>   work/<RUN_ID>`, and fix every error.
> - Never recompute by hand what a command does exactly — `score-items`,
>   `gradebook`, `extract-evidence`, `roll-up`, `calibration`, `lms plan`.
>
> These are the whole of it. Nothing outside this directory carries
> them, so treat them as the agreement itself rather than a summary of one.

# Find ideas from other courses

**Needs:** web search and fetch. Reads `ainar context` to compare against the
professor's own course, and says below what to do without it. Nothing is drafted
into the course model by this skill at all.

You are doing a literature review of teaching practice. The professor wants to
know how other people teach this, and the useful answer is specific: which
courses, what they cover, in what order, how they assess it, and what their course
does differently.

## What this skill does not do

It **writes no draft**. Not a concept, not a module, not an assessment. This is
the one skill whose whole output is a report, and that is not a limitation to work
around — it is the point.

The reason is the claims rule. A concept map drafted from Stanford CS229 would be
a statement about *this* course sourced from *another institution's* syllabus.
`/propose-concepts` may read "a syllabus the user pointed at" because that
syllabus is theirs. Somebody else's is a different thing: it is evidence about how
a subject is usually taught, which is worth a great deal, and it is not authority
over what this course claims.

So the sequence is: this skill reports, the professor decides what to adopt, and
*then* `/propose-concepts` runs on the decision. If the report ends with "shall I
draft these twelve concepts?", that is the skill overstepping — offer the handoff,
name the source, and let them choose.

## 1. Ask what they are actually after

"Find ideas for my AI course" has at least four different answers. Ask which:

> Are you after the **topic sequence** — what gets taught in what order — or the
> **assessment design**, or **specific material** like a lab or a worked example,
> or a check on whether you are **missing something** the field now expects?

And the scope, because it changes where to look:

> Undergraduate or graduate? And is this the whole course or one topic in it?

The fourth of those — "am I missing something" — is the one where reading the
professor's own course first matters, so do that before searching.

## 2. Read their course first, if there is one

```bash
bin/ainar context CSS-4008-2026-FALL
```

You need their concept list, module order and assessment structure *before* you
search, for two reasons. A comparison is only useful against something, and
without it you will report things they already teach under a different name —
which reads as not having looked.

Note the vocabulary they use. If their course says "generalisation" where Stanford
says "bias-variance tradeoff", say so explicitly when you report; a professor
should not have to work out that two names are one idea.

Check `imports/` too. A syllabus or deck from another university that the
professor has already collected is a better source than anything you will find
by searching, and it is worth saying that you read it — half the value of this
skill is telling them what they already had.

## 3. Search

Look in this order, because the quality of what you can read drops sharply:

1. **Open courseware with real materials.** MIT OpenCourseWare, Stanford's public
   course pages (`cs229.stanford.edu` and its siblings), CMU, Berkeley, Harvard
   CS50. These publish syllabi, slide decks, problem sets and often solutions.
2. **Course GitHub repositories.** Many modern courses keep notebooks, labs and
   autograders in public repos. These are the most useful thing you will find for
   practical material, and the most likely to carry an explicit licence.
3. **Public syllabus pages** at any university, which give topic sequence and
   assessment weights even when no material is attached.
4. **Curriculum guidance**, for the "am I missing something" question: ACM/IEEE
   computing curricula recommendations, professional body requirements.

Search in English and, where the topic warrants, in Russian and Kazakh — a
regional course may be more comparable in constraints than an American one.

Fetch and read what you find. A syllabus page, a slide deck, a problem set: read
them properly rather than reasoning from the course title. If something is behind
a login, a paywall or a robots restriction, **stop at it** and say so — do not
look for another route in.

## 4. The line on their material

This is the rule that matters most in this skill, and it has two parts that are
easy to conflate.

**Facts about a course are yours to report.** That week 4 covers regularisation,
that the midterm is worth 25%, that the labs use PyTorch, that concept A is taught
before concept B — report all of it freely, with the URL.

**Their expression is not yours to take.** Do not copy slide text, problem
statements, rubric wording, exam questions, figures or code into a report or into
this repository. Summarise in your own words. If you must quote to make a point,
one short quotation with attribution, and never more.

Three consequences worth stating plainly:

- **Record the licence.** MIT OCW is Creative Commons; a Stanford course page may
  be all rights reserved; a GitHub repo has whatever its `LICENSE` says. Put the
  licence beside each source in the report, because "can I use this?" is the next
  question the professor will ask and the answer differs per source.
- **A problem set you cannot reuse is still worth reading.** Report its
  *structure* — six problems, two proof-based, one implementation, graded on
  correctness and justification — and let the professor write their own.
- **Never present another course's material as draftable.** If the professor asks
  you to adopt an assignment wholesale, say what the licence permits, say that
  attribution is theirs to decide, and route the writing through
  `/design-assessment` so what lands in the repository is theirs.

## 5. Write the report

Write to `work/<RUN_ID>/ideas-<topic>.md`, or `work/ideas-<topic>.md` when no run
is modelled. Markdown, and structured so the professor can skim it:

```markdown
# How model evaluation is taught elsewhere

Surveyed 5 courses, 2026-08-12. Two of them sequence this differently from
CSS-4008 in a way worth considering; one assesses it with an instrument this
course has no equivalent of.

## The courses

| Course | Level | Where this sits | Materials | Licence |
| --- | --- | --- | --- | --- |
| Stanford CS229 | graduate | weeks 4–5, after linear models | slides, problem sets | all rights reserved |
| MIT 6.036 | undergraduate | week 6 | full lecture notes, labs | CC BY-NC-SA 4.0 |
```

Then, in this order:

1. **What they all do.** Where five courses agree, that agreement is the strongest
   signal in the report — and if this course differs from all five, that is worth
   the professor's attention whether or not they change it.
2. **Where they disagree**, and what the disagreement is about. Two courses
   ordering two topics differently usually reflects a real pedagogical choice;
   name the choice rather than counting votes.
3. **What this course has that they do not.** Do this honestly. A professor
   reading a survey of Stanford and MIT is being invited to feel behind, and
   sometimes the right finding is that their sequence is better for their
   students.
4. **What this course does not have**, as observations rather than
   recommendations: *"four of five introduce cross-validation before the first
   assessment; CONCEPT-CROSS-VALIDATION does not appear in this course"*. That is
   a fact and a gap. Whether it is a *problem* is theirs to say.
5. **Naming differences**, from step 2 — where the same idea appears under a
   different name.
6. **Material worth looking at**, with URL and licence, and what specifically is
   good about each. Not a link dump.

Every claim in the report carries the source it came from. A survey the professor
cannot check is a survey they have to redo.

## 6. Hand over

End with the options, not a recommendation dressed as a conclusion:

- to add concepts the survey suggests: `/propose-concepts`, pointed at **their**
  decision about what to adopt — say plainly that the source will be recorded as
  the professor's choice informed by this survey, not as another course's syllabus
- to build an assessment along the lines of one you found: `/design-assessment`,
  which will write something new against their outcomes
- to check the gap against what their students have actually shown: `/find-gaps`

Do not run any of those unprompted. The report is the deliverable.

## Without the CLI

This skill barely needs the CLI, which is why it is a reasonable first thing to
try on a machine with nothing set up.

Without `ainar context`, read `concepts.yaml`, `modules.yaml` and
`assessments/` directly for the comparison. Without a repository at
all, ask the professor for their syllabus or topic list and compare against that —
say in the report that the comparison came from what they described rather than
from a validated model, because the difference matters when they act on it.

What you cannot do without web access is this skill's whole job. If search or
fetch is unavailable, say so and stop. Listing courses from memory would produce
plausible syllabi for courses whose content you cannot check, attributed to real
universities — which is the worst possible output here, and worse than nothing.

`references/working-without-the-cli.md` carries the file layout and the identifier
patterns. Read it before starting.

## Rules

- **Never invent a course, a URL, a syllabus or a licence.** Every course named
  must be one you actually fetched. A fabricated Stanford syllabus is worse than
  no answer, because it is attributed to a real institution and reads as checkable.
- **Never copy their expression.** Slide text, problem statements, rubric wording,
  figures, exam questions. Structure and topics are facts; wording is theirs.
- **Record the licence beside every source**, and say when you could not determine
  it rather than guessing permissively.
- **Write no draft into the course model.** Not a concept, not a module, not an
  assessment. This skill's output is a report, and the handoff is a sentence.
- **Report gaps as observations, not as failings.** "Four of five teach X before
  the first assessment; this course does not" is useful. "This course is missing
  X" is a judgement about their design that they did not ask you for.
- **Do not bypass a paywall, a login or a robots restriction.** Note the source
  exists, note that you could not read it, and move on.
- **No student names anywhere**, in the report or in a search query.
