/**
 * The deck grammars, as data instead of as an essay.
 *
 * `references/deck-grammars.md` is eleven hundred words explaining *why* a
 * course introduction is not a lecture and why a history session climbs a
 * different ladder than a physics one. That reasoning is worth reading once. It
 * is not worth re-reading on every request, and until this file existed there
 * was no other way to get the phase order and the ladder out of it.
 *
 * So the reference keeps the argument and this keeps the answer. Everything
 * here is the same content in the form a caller actually needs: which phases,
 * in what weighting, with a beat chain that is a defensible default rather than
 * a rule, and the discipline ladder as a list.
 *
 * The chains name beats that exist in `beats/`, and `pres grammar` checks that
 * they do — a default that points at a beat nobody wrote is worse than no
 * default at all.
 */

import { DECK_ARCHETYPES, PHASES, type Phase } from "./archetypes.ts";

/** How much of a session a phase gets. Not minutes — a weighting. */
export type Weight = "light" | "normal" | "heavy" | "skip";

export interface Grammar {
  /** What kind of session this is. */
  deck_archetype: string;
  /** One line, for the catalogue. */
  shape: string;
  /** The six phases with this grammar's weighting. */
  phases: Array<{ phase: Phase | string; weight: Weight }>;
  /**
   * A beat chain that is a good default for this grammar.
   *
   * The point of shipping one is that the commonest failure is not choosing the
   * wrong beat, it is never choosing at all and emitting title-and-three-bullets
   * fifteen times. A chain in hand makes the sequence the starting position and
   * departure the deliberate act, which is the right way round.
   */
  chain: string[];
  /** What to change about the chain, and when. */
  vary: string;
}

const P = (
  entries: Array<[Phase | string, Weight]>,
): Array<{ phase: Phase | string; weight: Weight }> =>
  entries.map(([phase, weight]) => ({ phase, weight }));

export const GRAMMARS: Record<string, Grammar> = {
  conceptual_lecture: {
    deck_archetype: "conceptual_lecture",
    shape: "the six phases, weighted towards building understanding and integrating",
    phases: P([
      ["orient", "normal"],
      ["create_need", "heavy"],
      ["build_understanding", "heavy"],
      ["formalize", "normal"],
      ["use_or_test", "normal"],
      ["integrate", "heavy"],
    ]),
    chain: [
      "open-lecture",
      "problem-before-solution",
      "intuition-to-definition",
      "component-interaction-mechanism",
      "concept-to-case",
      "predict-reveal-explain",
      "story-so-far",
    ],
    vary: "swap create-need for contradiction-surprise where the material has a real surprise in it",
  },
  technical_lecture: {
    deck_archetype: "technical_lecture",
    shape: "weighted towards formalising and using; expect derivations and algorithms",
    phases: P([
      ["orient", "light"],
      ["create_need", "normal"],
      ["build_understanding", "heavy"],
      ["formalize", "heavy"],
      ["use_or_test", "heavy"],
      ["integrate", "normal"],
    ]),
    chain: [
      "preview-lecture",
      "problem-before-solution",
      "intuition-to-definition",
      "component-interaction-mechanism",
      "observation-model-equation",
      "worked-example",
      "predict-reveal-explain",
      "story-so-far",
    ],
    vary: "for an algorithms session, naive-then-improved then execution-trace instead of the mechanism and equation beats",
  },
  seminar: {
    deck_archetype: "seminar",
    shape: "a reading is the object; evidence and interpretation dominate and the discussion is the content",
    phases: P([
      ["orient", "normal"],
      ["create_need", "light"],
      ["build_understanding", "normal"],
      ["formalize", "light"],
      ["use_or_test", "heavy"],
      ["integrate", "heavy"],
    ]),
    chain: [
      "open-lecture",
      "analyze-artifact",
      "claim-evidence-interpretation",
      "compare-evidence",
      "compare-alternatives",
      "story-so-far",
    ],
    vary: "with two readings, compare-evidence carries the session and the other beats shrink around it",
  },
  workshop: {
    deck_archetype: "workshop",
    shape: "task blocks with checkpoints; slides punctuate the work rather than fill it",
    phases: P([
      ["orient", "normal"],
      ["create_need", "light"],
      ["build_understanding", "normal"],
      ["formalize", "light"],
      ["use_or_test", "heavy"],
      ["integrate", "normal"],
    ]),
    chain: [
      "preview-lecture",
      "problem-before-solution",
      "code-walkthrough",
      "worked-example",
      "diagnose-misconception",
      "story-so-far",
    ],
    vary: "the checkpoints are activity slides between the blocks, not extra beats",
  },
  case_session: {
    deck_archetype: "case_session",
    shape: "situation → evidence → framework → alternatives → recommendation",
    phases: P([
      ["orient", "normal"],
      ["create_need", "heavy"],
      ["build_understanding", "normal"],
      ["formalize", "normal"],
      ["use_or_test", "heavy"],
      ["integrate", "heavy"],
    ]),
    chain: [
      "open-lecture",
      "case-to-concept",
      "claim-evidence-interpretation",
      "compare-alternatives",
      "story-so-far",
    ],
    vary: "concept-to-case instead when the framework is already known and the case is the test of it",
  },
  course_intro: {
    deck_archetype: "course_intro",
    shape: "its own grammar: why · what you will learn · how it works · activities · timeline · assessment · responsibilities · next actions",
    phases: P([
      ["orient", "heavy"],
      ["create_need", "heavy"],
      ["build_understanding", "light"],
      ["formalize", "skip"],
      ["use_or_test", "light"],
      ["integrate", "normal"],
    ]),
    chain: ["open-lecture", "preview-lecture", "story-so-far"],
    vary: "not a lecture and must not borrow one's grammar. The eight sections above are the sequence; beats only shape the opening and the close",
  },
  revision: {
    deck_archetype: "revision",
    shape: "synthesis-heavy; almost entirely integrating and testing",
    phases: P([
      ["orient", "normal"],
      ["create_need", "light"],
      ["build_understanding", "light"],
      ["formalize", "light"],
      ["use_or_test", "heavy"],
      ["integrate", "heavy"],
    ]),
    chain: [
      "reconnect-prior-knowledge",
      "story-so-far",
      "worked-example",
      "predict-reveal-explain",
      "compare-alternatives",
    ],
    vary: "diagnose-misconception earns a place here more than anywhere else — this is the session where what students got wrong is known",
  },
};

