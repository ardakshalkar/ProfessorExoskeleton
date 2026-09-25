# The course-mode prototype

A working page, not a mockup: the arrangement argued for in
[`COURSE-MODE.md`](../COURSE-MODE.md), driven by the real example course through
the same payloads the pane reads.

```bash
node --experimental-strip-types plugins/dsh-professor-pane/prototype/build.mjs
```

That writes `course-mode-prototype.html` beside these files. Open it in a
browser. The output is **not committed** — it is 240KB of derived bytes that
would churn on every course edit — and `build.mjs` names the path it wrote.

## The two files

| File | What it is |
| --- | --- |
| `proto.html` | The page. Hand-edited; this is where design changes go. |
| `build.mjs` | Reads the course, computes what a view may not, and substitutes three markers into `proto.html`. |

The three markers, all replaced at build time:

* `__COURSE_DATA__` — the outline, the class, the inbox and the todos, as one
  JSON blob in a `<script type="application/json">`. Every figure on the page
  is counted here, never in a view.
* `__TEMPLATE_JS__` — `vendor/ainar/mcp/widget-assets/template.js`, verbatim.
  Not a copy of the interpreter: the interpreter.
* `__PANE_DOC__` — the document `dsh-professor-pane` serves into its 300px
  frame today, embedded in chat mode so the two arrangements can be compared
  side by side rather than described.

## What it is for

Three questions this repository had open, answered by building rather than by
arguing:

**`UI-1`, the context packet.** Press any week, meeting, assessment, student or
todo and the bar at the foot shows the structured thing that press would carry
into a turn. It is the item the rest of course mode depends on, and it is much
easier to judge on screen than in a table.

**`UI-5`, whether course mode reuses the widget documents.** The week card here
is a `.tmpl` rendered by the shipped interpreter, with clicks crossing the
boundary the way `runtime.js` already does it — `data-pick` and `data-id` on the
element, one delegated listener on the container. It appears to hold. The
structure and the appearance are both swappable from inside the page, which is
the same pair a professor already chooses with `ainar page --structure compact
--template print`.

**Where it would mount.** The shipped `dsh-client-ui-layout` declares four
seats — `sidebar`, `conversation`, `details`, `shell.overlay` — and no
full-width one. Its README claims a `conversation.empty` that appears nowhere in
the bundle, which is the negative result recorded in `4db9b4f`. So course mode
is either the conversation slot or `shell.overlay`. The prototype states the
choice and does not take it.

## What is real, and what is not

Real, and read from `workspace/courses/CSS-4008/`: the weeks, modules, meetings
with their rooms, materials, assessments with weights and rubric counts, the
concept evidence, the gradebook rows with the reasons a mark cannot be exported,
and the action inbox.

Not real, and labelled on screen wherever it appears:

* **The three student names** are fixtures invented for the prototype. The
  bundle holds one user — the instructor — because a student in this model is a
  pseudonymous identifier and nothing else. In the harness they resolve from
  `~/.ainar/roster/people.json`, are held for one response, and never enter a
  payload. The amber rule appears whenever names are showing, the identifier
  stays under each name, and the context packet carries the pseudonym alone.
* **The Proposed drafts** stand in for a merge. This workspace has no
  `work/CSS-4008-2026-FALL/`, so `loadDrafts` has nothing to give it.
* **The conversation** in chat mode, and the replies in the chat overlay. The
  page reaches no model.
