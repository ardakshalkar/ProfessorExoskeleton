# Professor Slides Skills

Skills that plan a presentation, write it, and render it — over a course found
rather than assumed, at **the depth the request actually needs**.

A spin-off of the AINAR Professor Exoskeleton's `/make-materials`, which does
the same job welded to one repository: it needs the `ainar` CLI, a `courses/`
tree, `ainar approve` to promote a draft, and `Document` records to carry the
render contract. This installs on its own.

## Use the minimum harness the task needs

The interesting design decision in this plugin is not the workflow. It is that
the workflow is *chosen*.

There is a rigorous instructional-design pass in here — course provenance,
published treatments, deck grammar, teaching beats, slide-level intent, coverage
analysis, a professor's approval before a slide is written. It is the right
thing for a new lecture on a topic somebody has to sequence carefully. It is
absurd for *"make five slides explaining RAG"*, and running it anyway teaches
professors that the plugin is slow rather than that it is careful.

So there are three depths, and one cheap command that picks one.

```bash
pres route "Make 5 slides explaining RAG."
```

| | Use it for | What it costs |
| --- | --- | --- |
| **FAST** | a few slides · notes to turn into a deck · something exploratory or for yourself | one file, three commands, no course probing, no outline, no approval gate |
| **STANDARD** | **the default.** A real session for a real class | a compact outline, then the deck. Beats and archetypes chosen from compact catalogues rather than from reading the references |
| **DEEP** | a new lecture or course · research wanted · accreditation · material other instructors will teach from · 20+ slides · "show me the outline first" | the full workflow, unchanged |

FAST is not sloppy. **The same rules about teaching apply in all three** —
assertion headlines, one claim per slide, draw what is drawable, create the need
before naming the thing, no answer on a question slide. What changes is how much
of the reasoning becomes a file on disk.

```text
FAST      request → deck → check → render
STANDARD  context → compact outline → deck → checks → render
DEEP      provenance → context → research → grammar → beats → slide intent →
          coverage → APPROVAL → deck → QA → render → inspect
```

The router prefers STANDARD, uses FAST when the task is obviously small or speed
was asked for, and uses DEEP only when there is a concrete reason. An explicit
`fast`, `standard` or `deep` in the request always wins, and choosing the mode is
never itself a long deliberation.

### Examples

| Request | Mode | Why |
| --- | --- | --- |
| "Make 5 slides explaining RAG." | FAST | a small deck |
| "Turn these notes into slides." | FAST | the material is in the request |
| "Create a few slides comparing agents and workflows." | FAST | exploratory and small |
| "Outline next week's lecture on model evaluation for CSS-4008." | STANDARD | a real session, nothing unusual |
| "Prepare slides for MODULE-06." | STANDARD | the default |
| "Make me a quick 5-slide deck, but with sources." | STANDARD | it pulls both ways, so the middle is taken and both signals are reported |
| "Research how Stanford teaches attention, then build the lecture." | DEEP | research asked for |
| "Show me the outline first so I can approve it." | DEEP | approval before building |
| "This goes in our accreditation self-study." | DEEP | the deck will be audited |
| "About 24 slides on transformers." | DEEP | a long deck is a sequencing problem |

## The skills

| | |
| --- | --- |
| `/make-presentation` | The one to reach for. Routes the request, then runs that depth end to end. |
| `/outline-presentation` | Plan only. Find the course, choose the teaching sequence the discipline calls for, draft the arc, the beats and a slide list saying what the learner is doing on each one and how the information is represented — plus an honest statement of what is deliberately left out. |
| `/build-presentation` | Fill an outline in: slides as Marp markdown written as their archetypes, diagrams as SVG you also commit, tables from the source material, openly-licensed images with their attribution attached, and a written prompt for any illustration the professor must generate. |
| `/render-presentation` | The `.pptx` with real editable shapes and speaker notes, and the PDF converted from that same deck. |

The lower three remain fully usable on their own — `/outline-presentation` for a
session you want to think about before anything is written is still the right
call, and it is what DEEP mode is made of.

Outlining is separate for a reason that survives the routing: going from module
to finished markdown in one pass means the professor first sees the argument of
the lecture when it is already written, and by then changing it costs
twenty-four slides. What changed is that a five-slide explainer no longer pays
for that protection.

