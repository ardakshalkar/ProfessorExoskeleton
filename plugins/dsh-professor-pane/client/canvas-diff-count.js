/**
 * What the Canvas card counts of the run's differences with Canvas — apart
 * from canvas-diff.js so it can be tested without React.
 */

export const KINDS = [
  { id: "grades", label: "Marks" },
  { id: "assignments", label: "Definitions" },
  { id: "roster", label: "Class list" },
];

export const DIRECTIONS = [
  { id: "push", label: "to Canvas", tag: "changed here" },
  { id: "pull", label: "from Canvas", tag: "changed in Canvas" },
  { id: "conflict", label: "conflicts", tag: "changed on both sides" },
  { id: "held", label: "held", tag: "held for you" },
];

const zero = () => ({ push: 0, pull: 0, conflict: 0, held: 0, total: 0 });

/** Whether Sync all applies a difference itself, rather than leaving it for the professor. */
export const applicable = (entry) =>
  (entry.direction === "push" && entry.kind !== "roster") || (entry.direction === "pull" && entry.kind === "roster");

/**
 * The counts the card shows, from a `/api/canvas/differences` answer: per
 * kind and per direction, and how many Sync all could apply. `null` while
 * there is no check with differences in it.
 */
export const diffSummary = (answer) => {
  if (!answer || !Array.isArray(answer.differences)) return null;
  const kinds = { grades: zero(), assignments: zero(), roster: zero() };
  const directions = zero();
  let canApply = 0;
  for (const entry of answer.differences) {
    const kind = kinds[entry.kind] || (kinds[entry.kind] = zero());
    kind[entry.direction] += 1;
    kind.total += 1;
    directions[entry.direction] += 1;
    directions.total += 1;
    if (applicable(entry)) canApply += 1;
  }
  return { total: directions.total, kinds, directions, applicable: canApply, kept: answer.kept || 0 };
};