/**
 * The representation ladder each discipline climbs.
 *
 * The whole reason this is a table rather than one generic shape: use a single
 * ladder for everything and a humanities deck comes out full of definitions and
 * bullet points, which is not how the subject is taught or thought.
 */
export const LADDERS: Record<string, string[]> = {
  "cs": ["problem", "intuition", "pseudocode", "example", "complexity", "alternative", "comparison"],
  "algorithms": ["problem", "intuition", "pseudocode", "example", "complexity", "alternative", "comparison"],
  "mathematics": ["motivation", "definition", "proposition", "derivation", "consequence", "example"],
  "physics": ["phenomenon", "schematic", "model", "equation", "prediction", "experiment"],
  "biology": ["phenomenon", "structure", "annotated structure", "mechanism", "process", "consequence"],
  "economics": ["question", "assumptions", "model", "proposition", "proof or graph", "interpretation"],
  "psychology": ["question", "phenomenon", "theory", "experiment", "result", "interpretation"],
  "history": ["framing question", "artifact", "observation", "comparison", "context", "interpretation"],
  "design": ["provocation", "precedent", "example", "abstraction", "rule", "exploration", "critique"],
  "architecture": ["provocation", "precedent", "example", "abstraction", "rule", "exploration", "critique"],
  "business": ["situation", "decision problem", "evidence", "framework", "alternatives", "trade-off", "recommendation"],
  "case": ["situation", "decision problem", "evidence", "framework", "alternatives", "trade-off", "recommendation"],
  "law": ["problem or case", "rule", "source", "application", "exception", "conclusion"],
};

/**
 * What changes between a deck the professor stands next to and one a student
 * reads alone.
 *
 * Six rows, and every one of them is a decision a generator makes silently by
 * default. `hybrid` is the practical default the templates assume.
 */
export const OUTPUT_MODE_TABLE: Array<{ aspect: string; teaching: string; handout: string }> = [
  { aspect: "text", teaching: "less", handout: "more context" },
  { aspect: "reveal", teaching: "progressive", handout: "final state" },
  { aspect: "questions", teaching: "no answers shown", handout: "answers or pointers" },
  { aspect: "definitions", teaching: "may be spoken", handout: "preserved on the slide" },
  { aspect: "diagrams", teaching: "built up", handout: "complete" },
  { aspect: "narration", teaching: "expected", handout: "unavailable" },
];

