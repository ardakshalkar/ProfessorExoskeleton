# What real lecture decks look like

Measured on 2026-10-19 from eleven public slide PDFs — four Stanford, three
Harvard, four Berkeley, six of them on tools, agents or MCP — and set against
the seven decks this skill produced for CSS-4007 in the same term. The rules in
`visual-grammar.md`, `text-style.md` and SKILL.md §3 that cite this file were
changed because of it.

Words were counted per page; "visual" means a slide carried mainly by a figure,
diagram, screenshot or trace. Native-shape diagrams undercount in that measure,
so two decks (CS2680, CS50 AI) were judged by eye. PDFs carry no speaker notes,
so nothing here says how the spoken part was planned.

## The decks

| Deck | Slides | Words/slide (median / p90) | Visual | Licence |
| --- | --- | --- | --- | --- |
| [Stanford CS224N L5, Transformers](https://web.stanford.edu/class/cs224n/slides_w26/cs224n-2026-lecture05-transformers.pdf) | 70 in 70 min | 60 / 105 | ~64% | none stated |
| [Stanford CS224N L10, RAG and agents](https://web.stanford.edu/class/cs224n/slides_w26/cs224n-2026-lecture10-rag-agents.pdf) | 72 in 80 min | 38 / 66 | ~75% | none stated |
| [Stanford CS336 L15, SFT/RLHF](https://github.com/stanford-cs336/lectures/blob/main/lecture_15.pdf) | 65 | 26 / 72 | ~65% | none stated |
| [Stanford CS329Z L4, Tool use](https://web.stanford.edu/class/cs329z/slides/lecture04.pdf) | 68 in 80 min | 38 / 74 | ~62% | none stated |
| [Harvard CS50 AI L6, Language](https://cdn.cs50.net/ai/2023/x/lectures/6/lecture6.pdf) | 146 (≈55 build steps) | 8 / 33 | most | CC BY-NC-SA 4.0 |
| [Harvard CS2680 L2, How Claude Code works](https://cs2680.com/slides/2_agent_use_1.pdf) | 53 in 75 min | 65 / 86 | ~70% by eye | © the author |
| [Harvard CS2680 L4, Context and tool design](https://cs2680.com/slides/4_agent_design_1.pdf) | 56 in 75 min | 73 / 92 | mostly diagrams and tables | © the author |
| [Berkeley LLM Agents MOOC, Yao, Agents history](https://rdi.berkeley.edu/llm-agents/assets/llm_agent_history.pdf) | 71 | 33 / 71 | ~54% | none stated |
| [Berkeley LLM Agents MOOC, Neubig, Software agents](https://llmagents-learning.org/slides/neubig24softwareagents.pdf) | 53 | 21 / 46 | ~55% | none stated |
| [Berkeley CS188 L2, Uninformed search](https://inst.eecs.berkeley.edu/~cs188/fa25/assets/lectures/cs188-fa25-lec02.pdf) | 62 | 23 / 79 | ~82% | credit line only |
| [Berkeley CS188 L24, Transformers/LLMs](https://inst.eecs.berkeley.edu/~cs188/fa25/assets/lectures/cs188-fa25-lec24.pdf) | 46 | 16 / 44 | ~85% | credit line only |

## What this skill produced, same measures

| CSS-4007 deck | Slides | Median words | Slides with a figure | Titles of 6+ words |
| --- | --- | --- | --- | --- |
| MODULE-01 | 55 | 49 | 31% | 58% |
| MODULE-02 | 30 | 58 | 33% | 73% |
| MODULE-03 | 32 | 40 | 88% | 84% |
| MODULE-04 | 39 | 41 | 49% | 54% |
| MODULE-05 | 30 | 82 | 17% | 50% |
| MODULE-06 | 30 | 82 | 7% | 47% |
| MODULE-08 | 25 in 75 min | 61 | 20% | 28% |

## The differences, and the rule each one changed

1. **Fewer, heavier slides.** Real decks run about 42–54 slides an hour, with
   build steps counted; the skill's default ceiling was 2.5 per ten minutes
   (15 an hour), and its decks run 20–30 for 75–100 minutes. A ceiling that low
   does not make a lecture shorter — it moves the content into fewer slides, and
   the words per slide go up to carry it. → `slides_per_10_minutes` is now 4.5
   in both preference defaults, and SKILL.md §3 says to plan from the minutes.

2. **More words.** The median of the eleven decks' medians is **33 words**; eight
   of eleven sit at 16–38, and no deck's 90th percentile passes 105. The two
   densest (CS2680, 65–73) carry those words as labels inside drawn diagrams.
   Slides over 150 words are, without exception, pasted exhibits: raw dataset
   rows, an agent trace, a GitHub issue. Four of the seven CSS-4007 decks have a
   median above 49. → `visual-grammar.md` now quotes these numbers instead of
   secondhand corpus figures.

3. **Less drawn.** 54–85% of real slides are carried by a picture; the skill's
   decks range 7–88%, and four of seven are under a third. → no rule change;
   "draw first" was already the rule. What changed is the slide budget in (1),
   which is what made drawing affordable.

4. **No builds.** Four real decks build one figure across several slides —
   CS224N L5 adds one step of attention across twelve, CS188 L24 greys out all
   but the active path, CS50 reveals a quotation a word at a time. The skill's
   decks reuse a figure at most twice. → `visual-grammar.md` "Build, don't
   cram".

5. **Long titles.** Ten of ten titled decks use mostly short topic labels, a
   median of 3–5 words; question titles appear in nine of eleven; assertion
   titles are a minority everywhere except CS2680, where each one sits on a
   diagram that proves it. The skill's decks put 6+ words in 28–84% of titles.
   → `text-style.md` now says the label is the default and the assertion is
   earned.

6. **The question and its answer on one slide.** CS188 puts a quiz on one slide
   and the reveal on the next; CS2680 marks question slides "Hands up"; CS336
   shows four slides of raw data and then asks "What's varying across these?".
   → SKILL.md §3: a question slide is followed by its answer, not combined.

7. **No running example.** Nine of eleven carry one concrete case through the
   lecture — Pacman (CS188), "fix the failing auth test" (CS2680), one
   question failing under two methods before ReAct solves it (CS224N L10).
   → SKILL.md §3.

8. **The thing itself, before its name.** Eight of eleven open a concept with an
   example or a raw artefact — dataset rows, a real screenshot of a context
   window, a GitHub issue verbatim — and only then define it. The skill's
   one-sentence definition rule stands; what changed is that the artefact comes
   first where one exists. → SKILL.md §3.

9. **Concepts with no instance.** The week 8 deck defines MCP, a skill and a
   plugin in a sentence each, and shows no real skill, names no plugin and
   calls no server students would recognise; the skills half (slides 18–22) is
   definitions, a folder diagram and a table. Every real deck here teaches its
   concepts through instances — CS2680 has students sort seven requirements into
   Skill, MCP, Hook or Plugin; CS329Z shows a real `tools/list` exchange. →
   `outline-craft.md` "Every concept gets an instance", the outline's
   `examples:` field, and the template's example slot is no longer optional.

10. **Code alone.** Code appears in four decks, never more than about 25 lines,
   always beside its diagram or as a schema next to its output (CS329Z shows the
   MCP `tools/list` request beside its response). → SKILL.md §3.

## What the skill already did that real decks also do

- **A roadmap reshown at section boundaries** — CS329Z six times, Yao and
  CS188 L24 four. That is `visual_anchor` and `focus`.
- **Credit for reused figures** — CS224N credits a tutorial, CS329Z reuses
  CS224N slides, CS188 credits slides going back years. That is §2's copying
  rule.
- **A recap and a "next"** — six of eleven and three of eleven respectively.

## What it does that real decks mostly do not

- A one-sentence definition slide per new term. Real decks define in passing,
  on a figure. Kept: it is what lets a quiz be answered from the deck, and the
  CSS-4007 decks are read afterwards as well as shown.
- Concept identifiers on slides. Real decks have nothing like it. Kept where
  the structure matters, as SKILL.md says, and nowhere else.
