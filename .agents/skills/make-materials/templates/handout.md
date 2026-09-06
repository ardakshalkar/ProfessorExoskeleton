---
title: "{{ handout title }}"
module: "{{ MODULE-ID }}"
course_run: "{{ COURSE_VERSION_ID }}"
outcomes: ["{{ LO-ID }}"]
concepts: ["{{ CONCEPT-ID }}"]
generated_by: make-materials-skill
---

<!--
  Two pages a student keeps. Not a deck in prose: a handout is read alone, after
  the session, without you there to fill the gaps between the bullets — so it
  says things in full sentences and it defines its terms.

  Fill every {{ slot }}. Delete this comment.
-->

# {{ handout title }}

**{{ COURSE_ID }} {{ term }} · {{ MODULE-ID }} · {{ date }}**

## What this is for

{{ One paragraph: what a student should be able to do after reading it, phrased
against the module's outcomes and not beyond them. }}

Assumes you have already met: {{ CONCEPT-ID }}, {{ CONCEPT-ID }}.

## {{ concept title }} — `{{ CONCEPT-ID }}`

{{ The explanation, in full sentences. }}

**In one line:** {{ the sentence a student would write in the margin }}

## {{ concept title }} — `{{ CONCEPT-ID }}`

{{ The explanation. }}

## Worked example

{{ The example, worked through with the steps visible. Constructed examples are
fine and are labelled as constructed. Do not cite a statistic, dataset or source
that is not in the course material you were given. }}

## The mistake to avoid

{{ If the class has a recorded misconception, name it and correct it — and say
which item revealed it. If there is none recorded, delete this section rather
than inventing a plausible one. }}

## Check yourself

1. {{ question }}
2. {{ question }}
3. {{ question }}

## Where this goes next

{{ What the following module does with it, and which resource to read first. }}

---

*Drafted by an agent from {{ MODULE-ID }} and reviewed by {{ who approves it }}.
{{ Cite every source used, or say that the material was written from the course's
own content. }}*
