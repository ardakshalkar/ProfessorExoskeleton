/**
 * The visual grammar, as data.
 *
 * Three taxonomies, and keeping them separate is the point:
 *
 *   **deck grammar**      what sequence teaches this topic
 *   **slide intent**      what the learner is doing on this slide
 *   **visual archetype**  how that information should be represented
 *
 * A generator that jumps from "section" straight to "slide" produces a
 * collection of individually reasonable slides that does not teach: title and
 * three bullets, fifteen times, because nothing ever told it that the
 * *cognitive operation* changed. Naming the intent separately from the
 * representation is what makes the variation follow from the teaching rather
 * than from a rule saying "do not repeat a layout".
 *
 * Everything here is a controlled vocabulary because `pres outline check` reads
 * it. `references/visual-grammar.md` is the prose; this is what is enforced.
 */

/**
 * What a piece of text on a slide is *doing*.
 *
 * More useful than counting words. "Maximum five bullets" cannot tell the
 * difference between five bullets of generated explanation, which is usually
 * bad, and five parallel labels on a comparison, which is usually right.
 */
export const TEXT_ROLES = {
  headline: "what this slide is about",
  claim: "what the student should believe or understand",
  label: "what this is",
  annotation: "what to notice here",
  explanation: "why or how it works",
  evidence: "what supports the claim",
  instruction: "what the student should do",
  question: "what the student should think about",
  source: "where this came from",
  takeaway: "what must be remembered",
} as const;

export type TextRole = keyof typeof TEXT_ROLES;

/**
 * How much text a slide carries, as a generation default rather than a limit.
 *
 * A universal word cap is wrong: text density varies enormously by discipline,
 * and a mathematics slide carrying a derivation is dense because the content is
 * dense. These bands are starting points the professor overrides, not
 * measurements — see the note on corpora in `references/visual-grammar.md`.
 */
export const DENSITY = {
  sparse: { words: [5, 25] as const, note: "a question, a claim, an artifact with its label" },
  moderate: { words: [20, 50] as const, note: "the common case: a concept with its explanation" },
  dense: { words: [40, 120] as const, note: "only when the density is intrinsic, and then with strong visual structure" },
} as const;

export type Density = keyof typeof DENSITY;

/** Whether a slide's picture is required, optional, or beside the point. */
export type VisualNeed = "dominant" | "supporting" | "optional" | "none";

export interface Archetype {
  /** What carries the meaning. */
  dominant: string;
  /** The text roles this archetype is for. Others are a warning, not a ban. */
  roles: TextRole[];
  density: Density;
  visual: VisualNeed;
  /** How the slide is laid out, in words a person can check against the render. */
  composition: string;
  /**
   * Text roles that would break what the archetype is for.
   *
   * The only one that is an error rather than a warning is an answer on a
   * question slide: the whitespace and the missing answer *are* the teaching,
   * and a generator's instinct is to fill both.
   */
  forbids?: TextRole[];
}

/**
 * Eighteen slide archetypes.
 *
 * Not PowerPoint layouts — pedagogical shapes. They come from reading real
 * teaching decks rather than from design templates, which is why several of
 * them (question, primary source, single visual) look "empty" by the standards
 * of a slide generator and are doing their job precisely by being so.
 */
