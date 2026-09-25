<!--
  The inbox as the professor reads it. The drafts behind it go in
  action-items-draft.yaml; this is the report.

  Order by what is actually urgent, not by section. If nothing needs attention,
  say that plainly — an inbox with manufactured items in it is worse than an
  empty one, because it costs the same attention and buys nothing.

  Fill every {{ slot }}. Delete this comment.
-->

# {{ COURSE_ID }} {{ term }} — what needs you

**{{ n }} items, roughly {{ n }} minutes.** As of {{ YYYY-MM-DD }}.

| # | Priority | What | Why now |
| --- | --- | --- | --- |
| 1 | {{ high / medium / low }} | {{ title }} | {{ one line }} |
| 2 | {{ … }} | {{ title }} | {{ one line }} |

## The ones that need a decision from you

<!-- Grades awaiting approval, and anything where the model has a suggestion and
     no professor decision. Say the confidence; say what happens if it waits. -->

- **{{ title }}** — {{ what it is, with the identifiers }}. {{ Confidence, where
  the command reported one. }} {{ What it blocks. }}

## What is missing

<!-- Submissions not in, judgements not made, deadlines coming. Straight from
     `ainar pending`. Never a mark of zero for a missing submission. -->

- {{ ASSESSMENT-ID }} — {{ n }} of {{ n }} submitted, {{ n }}/{{ n }} judgements
  done. {{ Who has not submitted, by pseudonym. }}

## Open signals

- {{ SIGNAL-ID }} — {{ what it says }}. {{ Raised {{ when }}, still open. }}

## Where the course itself is thin

<!-- From the ladder and from validate. A rung being `ready` says what the files
     hold, never that the content is any good — `ainar alignment` and the
     validator's warnings are where that lives. -->

| Stage | What it says | The move |
| --- | --- | --- |
| {{ rung }} | {{ detail, verbatim }} | {{ the skill that does it }} |
| {{ rung }} | {{ detail }} | **A claim — your decision, not work an agent can do** |

## To approve the drafts behind this

```bash
bin/ainar approve work/{{ COURSE_VERSION_ID }} --as {{ USER-… }}
```

<!-- Never run that. It is the one place a person enters the loop. -->
