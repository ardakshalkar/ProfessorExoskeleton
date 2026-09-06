# Professor Assignment Skills

A lean plugin for creating four teaching activities that should not be treated
as interchangeable worksheets:

- `make-homework` — independent work that reinforces, integrates, or prepares;
- `make-lab` — pre-lab, in-lab, and post-lab inquiry;
- `make-seminar` — preparation plus a branching discussion architecture;
- `make-practice` — guided practice with feedback and fading support.

Every skill aligns outcomes to observable evidence and creates two views:

```text
course context -> activity design -> student artifact
                                \-> professor guide
```

Each skill accepts `SKETCH`, `STANDARD`, or `ASSURANCE`. Explicit depth always
wins; otherwise focused work uses SKETCH and a complete activity uses STANDARD.
ASSURANCE is reserved for explicit deep/approval-first work or genuinely higher
risk. Depth changes the design and validation effort, not the amount of work
assigned to students.

The package has no CLI, hooks, runtime dependencies, or mandatory research
stage. It consumes the sibling Professor DataLayer description when a course
workspace is available and can also work directly from material supplied in the
request.

## Deliberate boundary

This first version designs activities. It does not grade student work, monitor
GitHub repositories, run laboratory equipment, or record oral defenses. Those
need student data or external integrations and belong in separate capabilities.
