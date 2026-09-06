/**
 * The rules that are worth having in hand, in the form of a card.
 *
 * Four references carry the craft — `visual-grammar.md`, `text-style.md`,
 * `presentation-graphics.md`, `typography.md` — and together they are about
 * seven thousand words. Reading all four to write one deck is the single largest
 * cost in this plugin, and most of what is read is reasoning rather than rule:
 * *why* assertion headlines beat topic labels, the evidence behind sentence
 * case, what happens to a diagram whose labels sit in a glossary underneath it.
 *
 * That reasoning changes how somebody writes decks. It does not need to be
 * re-derived per deck. So the references keep it and this prints the rules
 * themselves — with the reference named beside each group, for the request that
 * genuinely needs the argument.
 *
 * Every line here is a rule that already exists somewhere in `references/` or
 * is enforced by a check in this CLI. Nothing new is invented here; if a rule
 * appears in both places and they disagree, the reference is wrong and should be
 * fixed, because this is what gets read.
 */

import { ARCHETYPES, DENSITY, TEXT_ROLES, type ArchetypeName } from "./archetypes.ts";

export interface RuleGroup {
  key: string;
  title: string;
  /** Where the argument for these lives. */
  reference: string;
  rules: string[];
}

export const RULE_GROUPS: RuleGroup[] = [
  {
    key: "writing",
    title: "The words",
    reference: "references/text-style.md",
    rules: [
      "A headline asserts; it does not name a topic. \"Kazakh costs 1.75× English for the same news\", never \"Cost analysis\". Best-evidenced finding in slide design: assertion headlines raise recall and understanding, still measurable a week later.",
      "A slide whose claim you cannot state in one sentence is usually a slide worth cutting.",
      "Sentence case, headlines and body alike. Title Case flattens the word shapes we read by and is slower at distance.",
      "Every list parallel — all verbs or all noun phrases, never mixed. A reader who hits the break spends a moment on grammar instead of content.",
      "One thing per slide. A slide with two claims is two slides.",
      "Keep emphasis out of bullets. Bold, italic and code render as plain text inside a bulleted item, because a bullet and mixed formatting cannot share a line through this renderer. `pres check` names any item where that happened.",
      "Real questions on the check slides — something a student answers, not a topic they nod at.",
      "An example you construct yourself is fine and is labelled as such. A statistic, dataset or quotation you cannot cite is not.",
      "Use the module's own identifiers where the structure matters, so the material and the course model stay connected.",
    ],
  },
  {
    key: "visual",
    title: "Drawing, and when not to",
    reference: "references/visual-grammar.md",
    rules: [
      "Drawing is the default. Prose is the exception and the exception needs a reason — and \"I could describe it in words\" is not that reason. Almost anything can be described in words.",
      "For every slide, before writing its prose: what would this look like drawn? The sentence stays only when the honest answer is \"worse than the sentence\".",
      "A bulleted list of pipeline stages is a diagram somebody declined to draw. So is a numbered list of steps, a paragraph comparing two approaches, and a sentence describing what a structure contains.",
      "Draw it when the content is a sequence, a set of interacting parts, a comparison, a structure, a before-and-after, an object with named parts, or a quantity you can cite.",
      "Leave it as text when it is a definition, a question, a primary source, a bare claim, a source line, or an equation.",
      "A photograph is evidence; a diagram is the explanation. Text beside a photograph directs attention — it never describes what the room can already see. Labels on a diagram sit on the parts they name, not in a glossary underneath.",
      "Two images imply a relationship. Say which. If the honest answer is \"they look nice\", use one.",
      "Draw the orientation. Every question an opening answers is positional, and position described in sentences makes the room rebuild the map from a description of it, every week. `roadmap` is a dominant-visual archetype for that reason.",
      "Reuse the visual anchor. One diagram with the emphasis moving beats five unrelated diagrams, every time — set `visual_anchor` and `focus`. Five diagrams make the student re-learn a layout each slide instead of learning the addition.",
      "Text-only slides are legitimate. Never \"every slide needs an image\"; always \"every slide needs an information carrier\" — and the carrier is a picture more often than a first draft assumes.",
      "Density is a mode, not a word cap: sparse, moderate, dense. A derivation is dense because derivations are.",
      "`delivery_dependency: high` marks a slide deliberately incomplete without the professor talking over it. Normal teaching, and a hole in a handout.",
    ],
  },
  {
    key: "questions",
    title: "Question and activity slides",
    reference: "references/visual-grammar.md",
    rules: [
      "The question, and nothing else. No answer, no explanation — the whitespace and the missing answer are the teaching.",
      "This is the one grammar violation that is an error rather than a warning: `pres outline check` refuses an `explanation` or `takeaway` role on a `question` or `activity` slide.",
      "Not in small text, not at the bottom, not in the speaker notes to be read aloud early. The commitment is the mechanism.",
    ],
  },
  {
    key: "figures",
    title: "Pictures, and where they may come from",
    reference: "references/presentation-graphics.md",
    rules: [
      "A diagram you draw — hand-authored SVG, from structure the course already claims. Most figures on a teaching deck, and the good case.",
      "A table — built from the source material, in markdown, in the deck. Never a picture of a table.",
      "A chart of this class's data — there is none. Nothing here reads student records, so the slide says what it needs in words. A hand-plotted bar chart of marks you totalled yourself is the worst artefact available, because a chart is not audited.",
      "A chart of external data — only with a citable source, cited on the slide.",
      "An image you did not draw — `pres find-image --search \"…\"` searches openly-licensed work and brings the attribution with it.",
      "An illustration nobody has — write the prompt, record it on the figure, report the slide as waiting on an image. Running the generator is the professor's.",
      "Figures live flat beside the deck, named after it, linked as siblings. A subdirectory link breaks silently in a deck nobody opens until the lecture.",
      "Alt text on every figure, and it says what the picture asserts rather than captioning the filename.",
      "Colour is never the only channel: label the lines, vary the dash, name the regions.",
      "Every figure gets a plan entry, including ones you drew. A figure with no entry is a figure whose licence nothing checks.",
      "The title slide's picture is named in the plan as `title_slide.image`, not linked from the markdown — the renderer composes that slide. It should be an image, never a diagram: a mechanism there shows the payoff before anything has asked the question.",
    ],
  },
  {
    key: "record",
    title: "What the deck has to admit about itself",
    reference: "RULES.md",
    rules: [
      "Serve the claims, never add them. No new outcome, concept, prerequisite or criterion — if the session needs one, say which and stop.",
      "Do not invent sources, and do not invent a misconception.",
      "No answer key on a slide, and no student name, email or number anywhere — including in a filename or an axis label.",
      "`generated_by` is not optional. A professor presenting these slides should be able to see they were drafted by an agent.",
      "Say where the course came from. A fallback is an excellent way to hide a stale course.",
    ],
  },
];