## The planning layer

Ask a generator for a lecture and it produces *title and three bullets*, fifteen
times. Every one of those slides is individually defensible; what is wrong is
that the cognitive operation never changed while the material did.

So the planning runs down three separate taxonomies rather than jumping from a
section to a list of slides:

```text
DECK GRAMMAR        what sequence teaches this topic     pres grammar
      ↓
TEACHING BEAT       what job does this stretch do        pres beats
      ↓
SLIDE INTENT        what is the learner doing here
      ↓
VISUAL ARCHETYPE    how should that be represented       pres archetypes · pres rules
```

Those four commands are the compact form of four reference documents totalling
about seven thousand words. `pres grammar --deck technical_lecture` prints the
phase spine, a default beat chain and the discipline's representation ladder;
`pres beats --phase build_understanding` lists candidate beats one line each;
`pres beats <id>` opens exactly the one you chose. The references keep the
reasoning — which is worth reading once, and not once per deck — and DEEP mode
still reads them.

A **teaching beat** is two to seven slides that do one teaching job —
`problem-before-solution`, `follow-one-object`, `predict-reveal-explain`,
`analyze-artifact`. Twenty-nine of them live in [`beats/`](beats/README.md),
each with the sequence it implies, the rules its pictures follow, and the
question worth asking the professor before using it.

Eighteen **visual archetypes** say how one slide is shaped, and they are
enforced, not suggested. Some of what falls out of that:

- **A photograph is evidence; a diagram is the explanation.** Text beside a
  photograph directs attention rather than describing what the room can see.
  Labels on a diagram sit on the parts they name — never a diagram followed by
  "Box A means…, Box B means…".
- **Whitespace on a question slide is the teaching**, and so is the missing
  answer. That one is an error, not a warning.
- **Reuse the visual anchor.** One diagram with the emphasis moving beats five
  unrelated diagrams; the student otherwise spends each slide re-learning a
  layout instead of learning the addition.
- **Text-only slides are legitimate.** Never *every slide needs an image*;
  always *every slide needs an information carrier*.
- **Density is a mode**, not a word cap — a derivation is dense because the
  content is.
- **`delivery_dependency: high`** marks a slide deliberately incomplete without
  the professor talking over it. Normal teaching; a hole in a handout.

Two more references carry the craft no check can enforce:
[`references/text-style.md`](references/text-style.md) on how to write the words
— assertion headlines rather than topics, sentence case, parallel lists — and
[`references/typography.md`](references/typography.md) on which typefaces
survive the lecture-room machine, and why the height estimator cares which one
you pick.

`pres outline check` also reads the deck as a sequence: identical archetypes in
a row, text-only runs, a mechanism arriving before anything creates the need for
it, no reset in nine slides of new material, beats that do not hand over.

## Installing

**As a plugin** — the route that needs no other setup. From an interactive
Claude Code session (terminal, desktop app, IDE or web):

```bash
/plugin marketplace add /path/to/professor-slides-skills
```

```bash
/plugin install professor-slides-skills@professor-exoskeleton
```

Then, once:

```bash
cd plugin/professor-slides-skills/node && npm install
```

The plugin loader puts `bin/` on PATH, so the skills' `pres …` commands resolve,
and it sets `${CLAUDE_PLUGIN_ROOT}` so they can find `references/` and `beats/`.

**As loose skills**, if you would rather not use the marketplace: copy
`skills/make-presentation`, `skills/outline-presentation`,
`skills/build-presentation` and `skills/render-presentation` into
`~/.claude/skills/`. Two things the loader would have done for you have to be
done by hand.

Put `pres` on PATH:

```bash
cd plugin/professor-slides-skills/node && npm install && npm link
```

That gives you a global `pres` that works from any directory and does not depend
on the plugin being enabled. And keep this directory where the skills can reach
it — they read `references/` and `beats/` from the plugin root, and say so at
the top of each `SKILL.md` for the case where `${CLAUDE_PLUGIN_ROOT}` is unset.

**Not** in the claude.ai side of the desktop app. That installs MCPB extensions
and this is a skills-and-CLI plugin, with no MCP server in it.

