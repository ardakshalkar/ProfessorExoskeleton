/**
 * Which harness this request actually needs.
 *
 * The plugin used to run one workflow: course discovery, context, preferences,
 * a survey of published treatments, deck grammar, teaching beats, slide intents,
 * visual archetypes, an outline artefact, checks, a professor's approval, a
 * reload, the deck, the plan, more checks, a render. That is the right shape for
 * a new lecture on a topic somebody has to sequence carefully. It is absurd for
 * "make five slides explaining RAG", and running it anyway taught professors
 * that the plugin is slow rather than that it is careful.
 *
 * So the depth is chosen, and the choosing is *here* rather than in a skill,
 * for two reasons. It is a decision with a right answer often enough to be
 * mechanical — the signals are words in a sentence and a slide count — and a
 * router implemented as prose in a SKILL.md is a router that costs a paragraph
 * of reasoning on every request, which is exactly the overhead being removed.
 *
 * The rules, in order:
 *
 *   1. An explicit mode wins. Always, with no argument and no scoring.
 *   2. A concrete reason for DEEP promotes. Research, approval before building,
 *      accreditation, reuse by other instructors, a genuinely uncertain
 *      sequence, a long deck.
 *   3. Obvious smallness or an ask for speed demotes to FAST.
 *   4. Both at once means STANDARD, and the report says both fired.
 *   5. Otherwise STANDARD, which is the default because it is right most of
 *      the time.
 *
 * Rule 4 matters. "A quick deck, with sources" is a real request, and neither
 * cutting the sources nor running the full instructional-design workflow is
 * what was asked for. The middle is the honest answer and STANDARD is the
 * middle.
 */

export type Mode = "fast" | "standard" | "deep";

export const MODES: readonly Mode[] = ["fast", "standard", "deep"] as const;

export const isMode = (value: unknown): value is Mode =>
  typeof value === "string" && (MODES as readonly string[]).includes(value.toLowerCase());

/** How the course is looked for. See `source.ts`. */
export type SourcePreference = "auto" | "database" | "local";

export interface RouteInput {
  /** What the professor asked for, in their words. */
  request?: string;
  /** `--mode fast|standard|deep`, which overrides everything. */
  mode?: string;
  /** A slide count, when one is known from a flag rather than the sentence. */
  slides?: number;
  /** Session length in minutes, when known. */
  minutes?: number;
}

export interface Recipe {
  mode: Mode;
  /** Where the course is looked for first. */
  source: SourcePreference;
  /** How much of the module context is loaded. */
  context: "none" | "brief" | "full";
  /** Whether published treatments are read before planning. */
  research: "no" | "if-needed" | "yes";
  /** Whether a separate outline artefact is written. */
  outline: "none" | "compact" | "full";
  /** How beats are chosen: the model's own judgement, the catalogue, or the files. */
  beats: "implicit" | "catalogue" | "library";
  /** Whether a professor has to approve before the deck is written. */
  approval: "none" | "on-request" | "required";
  /** Which checks run. */
  checks: string[];
  /** What is read before writing, beyond the skill itself. */
  load: string[];
  /** What this mode deliberately does not do. Printed, so it is never a secret. */
  skips: string[];
  /** The workflow, one line per step. */
  steps: string[];
}

export interface Routed {
  mode: Mode;
  /** One sentence, for the professor. */
  why: string;
  /** The signals that fired, each naming what fired it. */
  signals: string[];
  /** Whether the mode was asked for rather than inferred. */
  explicit: boolean;
  recipe: Recipe;
}

/** A slide count above which a deck is a project rather than a session. */
const LONG_DECK = 20;
/** A session long enough that its sequencing is a real design problem. */
const LONG_SESSION = 150;
/** At or under this, a deck is small enough that planning it costs more than writing it. */
const SMALL_DECK = 8;

interface Signal {
  /** What to say fired. */
  name: string;
  test: RegExp;
}

/**
 * Reasons to go DEEP. Each is concrete: a thing the professor said, not a mood.
 *
 * Deliberately not "the topic is hard". Every topic is hard, and a router that
 * promotes on difficulty promotes on everything.
 */
