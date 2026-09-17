---
name: publish-telegram
description: Prepare and, with the professor's explicit instruction, publish student-safe course announcements to the Telegram channel configured for a course run; also answer whether an assignment has a recorded deadline. Use when the user asks to announce, post, send or publish course information to Telegram, configure a course Telegram channel, or asks whether an assignment has a deadline. Building the course page students read is /course-page; promoting drafts into the course record is `ainar approve`, which the professor runs.
stage: teach
requires: [assessments]
produces: []
writes: none
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

# Publish a course announcement to Telegram

**Needs:** a modelled course to answer from. Actual publication additionally
needs the authenticated shared backend, a configured Telegram channel, and the
`integrations:publish` OAuth scope.

Telegram is student-facing. Prepare freely; publish only when the professor uses
an explicit publishing verb in the current request, such as “publish”, “post” or
“send”. “Draft”, “prepare”, “what would this look like?” and a deadline question
authorise a preview only. Show the exact final message before a separate
confirmation when the request leaves the wording or target ambiguous.

## Read the student-safe facts

Use `course_outline` for the run and match the assignment by exact
`assessment_id` first, then by an unambiguous title. It contains the facts safe
to announce: title, opening time, deadline, declared weight and student-facing
materials. Do not use `assessment_rubric` to compose a post; its payload may
carry answer keys and marking guidance.

For “does this assignment have a deadline?” answer directly:

- `due_at` present: “Yes — it is due <local date and time> (<run timezone>).”
- `due_at` absent or null: “No deadline is recorded for this assignment.” Do not
  shorten this to “there is no deadline”; the course record may be incomplete.
- a date without a time in `extensions.notion.soft_deadline`: call it a soft
  date, not the formal deadline, and say no submission time is recorded.
- multiple title matches: list the IDs and ask which one. Never guess.

An opening time is not a deadline. Preserve the run’s timezone and include the
offset when ambiguity matters.

## Compose the announcement

Default assignment-publication shape:

```text
📌 <Assignment title> is now available

<One student-facing sentence from the approved description, if present>
Due: <date, time, timezone | No deadline recorded>
Submission: <approved delivery/submission information, if present>
<student-facing URL, if recorded>
```

Keep Telegram messages at or below 4096 characters. Send plain text: do not
invent Markdown/HTML markup, links or hashtags. Never include an answer key,
correct-option marker, marking guidance, misconception notes, hidden tests,
student names, pseudonyms, grades or internal approval commentary. If the
requested text contains any of those, refuse to publish it and explain what must
be removed.

## Publish through the backend

Call `publish_telegram` first with `confirm: false` when the configured target is
not already known. This resolves the course-scoped channel and sends nothing.
Then report:

- the course run and configured channel;
- the exact message;
- whether the assignment has a formal deadline and the value used.

Call it with `confirm: true` only after explicit current-turn authorization:

```json
{
  "course_version_id": "CSS-4008-2026-FALL",
  "message": "…",
  "confirm": true
}
```

The backend, not the local process, owns `AINAR_TELEGRAM_BOT_TOKEN`. It checks
the signed-in professor’s run membership, the `integrations:publish` scope and
the configured channel before sending. Report the returned channel and Telegram
message ID. Never claim success from a prepared preview or retry an ambiguous
failure; show the failure and let the professor decide whether to retry.

## Channel setup

The professor creates a bot with BotFather, adds it to the channel as an
administrator with permission to post messages, and gives an administrator the
channel identifier (`@public_name` or the private `-100…` chat ID). The backend
administrator stores the bot token as `AINAR_TELEGRAM_BOT_TOKEN` and maps the
course run to the channel in `delivery.telegram_channels`. Never request, read,
echo or write the bot token in chat or repository files.

## Without the CLI

Read `versions/<TERM>/assessments/*.yaml` and match `assessment_id`, `title`,
`opens_at` and `due_at`. You can answer the deadline question and prepare the
exact announcement. Without the authenticated backend, publication is
unavailable: say so plainly and do not suggest putting the bot token into a
local script.

`references/working-without-the-cli.md` carries the file layout and identifier
patterns. Read it before relying on files directly.

## Rules

- A recorded blank is not a fact. Say “not recorded”, never invent a deadline.
- Publishing requires an explicit verb in the current request; prior approval
  and “keep students updated” are not standing authorization.
- One tool call sends one message. Do not split, cross-post or retry without
  separate authorization.
- Telegram is for course announcements, never individual student information.
- Do not run `ainar approve`, change the assignment or repair missing metadata
  as part of publishing.
