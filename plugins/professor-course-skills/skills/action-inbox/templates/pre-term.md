<!--
  A course with no student work in it yet. There is no grading backlog, and
  saying "nothing needs your attention" would be true and useless — so the
  readiness ladder is the answer, and one next step is the point of the document.

  Name one step, not five. A professor given five is given a decision about which
  to do first, which is the work this was meant to save.

  Fill every {{ slot }}. Delete this comment.
-->

# {{ COURSE_ID }} {{ term }} — where it stands

**{{ n }} of {{ n }} rungs ready.** As of {{ YYYY-MM-DD }}. No student work yet,
so nothing here is about the class.

## Do this next

**{{ the one step }}**

{{ Why this rung and not a later one — what it is underneath. }} {{ What it
unblocks. }}

{{ Either: `/{{ skill }}` drafts it and you approve. Or: this is a claim, and it
has to be your words — nothing can draft it for you. }}

## The ladder

| Stage | State | What it says | The move |
| --- | --- | --- | --- |
| {{ rung }} | ready | — | — |
| {{ rung }} | {{ partial / missing }} | {{ detail, verbatim }} | {{ the skill }} |
| {{ rung }} | {{ partial / missing }} | {{ detail }} | **your decision** |

<!-- `ready` means the files hold something, never that it is any good. Say so
     wherever a count of ready rungs appears. -->

Ready counts what the files hold. Whether the content is right is what
`ainar alignment` and the validator's warnings are for, and a rung being ready
never means those have nothing to say.

## What the validator says now

```
{{ the output, verbatim — errors and warnings both, with their codes }}
```

{{ Or: "No errors and no warnings" — and say it rather than leaving the section
out. }}

## Not yet worth doing

<!-- Rungs further up that would be wasted effort until the ones above land. -->

- {{ rung }} — {{ what it waits on }}
