# Future realization plan

The [roadmap in the README](README.md#roadmap) says what exists. This says what
to build next and why, and it is deliberately a different kind of document: the
roadmap is a checklist held to the rule that `[x]` means something tests it,
while this one is an argument about direction that will be wrong in places and
should be edited rather than appended to.

Thirteen aspects follow. They are not a sprint plan and not all of them are
worth doing — the point of writing them down together is that some of them are
in tension, and the tension is easier to see on one page than in thirteen
issues. Each says where the thing stands today, what finished would look like,
and a first step small enough to start on.

Ordering at the end, under [Sequencing](#sequencing). That section matters more
than any single aspect above it. The same thirteen aspects are cut into work
items in [`BACKLOG.md`](BACKLOG.md), which is where they get prioritised.

---

## 1. Interface: two modes, not one column

> Worked out at length in
> [`plugins/dsh-professor-pane/COURSE-MODE.md`](plugins/dsh-professor-pane/COURSE-MODE.md):
> what the column shows today and judges about it, the outline as the spine,
> the four overlays, and the wall that keeps marks out of the student page.

**Where it stands.** The harness is chat-first. `dsh-professor-pane` is the
right column — three hundred pixels — with six buttons and, under most of them,
a segmented row of sub-views. A slide deck or an exam paper already escapes the
column by opening as a full-page overlay, which is the admission that the column
is too narrow for the thing the professor actually came to look at. The pane can
already push a message into the open session: the browser half `postMessage`s,
and `index.js` turns it into a prompt.

**What done looks like.** Two modes over the same state, switched by the
professor and remembered per workspace.

*Chat mode* is today's arrangement and stays the default for the work that is
genuinely a conversation: plan a term, draft an assessment, argue about whether
an outcome is measurable. The pane is the reference column beside it.

*Course mode* inverts it. The course is the application — full width, the
outline and the students and the gradebook as the page rather than as a panel —
and the agent collapses to a button. Pressing it opens chat over the course the
way a deck opens over the harness today, carrying the context of whatever is on
screen: pressed from a student's row, the next message is about that student
without anyone typing a pseudonym.

The second mode is the one that matters for adoption. A professor clicking
through their own course is doing something they already know how to do; a
professor facing an empty chat box has to know what to ask. Course mode makes
the agent the thing you reach for when a screen is not enough, which is the
honest description of what it is good for.

**What it costs, plainly.** Two modes is two layouts to keep working, and the
pane's client is already 4,171 lines. It is also the first UI state in this
project worth persisting beyond a session.

**First step.** Do not build the mode switch. Build the *context packet* — the
structured thing a button press sends with the prompt (run, view, selected
record, what is on screen) — and use it in chat mode first, so pressing a pane
button stops producing a prompt the agent has to interpret from scratch. If that
lands, course mode is mostly layout. If it does not, the layout would not have
saved it.

## 2. Integrations: one shape, applied outward

**Where it stands.** The LMS path is the only mature integration, and it has a
shape worth copying: **plan → diff → push**, where a cell is new, unchanged, a
change this workspace owns, or *drift* — somebody edited it in the target by
hand — and drift is reported and left alone. `--target canvas-api` and
`--target sheets-api` reach a live gradebook, need `--confirm`, and are marked
as not for an agent to run. Telegram announcements exist with explicit
confirmation before anything sends. Postgres is an optional route in
`ainar-node/src/store/postgres.ts`.

**What done looks like.** Everything touching the world outside the workspace
goes through that same three-verb contract, so a professor learns it once.
Candidates, roughly in the order they earn their keep:

| Integration | Why it is worth it | The hard part |
| --- | --- | --- |
| Canvas / Moodle write-back | Grades are computed here and retyped there | Auth per institution; drift is the norm, not the exception |
| Calendar (ICS feed) | The term plan holds real dates and nothing reads them | Nearly free; mostly a decision about what a meeting *is* |
| GitHub Classroom | `workspace/homework/<slug>/` already holds starters | Rate limits, and a roster join that must not leak names |
| Supabase / Postgres mirror | A student application needs somewhere to read | Becomes the first place student data lives off the machine |
| Email / institutional messaging | Telegram is not what most faculties use | Sending is irreversible in a way a file export is not |
| Faculty SSO | `deploy/` assumes an identity provider it does not have | Not ours to solve; ours to not block |

**First step.** Write the contract down as a document *before* the next
integration rather than after: `plan` is read-only and free, `diff` is
three-way against a recorded ledger, `push` needs `--confirm` and never runs
from an agent turn. Then do the calendar feed, because it is small enough that
the contract is what gets tested rather than the integration.

## 3. Token usage: measure, then cut

**Where it stands.** Nothing measures it. The levers below are guesses at where
the tokens go, which is exactly the problem.

What is visible without measuring: the two skill trees hold about forty
`SKILL.md` files, the largest 3,400 words, several with reference files beside
them. The persona tells the agent to run `validate` and `inbox` at the start of
a session — two full sweeps of the course model before the professor has said
anything. Tool results are whole-record JSON: `gradebook` returns the grid, not
the question you asked of it.

**What done looks like.** A turn costs what the work needs and no more, and
somebody can say what it cost. The levers, in the order they are likely to pay:

- **Measurement first.** Per-run token accounting — which skill, which tools,
  how much of it was the course record — reported the way `npm run check`
  reports parity. Everything below is unfalsifiable without it.
- **Progressive disclosure, finished.** `references/` directories already exist
  under most skills; the pattern is right and the front matter is still long. A
  `SKILL.md` should be the decision procedure and nothing else.
- **Projections on tool output.** A field selector, and summary-with-drill-down
  on the read tools. `class_progress` for one concept should not serialize every
  student.
- **Deterministic work stays in code.** Anything `ainar` can compute must never
  be a model turn. This is already the design ethos; it deserves to be a rule
  with a test.
- **Caching the record.** The course changes rarely inside a session. A digest
  per record, and prompt caching keyed to it, so the second question about the
  same run does not re-send it.
- **Model routing.** Extraction and classification do not need the model that
  drafts a rubric. The harness can route; nothing here uses that.

**First step.** The accounting. Not a dashboard — a number at the end of a run,
attributed by source.

## 4. The record: readiness, history, a real backing store

**Where it stands.** Two named gaps. `readiness` in the action inbox — the
checklist of what to build next, with its importance ordering — exists in the
Python implementation and is not ported, which is one of the two golden fixtures
that do not reproduce. Multi-term history does not exist: `archive/<TERM>/`
retires a finished offering, but nothing compares this year against last.

**What done looks like.** `readiness` ported and the fixture green. Comparison
across offerings as a first-class read — the same concept, the same assessment,
two years, and what moved. That is the question a professor asks in their second
year of using this, and it is the question that makes the accumulated record
worth having kept.

**First step.** Port `readiness`. It is bounded, it closes a known-red fixture,
and the ordering logic in it is the thing course mode will want to draw.

## 5. Teaching material: the professor's own template

**Where it stands.** Slides build and render to real `.pptx` shapes and PDF, and
`deck fit` answers "will this overflow" before rendering. The roadmap's open
item is rendering that survives a template the instructor brings from their
faculty. Separately, the harness has absorbed the slides plugin, and the
salvage is still outstanding: five checks the renderer lacks (alt text, flat
sibling figure path, unused figure, missing required visual, emphasis inside a
list), thirty teaching beats, and seven craft references.

**What done looks like.** A professor drops in their faculty's `.potx` and the
decks come out looking institutional without the layout engine guessing. The
refusal to invent an attribution for a figure stays — that is a trademark
question and the professor's call.

**First step.** The salvage, because it is a known list against a known target.
Templates after.

## 6. Grading: calibration, and the line that does not move

**Where it stands.** Criterion-level suggestions with cited evidence and
confidence; batch grading that reports which few submissions need a human first;
deterministic scoring of choice items. Calibration against a second grader or
against last year's distribution is open.

**What done looks like.** Before a professor trusts a batch, they can see how
this grader agrees with them — on submissions they have already marked, per
criterion, with the disagreements listed rather than averaged away. A confidence
number never checked against a human is decoration.

**The line.** Nothing in any interface may approve a judgement about a student or
push a grade. `ainar approve` is the one approval path and the professor runs it.
Facts only the professor knows — LMS ids, section mappings — have no drafted half
and are fair game for a UI to write. This is not a roadmap item; it is the
constraint every roadmap item is checked against.

**First step.** An agreement report over already-approved evaluations. The data
is sitting there.

## 7. Students: the axis that is empty on purpose

**Where it stands.** `[ ] Anything student-facing. Every surface here is for the
instructor today.` Enrollments hold pseudonyms, names live in `~/.ainar/roster`
outside the checkout, and `refuseInsideRepo` refuses to write identities to any
path inside the workspace.

**What done looks like.** Deciding this is a strategy question, not a technical
one, and it deserves an explicit answer rather than being drifted into. A student
application reading the mirrored record changes what this project *is*: it adds a
second user with different interests, a consent question, and a data boundary
that currently does not have to exist because nothing leaves the machine.

**First step.** Write the one-page position: student-facing or not, and if yes,
read-only first and what the professor controls. No code until that exists.

## 8. Evaluating the assistant, not just the read layer

**Where it stands.** The read layer is pinned hard — 94 checks against 98
mutation fixtures, golden output for the commands. The *drafting* half has
nothing equivalent. There is no measure of whether a drafted term plan, rubric or
grading suggestion is any good.

**What done looks like.** The honest metric is acceptance: of what the skills
drafted, how much did the professor promote unchanged, promote edited, or reject?
That number per skill, over a term, is worth more than any benchmark — and the
approve step already sits exactly where it can be recorded.

**First step.** Record the outcome at `ainar approve` — unchanged, edited,
rejected — with the draft's provenance beside it. Then leave it alone for a term
and read it.

## 9. Trust: provenance on every draft

**Where it stands.** Drafts land in a separate place and are promoted one
identifier at a time. What is not recorded is where a draft came from: which
model, which skill, which evidence it cited.

**What done looks like.** Every promoted record carries how it was proposed, so a
year later "why is this rubric like that" has an answer. This also gives §8 its
denominator and §6 its audit trail; the three are one piece of plumbing wearing
three names.

**First step.** A provenance block on drafts, written by the skills, preserved by
`approve`.

## 10. Deployment: more than one professor

**Where it stands.** `deploy/` has the per-person launcher, the systemd template
and an authenticating Caddy front door. The launcher and the harness's trust
fence were both exercised against a running host, but nothing has stood up on a
real server, and the identity-provider half is left to the institution.

**What done looks like.** One host, several professors, each with their own home
and port, and a failure mode that is a refused login rather than someone reading
another person's gradebook.

**First step.** Stand it up for two accounts on one machine and write down what
broke. The document is the deliverable; the deployment is how it gets written.

## 11. Installation: the professor is not a developer

**Where it stands.** `npm install --legacy-peer-deps`, and the flag is not
optional — without it npm spends eight-plus minutes and about a gigabyte on this
dependency graph and does not converge. A manual second install is needed. Node
22.6+ for the slide tooling. `bin/sample` is still named after what this
repository started as.

**What done looks like.** Something a professor can install without first reading
a paragraph about npm's peer resolver.

**First step.** CI on Linux and Windows before the install work. Every green
result so far is one machine, and fixing an install you cannot reproduce is
guesswork.

## 12. Language and institutional fit

**Where it stands.** Everything is in English, and the grading assumptions are
whatever the example course happens to carry.

**What done looks like.** A course taught in Russian or Kazakh produces materials
in that language without the professor asking for it each time, and the grading
scale, credit system and marking conventions are workspace configuration rather
than assumptions baked into a skill. This is not localization of the UI; it is
the *output* matching the faculty.

**First step.** Find where a language or a scale is currently assumed. It is
probably assumed in more places than expected, and that list is the plan.

## 13. Privacy under observation

**Where it stands.** Strong on storage: pseudonyms in the record, identities
outside it, a path refusal that covers the near-miss sibling-directory case, an
answer-key scan with no override on the public page, and rendered decks excluded
from git because they quote student work.

**What is missing.** The screen. A professor demonstrating this in a lecture
hall, or sharing a screen in a meeting, shows real marks against real rows.
Course mode makes this worse by making the gradebook the whole window.

**What done looks like.** A presentation toggle that pseudonymizes the view, and
a default that errs toward it when the window is large.

**First step.** Ship it inside the course-mode change. Afterwards it is a
retrofit nobody does.

---

## Sequencing

Not everything above is worth doing, and doing them in the wrong order wastes the
ones that are.

**First, because other things depend on them.** Token accounting (§3), because
every efficiency claim is unfalsifiable without it. Provenance on drafts (§9),
because §6 and §8 both need it and it is cheap now and expensive to backfill.
`readiness` (§4), because it closes a red fixture and course mode wants its
ordering.

**Next, because they change what the product feels like.** The context packet,
then course mode (§1), with the presentation toggle in the same change (§13).
This is the largest item here and the one most likely to decide whether anyone
else uses this.

**When someone asks for it.** Integrations beyond the calendar feed (§2), faculty
templates (§5), language fit (§12). Each is a real amount of work justified by a
real user, and none of it is justified by a hypothetical one.

**Decide before building.** Student-facing anything (§7). The answer changes the
shape of §2 and §13.

**Continuously, not as a phase.** CI and install (§11), and a green
`npm run check`. These do not get their own quarter; they get fixed when they
break.

## What this document is not

It is not a commitment, and nothing here carries a date. It is also not a
replacement for the README's roadmap: that one is held to the rule that `[x]`
means something tests it, and it should stay that way. When an item here is
built, it moves there and stops being an argument.