const DEEP_SIGNALS: Signal[] = [
  {
    name: "external research asked for",
    test: /\b(research|researched|published (?:treatments?|courses?|work)|literature|find sources|with sources|cite sources|how (?:others|mit|stanford|cmu|berkeley) teach)\b/i,
  },
  {
    name: "a new lecture or course",
    test: /\b(new (?:course|lecture|module|unit)|from scratch|first (?:lecture|session|class) of|never taught|brand new)\b/i,
  },
  {
    name: "accreditation or audit",
    test: /\b(accreditation|accredited|programme review|program review|quality assurance|audit(?:ed|ing)?|external examiner|self-study)\b/i,
  },
  {
    name: "reusable by other instructors",
    test: /\b(reusable|reuse by|other (?:instructors|lecturers|teachers)|shared with (?:colleagues|the (?:department|team|faculty))|for the (?:department|faculty)|teaching pack)\b/i,
  },
  {
    name: "approval before building asked for",
    test: /\b(approve (?:the |my |an )?(?:outline|plan)|outline (?:first|for approval)|(?:review|check|see) (?:the )?(?:outline|plan) (?:first|before)|before (?:you |we )?(?:build|write) (?:the )?slides|sign ?off)\b/i,
  },
  {
    name: "deep instructional design asked for",
    test: /\b(instructional design|pedagogic(?:al)? (?:design|rigour|rigor)|rigorous|thorough(?:ly)?|carefully sequenced|do it properly|full workflow)\b/i,
  },
  {
    name: "sequencing is uncertain",
    test: /\b(not sure (?:how|what|which|where)|unsure (?:how|what|where)|hard to (?:sequence|teach|explain)|tricky to (?:sequence|teach)|students (?:always |reliably )?(?:get (?:this|it) wrong|struggle)|what order)\b/i,
  },
];

/** Reasons to go FAST. Smallness, or an explicit ask for speed. */
const FAST_SIGNALS: Signal[] = [
  {
    name: "speed asked for",
    test: /\b(quick(?:ly)?|rough|just (?:a|some|make|give|throw)|asap|right now|in a hurry|no need to (?:plan|outline)|straight to (?:the )?slides|sketch)\b/i,
  },
  {
    name: "material supplied in the request",
    test: /\b(turn (?:these|this|my) (?:notes?|text|bullets?|points?|draft|outline|paragraphs?)|from (?:these|my) notes?|these bullet points|this text)\b/i,
  },
  {
    name: "a few slides",
    test: /\b(a few slides|couple of slides|handful of slides|one or two slides)\b/i,
  },
  {
    name: "exploratory, not for a class",
    test: /\b(exploratory|for myself|not for (?:a )?class|to think (?:out loud|through)|scratch deck)\b/i,
  },
];

/**
 * An explicit mode in the sentence, as opposed to the word appearing in the
 * content.
 *
 * "Fast Fourier transforms" is not a mode request and "a deep dive into
 * attention" is not either, so a bare occurrence of the word is not enough. It
 * has to be used the way somebody names a setting.
 */
const EXPLICIT_MODE = [
  /\bmode\s*[:=]?\s*(fast|standard|deep)\b/i,
  /\b(fast|standard|deep)\s+mode\b/i,
  /(?:^|\s)--(fast|standard|deep)\b/i,
  /\b(?:use|run|do|go|make it|keep it)\s+(fast|standard|deep)\b/i,
  /^\s*(fast|standard|deep)\s*$/i,
];

/** Numbers a professor writes as words. */
const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
};

/** A slide count in the sentence: "5 slides", "about twelve slides". */
export function slidesIn(request: string): number | null {
  const digits = /\b(\d{1,3})\s*(?:-|\s)?\s*slides?\b/i.exec(request);
  if (digits) return Number(digits[1]);
  const words = new RegExp(`\\b(${Object.keys(WORD_NUMBERS).join("|")})\\s+slides?\\b`, "i").exec(request);
  return words ? WORD_NUMBERS[words[1]!.toLowerCase()]! : null;
}

