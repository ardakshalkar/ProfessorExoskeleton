/**
 * The browser half: this host's own brand, in place of the shipped one.
 *
 * WHAT TO EDIT
 * ------------
 * The three constants directly below are the whole of the wording and the
 * mark. Everything after them is plumbing. A profile cannot override them:
 * row config reaches node halves only, and no shipped client half in
 * `node_modules/@deepseek-ai` injects `config` either — so a client-side
 * brand is edited here, in source, by design rather than by omission.
 *
 * HOW THIS DISPLACES THE SHIPPED BRAND
 * ------------------------------------
 * `sidebar.brand.mark`, `sidebar.brand.name` and `conversation.hero.brand.mark`
 * are declared `kind: "single"` by `ui-sidebar` and `ui-conversation`. A single
 * slot does not stack: a second registration shadows the first and the LOWEST
 * priority renders. `ui-brand-official` registers all three at the default 0,
 * so this file registers at -1 and wins — the same mechanism, and the same
 * priority, that `dsh-professor-pane` uses for the `details` column.
 *
 * `ui-brand-official` therefore stays mounted and harmless. Disabling its row
 * instead would NOT work on its own: `ui-sidebar` renders each brand slot with
 * `fallback: FishLogo`, so an unoccupied slot shows the shipped whale rather
 * than nothing. Occupying the slot is the only thing that changes the mark,
 * which is why this is a plugin and not a line in a patch file.
 *
 * Hand-written in the module loader's registration form rather than bundled,
 * for the reason `package.json` gives: every shipped client half is this same
 * shape, so the format is the loader's contract and not a private artefact.
 */

window.__ModuleLoader__.load({
  id: "dsh-professor-brand",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const h = React.createElement;

    // ---------------------------------------------------------------- wording

    /** The wordmark, set in the sidebar beside the mark. */
    const BRAND_NAME = "Professor's";

    /**
     * The boxed tag after the wordmark.
     *
     * Set to an empty string to drop the box entirely and show the wordmark
     * alone; the layout below handles that case rather than leaving an empty
     * rectangle behind.
     */
    const BRAND_TAG = "EXOSKELETON";

    /**
     * What a screen reader is told the mark is.
     *
     * The mark is decorative wherever the wordmark sits beside it, so this is
     * the label for the one place it appears alone: the conversation hero.
     */
    const BRAND_MARK_LABEL = "Professor's Exoskeleton";

    // ------------------------------------------------------------------- mark

    /**
     * The mark: two brackets carrying a figure with a spine.
     *
     * Drawn in `currentColor` and with no fills of its own beyond the head, so
     * it inherits the sidebar's colour and needs no light and dark variants.
     * The 24-unit viewBox matches what `ui-sidebar` asks for (`size: 24`), and
     * the strokes are on whole and half units so they stay crisp at that size.
     */
    function BrandMark({ size, className }) {
      const side = size ?? 24;
      return h(
        "svg",
        {
          width: side,
          height: side,
          viewBox: "0 0 24 24",
          className,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.75,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          role: "img",
          "aria-label": BRAND_MARK_LABEL,
        },
        // The exoskeleton: a bracket either side, open towards the figure.
        h("path", { key: "l", d: "M7.5 3.5H5A1.5 1.5 0 0 0 3.5 5v14A1.5 1.5 0 0 0 5 20.5h2.5" }),
        h("path", { key: "r", d: "M16.5 3.5H19A1.5 1.5 0 0 1 20.5 5v14a1.5 1.5 0 0 1-1.5 1.5h-2.5" }),
        // The figure it carries.
        h("circle", { key: "head", cx: 12, cy: 8.25, r: 2.25, fill: "currentColor", stroke: "none" }),
        h("path", { key: "spine", d: "M12 12.5v7" }),
        h("path", { key: "arms", d: "M8.75 15.5h6.5" }),
      );
    }

    // --------------------------------------------------------------- wordmark

    /**
     * The name, without the mark — which has its own slot and would otherwise
     * appear twice.
     *
     * Inline styles rather than classes: the shipped stylesheet's class names
     * are not a contract this plugin should depend on, and there are six
     * declarations here.
     */
    function BrandName() {
      const word = h(
        "span",
        {
          key: "word",
          style: { fontWeight: 600, fontSize: "15px", letterSpacing: "-0.01em", whiteSpace: "nowrap" },
        },
        BRAND_NAME,
      );

      if (!BRAND_TAG) return word;

      return h(
        "span",
        { style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
        word,
        h(
          "span",
          {
            key: "tag",
            style: {
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              padding: "2px 5px",
              borderRadius: "3px",
              /*
               * Outlined rather than filled, and this is not a style
               * preference.
               *
               * A filled tag needs two colours: the sidebar's ink for the box
               * and the sidebar's paper for the letters. The ink is available
               * as `currentColor` — but setting `color` on this same element
               * to get the letters redefines what `currentColor` means HERE,
               * so `background: currentColor` resolved to the letter colour
               * and the tag rendered white on white: present, sized, and
               * invisible. There is no shipped custom property for the paper
               * colour to reach for instead.
               *
               * An outline needs only the ink, inherits it, and is legible in
               * both themes with nothing to keep in sync.
               */
              border: "1px solid currentColor",
              opacity: 0.7,
              whiteSpace: "nowrap",
            },
          },
          BRAND_TAG,
        ),
      );
    }

    // --------------------------------------------------------------- plumbing

    /** Required service: the UI slot registry. */
    const inject = ["slots"];

    /**
     * Fill all three brand slots as one declaration-aware registration set.
     *
     * Nested `slots.inject` is the shape `ui-brand-official` uses, and it is
     * the reason this works whether the row activates before or after the
     * sidebar and conversation declarers: the registrations withdraw together
     * if either declaration collapses, so there is never a half-replaced brand
     * showing one mark beside the other's wordmark.
     */
    function apply(ctx) {
      ctx.slots.inject("sidebar.brand.mark", () =>
        ctx.slots.inject("sidebar.brand.name", () =>
          ctx.slots.inject("conversation.hero.brand.mark", function* () {
            // -1 shadows `ui-brand-official`'s default 0. See this file's header.
            yield ctx.slots.register({ name: "sidebar.brand.mark", priority: -1 }, BrandMark);
            yield ctx.slots.register({ name: "sidebar.brand.name", priority: -1 }, BrandName);
            yield ctx.slots.register({ name: "conversation.hero.brand.mark", priority: -1 }, BrandMark);
          }),
        ),
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
