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
Twenty-eight schemas in [`vendor/datalayer/schema/`](vendor/datalayer/schema/). Once a course
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

The instructor should not have to *type* that, though, and since 2026-09-21 they
do not. `ainar publish` — and the Publish button in the pane, which spawns it —
runs the same gate over the **documents and resources** a publication needs and
then publishes, so a deck drafted an hour ago reaches the students' page in one
press that shows what it would promote before it promotes anything. The line
moved to where the decision actually is: pressing *publish the course page*
having read what would go on it **is** the act of standing behind a deck, and
says nothing about whether a suggested score is right. So a judgement about a
student — an evaluation, a signal, an intervention — is still `ainar approve`,
still the instructor's, and is reported as *left alone* when a publication walks
past it in the same directory.

Everything that produces a file a person opens — a deck, an exam paper, the
students' page — runs through those three moves in the same order.
[`GENERATION.md`](GENERATION.md) traces that one shape and then each pipeline
against it, including where a stage is missing.
[`PIPELINES.md`](PIPELINES.md) is the same thing in plain terms, one page: what
happens between your sentence and the thing you wanted, and the two decisions
that stay yours.

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
98 mutation fixtures in [`workspace/golden/validator/`](workspace/golden/validator/) — each one
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
course`, `new run`, `roster`, `approve`, `publish`, `deck fit`.

### The write layer

Four commands used to print *"run `python -m ainar` for that"*, and two more
were simply absent. All six were ported on 2026-09-08, so nothing in this
project reaches for Python any more — see [`PROVENANCE.md`](PROVENANCE.md) for
what each was checked against.

```bash
bin/ainar score-items work/CSS-4008-2026-FALL --course-version CSS-4008-2026-FALL --dry-run
bin/ainar export --out dist/            # canonical JSON for the application
bin/ainar sql --out dist/               # an idempotent PostgreSQL import
bin/ainar dashboard CSS-4008-2026-FALL  # the professor's grid, marks by pseudonym
bin/ainar page CSS-4008-2026-FALL       # the students' course page, no script at all
```

The two HTML surfaces are deliberate opposites, and the wall between them is
the design: `dashboard` draws marks and is private; `page` draws the plan, is
the only output written for a public URL, and copies a material file only after
an answer-key scan that has no override.

`page` builds the site; `publish` is what puts something in front of a class,
and it is the one command that also promotes:

```bash
bin/ainar publish page CSS-4008-2026-FALL             # the plan: writes nothing
bin/ainar publish page CSS-4008-2026-FALL --confirm   # promote the materials, then build
bin/ainar publish telegram CSS-4008-2026-FALL --message-file note.txt
bin/ainar publish canvas ASSESSMENT-04 --run CSS-4008-2026-FALL
```

Four targets, one grammar, two presses each. The plan names the drafted
documents it would promote, what would then be published, and what it would
hold back; `--confirm` does both. What it may promote is documents and
resources — a drafted evaluation in the same directory is reported as left
alone, because publishing a deck is not a decision about anybody's mark.

`lms` is the last one and the only thing here that reaches a third party:

```bash
bin/ainar lms plan CSS-4008-2026-FALL --assessment ASSESSMENT-04     # read-only
bin/ainar lms diff CSS-4008-2026-FALL --assessment ASSESSMENT-04     # three-way
bin/ainar lms push CSS-4008-2026-FALL --assessment ASSESSMENT-04 --out ~/upload.csv
```

A cell is new, unchanged, a change this workspace owns, or **drift** — somebody
edited it in the target by hand — and drift is reported and left alone. Names,
numbers and emails are joined in from the private roster at the moment of
export and never written back; a file that names students is refused a path
inside the workspace. `--target canvas-api` and `--target sheets-api` reach a
live gradebook, need `--confirm`, and are not for an agent to run.

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
- `course_outline.json` carries two fields on each assessment that `outline.py`
  never emitted: `instructions_document_id`, which names the brief so a view
  with a route to it can offer it, and `description`, which is the brief itself
  for the great majority of assessments that have no document at all. Both are
  deliberate additions, so the fixture is behind the code rather than the code
  being wrong — but it is left failing rather than quietly rewritten, because a
  golden file that is edited whenever it disagrees has stopped being one. (This
  entry used to name the `placement` wording. That had already been fixed; the
  fixture was failing on the field list and the note had not caught up.)

A third fixture was added on 2026-09-08: `workspace/golden/CSS-4008/import.sql`, the 655
lines `python -m ainar sql` wrote for the example course before Python was cut
loose. `test/sqlgen.test.ts` compares the port's output against it line by line
and names the only difference it is allowed to have.

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
- [x] `ainar publish {page,telegram,homework,canvas}` — the plan, then one
      `--confirm` that promotes the materials the publication needs and
      publishes. The same command behind the pane's Publish button and the
      `/publish` skill, so the three cannot disagree about what a press does
- [x] `ainar new course` / `new run` scaffolding that validates as written
- [x] One run of one course per workspace — no `versions/<TERM>/` level, with
      `ainar migrate-layout` to move an old tree and `ainar archive-run` to
      retire a finished term into `archive/<TERM>/`, text in full and binaries
      by checksum
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
- [x] The harness wearing this project's own name and mark rather than the
      shipped DeepSeek brand — see [`plugins/dsh-professor-brand`](plugins/dsh-professor-brand/)
- [x] Telegram announcements, with explicit confirmation before anything sends
- [ ] Canvas and Moodle publishing as a live integration rather than a file
- [ ] More than one professor on one machine. [`deploy/`](deploy/) has the
      per-person launcher, the systemd template and an authenticating Caddy
      front door, and the launcher and the harness's trust fence were both
      exercised against a running host — but nothing here has stood up on a
      real server, and the identity-provider half is left to the institution

**Before this is fair to hand to an early user**

- [x] **A LICENSE** — [MIT](LICENSE)
- [ ] Install that does not need `--legacy-peer-deps` and a manual second `npm install`
- [ ] CI on Linux and Windows — every green result so far is one machine
- [ ] A green `npm run check`. `npm test` passes; the golden half does not,
      for the two reasons named above
- [x] Settle the vendored-vs-source boundary so a contribution has somewhere to land — everything is source; see `PROVENANCE.md`
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
`workspace/courses/CSS-4008/` and eleven of them have nothing to run against.

## The example course

[`workspace/courses/CSS-4008/`](workspace/courses/CSS-4008/) is a filled-in course to read and
break: *Artificial Intelligence*, 5 credits, offered `2026-FALL` — four
outcomes, ten concepts with prerequisite edges, nine modules, four assessments
with rubrics and items, and three enrolled students carrying recorded evidence.

It is deliberately small enough to hold in your head and complete enough that
every read command returns something. The expected output for each of those
commands is checked in beside it under
[`workspace/golden/CSS-4008/`](workspace/golden/CSS-4008/), which is what makes it a fixture and
not just a demo.

The two capabilities its outcomes reference sit in
[`workspace/shared/capabilities.yaml`](workspace/shared/capabilities.yaml) rather than inside the
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

The repository root holds the product. Everything a *course* is made of lives
one level down, in `workspace/`, because that is a workspace and this is not —
see **The workspace is not the repository** below.

```
ainar-node/                    the model and the read layer, in TypeScript
  src/                         validate, gradebook, roster, approve, decks
  src/tools/                   the 16 read-only tools, and their widgets
  src/mcp/                     protocol only: stdio, HTTP, OAuth
  bin/ainar.ts                 the `ainar` CLI
  test/                        19 suites
