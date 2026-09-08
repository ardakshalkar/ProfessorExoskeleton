# Professor's Exoskeleton

An assistant for the person teaching the course — not for the person taking it.

Almost everything built for education points at the student. This points at the
instructor, and at the unglamorous half of the job: the syllabus that has to
align, the concept map nobody wrote down, the twelve assessments that have to
measure the four outcomes you claimed, the ninety submissions, the slides for
Thursday, the question of which three students to talk to before the midterm.

This is long-run work. The end state is an exoskeleton in the literal sense — a
system that carries the load of running a course while the instructor keeps
every judgement that matters. It is not there yet. What exists today is the
skeleton it hangs on: a typed model of a course, a read layer that answers
questions about it, and about thirty skills that draft against it. The
[roadmap](#roadmap) below says plainly which parts are finished and which are
still an intention.

## The idea

Three moves, and the third is the point.

**Model.** A course is records, not prose — outcomes, concepts and the
prerequisites between them, modules, assessments, rubrics, items, evidence.
Twenty-eight schemas in [`datalayer/schema/`](datalayer/schema/). Once a course
is data, questions like *"which outcome does nothing assess?"* stop being
essay questions.

**Draft.** Skills read that model and write proposals into it — a term plan, a
concept map extracted from a syllabus, an assessment blueprint, criterion-level
grading suggestions with cited evidence, a lecture's slides.

**Approve.** Nothing a skill writes is part of the course until the instructor
promotes it. Drafts land in a separate place and `ainar approve` moves them,
one identifier at a time if you like. This is the whole design: the system may
propose anything and decide nothing. A grade suggestion is a suggestion until a
human agrees with it.

## What works today

The read layer is real and covered by tests. From a checkout with an example
course in it:

```bash
node --experimental-strip-types ainar-node/bin/ainar.ts validate
```

```
CSS-4008: 0 error(s), 2 warning(s)
  WARNING item.criterion_score_mismatch items feeding this criterion sum to 40
          but its maximum_score is 60, so an item-derived score would need
          rescaling [CRIT-01-01]
  ...
94 of 94 checks, the complete set.
```

The two warnings are deliberate: the example course carries a rubric whose
items do not add up to the criterion maximum, because an example where nothing
is wrong teaches you nothing about what the validator is for.

Those 94 referential checks are held to the original Python implementation by
98 mutation fixtures in [`golden/validator/`](golden/validator/) — each one
breaks the course in a specific way and pins the exact diagnostic. The same
data drives the rest of the read commands:

```bash
node --experimental-strip-types ainar-node/bin/ainar.ts syllabus CSS-4008-2026-FALL
node --experimental-strip-types ainar-node/bin/ainar.ts alignment CSS-4008-2026-FALL
node --experimental-strip-types ainar-node/bin/ainar.ts inbox CSS-4008-2026-FALL
node --experimental-strip-types ainar-node/bin/ainar.ts gradebook CSS-4008-2026-FALL
```

`ainar --help` lists the rest: `context`, `stats`, `pending`, `rubric`,
`student`, `class-progress`, `calibration`, `blueprint`, `schema`, `new
course`, `new run`, `roster`, `approve`, `deck fit`.

A course taught in subgroups narrows with `--group`, which the gradebook,
class progress, the inbox and the term plan all honour — and which refuses a
label the run does not use, because a typo would otherwise read as an empty
class rather than as a mistake:

```bash
node --experimental-strip-types ainar-node/bin/ainar.ts roster groups --run CSS-4008-2026-FALL
node --experimental-strip-types ainar-node/bin/ainar.ts class-progress CSS-4008-2026-FALL --group CS-401
```

The same read layer is exposed to a model as MCP tools — `course_context`,
`syllabus`, `alignment_report`, `gradebook`, `class_progress`,
`action_inbox`, `pending_judgements`, `assessment_blueprint`,
`assessment_rubric`, `calibration`, `student`, `validate_course` and friends —
so an agent answers from the course record rather than from the conversation.

### Parity, stated honestly

```bash
cd ainar-node && npm run check     # tests, then golden output, then the validator
```

The validator half is exact: **98/98 mutations reproduced, 94/94 codes
implemented**. The golden half is **21 of 23 fixtures**, and the two that fail
are worth naming rather than hiding, since `npm run check` exits non-zero on
them today:

- `action_inbox.json` expects a `readiness` block — the checklist of what to
  build next — which `inbox.py` produces and this port does not. A missing
  feature, not a stale fixture.
- `course_outline.json` pins an older wording of its `placement` note than the
  code now emits. That one is genuinely just stale.

## Roadmap

Honest state, not aspiration. `[x]` means it exists and something tests it.

**The model and the read layer**

- [x] 28 record schemas, and `ainar schema` to print what a record must look like
- [x] 94 referential validation checks, pinned by 98 golden mutations
- [x] Syllabus, course context, constructive-alignment report
- [x] Gradebook, class progress, per-assessment results, item difficulty
- [x] Action inbox — what needs the instructor's attention, ranked
- [x] Subgroups — `--group` narrows the gradebook, class progress, the inbox and
      the term plan to one subgroup, and refuses a label the run does not use
- [x] Draft/approve promotion (`ainar approve`, `--only`, `--reject`, `--dry-run`)
- [x] `ainar new course` / `new run` scaffolding that validates as written
- [ ] `readiness` in the action inbox — the checklist of what to build next,
      with its importance ordering. It exists in `inbox.py` and is not ported,
      which is one of the two golden fixtures that do not reproduce
- [ ] Postgres/Supabase backing store beyond the current optional route
- [ ] Multi-term history — comparing this offering against the last one

**Teaching material**

- [x] Slide outlining, building and rendering to real `.pptx` shapes + PDF
- [x] `deck fit` — answering "will this slide overflow" before rendering
- [x] Handouts, labs, seminars, homework, worked examples as skills
- [ ] Rendering that survives a template the instructor brings from their faculty

**Assessment and grading**

- [x] Assessment + rubric + concept-tagged items designed against a blueprint
- [x] Deterministic scoring of choice items
- [x] Criterion-level grading suggestions with cited evidence and confidence
- [x] Batch grading that reports which few submissions need a human first
- [x] Moodle XML and Canvas QTI export files
- [ ] Write-back to a live LMS gradebook over its API
- [ ] Calibration against a second grader, or against last year's distribution

**Students**

- [x] Pseudonymous roster import from a CSV export, identities kept outside the repo
- [x] Roster reconciliation — a student absent from a later export becomes
      `status: dropped` rather than being deleted, so a withdrawal is a
      recorded fact and not a missing row
- [x] Per-student concept states, evidence, and prerequisite-aware gap reports
- [x] Student and class dashboards as self-contained local HTML
- [ ] Anything student-facing. Every surface here is for the instructor today.

**Interfaces**

- [x] `ainar` CLI (the read half of the workspace)
- [x] MCP server, so the model reads the course rather than being told about it
- [x] A harness pane for clicking through a course while editing it
- [x] Telegram announcements, with explicit confirmation before anything sends
- [ ] Canvas and Moodle publishing as a live integration rather than a file

**Before this is fair to hand to an early user**

- [ ] **A LICENSE.** There isn't one yet, so nobody has permission to use this
- [ ] Install that does not need `--legacy-peer-deps` and a manual second `npm install`
- [ ] CI on Linux and Windows — every green result so far is one machine
- [ ] A green `npm run check`. `npm test` passes; the golden half does not,
      for the two reasons named above
- [ ] Settle the vendored-vs-source boundary so a contribution has somewhere to land
- [ ] Rename `bin/sample`, which is a leftover from what this repository started as

## Run it

Requires Node 22+ for the harness, and Node 22.6+ for the slide tooling, which
runs TypeScript through Node's type stripping (22.18 and later need no flag).

```bash
npm install --legacy-peer-deps
```

The flag is not optional. Without it npm's peer resolver spends eight-plus
minutes and about a gigabyte on this graph — sixty-odd `@deepseek-ai` packages,
all on rc versions — and does not converge. With it, npm converges in a couple
of minutes but silently skips every peer, and the harness will not boot without
them; so the peers it declares are listed as direct dependencies in
[`package.json`](package.json). That is the whole reason a dependency list this
long sits under a project this size.

```bash
bin\sample
```

`bin/sample` is the same thing for git-bash, WSL, macOS and Linux. Both set
`DSH_HOME` to this project's `.dsh` — the one thing that has to be true before
the harness boots, and a silent failure if it is not — and hand every remaining
argument through. The harness comes up at `http://127.0.0.1:3080`. A model is
only needed to talk to an agent; `ainar` and the tests need none.

```bash
npm test                    # the sample plugin's tools, against a bare Node
cd ainar-node && npm test   # the model, the read layer, roster, approve, decks
```

The second is the one that matters: 188 tests over 19 suites, and none of them
skipped, because the example course below is checked in. Remove
`courses/CSS-4008/` and eleven of them have nothing to run against.

## The example course

[`courses/CSS-4008/`](courses/CSS-4008/) is a filled-in course to read and
break: *Artificial Intelligence*, 5 credits, offered `2026-FALL` — four
outcomes, ten concepts with prerequisite edges, nine modules, four assessments
with rubrics and items, and three enrolled students carrying recorded evidence.

It is deliberately small enough to hold in your head and complete enough that
every read command returns something. The expected output for each of those
commands is checked in beside it under
[`golden/CSS-4008/`](golden/CSS-4008/), which is what makes it a fixture and
not just a demo.

The two capabilities its outcomes reference sit in
[`shared/capabilities.yaml`](shared/capabilities.yaml) rather than inside the
course, because a student accumulates evidence for a capability across several
courses — which is what lets a capability map be built instead of a transcript.
Remove that file and `validate` reports nine dangling references, which is the
short version of why it is not course-local.

The three students are pseudonyms — `STUDENT-JNG7SN` and the like — and the
staff record is a placeholder. No real person is in this repository.

## Student identities

Enrollments hold pseudonyms only. Names, student numbers and emails live in
`~/.ainar/roster` — outside the checkout, deliberately — and the pseudonym is
an HMAC of the institutional id under a local salt, so the same person keeps
the same identifier across every course and semester without the mapping ever
being committed.

```bash
node --experimental-strip-types ainar-node/bin/ainar.ts roster status
```

`refuseInsideRepo` in [`ainar-node/src/roster.ts`](ainar-node/src/roster.ts)
refuses to write identities to any path inside the workspace, including the
near-miss case of a sibling directory whose name merely starts with the
workspace's. `roster show` and `roster whois` print to a terminal and never to
a file the repository could capture.

Rendered decks are excluded for the same reason, one step weaker: slides carry
draft arguments, unannounced results and student work quoted as examples, so
`output/` is in `.gitignore` and decks belong outside the checkout.

## Layout

```
courses/CSS-4008/              the example course — start here
shared/capabilities.yaml       capabilities, which outlive any one course
datalayer/schema/              28 record schemas: what a course IS
ainar-node/                    the model and the read layer, in TypeScript
  src/                         validate, gradebook, roster, approve, decks
  bin/ainar.ts                 the `ainar` CLI
  test/                        19 suites
golden/                        expected output, and 98 validator mutations
plugins/
  dsh-ainar-course-model/      the model as a harness plugin + MCP server
  dsh-professor-pane/          the UI for clicking through a course
  professor-skills/            19 skills: slides, assessment, grading, publishing
  dsh-sample/                  a minimal plugin, kept as the contract example
.agents/skills/                16 course-level skills: planning, gaps, dashboards
bin/sample[.cmd]               the front door: set DSH_HOME, then exec dsh
.dsh/profiles/sample/          how this host is composed
```

[`plugins/VENDORED.txt`](plugins/VENDORED.txt) is required reading before
editing anything under `plugins/`: three of the four are copies from sibling
checkouts, and a change made here is lost, silently, on the next re-vendor.

## Writing a plugin against this

[`plugins/dsh-sample/`](plugins/dsh-sample/) is the contract in miniature — two
tools, one HTTP route, one config schema, and the patch row that mounts it. Its
[README](plugins/dsh-sample/README.md) has the table of things that are **fatal
at registration** rather than merely broken, each of which takes down the whole
harness instead of the one plugin. It is short and worth reading once.

The four-layer config arrangement, the mount order, and how the pieces find
each other are documented there too, along with `--dump-config`, which answers
"is my row actually mounted, and whose value won" without booting anything.
