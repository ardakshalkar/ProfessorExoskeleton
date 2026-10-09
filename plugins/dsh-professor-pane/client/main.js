/**
 * The browser half: the right column of the harness, as the professor's pane.
 *
 * Hand-written in the module loader's registration form rather than bundled.
 * Every client half in `node_modules/@deepseek-ai` is this same shape —
 * `window.__ModuleLoader__.load({ id, factory })`, a factory that takes a
 * synchronous `require` and returns `module.exports` — so the format is the
 * loader's contract and not a private artefact of anybody's tsdown config.
 * `package.json` says why there is no build step.
 *
 * WHICH SEAT THIS IS, AND WHAT IT DISPLACES
 * -----------------------------------------
 * `details` is the third column of `ui-layout`'s AppFrame: the right pane. It
 * is a `single` slot, so a second registration does not sit beside the first —
 * it shadows it, and the lowest priority renders. `ui-conversation` registers
 * its tool-call inspector there at the default priority 0, so this pane
 * registers at -1 and wins.
 *
 * That is a displacement and worth stating plainly. What it costs is nothing
 * today: the only thing that opens that inspector is the `openDetails(target)`
 * action `ui-conversation` hands to `conversation.chat.node` registrants, and
 * no shipped registrant calls it — the panel is unreachable in the running
 * harness. The same call's data is in the trajectory view, which has its own
 * seat in the conversation column. If a future DSH wires a "view details"
 * control up, this pane's priority is the one line to reconsider.
 *
 * WHAT IT DRAWS
 * -------------
 * A row of buttons. Most of them put a document into a sandboxed frame with its
 * payload already inside it — either `dsh-ainar-course-model`'s own widget, so
 * the term plan a professor sees here is the same document ChatGPT and Claude
 * Desktop get from the same bytes with no second implementation to drift, or a
 * page `index.js` assembles for a view no widget covers.
 *
 * Two are drawn here instead: Preferences and Integrations. Both have a form,
 * and a form cannot go in the frame — it is delivered as `srcdoc` without
 * `allow-same-origin`, so a document inside it has an opaque origin and cannot
 * call back to the routes a Save would need. See `WidgetFrame`.
 *
 * The pane computes no figure, which is the rule the widgets are held to and
 * the reason they are worth reusing rather than reimplementing. Every number in
 * here arrived in a payload; this file formats dates by printing the strings it
 * was given and does no arithmetic at all.
 */

import { DefenceDesk } from "./defence-desk.js";
import { SyncsView } from "./syncs.js";
import { turnStep } from "./defence-turn.js";
import { inject, OpenPaneAction, ProfessorPane } from "./pane.js";

/**
 * @param ctx - client root context.
 */
function apply(ctx) {
  /**
   * Send a widget's question into one session.
   *
   * `sessions.scope(id)` then `sessionOf` is how `ui-conversation` reaches
   * a session's behaviour verbs, and `prompt(..., 'queue')` is its own
   * `send`: appended as a turn rather than steering the running one, so a
   * button press while the model is working does not interrupt it.
   */
  const ask = (sessionId) => (text) => {
    const scope = ctx.sessions.scope(sessionId);
    const session = scope === undefined ? undefined : ctx.sessions.sessionOf(scope);
    if (session === undefined) return;
    Promise.resolve(session.prompt([{ type: "text", text: text }], "queue")).catch(() => {});
  };

  /**
   * Put a mention of something into the composer, and send nothing.
   *
   * The opposite half of `ask`, and the difference is whose sentence it is.
   * `ask` carries a question this pane already knows how to phrase — "what
   * should I teach this week" — and sends it. This one carries only the
   * NAME of what the professor is looking at, into the draft, with the
   * caret after it: the question is theirs to type, and the identifier
   * spares the model a search for which of forty documents was meant.
   *
   * Appends rather than replaces. A half-typed question in the composer is
   * work, and a button that discards it to make room for a filename would
   * be the pane deciding it matters more than the professor's sentence.
   *
   * Returns whether the draft was actually written, because the caller
   * draws a different outcome for "no" — this reaches across a plugin
   * boundary to `ui-conversation`, and a composition without it is a real
   * arrangement rather than a broken one.
   */
  const mention = (sessionId) => (text) => {
    const scope = ctx.sessions.scope(sessionId);
    if (scope === undefined) return false;
    const resolver = ctx.conversation === undefined ? undefined : ctx.conversation.input;
    const input = resolver === undefined ? undefined : resolver.for(scope);
    if (input === undefined || typeof input.setDraft !== "function") return false;
    // `getSnapshot()`, not a `.snapshot` property: `SnapshotStore` is the
    // `useSyncExternalStore` shape, and reading the property that is not
    // there yields undefined rather than throwing — which is how the first
    // version of this silently replaced a half-typed question instead of
    // appending to it. Guarded anyway, because this is another package's
    // store and a read that throws must not cost the professor their draft.
    let current = "";
    try {
      const state = input.state;
      const snapshot =
        state !== undefined && typeof state.getSnapshot === "function"
          ? state.getSnapshot()
          : undefined;
      const draft = snapshot === undefined ? undefined : snapshot.draft;
      if (typeof draft === "string") current = draft;
    } catch {
      current = "";
    }
    // One space between what was there and what arrives, and none when the
    // draft is empty — the composer is a sentence being written, not a log.
    const trimmed = current.replace(/\s+$/, "");
    input.setDraft(trimmed === "" ? text : trimmed + " " + text);
    return true;
  };

  ctx.slots.inject("details", () =>
    ctx.slots.register(
      {
        name: "details",
        // Lowest renders. `ui-conversation`'s tool-call inspector sits at
        // the default 0; see this file's header for what that displaces and
        // why it currently costs nothing.
        priority: -1,
        inject: (sessionId) => ({
          closeDetails: () => ctx.layout.closeDetails(),
          openDetails: () => ctx.layout.openDetails(),
          ask: ask(sessionId),
          mention: mention(sessionId),
        }),
      },
      ProfessorPane,
    ),
  );

  ctx.slots.inject("conversation.session.header.actions", () =>
    ctx.slots.register(
      {
        name: "conversation.session.header.actions",
        id: "professor-pane",
        order: 10,
        inject: () => ({ openPane: () => ctx.layout.openDetails() }),
      },
      OpenPaneAction,
    ),
  );
}

exports.apply = apply;
exports.inject = inject;
// For the tests only: the end-of-answer detector is the one piece of the
// desk that is logic rather than wiring, and the desk itself is mounted
// alone by `test/desk-page.mjs`, against a mock API and a synthetic voice.
exports.turnStep = turnStep;
exports.DefenceDesk = DefenceDesk;
// The same, for `test/syncs-page.mjs`: the Syncs view alone, against the real
// syncs of a workspace and made-up names in the review list.
exports.SyncsView = SyncsView;