workspace/                     a course workspace, which is what the tools read
  courses/CSS-4008/            the example course — start here
  homework/<slug>/             starter repositories students fork
  imports/<label>/             material brought in from outside, not yet a record
  archive/<TERM>/              offerings that have finished
  shared/capabilities.yaml     capabilities, which outlive any one course
  golden/                      expected output, and 98 validator mutations
vendor/                        taken from elsewhere, kept as source — PROVENANCE.md
  datalayer/schema/            28 record schemas: what a course IS
  ainar/mcp/widget-assets/     the widget documents, shared with the Python server
plugins/
  dsh-ainar-course-model/      the model as a harness plugin + MCP server
  dsh-professor-pane/          the UI for clicking through a course
  dsh-professor-brand/         this host's own mark and wordmark, not DeepSeek's
  professor-course-skills/     20 course-level skills: planning, gaps, dashboards
  professor-skills/            19 skills: slides, assessment, grading, publishing
  dsh-sample/                  a minimal plugin, kept as the contract example
.claude-plugin/marketplace.json  the same seven skill trees, for the second host
bin/sample[.cmd]               the front door: set DSH_HOME, then exec dsh
.dsh/profiles/sample/          how this host is composed
deploy/                        the same host for more than one professor:
                               a home and a port each, behind an authenticating
                               proxy, because the harness has no login of its own
