/**
 * When a mark counts: the one rule every window that draws marks reads.
 *
 * A mark is decided in the Grade window, and the other windows that show one
 * — the Assessment window's figures, the Students drawer's rubric check —
 * draw only what was decided. Each used to say so in its own words; written
 * twice, the rule could drift, and the windows would disagree on what a
 * student has. No imports: Node and the bundle both load it.
 */

/** The statuses an evaluation is decided in: accepted as suggested, or changed. */
export const DECIDED = ["approved", "overridden"];

/** Whether an evaluation carries a decided mark; a suggestion does not. */
export const isDecided = (evaluation) => Boolean(evaluation && evaluation.professor_decision && DECIDED.includes(evaluation.status));

/** The decided mark of an evaluation, or null while it is only a suggestion. */
export const decisionOf = (evaluation) => (isDecided(evaluation) ? evaluation.professor_decision : null);