export const ARCHETYPES: Record<string, Archetype> = {
  section_opener: {
    dominant: "title or image",
    roles: ["headline"],
    density: "sparse",
    visual: "optional",
    composition: "a full image, or a large title alone",
  },
  roadmap: {
    dominant: "structure",
    roles: ["headline", "label"],
    density: "sparse",
    // A roadmap answers "where are we", which is a question about position in a
    // structure — the one thing prose is worst at. "Last time / today / builds
    // on" as three sentences asks the room to rebuild the map from a
    // description of it, every week. So the map is the slide, and its words are
    // labels on the map: `dominant`, not `supporting`.
    visual: "dominant",
    composition: "the sequence or map itself, with the words as labels on it",
  },
  big_idea: {
    dominant: "a statement",
    roles: ["claim", "takeaway"],
    density: "sparse",
    visual: "optional",
    composition: "one claim in large text, with an optional qualifier",
  },
  definition: {
    dominant: "a term",
    roles: ["headline", "claim", "explanation"],
    density: "moderate",
    visual: "optional",
    composition: "term, then meaning, then one example",
  },
  question: {
    dominant: "a question",
    roles: ["question", "instruction"],
    density: "sparse",
    visual: "optional",
    composition: "a large question and deliberate whitespace",
    // The emptiness is the instructional function. A generator sees unused
    // space and fills it; this says not to, and the check enforces it.
    forbids: ["explanation", "takeaway"],
  },
  single_visual: {
    dominant: "one photograph, artifact or map",
    roles: ["label", "annotation", "source", "question"],
    density: "sparse",
    visual: "dominant",
    composition: "the visual fills the slide; text identifies it and says what to notice",
    // Describing what a student can already see wastes the slide and the room's
    // attention. Interpretation comes later, or from the professor.
    forbids: ["explanation"],
  },
  visual_comparison: {
    dominant: "two to four visuals",
    roles: ["label", "annotation", "claim", "source"],
    density: "sparse",
    visual: "dominant",
    composition: "side by side at equal weight, with parallel labels",
  },
  annotated_object: {
    dominant: "a photograph or diagram with callouts",
    roles: ["label", "annotation"],
    density: "moderate",
    visual: "dominant",
    composition: "a central visual with labels attached directly to what they name",
  },
  process: {
    dominant: "a sequence diagram",
    roles: ["label", "headline"],
    density: "sparse",
    visual: "dominant",
    composition: "left to right or top to bottom, with short step labels",
  },
  system_diagram: {
    dominant: "a mechanism or architecture diagram",
    roles: ["label", "annotation", "headline"],
    density: "moderate",
    visual: "dominant",
    composition: "components and the relationships between them, labelled in place",
  },
  worked_example: {
    dominant: "an example carried through",
    roles: ["headline", "instruction", "explanation", "takeaway"],
    density: "moderate",
    visual: "supporting",
    composition: "problem, then steps, then the answer, then why it worked",
  },
  derivation: {
    dominant: "equations",
    roles: ["claim", "explanation", "takeaway"],
    density: "dense",
    visual: "supporting",
    composition: "progressive vertical reasoning: claim, steps, result, one sentence of meaning",
  },
  algorithm: {
    dominant: "code or pseudocode",
    roles: ["annotation", "explanation", "headline"],
    density: "dense",
    visual: "supporting",
    composition: "the formal representation dominates; interpretation sits beside it, not under it",
  },
  data_evidence: {
    dominant: "a chart",
    roles: ["claim", "annotation", "source", "evidence"],
    density: "sparse",
    visual: "dominant",
    composition: "the headline carries the claim, the chart carries the evidence",
  },
  structured_comparison: {
    dominant: "a table or matrix",
    roles: ["label", "claim"],
    density: "moderate",
    visual: "supporting",
    composition: "alternatives against dimensions, with terse cells",
  },
  primary_source: {
    dominant: "a document or quotation",
    roles: ["evidence", "source", "question", "annotation"],
    density: "dense",
    visual: "supporting",
    composition: "the passage, its source, and the question to read it against",
  },
  activity: {
    dominant: "a task or poll",
    roles: ["question", "instruction"],
    density: "sparse",
    visual: "optional",
    composition: "the problem, the options if any, and room to think",
    forbids: ["explanation", "takeaway"],
  },
  synthesis: {
    dominant: "relationships between what has been taught",
    roles: ["takeaway", "claim", "label", "question"],
    density: "moderate",
    visual: "supporting",
    composition: "three to five ideas and how they connect, usually as a diagram rather than a list",
  },
};

export type ArchetypeName = keyof typeof ARCHETYPES;

/**
 * What the learner is doing, which is a different question from how it looks.
 *
 * The same lecture, at the same point, with the same content, gets a different
 * slide depending on whether the student is meeting an idea, checking it, or
 * being asked to apply it.
 */