`pptxgenjs` and `sharp` are optional dependencies — reading and checking a
course never needs a native image library, and a machine where they fail to
install still resolves a course and still runs the tests. `pres render`
needs them; the PDF additionally needs LibreOffice.

Node 22.6 or later. The plugin runs its TypeScript directly.

## Where the course comes from

Three places, in order, and the answer always says which one produced it:

1. **A course database** — `PRES_COURSE_URL`, `SUPABASE_DB_URL` or
   `SUPABASE_URL`, from the environment or a `.env`. One query against
   `content.course_bundle_read_models`.
2. **A course directory** — `courses/<COURSE_ID>/` in the AINAR layout, found by
   walking up from where you are or named by `PRES_WORKSPACE`.
3. **A single flat `course.yaml`** — for a talk with no course behind it.

```bash
pres source --course CSS-4008
```

```text
Course read from course-directory: .../ProfessorHarness/courses/CSS-4008 (9 files)
  tried supabase first — reached aws-0-ap-northeast-1.pooler.supabase.com:6543,
  but content.course_bundle_read_models is empty
```

That second line is the point. A fallback is an excellent way to hide a failure:
a database link that is merely unreachable, silently followed by a course
directory last pulled in March, produces a deck built from March's outcomes that
looks exactly like a correct one.

`references/course-source.md` has the resolution order, the flat file's shape,
and the two Supabase problems that each waste an afternoon — the IPv6-only
dashboard host, and certificate verification on a network that re-signs TLS.

### And it does not make you wait for a database that is not there

The order above is right for source-of-truth semantics and used to be brutal in
practice. Twenty-eight candidate pooler hostnames were resolved one at a time,
every surviving route got a ten-second connection deadline twice over, nothing
remembered a failure, and `pres source`, `pres context` and `pres outline check`
each paid the whole bill again. A professor whose `.env` named a database they
were not currently on the VPN for waited minutes per command to be told the
database was not there.

Now: hostnames resolve in parallel, deadlines are 1.5–2.5 seconds, the whole
probe is bounded by a hard budget, the pooler candidates race in batches so the
unknown region costs one wait rather than fourteen, and **a failure is
remembered** — for ten minutes by default, so the second command in a session is
instant instead of slow.

```text
first call    course source: 6.4 s   (bounded by PRES_DB_BUDGET_MS)
next call     course source: 14 ms   database probe: 0 ms (skipped — unreachable 40 s ago)
```

None of it changes what is *reported*. A skipped database is an attempt on the
provenance record, with the reason and the age of the remembered failure, so a
professor can see the difference between a choice and a problem:

```text
Course read from flat-file: .../course.yaml
  skipped supabase first — nothing answered 40 s ago, and that is remembered for
  10 min so every command after the first is instant instead of slow. Retry now
  with --source database, or --fresh-route.
```

Three knobs, and one flag that matters:

| | |
| --- | --- |
| `--source auto` | the three places above, in order. The default |
| `--source database` | the shared database and nothing else. A failure is an **error**, never a quiet fallback onto a local copy — and it always retries a remembered failure |
| `--source local` | never touch the network. What FAST mode uses |
| `PRES_SUPABASE_REGION` | pin the region and the search becomes one attempt: 6.4 s → 1.4 s |
| `PRES_CONNECT_TIMEOUT_MS`, `PRES_DB_BUDGET_MS`, `PRES_DB_FAIL_TTL_MS` | the deadline, the total budget, how long a failure is believed |
| `--fresh-route` | forget what was remembered and probe again |

A successful route is still written to `~/.pres/routes/<project-ref>`, keyed by
project rather than by directory, because what was discovered is a property of
this machine's network and not of where you ran the command.

## Readings and books

Not a new file. `delivery.resources` in the database,
`versions/<TERM>/resources.yaml` in a course directory, `references:` in a flat
file — the course model already has the right record with the right concept
tagging, and a second list beside it would be a second thing to keep true.
`pres context` returns the ones whose concepts overlap the module's.

## Approval

There is no approval CLI here. The record is the outline's own `status`, and it
moves to `approved` only when the professor says so — never on an agent's
initiative, in any mode.

