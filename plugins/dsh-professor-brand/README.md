# dsh-professor-brand

This host's own mark and wordmark, in place of the shipped DeepSeek one.

Three UI slots, one file, no build step:

| slot | what this fills it with |
| --- | --- |
| `sidebar.brand.mark` | the mark, at the 24px the sidebar asks for |
| `sidebar.brand.name` | the wordmark, and the boxed tag after it |
| `conversation.hero.brand.mark` | the same mark, on the start screen |

## Changing the wording or the mark

[`lib/client.js`](lib/client.js), at the top. `BRAND_NAME` is the wordmark,
`BRAND_TAG` is the boxed tag after it — set it to `""` to drop the box
entirely — and `BRAND_MARK_LABEL` is what a screen reader is told the mark is.
The mark itself is the `BrandMark` SVG a few lines below.

A profile cannot override these, and that is a real limitation rather than an
oversight: row config reaches node halves only. No shipped client half in
`node_modules/@deepseek-ai` injects `config` either, so there is no channel
from the composed config tree to a browser component to follow. A client-side
brand is edited in source.

## Why a plugin, and not a line in a patch file

Because the alternative does not work. All three slots are declared
`kind: "single"`, and `ui-sidebar` renders each one with
`fallback: FishLogo` — so disabling `ui-brand-official`'s row leaves the slots
empty and the sidebar draws the shipped whale as its fallback. The mark only
changes if something *occupies* the slot.

A `single` slot shadows rather than stacks, and the **lowest priority renders**.
`ui-brand-official` registers at the default 0, so this registers at -1 and
wins, with the official row left mounted and harmless. That is the same
mechanism, and the same priority, that `dsh-professor-pane` uses to take the
`details` column.

The registrations are nested inside `slots.inject` calls, which is what makes
the order not actually matter: each one waits for its declaration and withdraws
with it, so there is never a half-replaced brand showing one mark beside the
other's wordmark during HMR.

## The one piece that is not a slot

The browser tab title. `ui-brand-official`'s own README is explicit that
`DSH_CLIENT_TITLE` selects it at **build** time rather than through a slot, and
this project consumes a published frontend bundle rather than building one — so
that variable is not a lever here. It is patched by
[`patches/apply.mjs`](../../patches/apply.mjs) instead, which is that file's
stated purpose: behaviour hard-coded in a bundle, patched loudly, reapplied
after every install.

It takes **two** patches, and finding that out took restarting the harness and
looking at the tab:

| patch | covers |
| --- | --- |
| `dsh-web-frontend`, `dist/index.html` | the served document — the tab until React mounts |
| `dsh-client-ui-renderer`, `lib/client.js` | `DocumentTitle`'s own `productTitle` constant |

Patching only the first left the tab reading "Professor's Exoskeleton" on the
start screen and `<session title> — DeepSeek Harness` the moment a conversation
was open, because `ui-renderer` takes the title over from then on and composes
it from a constant of its own. The open-conversation case is the one anybody
actually looks at, and the one a screenshot catches.

Neither patch is redundant: the renderer's constant is also what the title is
restored to on unmount, and the served HTML is what shows before any of that
JavaScript has run.

## Turning it off

Override the row from the profile's patch layer:

```yaml
- id: professor-brand
  disabled: true
```

The shipped brand comes back on its own, because `ui-brand-official` was never
unmounted. The tab title does not — that is the patch, and `npm run patch`
governs it.