/** A duration in the sentence: "90 minutes", "a two-hour seminar". */
export function minutesIn(request: string): number | null {
  const minutes = /\b(\d{2,3})\s*(?:-|\s)?\s*(?:minutes?|mins?|min)\b/i.exec(request);
  if (minutes) return Number(minutes[1]);
  const hours = /\b(\d(?:\.\d)?|one|two|three)\s*(?:-|\s)?\s*hours?\b/i.exec(request);
  if (!hours) return null;
  const raw = hours[1]!.toLowerCase();
  const value = WORD_NUMBERS[raw] ?? Number(raw);
  return Number.isFinite(value) ? Math.round(value * 60) : null;
}

export function explicitModeIn(request: string): Mode | null {
  for (const pattern of EXPLICIT_MODE) {
    const found = pattern.exec(request);
    if (found) return found[1]!.toLowerCase() as Mode;
  }
  return null;
}

const fired = (signals: Signal[], request: string): string[] =>
  signals.filter((signal) => signal.test.test(request)).map((signal) => signal.name);

/**
 * The mode, and why.
 *
 * Pure: no filesystem, no network, no clock. That is what makes it testable and
 * what keeps it from being a reason the router is slow.
 */
export function decideMode(input: RouteInput = {}): Routed {
  const request = (input.request ?? "").trim();

  if (input.mode) {
    if (!isMode(input.mode)) {
      throw new Error(`'${input.mode}' is not a mode. The three are: ${MODES.join(", ")}.`);
    }
    const mode = input.mode.toLowerCase() as Mode;
    return {
      mode,
      why: `${mode} was asked for explicitly`,
      signals: [`--mode ${mode}`],
      explicit: true,
      recipe: recipeFor(mode),
    };
  }

  const asked = explicitModeIn(request);
  if (asked) {
    return {
      mode: asked,
      why: `${asked} was asked for in the request`,
      signals: [`the request names ${asked}`],
      explicit: true,
      recipe: recipeFor(asked),
    };
  }

  const slides = input.slides ?? slidesIn(request);
  const minutes = input.minutes ?? minutesIn(request);

  const deep = fired(DEEP_SIGNALS, request);
  if (slides !== null && slides >= LONG_DECK) deep.push(`a long deck (${slides} slides)`);
  if (minutes !== null && minutes >= LONG_SESSION) deep.push(`a long session (${minutes} minutes)`);

  const fast = fired(FAST_SIGNALS, request);
  if (slides !== null && slides <= SMALL_DECK) fast.push(`a small deck (${slides} slides)`);

  // Both at once. Neither answer is what was asked for, so take the middle and
  // say so rather than picking a winner the professor did not choose.
  if (deep.length && fast.length) {
    return {
      mode: "standard",
      why: "the request pulls both ways, so the middle was taken",
      signals: [...deep.map((name) => `deep: ${name}`), ...fast.map((name) => `fast: ${name}`)],
      explicit: false,
      recipe: recipeFor("standard"),
    };
  }
  if (deep.length) {
    return {
      mode: "deep",
      why: `there is a concrete reason for the full workflow: ${deep[0]}`,
      signals: deep,
      explicit: false,
      recipe: recipeFor("deep"),
    };
  }
  if (fast.length) {
    return {
      mode: "fast",
      why: `the task is small or speed was asked for: ${fast[0]}`,
      signals: fast,
      explicit: false,
      recipe: recipeFor("fast"),
    };
  }
  return {
    mode: "standard",
    why: "nothing calls for either extreme, and standard is the default",
    signals: [],
    explicit: false,
    recipe: recipeFor("standard"),
  };
}

/**
 * What each mode actually does.
 *
 * Data rather than prose so the skill can print it instead of describing it,
 * and so `skips` is a list a professor can read. A mode that quietly does less
 * is a mode that looks like a bug; one that says what it left out is a choice.
 */
