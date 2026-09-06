---
marp: true
title: "{{ session title }}"
module: "{{ MODULE-ID }}"
course_version: "{{ COURSE-ID-YYYY-TERM }}"
outcomes: ["{{ LO-ID }}"]
concepts: ["{{ CONCEPT-ID }}"]
generated_by: build-presentation-skill
---

<!--
  In a workshop the slides are punctuation: the unit is the task block, and each
  block ends with a checkpoint that says whether the room can move on.

  Slide order, count and titles must match the outline. Delete every slide the
  outline does not have, including this comment.
-->

# {{ session title }}

{{ MODULE-ID }} · {{ COURSE-ID }} {{ term }} · {{ date }}

---

## What we are building

<!-- The framing, and what will be true at the end. Then what has to be working
     on their machine already — a room that discovers a missing dependency at
     minute twenty has lost twenty minutes of every person in it. -->

Today: {{ what they will have built }}

Before we start, you need:

- {{ software, data or account }}
- {{ software, data or account }}

---

## {{ the demonstration }}

<!-- The step that is hard to describe and easy to show. A diagram of the
     pipeline, not a screenshot of results — a screenshot of a result is read as
     a measurement. -->

![{{ alt text: what the figure shows, in a sentence }}]({{ deck-name }}-fig-01-{{ what }}.svg)

---

## Task 1 — {{ what they do }}

<!-- The instruction, then the checkpoint. The checkpoint is observable: not
     "understand X" but something they can see on their own screen. -->

1. {{ step }}
2. {{ step }}
3. {{ step }}

**Checkpoint:** {{ what they should be looking at when this works }}

---

## {{ where this usually goes wrong }}

<!-- Placed where the failure happens, not at the end. Delete if there is no
     predictable failure. -->

- What you will see: {{ the symptom }}
- What is actually happening: {{ the cause }}
- The rule: {{ what avoids it }}

---

## Task 2 — {{ what they do }}

1. {{ step }}
2. {{ step }}

**Checkpoint:** {{ what they should be looking at when this works }}

---

## What we saw

<!-- The generalisation the exercise earns — and only what it earns. An
     exercise on one dataset does not establish a claim about datasets. -->

- {{ what the exercise demonstrated }}
- `{{ CONCEPT-ID }}`
- Next: {{ what the following session does with this }}
