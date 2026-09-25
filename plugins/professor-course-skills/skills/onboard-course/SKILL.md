---
name: onboard-course
description: Set up a new course from nothing — identity, the term's dates, which LMS or gradebook it publishes to, the grading policy, and the learning outcomes in the professor's own words — then hand off to the skills that fill in the rest. Use when the user is starting a course from scratch, asks to set up or create a course, asks how to begin, wants onboarding, or points at an empty workspace.
stage: setup
requires: []
produces: []
writes: records
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

# Set up a course

**Needs:** a workspace. Uses `ainar new` and `ainar validate`; says below what to
do without them.

You are interviewing a professor and writing down what they tell you. That is the
whole job, and the temptation to do more than that is strongest here than anywhere
else in this repository — an onboarding flow feels like it should end with a
finished course, and a finished-looking course nobody stated is the worst thing
this skill can produce.

## What cannot be drafted, which is most of what onboarding touches

Everything else in `skills/` writes a proposal into `work/` and lets
`ainar approve` decide. **That machinery is unavailable to this skill**, because
the records onboarding creates are precisely the ones the loader refuses in a
draft file: `Course`, `CourseVersion` and `LearningOutcome`.

So the line runs differently here, and it is about *transcription versus
invention* rather than about `work/` versus `courses/`:

- **A fact the professor states in the conversation, you may write down.** The
  title, the credits, the department, the term dates, who teaches it, the Canvas
  course id, the timezone. Writing "AI Systems" into `course.yaml` after they said
  the course is called AI Systems is transcription, and typing it back to them to
  paste in themselves is friction with no safety in it.
- **A learning outcome you may write down only in their words.** If they dictate
  four outcomes, transcribe them. If they do not, leave the scaffolded `TODO` in
  place and say what is missing. **Never propose an outcome**, not as a starting
  point, not as an example, not "to be edited later". Student evidence attaches to
  an outcome, so an invented one is the mistake that costs most to find late — and
  onboarding is exactly where it would be least noticed.
- **A weight, a rubric or a concept you do not write at all here.** Later skills
  do those, with their own rules.

If you are unsure which side something falls on, ask. One question costs a
sentence; a claim nobody made costs a term.

## 1. Look before you scaffold

```bash
bin/ainar validate
bin/ainar stats
```

If a course already exists, you are **not** onboarding — say what is there and ask
what they actually want. If `list_courses` or `validate` reports no courses, check
you are in the right place: a workspace is the folder that *contains* `courses/`,
and pointing at a folder of unmodelled material is the commonest first-run mistake.

`ainar new` never overwrites — `_write_if_absent` is its whole safety model — so
running it against an existing course is safe but pointless.

## 2. Ask, in this order

Ask in small groups and write down the answers as you go. Do not ask all of it at
once; a fifteen-question form gets abandoned.

**Identity.** Course id in the `AAA-9999` pattern, title, credits, department, who
teaches it and their `USER-*` id. Say that the id is **permanent** — student
evidence will point at it — and that titles get reworded freely while ids do not.

**The term.** Which term (`2027-SPRING`), start and end date, timezone. Default to
`Asia/Almaty` and `+05:00` unless they say otherwise.

**Where grades go.** This is the setting that decides which tooling can reach the
course at all, so ask it explicitly rather than assuming:

> Where do the grades end up — Canvas, a Google Sheet you keep yourself, Moodle,
> something else, or nowhere yet?

Record the answer on the run as `extensions.lms.target`, and **say honestly what
this workspace can do with it.** `canvas-csv`, `canvas-api`, `sheet-csv` and
`sheets-api` work. Moodle and Notion do not: the validator reports
`lms.unsupported_target` and names what is supported, and the honest answer is
that they will export a file and upload it by hand until an adapter exists. Write
it down anyway — a recorded gap is how it gets built.

If Canvas: ask for the numeric course id (`extensions.lms.canvas_course_id`) and
tell them the host goes in the connections registry, outside the repository —
`ainar connections migrate` builds one from whatever is already on the machine,
and `ainar connections list` shows what is in it. If a sheet: the id between
`/d/` and `/edit` (`extensions.lms.sheet_id`).

**Never ask for a token, and never accept one that is offered.** If they paste
a credential into the chat, do not use it and do not repeat it: say that it has
now been in a transcript and should be revoked and reissued. A token typed into
a conversation reaches the transcript, the context window and the model
provider — more places than the config file you just told them to clean out.

There are two right places, and both keep the value away from you:

- **The pane.** Integrations → Credentials has a field per connection. What is
  typed there goes to the harness's credential store through `ctx.credentials`,
  and no route reads it back. Point them at it; you can say the variable's name,
  which is not a secret.
- **Their shell.** `export AINAR_CANVAS_TOKEN=…`, which also shadows anything
  saved in the pane — so if they have done both, the shell is what is in effect
  and the pane's field is disabled saying so.