export function recipeFor(mode: Mode): Recipe {
  if (mode === "fast") {
    return {
      mode,
      source: "local",
      context: "none",
      research: "no",
      outline: "none",
      beats: "implicit",
      approval: "none",
      checks: ["pres check DECK.md"],
      load: ["nothing beyond this skill; `pres rules` if a reminder is wanted"],
      skips: [
        "external research",
        "written-down teaching beats — the sequence is still deliberate, it is just not an artefact",
        "a separate outline file",
        "the professor's approval gate",
        "course probing, unless a course was named",
        "the long reference documents",
      ],
      steps: [
        "write the deck markdown straight out: one claim per slide, assertion headlines, draw what is drawable",
        "pres plan build DECK.md --mode fast     # generates the render contract",
        "pres check DECK.md",
        "pres render DECK.md --pdf               # only if a file was asked for",
      ],
    };
  }
  if (mode === "deep") {
    return {
      mode,
      source: "auto",
      context: "full",
      research: "yes",
      outline: "full",
      beats: "library",
      approval: "required",
      checks: ["pres outline check FILE", "pres check DECK.md"],
      load: [
        "references/deck-grammars.md",
        "references/teaching-beats.md",
        "references/outline-craft.md",
        "references/visual-grammar.md",
        "references/presentation-graphics.md",
        "references/text-style.md",
        "beats/<the ones chosen>.yaml",
        "examples/MODULE-06/",
      ],
      skips: [],
      steps: [
        "pres source --course ID                 # provenance, reported to the professor",
        "pres context --course ID --module M     # the full context",
        "read two or three published treatments; come back with insight, never text",
        "choose the deck grammar, write the arc, choose beats from the library",
        "write the full outline: beats, slide intents, archetypes, coverage and omissions",
        "pres outline check FILE",
        "hand over and STOP — the professor approves the outline",
        "reload the context, then write the deck and the figures",
        "pres plan build DECK.md --mode deep",
        "pres check DECK.md",
        "pres render DECK.md --pdf, then read the PDF",
      ],
    };
  }
  return {
    mode: "standard",
    source: "auto",
    context: "brief",
    research: "if-needed",
    outline: "compact",
    beats: "catalogue",
    approval: "on-request",
    checks: ["pres outline check FILE", "pres check DECK.md"],
    load: [
      "pres grammar --deck <archetype>   # the phase spine and a default beat chain",
      "pres beats --family <family>      # one line each, to choose from",
      "pres beats <id>                   # only a beat actually needed in detail",
    ],
    skips: [
      "external research, unless the course material is thin",
      "reading the long reference documents in full",
      "the approval gate, unless the professor asked to approve first",
      "reloading the context between outlining and building",
    ],
    steps: [
      "pres context --course ID --module M --brief   # skip if there is no course",
      "pres grammar --deck <archetype>               # phases and a default beat chain",
      "write the compact outline: arc, a named beat chain, slides with intent and archetype",
      "pres outline check FILE",
      "write the deck markdown and the figures",
      "pres plan build DECK.md --mode standard",
      "pres check DECK.md",
      "pres render DECK.md --pdf                     # only if a file was asked for",
    ],
  };
}

/** The routing decision as the few lines a skill should print. */
export function describeRoute(routed: Routed): string {
  const { recipe } = routed;
  const lines = [
    `mode: ${routed.mode}${routed.explicit ? " (asked for)" : ""}`,
    `why: ${routed.why}`,
  ];
  if (routed.signals.length) lines.push(`signals: ${routed.signals.join("; ")}`);
  lines.push("");
  lines.push(
    `source ${recipe.source} · context ${recipe.context} · research ${recipe.research} · ` +
    `outline ${recipe.outline} · beats ${recipe.beats} · approval ${recipe.approval}`,
  );
  lines.push("");
  lines.push("steps:");
  for (const step of recipe.steps) lines.push(`  ${step}`);
  if (recipe.load.length) {
    lines.push("");
    lines.push("read:");
    for (const item of recipe.load) lines.push(`  ${item}`);
  }
  if (recipe.skips.length) {
    lines.push("");
    lines.push("deliberately skipped:");
    for (const item of recipe.skips) lines.push(`  ${item}`);
  }
  return lines.join("\n");
}
