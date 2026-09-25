/**
 * The node half: three UI slots in the browser, and the browser tab here.
 *
 * Nearly all of this plugin is `lib/client.js`, which occupies the sidebar mark,
 * the sidebar wordmark and the conversation hero mark. Those are UI slots and
 * need nothing on this side — but `dsh-client-modules` only serves the client
 * half of a package that is a mounted ROW, so the row needs a node-side entry
 * point to mount at all. `@deepseek-ai/dsh-client-ui-brand-official` carries the
 * same seat for the same reason, and carries it empty.
 *
 * This one is not empty, because the browser tab is the one piece of the brand
 * with no slot behind it. `ui-brand-official` says so itself: "the browser title
 * is independent; `DSH_CLIENT_TITLE` selects title text at BUILD time rather
 * than through a UI slot". This project consumes a published frontend bundle
 * rather than building one, so that variable is not a lever it has — and the
 * served `index.html` is not ours to edit. What IS ours is the webserver's own
 * escape hatch. See `apply`.
 *
 * There is deliberately no config here. A brand slot is filled by a React
 * component in the browser, and row config does not reach a client half — no
 * shipped one injects `config` — so the wording and the mark are constants at
 * the top of `lib/client.js` instead. If a profile ever needs to vary them,
 * the missing piece is a channel from config to the browser, not a schema here.
 */

/** The row id this plugin answers to, and what `--dump-config` prints. */
export const name = "professor-brand";

/**
 * What the tab says before the client mounts.
 *
 * Only half the tab's life, and the half a screenshot rarely catches: once
 * React is up, `dsh-client-ui-renderer`'s `DocumentTitle` takes the tab over
 * and composes it from its own hardcoded constant. That component is rendered
 * directly by the renderer rather than through a slot, so there is nothing to
 * occupy and nothing to inject — it is still patched in `patches/apply.mjs`,
 * and it is the only title patch left.
 */
const TITLE = "Professor's Exoskeleton";

/**
 * Replace whatever the shipped index.html calls itself.
 *
 * Deliberately a pattern rather than the exact string the bundle ships today.
 * A patch in `patches/apply.mjs` has to match exactly and shout when it stops
 * matching, because a patch changes BEHAVIOUR and silently not applying one
 * leaves the harness running something other than what that file claims. This
 * is not that: it is a pure override of a name. If DeepSeek retitles their own
 * bundle tomorrow we still want ours, so matching loosely is correct here for
 * the same reason matching exactly is correct there.
 */
const retitle = (html) => html.replace(/<title>[^<]*<\/title>/i, `<title>${TITLE}</title>`);

/**
 * Register the tap, if this composition serves a browser at all.
 *
 * `webServer` is reached through a nested fiber rather than declared in
 * `inject`, and the distinction matters: a declared dependency that no profile
 * provides fails the WHOLE row, and this row's real job is three brand slots.
 * Losing the mark and the wordmark in a headless profile because there is no
 * HTTP server to retitle would be the wrong trade. So the tap exists while a
 * webserver does, and its absence costs nothing.
 *
 * `tapIndex` runs after the structured injection rows on every index response —
 * `renderIndex` in `dsh-host-webserver` — and returns the disposer that removes
 * it, which `effect` ties to this fiber so an unload actually unloads.
 */
export function apply(ctx) {
  ctx.inject(["webServer"], (scoped) => {
    scoped.effect(
      () => scoped.webServer.tapIndex(retitle),
      "professor-brand: the browser tab title",
    );
  });
}
