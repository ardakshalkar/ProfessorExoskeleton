# Where the course comes from

Every skill in this plugin starts by finding the course, and none of them
assumes where it is. `pres source` looks in three places, in this order, and
**says which one answered**.

```bash
pres source --course CSS-4008
```

```text
Course read from course-directory: .../ProfessorHarness/courses/CSS-4008 (9 files)
  tried supabase first — reached aws-0-ap-northeast-1.pooler.supabase.com:6543,
  but content.course_bundle_read_models is empty
```

That second line is the point of the whole mechanism. A fallback is an
excellent way to hide a failure: a database link that is merely unreachable,
silently followed by a course directory last pulled in March, produces a deck
built from March's outcomes that looks exactly like one built from today's.
Nothing here falls back quietly.

## 1. A course database

The DSN is read from `PRES_COURSE_URL`, `SUPABASE_DB_URL` or `SUPABASE_URL` —
process environment first, then `.env` and `.env.local` in the working
directory, then in the workspace (`PRES_WORKSPACE`, or a `ProfessorHarness`
checkout found by walking up from where you are).

One query answers it:

```sql
SELECT payload FROM content.course_bundle_read_models WHERE course_code = $1
```

That is the same read model the AINAR MCP server reads, so a course served from
the database and the same course read from YAML arrive in one shape. If the
table is empty, the schema is deployed but nothing has been imported into it —
in ProfessorHarness that is `ainar sql`.

### Two things about Supabase that waste an afternoon each

**The dashboard DSN does not resolve on many university networks.**
`db.<ref>.supabase.co` has an AAAA record and nothing else. Without an IPv6
route it is not slow, it is unreachable, and the driver says the host name
cannot be translated — which reads like a typo. `pres` tries the connection
pooler instead (`aws-0-<region>.pooler.supabase.com`, ports 6543 then 5432),
skipping any host with no A record, and remembers the route that answered in
`~/.pres/routes/<project-ref>`. That is under your home directory rather than in
the course workspace on purpose: the workspace is usually somebody else's git
checkout, and what was discovered is a property of this machine's network rather
than of the directory you ran the command from. `--fresh-route` probes again;
`PRES_HOME` moves the file.

The region is not in the DSN and cannot be derived from it, so it is searched
for — and the searching is bounded, because it used to be the slowest thing in
this plugin by a wide margin. Hostnames resolve in parallel, each connection gets
1.5–2.5 seconds rather than ten, the candidates race in batches so the unknown
region costs one wait rather than fourteen, and the whole probe is capped by
`PRES_DB_BUDGET_MS`. **`PRES_SUPABASE_REGION` skips the search entirely** and is
worth setting once you know the answer: it turns roughly six seconds into
roughly one.

A failure is also remembered, for `PRES_DB_FAIL_TTL_MS` (ten minutes by
default). A database that did not answer forty seconds ago will not answer now,
and the alternative is paying the whole probe again on every `pres` command in
the session. It expires on its own, `--fresh-route` ignores it, and
`--source database` always retries — a cache that could not be overridden would
hide a database coming back. The skip appears on the provenance record with its
age and how to retry, so it is never a silent absence:

```text
Course read from flat-file: .../course.yaml
  skipped supabase first — nothing answered 40 s ago, and that is remembered for
  10 min so every command after the first is instant instead of slow. Retry now
  with --source database, or --fresh-route.
```

Note the username on a pooler route: the pooler multiplexes every project in a
region, so the project ref moves out of the hostname and into the user
(`postgres.<ref>`). Getting that wrong produces `Tenant or user not found`,
which is also not about tenants.

**Certificate verification is attempted and may be reported as skipped.** `pres`
asks for `sslmode=verify-full` first. If the chain is not trusted — a network
that re-signs TLS, or Supabase's chain missing from the machine's trust store —
it retries with libpq's `require` semantics, which encrypt without checking the
server's identity, and **says so in a warning**. That is what `psycopg2` has
always done silently; it is not silent here.

## 2. A course directory

