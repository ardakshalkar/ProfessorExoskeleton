---
name: publish
description: Publish something a student sees — the course page, a Telegram announcement, a homework starter repository, or an assessment's definition in Canvas — promoting the drafted materials it needs on the way. Use when the user asks to publish, post, put up, push out, release or send something to students, asks to refresh the course site, or says to go ahead with a publication that was planned. Composing the announcement's wording is /publish-telegram; building the page without publishing it is /course-page; promoting a grade is `ainar approve` and stays the professor's.
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
> - **`ainar publish` promotes documents and resources, and nothing else.** That
>   is enforced by the command, not by your care. **Never run `ainar approve`**:
>   an evaluation, a signal or an intervention becomes a record when the
>   professor promotes it, and approving your own suggestion is the one place a
>   human enters.
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
bin/ainar publish page CSS-4008-2026-FALL --confirm       # promote, then publish
```

| Target | What reaches whom |
| --- | --- |
| `page RUN` | the week plan and the approved materials, written to `dist/pages/<RUN>/` for hosting |
| `telegram RUN --message TEXT` | one plain-text post to the run's channel. It cannot be recalled |
| `homework ASSESSMENT --run RUN` | the starter repository on GitHub, public so it can be forked |
| `canvas ASSESSMENT --run RUN` | the assessment's title, points, dates and brief. Never the marks |

## 1. Run the plan, always

The first run reads and writes nothing — not to `courses/`, not to disk, not to
anybody's server beyond the reads that answer the question. It prints two
halves, and both matter:

- **what it would promote.** The drafted documents and resources this
  publication needs, by identifier and title. This is the step that used to be
  `ainar approve` in a terminal, and it is why a deck drafted an hour ago can be
  on the page without a second command.
- **what it would then publish**, and what it would hold back and why.

A draft already in the record says `is already DOC-9001 in the course — left as
it is`. That is not an error and not a reason to stop: it means this was
published before.

Anything under `left alone` — evaluations, signals, interventions — stays a
proposal. Say so if there is any, because a professor reading *promote* may
reasonably assume it means everything in `work/`.

## 2. Read the plan to the professor

Name the target, the run, and the three things they cannot see from the command
line: what would be promoted, what would be held back, and who it reaches.
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

`--as USER-ID` when the run names no instructor; the promotion records who
accepted the materials and the command refuses rather than guessing.

Read the whole output back. The promotion lines are a change to the course
record and the professor should see them, not just the "published" line.

## 3a. When the professor has just edited something

A fixed typo needs no new identifier and no `supersedes`. They edit the file
where it lives and publish again; the plan says what changed and the publishing
run brings the record up to date with the file.

What to read back to them, because these three are theirs to act on:

- **`X changed since it was recorded`** — expected, and it is what they just
  did. The publishing run records it and the version goes up by one.
- **`Y was rendered from X, which changed — held back`** — the deck was edited
  and its PDF was not rebuilt, so the PDF is *not* published. Give them the
  rebuild command — `bin/ainar materials build <RUN>` for a course that
  declares its own producers — and say that publishing again sends both.
- **`X is NOT re-stamped`** — the same situation, said from the record's side.
  Not an error and not something to work around. The warning is deliberate and
  will keep coming back until the rendering is rebuilt.

Never fix a stale rendering by editing the record, deleting the document, or
pointing `storage_key` somewhere else. The file is out of date; the record is
telling the truth about it.

## 4. Report what cannot be undone

- A **Telegram** message is sent. Nothing recalls it.
- A **page** is a directory; hosting it is still a `git push` the professor runs.
- A **repository** may have been created public.
- A **Canvas** definition is live for the class, and a field somebody edited
  there was reported and left alone unless `--overwrite-drift` was asked for.

## When it refuses

- **an answer, in a published file or an announcement** — take the material out
  of the document. Never edit the check, never publish a copy with the line
  deleted; a page that briefly held the key held it for whoever was looking.
- **`STUDENT-…` in an announcement** — a channel is everybody. Rewrite it
  without the person.
- **the drafts do not load** — nothing was promoted and nothing published. It is
  a modelling error; `bin/ainar validate <COURSE> --drafts work/<RUN>` names it.
- **`approve.collision` / validation failed** — the gate refused, and the
  refusal *is* the gate. Report the codes; do not retry with a narrower flag.
- **no channel, no token, no Canvas course** — configuration the professor owns.
  The pane's Integrations tab is where those are set.

## Rules

- **The plan first, every time.** Even when the professor said "publish" in the
  first sentence: run the plan, read it, then confirm. Two presses is the shape
  the pane's button has and the shape this has.
- **Publishing promotes artefacts, never judgements.** If what they actually
  want is a grade approved, that is `ainar approve` and it is theirs to run.
- **The announcement is the professor's words.** Draft wording with
  `/publish-telegram`, show it, and send what they approved — not an improved
  version of it.
- **One target per act.** Publishing the page does not also announce it. Ask.
- **Say what reached whom.** A report that says "done" is not a record of a
  thing that cannot be taken back.