Whether that record is a *gate* depends on the deck. `pres plan build` stamps
the mode and the approval requirement onto the generated plan, and the checks
read it:

| Mode | Approval | Rendering |
| --- | --- | --- |
| `deep` | required | refused until the outline is `approved` |
| `standard` | on request | proceeds, and **says** nobody reviewed it |
| `fast` | none | proceeds with no outline at all, and says so |
| *no mode on the plan* | required | exactly as before this existed |

That last row is the compatibility rule: every plan written before modes existed
went through the gate and still does.

The gate was universal, and universal was wrong in one direction. It is exactly
right for a deck somebody asked to review before it was written. For "make five
slides explaining RAG" it is pure obstruction — and a professor made to approve
an outline they never asked for learns to type `status: approved` without reading
it, which costs the gate everything it was for.

What must never happen is a *silent* downgrade. A `.pptx` looks identical whether
or not anybody agreed to what is inside it, so `pres check` and `pres render`
both print which of the four rows above applies, and the skills repeat it when
handing the file over.

`--approval required` puts the gate back inside STANDARD mode, which is what a
professor who asks to approve first gets.

## One source of truth for each fact

`<deck>.plan.yaml` is **generated**, by `pres plan build`, and nothing should
write it by hand.

Every field in it — slide numbers, titles, minutes, purposes, archetypes,
densities, text roles, required visuals, the figure list — was already stated in
the outline or in the markdown. Copying them by hand cost tokens and created a
second thing to keep true, and the commonest render failure in this plugin was a
plan describing the deck as it was two edits ago.

```text
outline.yaml     the session: sequence, minutes, purposes, intents, archetypes, coverage
deck.md          what is on each slide, including its title and its figures
      ↓  pres plan build   (deterministic)
plan.yaml        the render contract — a projection of those two
      ↓  pres render
pptx · pdf
```

The one thing the projection carries that neither source holds is figure licence
metadata: an attribution written by `pres find-image` is preserved across
regeneration, because nothing else knows it. `pres check` notices a stale plan
and names the command that fixes it.

## The `pres` CLI

```
pres route      [REQUEST] [--mode fast|standard|deep] [--slides N] [--json]
pres source     --course ID [--version TERM] [--source auto|database|local]
                [--only SOURCE] [--fresh-route] [--json]
pres context    --module MODULE-ID [--course ID] [--date YYYY-MM-DD] [--brief] [--json]
pres grammar    [--deck ARCHETYPE] [--discipline NAME]
pres beats      [--family F | --phase P] | pres beats BEAT-ID
pres archetypes [--name X]
pres rules      [writing | visual | questions | figures | record]
pres outline    check FILE
pres plan       build DECK.md [--mode M] [--approval A] [--dry-run]
pres check      DECK.md
pres render     DECK.md [--pdf] [--out DIR] [--draft]
pres find-image --search QUERY [--pick N --name STEM --into DIR]
```

`--timing` on any command, or `PRES_TIMING=1`, prints where the time went:

```text
course source: 180 ms
  database probe: 141 ms
    dns: 6 ms (28/28 resolved)
context: 42 ms
checks: 61 ms
render pptx: 1.8 s
pdf conversion: 2.4 s
```

Local only. Nothing is written, aggregated or sent anywhere — it is a measuring
stick, and a performance tool that phones home is one nobody is allowed to
enable.

## What is enforced rather than trusted

- A deck whose mode requires approval is not rendered without it — and every
  render says which mode built it and whether an approval stands behind it.
- The plan must match the markdown in slide count, order and title. A mismatch
  exits saying where; nothing reorders slides to agree. A generated plan that has
  fallen behind its sources is reported with the command that fixes it.
- A figure claiming a source without an attribution line stops the render.
- Every figure needs alt text, and it is not a caption of the filename.
- Any slide running past the bottom margin is named.
- An outline may not cover a concept its module does not claim, and may not drop
  one it does without recording why.
- A question or activity slide may not carry an explanation or a takeaway. The
  missing answer is the point.
- Every slide's archetype has to be one of the eighteen.

`RULES.md` has the reasoning behind each.

## Running the tests

```bash
cd node && npm test
```

## Licence

MIT — see [LICENSE](../../LICENSE).
