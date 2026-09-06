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
  A seminar deck is scaffolding, not the argument. If these slides account for
  most of the session, this is a lecture wearing a seminar's name — say so
  rather than writing more slides.

  Slide order, count and titles must match the outline. Delete every slide the
  outline does not have, including this comment.
-->

# {{ session title }}

{{ MODULE-ID }} · {{ COURSE-ID }} {{ term }} · {{ date }}

---

## The claim on the table

<!-- State the claim in the reading's own terms, and say where it comes from.
     The critique comes later; a seminar that opens with it has skipped the
     reading. -->

> {{ the claim, quoted or fairly paraphrased }}

{{ RES-ID }} · {{ author, work, locator }}

---

## What the reading establishes

<!-- The evidence, stated fairly. This is the slide that earns the right to
     disagree on the next one. -->

- {{ what the evidence actually shows }}
- {{ what it does not show }}
- {{ what it assumes }}

---

## {{ figure title }}

<!-- Optional. A diagram of the argument's structure is often the most useful
     picture a seminar can have. Alt text is not optional. -->

![{{ alt text: what the figure shows, in a sentence }}]({{ deck-name }}-fig-01-{{ what }}.svg)

---

## The disagreement

<!-- Two or three defensible positions, and what separates them. Not a straw
     man among them: a position nobody holds is a position nobody learns from
     defeating. -->

| Position | Rests on | Breaks when |
| --- | --- | --- |
| {{ position }} | {{ what it assumes }} | {{ where it fails }} |
| {{ position }} | {{ what it assumes }} | {{ where it fails }} |

---

## {{ the question that opens the discussion }}

<!-- Most of the session happens after this slide and not on it. One question,
     answerable from the reading, with more than one defensible answer. -->

{{ the question }}

---

## Where that leaves us

<!-- What the course now takes as settled, and — as importantly — what stays
     open. A synthesis that closes a question the field has not closed is worse
     than no synthesis. -->

- Settled: {{ what the session established }}
- Open: {{ what it did not }}
- `{{ CONCEPT-ID }}`
