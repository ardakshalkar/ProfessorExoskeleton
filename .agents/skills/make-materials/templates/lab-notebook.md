---
title: "{{ lab title }}"
module: "{{ MODULE-ID }}"
course_run: "{{ COURSE_VERSION_ID }}"
outcomes: ["{{ LO-ID }}"]
concepts: ["{{ CONCEPT-ID }}"]
activity: "{{ ACTIVITY-ID }}"
duration_minutes: {{ from the scheduled activity, not guessed }}
generated_by: make-materials-skill
---

<!--
  A practical, paced against the activity's real duration. The shape below is
  fixed: setup, tasks with checkpoints, a stretch task, and what to submit.

  Two things this file must never contain, because a student reads it: an
  answer key of any kind, and anything written for the marker. If the lab is
  assessed, the marking guidance lives on the assessment, not here.

  Fill every {{ slot }}. Delete this comment.
-->

# {{ lab title }}

**{{ COURSE_ID }} {{ term }} · {{ MODULE-ID }} · {{ ACTIVITY-ID }} ·
{{ duration }} minutes**

## Before you start

- You will need: {{ tools, environment, files }}
- This assumes you can already: {{ what CONCEPT-ID gave you }}
- If any of that is missing, {{ what to do about it — a resource, or ask }}

## What you are building

{{ One paragraph. The finished thing, described so a student can tell whether
they have got there. }}

## Task 1 — {{ task title }}

{{ What to do. }}

**Checkpoint.** You have finished this task when {{ the observable condition }}.
If instead you see {{ the common wrong result }}, {{ what it means }}.

## Task 2 — {{ task title }}

{{ What to do. }}

**Checkpoint.** {{ the observable condition }}

## Task 3 — {{ task title }}

{{ What to do. }}

**Checkpoint.** {{ the observable condition }}

## If you finish early

{{ A stretch task that goes deeper into a concept the module already has, never
into next week's. }}

## What to hand in

{{ What, in what form, by when — or "nothing; this lab is not assessed". If it
is assessed, name the assessment by identifier and leave the rubric where it
lives, on the assessment. }}

## What this was about

- `{{ CONCEPT-ID }}` — {{ how the lab exercised it }}
- `{{ CONCEPT-ID }}` — {{ how the lab exercised it }}
