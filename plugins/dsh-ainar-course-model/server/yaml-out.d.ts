/**
 * Writing YAML the way `yaml.safe_dump` writes it.
 *
 * `ainar approve` appends to files under `courses/`, and `node bin/ainar.ts
 * approve` appends to the same files. If the two gates emit the same data
 * differently, every approval reformats whatever the other one wrote — and a
 * diff in `courses/` stops meaning "a person decided something" and starts
 * meaning "a different binary ran". So this is not "a YAML writer": it
 * reproduces PyYAML's emitter for the shapes the model can hold, and
 * `tests/test_yaml_parity.py` compares the two byte for byte.
 *
 * The settings matched are the ones `ainar/approve.py` passes:
 * `sort_keys=False, allow_unicode=True, default_flow_style=False, width=88`.
 *
 * Four PyYAML behaviours are easy to miss and all four are load-bearing:
 *
 * 1. **It resolves with YAML 1.1**, so `yes`, `off` and `2026-08-08` are not
 *    strings, and a string holding one must be quoted. The JS `yaml` package
 *    resolves with 1.2 core, where they are strings — which is why the resolver
 *    below is written out rather than borrowed.
 * 2. **`6.0` and `6` are different scalars.** JavaScript has one number type, so
 *    float-ness comes from the caller as a path predicate.
 * 3. **Sequences under a mapping key are indentless** — the dash sits at the
 *    key's own column, not one level in.
 * 4. **A newline inside a quoted scalar folds to a blank line.** A literal block
 *    would round-trip to the same string but not to the same bytes.
 *
 * The line-breaking is a transcription of `Emitter.write_plain` and
 * `Emitter.write_single_quoted`: a run of spaces becomes a break only when it is
 * a single space, the column has already passed the width, and the run is
 * neither the first nor the last thing in the scalar. That is why a long word is
 * never split and a line may legitimately end past column 88.
 */
/** Whether the number at this path is a float, and so needs a `.0`. */
export type IsFloat = (path: string[]) => boolean;
/** Render a document, as `safe_dump` would. */
export declare const dump: (value: unknown, isFloat?: IsFloat) => string;
