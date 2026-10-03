---
name: publish
description: Publish something a student sees — the course page, a Telegram announcement, a homework starter repository, or an assessment's definition in Canvas — carrying only what the professor has accepted; and, for grades, preview what Canvas would receive and hand the send to the professor's press in the pane. Use when the user asks to publish, post, put up, push out, release or send something to students, asks to publish, send or release grades or marks to Canvas, asks to refresh the course site, or says to go ahead with a publication that was planned. Composing the announcement's wording is /publish-telegram; building the page without publishing it is /course-page; accepting a draft or a grade is the professor changing its record, and stays theirs.
stage: render
requires: [modules, activities, assessments]
produces: [documents, resources]
writes: record
---

> **Non-negotiables.** This skill proposes; a person decides.
>
> - **This skill may publish, and that is what it is for.** Every other skill
>   prints the command and stops. Here the professor's explicit instruction in
>   the current request is the decision, and running it is the service.
> - **`--confirm` needs an explicit publishing verb in the current request.**
>   "Publish", "post it", "send it", "go ahead", "put it up". *Draft*, *prepare*,
>   *check*, *what would this do* and a silent assumption authorise the plan
>   only. A verb in an earlier turn is spent; ask again.
> - **`ainar publish` approves nothing.** It carries only records the professor
>   has accepted, and names every `approval: draft` it left out. That is
>   enforced by the command, not by your care. **Never accept your own work** —
>   never write `approval: approved`, a `professor_decision` or an approved
>   status: accepting a suggestion is the one place a human enters.
>   `ainar publish … --confirm` publishes only what the professor has accepted,
>   and only this skill runs it, on explicit instruction.
> - **Never `ainar lms push --target canvas-api` or `--target sheets-api`.**
>   Those post grades a student can see. `publish canvas` moves a *definition*
>   and is a different act.
> - **No student name, email or institutional number** in an announcement, a
>   page, a repository or a brief. Write the identifier — and not even that in
>   something students read.
> - Before publishing anything: `bin/ainar validate <COURSE>`, and fix every
>   error. A refusal from the answer-key scan has no override.
> - Read the plan out loud before the confirming run. A professor who has not
>   been told what would change has not decided.

# Publish

**Needs:** a modelled course, and `bin/ainar publish`. Without the CLI, nothing
here runs — say so and hand over `/course-page`, which builds a site by hand.

One command, four targets, and the same two steps every time:

```bash
bin/ainar publish page CSS-4008-2026-FALL                 # the plan
bin/ainar publish page CSS-4008-2026-FALL --confirm       # publish what is accepted
```

| Target | What reaches whom |
| --- | --- |
| `page RUN` | the week plan and the approved materials, written to `dist/pages/<RUN>/` for hosting |
| `telegram RUN --message TEXT` | one plain-text post to the run's channel. It cannot be recalled |
| `homework ASSESSMENT --run RUN` | the starter repository on GitHub, public so it can be forked |
| `canvas ASSESSMENT --run RUN` | the assessment's title, points, dates and brief. Never the marks |
| `update RUN` | every destination this run has already been sent to, and no new ones |

## 1. Run the plan, always

The first run reads and writes nothing — not to `courses/`, not to disk, not to
anybody's server beyond the reads that answer the question. It prints two
halves, and both matter:

- **what it would publish**, and what it would hold back and why.
- **`Not published — N draft(s) nobody has approved yet`**, by identifier and
  title. These are records still marked `approval: draft` that this publication
  would otherwise have carried — a deck drafted an hour ago, say. Publishing
  does not accept them. If the professor wants one on the page, they change its
  `approval` to `approved` in its file and publish again; you do not.

`publish homework` and `publish canvas` refuse an assessment still marked
`approval: draft` outright: students are not given a brief nobody has accepted.

Say so whenever the plan lists drafts, because a professor who expected the deck
to go out needs to know why it did not.

## 2. Read the plan to the professor

Name the target, the run, and the three things they cannot see from the command
line: what would be published, what would be held back or left out as a draft,
and who it reaches.
For Telegram, show the message exactly as it will be sent, on its own.

**Say whether this is a first publication or an update.** The plan's
`Last published …` line answers it, and the difference matters to them: a first
publication is a decision about whether students see this at all, while an
update is a decision about replacing something they may already have read. If
it lists what has changed since, read that list — it is the shortest honest
answer to "what am I actually sending".

Then stop. Wait for the verb.

## 3. Publish

```bash
bin/ainar publish telegram CSS-4008-2026-FALL --message-file announcement.txt --confirm
```

Read the whole output back — what was sent, what was held back, and which
drafts were left out — not just the "published" line.

## 3a. When the professor has just edited something

A fixed typo needs no new identifier and no `supersedes`. They edit the file
where it lives and publish again; the plan says what changed and the publishing
run brings the record up to date with the file.

What to read back to them, because these three are theirs to act on:

