# Constructive alignment

Reference material for skills that have to judge whether a course hangs
together. `bin/ainar alignment <RUN>` computes this for a course held in
this model; this file is for reasoning about one that is not, or about what the
report means.

## The claim

Biggs' argument is that three things must point at each other:

```
what the student must be able to do        (outcome)
        ↕
what the student spends time doing         (activity)
        ↕
what the student is judged on              (assessment)
```

Learning follows what is assessed, not what is intended. So an outcome nothing
assesses is not a weak outcome — it is not an outcome of that course at all,
whatever the syllabus says. And an assessment serving no outcome is marks that
cannot become evidence about anything.

## The four questions worth asking of any course

1. **Which outcomes does nothing assess?** The most common and most damaging
   finding. In this model it is a validator warning; in a syllabus review it is
   the first thing to look for.
2. **Which assessment weight reaches no outcome?** Run the weights the other
   way. Marks that serve no outcome are usually participation, attendance or
   "effort" — often defensible, but they should be a deliberate choice rather
   than a leak.
3. **Which outcomes does nothing teach?** An outcome assessed but never taught
   is a course asking students to have arrived knowing it. Sometimes correct
   (a prerequisite), usually not.
4. **Does the declared weight match the actual share?** This is the one people
   never check by hand. An outcome can be declared at 30% and, once you total
   the rubric criteria that actually name it, carry 12% of the marks. The
   declaration is intent; the criteria are what happens.

`ainar alignment` reports the last one as a two-column table, computed from
rubric criteria rather than from stated intent:

| Outcome | Declared weight | Actual share of grade |
| --- | --- | --- |
| LO-01 | 20% | 25% |
| LO-04 | 30% | 22% |

## Alignment is not coverage

A course can cover every outcome and still be misaligned: three outcomes taught
in lectures and assessed by one essay that only genuinely exercises one of
them. Coverage asks *is there a link*; alignment asks *does the link carry
weight*. The matrices in the alignment report are coverage; the weight table is
alignment.

## Where the level enters

An outcome at `analyze` assessed by an instrument that can only reach `apply`
is aligned on paper and misaligned in fact. Check the pairing, not just the
existence of a link — see [bloom-taxonomy.md](bloom-taxonomy.md).

## What a review should and should not conclude

Report the gap; do not close it. Every one of the four questions has two
possible answers — the outcome is wrong, or the assessment is — and choosing
between them is a claim about what the course demands. That is the professor's.

The useful output is: *"LO-03 is declared at 25% and carries 8%. Either it
matters less than stated, or ASSESSMENT-02 should have a criterion naming it.
Which?"*

## Related

- [bloom-taxonomy.md](bloom-taxonomy.md)
- [assessment-design.md](assessment-design.md)
