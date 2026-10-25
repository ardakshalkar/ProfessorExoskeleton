/**
 * Where an older request for a place lands now.
 *
 * Links into course mode are written all over — the command field
 * (shared/actions.js), Today's items (server/today.js), the inspector, chips
 * inside served pages — and some were written for a view or a part that has
 * since moved or been folded into another. Each is resolved here, once, so a
 * stale link lands where the thing now lives instead of nowhere. No imports:
 * Node and the bundle both load it.
 */

/** Older names a request may still use: the Integrations view became Course settings. */
export const VIEW_ALIASES = {
  integrations: { view: "settings", sub: "integrations" },
  preferences: { view: "settings", sub: "preferences" },
};

/**
 * Parts that were folded into another place's, by `view/sub`: each item has
 * one home, and an older link to a part that drew it a second time lands
 * there (2026-10-24). `focus` names the section of the place to bring into
 * view; `kind` filters Waiting · Everything.
 *
 * - The grading policy is the Gradebook's Policy, not a Materials page too.
 * - What Canvas lacks is Sync's Marks for Canvas, not Gradebook · To Canvas
 *   and Waiting · Unpublished as well.
 * - The marks waiting for a decision are Everything's marks, each opening the
 *   Grade window, not a Pending table whose press only asked the chat.
 */
export const SUB_ALIASES = {
  "materials/grading": { view: "gradebook", sub: "policy" },
  "gradebook/canvas": { view: "syncs", focus: "marks" },
  "tasks/unpublished": { view: "syncs", focus: "marks" },
  "tasks/tasks": { view: "tasks", sub: "waiting", kind: "marks" },
};

/** A request with its view resolved through `VIEW_ALIASES`, then its part through `SUB_ALIASES`. */
export const resolveRequest = (request) => {
  if (!request) return request;
  const viewed = VIEW_ALIASES[request.view]
    ? { ...request, ...VIEW_ALIASES[request.view], sub: request.sub || VIEW_ALIASES[request.view].sub }
    : request;
  const folded = SUB_ALIASES[viewed.view + "/" + viewed.sub];
  if (!folded) return viewed;
  const { sub: _old, ...rest } = viewed;
  return { ...rest, ...folded };
};