A directory holding `courses/<COURSE_ID>/`, in the AINAR layout. The globs are
copied from that project's loader, so a course that loads there loads
identically here:

```text
courses/<COURSE_ID>/
  course.yaml
  outcomes.yaml            outcomes/*.yaml
  concepts.yaml            concepts/*.yaml
  concept-edges.yaml
  modules.yaml             modules/*.yaml
  versions/<TERM>/version.yaml
  versions/<TERM>/activities.yaml
  versions/<TERM>/resources.yaml
```

Nothing else is read. Submissions, evaluations, evidence and concept states are
student records, and a tool that renders slides has no business loading them.

Point `pres` at a workspace with `PRES_WORKSPACE`, or run it anywhere inside one.

## 3. A single flat file

For a talk that has no course behind it at all. `course.yaml` in the working
directory, or `--course-file <path>`:

```yaml
course:
  course_id: WS-2026
  title: Retrieval-augmented generation, in practice
  audience: working software engineers
  language: [en]

outcomes:
  - outcome_id: LO-01
    title: Choose a chunking strategy for a given corpus
    level: apply

topics:                       # `modules:` is accepted too
  - module_id: MODULE-01
    title: What retrieval actually fixes
    outcomes: [LO-01]
    concepts: [CONCEPT-RETRIEVAL]

concepts:
  - concept_id: CONCEPT-RETRIEVAL
    title: Retrieval as grounding
    prerequisites: []

activities:                   # `sessions:` is accepted too
  - activity_id: ACT-01
    module_id: MODULE-01
    type: workshop
    duration_minutes: 90

references:                   # the same record as delivery.resources
  - resource_id: RES-01
    title: The paper everyone cites
    kind: reading
    url: https://example.org/paper
    concepts: [CONCEPT-RETRIEVAL]
    locator: sections 3–4
```

The flat shape is read through the same normaliser as the other two, so every
check that applies to a course applies here as well.

## References, books and course pages

There is no separate list of books, and that is deliberate: the course model
already has the right record with the right concept tagging, and a second list
beside it would be a second thing to keep true.

`delivery.resources` in the database, `versions/<TERM>/resources.yaml` in a
course directory, `references:` in a flat file. Each entry has a `kind`
(`reading`, `textbook_chapter`, `link`, `video`, `slides`, `notebook`,
`dataset`), a `url` or `document_id`, `concepts`, and optionally a `locator`
naming the chapter or page range.

`pres context --module MODULE-06` returns the ones whose concepts overlap the
module's, plus anything attached to the module's scheduled meeting. Nothing
else: a deck grounded in every reading on the course is grounded in none of
them.

## Choosing a run

A course with several terms needs `--version`, as either
`CSS-4008-2026-FALL` or `2026-FALL`. Without it and with more than one, the run
is left unset rather than guessed — a deck built against the wrong term is a
deck with the wrong dates and the wrong room on its first slide.

## Saying which sources are in play

`--source` expresses what you want to happen:

| | |
| --- | --- |
| `--source auto` | the three places above, in order. The default |
| `--source database` | the shared database and nothing else. A failure is an error, and nothing falls back to a local copy — because a course directory last pulled in March produces a deck built from March's outcomes and looks exactly like a correct one |
| `--source local` | never touch the network. What FAST mode uses, and what you want on a train |

A skipped source is on the provenance record either way. "I asked for local" is
exactly as easy to forget three days later as "the network was down".

## Diagnosing

`--only supabase`, `--only course-directory` or `--only flat-file` stops the
chain at one source, so a failure is reported rather than papered over by the
next one. `--json` gives the whole normalised course including `provenance`.

`--timing`, or `PRES_TIMING=1`, prints where the seconds went — the DNS sweep,
each connection attempt, whether a route came from the cache or was probed, and
the point at which the budget gave up with routes untried:

```text
course source: 6.4 s
  database probe: 6.3 s
    dns: 6 ms (28/28 resolved)
    configured dsn: 128 ms (did not answer)
    pooler batch: 4.1 s (28 tried, none answered)
```

Local only. Nothing is written, aggregated or sent anywhere.