export function describeRules(keys?: string[]): string {
  const wanted = keys?.length
    ? RULE_GROUPS.filter((group) => keys.includes(group.key))
    : RULE_GROUPS;
  if (!wanted.length) {
    return `no such rule group. The groups are: ${RULE_GROUPS.map((group) => group.key).join(", ")}.`;
  }
  const lines: string[] = [];
  for (const group of wanted) {
    lines.push(`## ${group.title}   (${group.reference})`);
    for (const rule of group.rules) lines.push(`  - ${rule}`);
    lines.push("");
  }
  lines.push("These are the rules. The references hold the reasoning, and are worth reading once.");
  return lines.join("\n");
}

/**
 * What to actually write when the plan says a given archetype.
 *
 * The half of the archetype table that is about *authoring* rather than about
 * checking. `archetypes.ts` says what an archetype is and what it forbids;
 * these say what a person types.
 */
export const WRITING_NOTES: Partial<Record<ArchetypeName, string>> = {
  roadmap: "the map, drawn, with the words as labels on it. \"Last time / today / builds on\" as three bullets is the commonest un-drawn slide in a teaching deck",
  question: "the question, and nothing else. No answer, no explanation — an error, not a warning",
  activity: "the task, the options if any, and room to think. No answer",
  single_visual: "the picture, its identification, and what to notice. Not a description of what the room can already see",
  annotated_object: "the diagram is the explanation. Labels on the parts they name — never a diagram followed by \"Box A means…\"",
  system_diagram: "components and their relationships, labelled in place. Never a diagram plus a glossary",
  process: "left to right or top to bottom, with short step labels",
  visual_comparison: "two to four visuals at equal weight, parallel labels, same crop and scale. The layout does the comparing",
  data_evidence: "the headline carries the claim — \"accuracy drops sharply beyond 8K tokens\", not \"accuracy by context length\"",
  algorithm: "the code dominates; the interpretation sits beside it, not underneath it as bullets",
  derivation: "progressive vertical reasoning: claim, steps, result, one sentence of meaning",
  primary_source: "the passage at length is correct here. A long source being analysed is not a wall of text",
  big_idea: "one claim, large, alone",
  definition: "term, then meaning, then one example",
  structured_comparison: "alternatives against dimensions, terse cells, a real markdown table",
  worked_example: "problem, steps, answer, then why it worked",
  synthesis: "three to five ideas and how they connect — usually a diagram rather than a list",
  section_opener: "a full image, or a large title alone",
};

/**
 * The eighteen archetypes as a table.
 *
 * Enough to choose one and to write it, without `visual-grammar.md`: what
 * carries the slide, how dense it is, whether it needs a picture, what it must
 * not carry, and what to type.
 */
export function describeArchetypes(name?: string): string {
  if (name) {
    const archetype = ARCHETYPES[name as ArchetypeName];
    if (!archetype) {
      return `'${name}' is not one of the eighteen: ${Object.keys(ARCHETYPES).join(", ")}.`;
    }
    const band = DENSITY[archetype.density];
    const lines = [
      `${name}`,
      `  carried by:  ${archetype.dominant}`,
      `  visual:      ${archetype.visual}`,
      `  density:     ${archetype.density} (${band.words[0]}–${band.words[1]} words — ${band.note})`,
      `  text roles:  ${archetype.roles.join(", ")}`,
      `  composition: ${archetype.composition}`,
    ];
    if (archetype.forbids?.length) lines.push(`  must not carry: ${archetype.forbids.join(", ")}`);
    const writing = WRITING_NOTES[name as ArchetypeName];
    if (writing) lines.push(`  write:       ${writing}`);
    return lines.join("\n");
  }

  const lines = [
    "eighteen slide archetypes — archetype · carried by · visual · density · must not carry",
    "",
  ];
  for (const [key, archetype] of Object.entries(ARCHETYPES)) {
    const forbids = archetype.forbids?.length ? `no ${archetype.forbids.join("/")}` : "";
    lines.push(
      `  ${key.padEnd(22)} ${archetype.dominant.padEnd(38)} ${archetype.visual.padEnd(11)} ` +
      `${archetype.density.padEnd(9)} ${forbids}`,
    );
  }
  lines.push("");
  lines.push(`text roles: ${Object.keys(TEXT_ROLES).join(", ")}`);
  lines.push(
    "density bands: " +
    Object.entries(DENSITY)
      .map(([key, band]) => `${key} ${band.words[0]}–${band.words[1]}`)
      .join(" · ") +
    "  (generation defaults, not limits)",
  );
  lines.push("");
  lines.push("`pres archetypes --name <one>` for its composition and what to write.");
  return lines.join("\n");
}
