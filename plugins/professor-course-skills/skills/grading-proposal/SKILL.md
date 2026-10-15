---
name: grading-proposal
description: Turn the professor's words about the grading policy — drop an assignment, reweight the quizzes, move the midterms into their own block, switch to the admission-rating structure — into a whole proposed policy, checked and recorded for the professor to load in the Gradebook's policy editor. Use when a message starts with /grading-proposal, or the professor asks to change how the grade is divided, the blocks, the weights, or which block an assessment counts in. Changing a student's mark is not this; it is the professor's decision in the Grade view.
stage: any
requires: [versions, assessments]
produces: []
writes: record
---

> **Non-negotiables.** This skill proposes; the professor applies.
>
> - **Never edit `version.yaml` or an assessment record to change the policy.**
>   The only thing you write is a proposal, through
>   `bin/ainar grading propose`. The professor loads it in the Gradebook,
>   reads the diff and the impact, and presses Apply. A policy changed behind
>   that editor skips the check of what it does to students' totals and to
>   marks already in Canvas.
> - **Locked means stop.** If `grading_scheme.locked` is true the command
>   refuses; say "the grading policy is locked — unlock it in the Gradebook"
>   and propose nothing.
> - **A whole policy, every time.** Every block and every assessment of the
>   run, not only the ones that change — the pane loads your file as the
>   draft, and anything missing would silently keep a value you did not see.
> - **No student name, email or institutional number**, in the file, the
>   note or the reply.

# Propose a change to the grading policy

**Needs:** `bin/ainar grading`. Without it, describe the change in the
conversation and say plainly that it could not be recorded for the editor.

## 1. Start from what is on the professor's screen

A message from the pane carries the policy as it stands in the editor, unsaved
edits included, as JSON after the request. **That is your starting point**,
not the record: "make it 25% instead" means 25% of what they are looking at.
Without it (asked in the conversation), start from the record:

```bash
bin/ainar grading CSS-4007-2026-FALL --json
```

The shape, in both cases:

```json
{
  "components": [{ "component_id": "VSK1", "title": "ВСК 1", "weight": 0.3, "parent": null, "points": 100 }],
  "points": null,
  "assignments": { "ASSESSMENT-HW-05": { "component": "VSK2", "weight": 0.04 } }
}
```

`weight` is a share of the **whole** grade (0.04 is 4%), for blocks and
assessments alike. A block's sub-blocks and assessments add up to the block;
the top-level blocks add up to 1. `points` is what a block (or the course) is
out of in the LMS — Narxoz's ВСК is out of 100.

## 2. Read what the request touches before deciding

- The run's `grading_scheme.description` and anything the institution fixes
  (at Narxoz ВСК 1 30 / ВСК 2 30 / Final 40). A request that breaks an
  institutional rule is proposed only if the professor said so explicitly;
  otherwise keep the rule and say what you did instead.
- The assessments it names — their briefs, whether they are graded already.
- `bin/ainar grading RUN --json` lists pending proposals; if one already
  answers the request, say so rather than proposing it twice.

If the request has two honest readings ("make quizzes 10%" — of the course,
or of each ВСК?), **ask in the conversation and propose nothing.** The pane
shows that no proposal came back and sends the professor to the chat.

## 3. Build the policy

- **Drop an assessment from the grade:** `component: null`, `weight: 0`. Do
  not delete it — its marks stay recorded, it just stops counting.
- **Reweight:** say where the weight comes from. A share taken from one place
  goes somewhere, and the block sums must still hold. Spread in proportion to
  the current weights unless the professor said otherwise.
- **A new block:** an id of capitals, digits and dashes (`QUIZ`, `VSK1-HW`), a
  title, a weight, a `parent` when it nests. Move the work into it.
- **A different structure:** the pane's presets are the five usual shapes
  (ВСК 1 · ВСК 2 · Final; ВСК with blocks inside; admission rating 60 · exam
  40; homework · quizzes · midterms · final; no blocks). Keep each assessment
  in the period the professor filed it in; only the kind of block is yours.
- Round weights to 12 decimals; 0.04/3 is `0.013333333333`.

Write it to a file **outside the workspace** — the system temp directory —
never into the course folder.

## 4. Record it

```bash
bin/ainar grading propose CSS-4007-2026-FALL --file "$TMP/grading-proposal.json" \
  --request "drop HW8 and spread its weight over HW5-7" \
  --note "HW8 stops counting (weight 0, no block). Its 4% goes to HW5-7 equally, 5.33% each, so ВСК 2 stays 30%. Its marks stay recorded."
```

- `--request` is the professor's words, shortened if long.
- `--note` is **why**, in two to four sentences: what moves, where the weight
  went, which rule you kept. It is shown on the proposal card beside the diff.

The command checks the proposal like the editor's own write. A refusal names
the problem — a block that does not exist, a cycle, nothing changed, locked.
Fix it and run it again; never work around a refusal by editing the record.

## 5. Answer briefly

One or two sentences in the conversation: the proposal id, what it does, and
anything the professor should look at in the impact (marks already in Canvas,
a Canvas group the new block needs, a brief that states the old percentage).
The pane opens the proposal in the editor on its own.