```

### The workspace is not the repository

A **workspace** is any directory holding a `courses/` directory, and the code
finds one by walking up from wherever you are standing
([`workspaceRootFor`](ainar-node/src/workspace.ts)). A professor's workspace is
their own course folder, somewhere else entirely. `workspace/` here is a filled-in
example, and the repository root is deliberately *not* one — it is the product,
and a product that is also a course teaches the wrong lesson about which is
which.

The practical consequence: from the repository root, say where the course is.

```bash
bin/ainar stats --root workspace
cd workspace && ../bin/ainar stats     # or just stand in it
```

Without `--root`, `ainar` reads the directory you are standing in and finds no
courses there — which is the same thing it does in any other folder that is not
a workspace. Until 2026-09-17 the repository root happened to be a workspace, so
this was never needed here.

### Everything under `plugins/` is source

Edit it here. Three of the four began as copies from sibling checkouts; none has
a generated twin any more — `dsh-ainar-course-model/server/` was 8,396 lines of
compiled JavaScript kept in step with `ainar-node/src/` by hand, and it was
deleted on 2026-09-16 in favour of importing `@ainar/core`.
[`PROVENANCE.md`](PROVENANCE.md) records where each tree came from and what this
project has changed since.

The seven skill trees are read by two hosts and copied by neither. The harness
names them as absolute roots in
[`agent.cordis.yml`](.dsh/.agent-presets/professor/agent.cordis.yml), anchored to
that file. Claude Code gets the same seven from
[`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json): a
marketplace added from a local directory loads a relative-path plugin **in
place**, so it reads these files rather than a cached copy, and an edit here is
live in both hosts at once. Add it with `claude plugin marketplace add .` — and
note that a host reading skills from anywhere else, such as `~/.claude/skills`,
is holding a copy that nothing updates.

## Writing a plugin against this

[`plugins/dsh-sample/`](plugins/dsh-sample/) is the contract in miniature — two
tools, one HTTP route, one config schema, and the patch row that mounts it. Its
[README](plugins/dsh-sample/README.md) has the table of things that are **fatal
at registration** rather than merely broken, each of which takes down the whole
harness instead of the one plugin. It is short and worth reading once.

The four-layer config arrangement, the mount order, and how the pieces find
each other are documented there too, along with `--dump-config`, which answers
"is my row actually mounted, and whose value won" without booting anything.

## License

[MIT](LICENSE), which covers the code in this repository — the model, the read
layer, the skills and the plugins.

Two things it does not speak for. The `@deepseek-ai` harness packages are
dependencies rather than code carried here, and are licensed by their own
authors. And the example course's teaching content is under the same MIT terms
as the rest, but an institutional logo or a photograph a professor drops into
`materials/` is not — the slide tooling deliberately refuses to invent an
attribution for a figure, because whether a mark may go on a deck is the
professor's call and a trademark question rather than a licensing one.
