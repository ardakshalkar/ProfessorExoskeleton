/**
 * The node half: an empty seat, so the loader has a package to serve from.
 *
 * All of this plugin's behaviour is in the browser — `lib/client.js` occupies
 * three UI slots and nothing else. But `dsh-client-modules` only serves the
 * client half of a package that is a mounted ROW, so the row needs a node-side
 * entry point to mount at all. `@deepseek-ai/dsh-client-ui-brand-official`
 * carries the same empty seat for the same reason.
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
 * Nothing to do on the node side.
 *
 * Present because the loader expects an `apply`, and an absent one is a boot
 * failure rather than a no-op.
 */
export function apply() {}