- **`X changed since it was recorded`** — expected, and it is what they just
  did. The publishing run records it and the version goes up by one.
- **`Y was rendered from X, which changed — held back`** — the deck was edited
  and its PDF was not rebuilt, so the PDF is *not* published. The plan says
  which producer would rebuild it; adding `--rebuild` to the confirming run
  runs that producer and publishes the result in the same press. Where the plan
  says no producer declares it, the rebuild is the professor's to do however
  that file is made, and publishing again sends both.
- **`X is NOT re-stamped`** — the same situation, said from the record's side.
  Not an error and not something to work around. The warning is deliberate and
  will keep coming back until the rendering is rebuilt.

Never fix a stale rendering by editing the record, deleting the document, or
pointing `storage_key` somewhere else. The file is out of date; the record is
telling the truth about it.

**After an edit that has already gone out somewhere, offer `update`.** It
revisits every destination the run has been published to and nothing else, so
it is the right answer to "I fixed the deck, where had it got to?" — and the
plan lists them, so read that list before confirming. It never reaches a place
for the first time; a new destination is still one press of its own.

**Correcting an announcement is `--edit`, and only when they say so.** It edits
the message students are already looking at. Use it when the professor asks to
fix or correct what was posted; use a new message when they are announcing
something. If in doubt, ask which — the two are not recoverable from each
other.

## 4. Report what cannot be undone

- A **Telegram** message is sent. Nothing recalls it.
- A **page** is a directory; hosting it is still a `git push` the professor runs.
- A **repository** may have been created public.
- A **Canvas** definition is live for the class, and a field somebody edited
  there was reported and left alone unless `--overwrite-drift` was asked for.

## Grades: preview here, send from the pane

Asked to publish, send or release an assessment's grades, you do everything but
the send. A posted grade is in front of the student within seconds and cannot be
recalled by anything here, so that press is the professor's, in the pane — the
same rule as above, and the reason it is the one red button the pane has.

1. **Is every Canvas course linked?** For each subgroup the run names:

   ```bash
   bin/ainar lms plan RUN --assessment A --target canvas-api --group G
   ```

   It only reads. `has no Canvas assignment for G` means that course has none
   linked: run `bin/ainar lms assignments RUN --assessment A` (reads only),
   propose the match per course with its reason, and on the professor's yes
   `bin/ainar lms link RUN --assessment A --group G --canvas-assignment ID`,
   which changes nothing in Canvas. Where none exists, `lms assignment-plan`
   shows what would be created; `assignment-push … --confirm` only on a yes.
2. **Read the plans back**, one line per course: how many marks are `new` or
   `changed`, how many `skip` (no paper — nothing to send), and how many
   `unmatched` with the pseudonyms — a student the roster has and that Canvas
   course does not, fixed by adding them in Canvas and `/sync-roster`, never by
   guessing. Then the two notes, in the plan's words: *unpublished* (the send
   publishes it first) and *posts automatically* (students see each grade at
   once; to release later, set the column's Grade Posting Policy to Manually in
   Canvas first).
3. **Hand over the press:** in the pane, **Tasks → Unpublished** (or **Scans**),
   **Send…** beside the assessment, **Preview the Canvas send**, then the red
   **Send N marks to Canvas**. Afterwards the Scans bar's Canvas step and Tasks
   · Unpublished say how many landed.

Never run `lms push --target canvas-api` yourself, whatever the wording of the
request: the pane's Preview is a fresh read of Canvas, and the professor reads
it before pressing.

## When it refuses

- **an answer, in a published file or an announcement** — take the material out
  of the document. Never edit the check, never publish a copy with the line
  deleted; a page that briefly held the key held it for whoever was looking.
- **`STUDENT-…` in an announcement** — a channel is everybody. Rewrite it
  without the person.
- **`… is marked approval: draft`** — the assessment has not been accepted.
  Tell the professor; accepting it is theirs, never a word you change.
- **the course does not load / validation failed** — nothing was published. It
  is a modelling error; `bin/ainar validate <COURSE>` names it, drafts included.
  Report the codes; do not retry with a narrower flag.
- **no channel, no token, no Canvas course** — configuration the professor owns.
  The pane's Integrations tab is where those are set.

## Rules

- **The plan first, every time.** Even when the professor said "publish" in the
  first sentence: run the plan, read it, then confirm. Two presses is the shape
  the pane's button has and the shape this has.
- **Publishing accepts nothing.** If what they actually want is a draft
  accepted or a grade approved, that is a change to its record — the
  `approval` word, or a `professor_decision` beside the suggestion — and it is
  theirs to make.
- **The announcement is the professor's words.** Draft wording with
  `/publish-telegram`, show it, and send what they approved — not an improved
  version of it.
- **One target per act.** Publishing the page does not also announce it. Ask.
- **Say what reached whom.** A report that says "done" is not a record of a
  thing that cannot be taken back.