export const INTENTS = [
  "orient",
  "create_need",
  "demonstrate_problem",
  "build_intuition",
  "introduce_concept",
  "explain_mechanism",
  "formalize",
  "derive",
  "demonstrate",
  "provide_evidence",
  "compare",
  "apply",
  "check_understanding",
  "diagnose_misconception",
  "integrate",
  "transition",
  "administer",
] as const;

export type Intent = (typeof INTENTS)[number];

/**
 * The six phases every deck grammar is a weighting of.
 *
 * History might spend most of a lecture in evidence and interpretation;
 * mathematics most of one in formalisation; a practical course most of one in
 * use. The phases are reusable, the proportions are not — which is why the
 * discipline ladders in `references/deck-grammars.md` exist.
 */
export const PHASES = [
  "orient",
  "create_need",
  "build_understanding",
  "formalize",
  "use_or_test",
  "integrate",
] as const;

export type Phase = (typeof PHASES)[number];

/** What kind of deck this is. A course introduction is not a lecture. */
export const DECK_ARCHETYPES = [
  "conceptual_lecture",
  "technical_lecture",
  "seminar",
  "workshop",
  "case_session",
  "course_intro",
  "revision",
] as const;

/**
 * Who the deck is for once it leaves the room.
 *
 * A teaching deck can be sparse because the professor is standing next to it.
 * The same deck read afterwards by a student who missed the class is a
 * different artefact, and pretending one file serves both is how decks end up
 * too full to present and too thin to read.
 */
export const OUTPUT_MODES = ["teaching", "handout", "hybrid"] as const;

/** A slide that only works with the professor talking over it. */
export const DELIVERY_DEPENDENCY = ["low", "high"] as const;

export const isArchetype = (value: unknown): value is ArchetypeName =>
  typeof value === "string" && value in ARCHETYPES;

export const isTextRole = (value: unknown): value is TextRole =>
  typeof value === "string" && value in TEXT_ROLES;

export const isDensity = (value: unknown): value is Density =>
  typeof value === "string" && value in DENSITY;

export const isIntent = (value: unknown): value is Intent =>
  typeof value === "string" && (INTENTS as readonly string[]).includes(value);

/** Archetypes whose slide carries no picture by design. */
export const TEXT_CARRIED = new Set<string>([
  "big_idea",
  "definition",
  "question",
  "derivation",
  "primary_source",
  "activity",
]);

/** Archetypes that are a pause rather than new material. */
export const RESET_ARCHETYPES = new Set<string>(["roadmap", "synthesis", "section_opener"]);

/**
 * `roadmap` is dominant-visual and is deliberately *not* in `OBJECT_CARRIED`.
 *
 * The other dominant archetypes announce themselves: nobody plans a
 * `visual_comparison` or a `data_evidence` slide and then wonders what the
 * picture is. A roadmap is the shape a deck falls into when the map was never
 * drawn — three bullets under "Where we are" — so counting it as carried would
 * hide the commonest un-drawn slide in a deck from the one measure that looks
 * for un-drawn slides. It counts as carried when it plans a picture, like any
 * other slide.
 */
const CARRIED_ONLY_WHEN_DRAWN = new Set<string>(["roadmap"]);

/**
 * Archetypes whose slide is carried by an object rather than by prose.
 *
 * A picture is the commonest such object, but not the only one: a code block, a
 * derivation and a comparison matrix are all things the eye reads as structure
 * rather than as sentences. Counting only pictures would tell a programming
 * lecture that it is prose-heavy for being a programming lecture.
 *
 * Everything outside this set, and outside `TEXT_CARRIED`, is a slide the deck
 * is asking the audience to read.
 */
export const OBJECT_CARRIED = new Set<string>([
  ...Object.entries(ARCHETYPES)
    .filter(([name, archetype]) =>
      archetype.visual === "dominant" && !CARRIED_ONLY_WHEN_DRAWN.has(name))
    .map(([name]) => name),
  "algorithm",
  "derivation",
  "structured_comparison",
]);