/** The eight sections of a course introduction, which is not a lecture. */
export const COURSE_INTRO_SECTIONS = [
  "why this course",
  "what you will learn",
  "how the course works",
  "learning activities",
  "timeline",
  "assessment",
  "responsibilities",
  "next actions",
] as const;

export const grammarFor = (deckArchetype: string): Grammar | null =>
  GRAMMARS[deckArchetype] ?? null;

/**
 * What professors actually type, mapped to the keys above.
 *
 * Worth having because the failure is silent and expensive: a discipline that
 * does not match falls back to the six generic phases, which is precisely the
 * one generic shape the ladders exist to avoid. "Computer Science" is what
 * somebody types and `cs` is what the table is keyed by.
 */
const ALIASES: Record<string, string> = {
  "computer science": "cs",
  "computing": "cs",
  "software engineering": "cs",
  "data science": "cs",
  "machine learning": "cs",
  "ai": "cs",
  "artificial intelligence": "cs",
  "maths": "mathematics",
  "math": "mathematics",
  "statistics": "mathematics",
  "chemistry": "physics",
  "engineering": "physics",
  "medicine": "biology",
  "finance": "economics",
  "management": "business",
  "sociology": "psychology",
  "anthropology": "history",
  "philosophy": "history",
  "literature": "history",
  "art history": "history",
};

/** The ladder for a discipline, matched loosely so "Computer Science" lands. */
export function ladderFor(discipline: string): { key: string; ladder: string[] } | null {
  const wanted = discipline.trim().toLowerCase().replace(/\s+/g, " ");
  if (!wanted) return null;
  if (LADDERS[wanted]) return { key: wanted, ladder: LADDERS[wanted]! };

  const alias = ALIASES[wanted];
  if (alias && LADDERS[alias]) return { key: alias, ladder: LADDERS[alias]! };
  for (const [name, target] of Object.entries(ALIASES)) {
    if (wanted.includes(name) && LADDERS[target]) return { key: target, ladder: LADDERS[target]! };
  }

  for (const [key, ladder] of Object.entries(LADDERS)) {
    if (wanted.includes(key) || key.includes(wanted)) return { key, ladder };
  }
  return null;
}

/**
 * The whole catalogue in one screen, when nothing narrower was asked for.
 *
 * Seven lines rather than eleven hundred words, and enough to choose from. The
 * reference is still there for the request that needs the reasoning.
 */
export function describeGrammars(): string {
  const lines = ["deck archetypes — pick one, then `pres grammar --deck <name>` for its spine", ""];
  for (const name of DECK_ARCHETYPES) {
    lines.push(`  ${name.padEnd(20)} ${GRAMMARS[name]?.shape ?? ""}`);
  }
  lines.push("");
  lines.push(`phases, in order: ${PHASES.join(" → ")}`);
  lines.push(`output modes: teaching · handout · hybrid (hybrid is the practical default)`);
  lines.push("");
  lines.push("discipline ladders — `pres grammar --discipline <name>`:");
  lines.push(`  ${[...new Set(Object.keys(LADDERS))].join(", ")}`);
  lines.push("");
  lines.push("The reasoning is references/deck-grammars.md. This is the answer.");
  return lines.join("\n");
}

/** One grammar, with everything needed to plan against it. */
export function describeGrammar(grammar: Grammar, discipline?: string): string {
  const lines = [
    `${grammar.deck_archetype} — ${grammar.shape}`,
    "",
    "phases:",
  ];
  for (const entry of grammar.phases) {
    if (entry.weight === "skip") continue;
    lines.push(`  ${String(entry.phase).padEnd(20)} ${entry.weight}`);
  }
  lines.push("");
  lines.push("a default beat chain:");
  lines.push(`  ${grammar.chain.join(" → ")}`);
  lines.push(`  vary it: ${grammar.vary}`);

  if (discipline) {
    const found = ladderFor(discipline);
    lines.push("");
    if (found) {
      lines.push(`${found.key} ladder:`);
      lines.push(`  ${found.ladder.join(" → ")}`);
    } else {
      lines.push(
        `no ladder recorded for '${discipline}'. The six phases above are the fallback; ` +
        "the ladders are in references/deck-grammars.md.",
      );
    }
  }

  if (grammar.deck_archetype === "course_intro") {
    lines.push("");
    lines.push("sections, in order:");
    lines.push(`  ${COURSE_INTRO_SECTIONS.join(" → ")}`);
  }

  lines.push("");
  lines.push("`pres beats --family <family>` lists the beats in a family; `pres beats <id>` is one in full.");
  return lines.join("\n");
}