Afterwards, `ainar connections doctor` is yours to run: it makes one read-only
request and tells you whether the provider accepted the credential, without the
value ever passing through you. If `ainar connections list` reports a literal
token in a file, say so and tell them to revoke it at the provider; do not offer
to move it for them.

**The grading policy.** Narxoz policy is **midterm 1: 30, midterm 2: 30, final:
40**. Offer it as the starting point and let them confirm or replace it. Do not
write any weight now — assessments do not exist yet, and `/plan-term` is where
those three shells get created.

**The term's shape.** How many teaching weeks and meetings per week; 15 weeks with
one lecture and one practice is the local norm. You need this so `/plan-term` does
not have to ask again — pass it on rather than acting on it.

**The outcomes.** Ask last, because it is the one thing they cannot delegate and
the one thing worth their full attention:

> What must a student be able to do by the end? Four to six is usual. These are
> the only things in the whole model I cannot draft for you — every grade a student
> earns will point at one of them.

Transcribe what they say. If they have a syllabus, offer to read it and transcribe
the outcomes **from it**, showing each one beside the line it came from. If they
have neither, stop at the `TODO`s and say so plainly. A course with `TODO` outcomes
is an honest half-finished course; a course with four invented ones looks finished
and is not.

## 3. Scaffold, then fill in what was stated

```bash
bin/ainar new course CSS-4201 --title "Distributed Systems"
bin/ainar new run CSS-4201 2027-SPRING --start 2027-01-19 --end 2027-05-08
```

Then write the stated facts into the scaffolded files: `course.yaml`,
`version.yaml`, `people/users.yaml`, and `outcomes.yaml` **only**
where they dictated the wording. There is no `versions/v1/`, no `run.yaml` and no
term directory: a workspace holds one run of one course, one offering is one
`version.yaml` beside `course.yaml`, and outcomes, concepts and modules sit at
the course root carrying `course_id`.

Every `TODO` you leave behind is deliberate and gets named in the report. Every
`TODO` you fill in must trace to something they said in this conversation.

## 4. Check it

```bash
bin/ainar validate CSS-4201
bin/ainar stats CSS-4201
```

Expect warnings, and expect to report rather than fix them. A course with outcomes
and nothing else has outcomes nothing teaches and outcomes nothing assesses —
which is true, and is what the next skills are for. `lms.unsupported_target` is
also expected if they named Moodle or Notion.

Errors are different. Fix those before reporting: a malformed id, a naive
timestamp, a run whose id does not match its term.

## 5. Report, and say what happens next

Tell them what exists, what is `TODO`, and the order of the next steps — this is
the part that makes onboarding feel like a beginning rather than a form:

1. `/find-ideas` — how other universities teach this, before committing to a shape
2. `/propose-concepts` — the concept map, from their syllabus or teaching material
3. 🔒 `ainar approve work/<RUN> --as USER-…` — they promote the concepts
4. `/plan-term` — 15 weeks, the meetings, and the three assessment shells
5. `/design-assessment` — a real assessment with a rubric, when they need one
6. `ainar roster import` — the class list, which writes pseudonyms here and
   identities outside the repository

Say which of those they can do today and which need something they have not
supplied yet. And say plainly if the outcomes are still `TODO`, because everything
downstream attaches to them: a concept map is useful without them, and a grade is
not.

## Without the CLI

`ainar new` writes scaffolding with `TODO` placeholders and nothing more, so doing
it by hand is transcription of a known layout rather than a reimplementation.

Create `courses/<COURSE_ID>/course.yaml`, `outcomes.yaml`,
`version.yaml` and `people/users.yaml` yourself, following
`references/working-without-the-cli.md`, which carries the layout and the
identifier patterns. Keep every `TODO` you cannot fill from what
the professor said.

What you cannot do is check it. Say plainly that `ainar validate` did not run, and
that the identifier patterns and the run-id-matches-term rule are unverified —
those are the two things a typo hides in, and both are cheap for them to check
later by installing the package.

## Rules

- **Never write a learning outcome the professor did not state.** Not as an
  example, not as a placeholder with real-sounding text, not "so the file
  validates". `TODO` is the correct value for an outcome nobody has written.
- **Never invent a weight, a concept, a rubric or an assessment here.** Those have
  their own skills and their own gates.
- **Identifiers are permanent.** Say so when you ask for one. `CSS-4201` cannot be
  tidied up later without orphaning everything that points at it.
- **Record an unsupported target rather than arguing about it.** If they use
  Moodle, write `target: moodle` and report what that means today.
- **Never touch a credential.** Not `AINAR_CANVAS_TOKEN`, not
  `AINAR_SHEETS_TOKEN`, not a service-account key. Say which one they need to set.
- **No student names.** The roster comes later and comes from
  `ainar roster import`, which writes pseudonyms here and identities elsewhere.
- **Do not run `ainar approve`.** Nothing in onboarding needs it, and if you think
  it does, something has gone wrong earlier.
