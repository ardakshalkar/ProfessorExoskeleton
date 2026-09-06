# When there is no course to read

Three skills, and none of them needs a course *database*. Two of them do not
need a course at all. This is what changes as each layer of grounding goes away,
and — more usefully — what has to be said out loud when it does.

## No database, but a course directory

Nothing changes except the provenance line, which says so. Everything the
outline needs — outcomes, concepts, prerequisites, the scheduled meeting, the
readings — is in the YAML.

Say it once in the hand-over: *read from the course directory; the database was
not reachable / holds nothing yet.* A professor who thought they were working
against the shared copy should find that out from you rather than from a
colleague looking at different slides.

## No course directory, but a flat `course.yaml`

The shape in `course-source.md`. Everything still works, because the flat file
is normalised into the same course.

What is usually thinner: **prerequisites**. A flat file often lists topics with
no `prerequisites:` between the concepts, so `pres context` reports none, and
"none recorded" is not the same fact as "this concept depends on nothing". Say
which it is. The opening slide — *what you can already do* — is the one that
suffers, and the professor is the only one who can supply it.

## No course at all

A talk with no course behind it: a conference presentation, a guest lecture, a
seminar for a group that has no syllabus.

Everything still runs, and three things move from *read* to *asked*:

- **Audience and duration.** Always asked anyway. Here there is no activity to
  fall back on, so there is no default at all.
- **What they already know.** Without a previous module, the opening slide has
  nothing to build on. Ask, and write down the answer in the outline's
  `arc.starts_from` — that is the record of what was assumed, and it is what
  makes the deck reviewable later.
- **What may be claimed.** With no module bounding the concepts, the check that
  refuses a concept the course does not claim cannot run. That check is a
  guard-rail, not the rule. The rule still holds: **the claims are the
  professor's**. Write `TODO` and say what is missing rather than inventing an
  outcome, and be more explicit in the hand-over about what you assumed, because
  nothing else is checking.

Run `pres outline check` on the outline regardless. The internal half —
numbering, timing, titles, `max_slides` — is the half that catches a careless
draft, and it does not need a module.

## No `pptxgenjs` or `sharp`

`pres check` still runs: approval, the plan contract, figures present, alt text,
attribution. Only the build stops.

Marp will write a `.pptx`, and it is worse than it looks: each slide is a flat
image, so nothing in it can be edited or reused, and none of the four gates
runs. Offer it while saying that:

```bash
npx @marp-team/marp-cli DECK.md --pptx -o output/DECK.pptx
```

## No LibreOffice

The `.pptx` is written; the PDF is not. Marp renders straight to PDF and needs
only a browser:

```bash
npx @marp-team/marp-cli DECK.md --pdf --pdf-outlines -o output/DECK-review.pdf
```

Say what it is when you hand it over: a *second rendering* of the markdown, not
a picture of the deck the professor will present. Fine for reading through and
checking the words; wrong for anything presented or handed out, because it is
not the same document.

## No network

Two things go: the survey of how the topic is taught elsewhere, and
`pres find-image`. Say so in the report rather than pretending the survey
happened — "grounded in the course design only" is a fact about the deck, and it
is one a professor may want to act on before the lecture.
