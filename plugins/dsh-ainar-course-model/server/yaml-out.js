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
const WIDTH = 88;
const INDENT = "  ";
// --------------------------------------------------------------------------
// PyYAML's implicit resolvers (YAML 1.1), from `yaml/resolver.py`
// --------------------------------------------------------------------------
const RESOLVERS = [
    /^(?:yes|Yes|YES|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF)$/,
    /^(?:~|null|Null|NULL|)$/,
    new RegExp("^(?:[-+]?0b[0-1_]+" +
        "|[-+]?0[0-7_]+" +
        "|[-+]?(?:0|[1-9][0-9_]*)" +
        "|[-+]?0x[0-9a-fA-F_]+" +
        "|[-+]?[1-9][0-9_]*(?::[0-5]?[0-9])+)$"),
    new RegExp("^(?:[-+]?(?:[0-9][0-9_]*)\\.[0-9_]*(?:[eE][-+][0-9]+)?" +
        "|\\.[0-9][0-9_]*(?:[eE][-+][0-9]+)?" +
        "|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\\.[0-9_]*" +
        "|[-+]?\\.(?:inf|Inf|INF)" +
        "|\\.(?:nan|NaN|NAN))$"),
    new RegExp("^(?:[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]" +
        "|[0-9][0-9][0-9][0-9]-[0-9][0-9]?-[0-9][0-9]?" +
        "(?:[Tt]|[ \\t]+)[0-9][0-9]?:[0-9][0-9]:[0-9][0-9](?:\\.[0-9]*)?" +
        "(?:[ \\t]*(?:Z|[-+][0-9][0-9]?(?::[0-9][0-9])?))?)$"),
    /^=$/,
    /^<<$/,
];
/** Would this text resolve as something other than a string if left plain? */
const resolvesAsNonString = (text) => RESOLVERS.some((pattern) => pattern.test(text));
// --------------------------------------------------------------------------
// Scalar style — `Emitter.analyze_scalar`, reduced to block context
// --------------------------------------------------------------------------
const allowsPlain = (text) => {
    if (text === "")
        return false;
    if (/^\s|\s$/.test(text))
        return false; // leading or trailing whitespace
    if (/[\0-\x08\x0b\x0c\x0e-\x1f\x7f-\x84\x86-\x9f]/.test(text))
        return false;
    if (/[\n\x85\u2028\u2029]/.test(text))
        return false; // folds as a quoted scalar
    if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(text))
        return false; // indicator first
    if (/: /.test(text) || /:$/.test(text))
        return false;
    if (/ #/.test(text))
        return false;
    return true;
};
// --------------------------------------------------------------------------
// Line breaking — `Emitter.write_plain` and `Emitter.write_single_quoted`
// --------------------------------------------------------------------------
const BREAK = /[\n\x85\u2028\u2029]/;
/**
 * Write `text` starting at `column`, breaking to `indent` as PyYAML would.
 *
 * `quoted` selects the one difference between the two writers: inside a quoted
 * scalar a newline in the source emits an extra line break, which is what turns
 * one `\n` into a blank line.
 */
const write = (text, column, indent, quoted) => {
    let out = "";
    let col = column;
    let spaces = false;
    let breaks = false;
    let start = 0;
    let end = 0;
    const writeIndent = () => {
        out += "\n" + indent;
        col = indent.length;
    };
    while (end <= text.length) {
        const ch = end < text.length ? text[end] : null;
        if (spaces) {
            if (ch !== " ") {
                if (start + 1 === end && col > WIDTH && start !== 0 && end !== text.length) {
                    writeIndent();
                }
                else {
                    const data = text.slice(start, end);
                    col += data.length;
                    out += data;
                }
                start = end;
            }
        }
        else if (breaks) {
            if (ch === null || !BREAK.test(ch)) {
                if (quoted && BREAK.test(text[start]))
                    out += "\n";
                for (const _ of text.slice(start, end))
                    out += "\n";
                out += indent;
                col = indent.length;
                start = end;
            }
        }
        else if (ch === null || ch === " " || BREAK.test(ch)) {
            const data = text.slice(start, end);
            col += data.length;
            out += data;
            start = end;
        }
        if (ch !== null) {
            spaces = ch === " ";
            breaks = BREAK.test(ch);
        }
        end += 1;
    }
    return out;
};
const numberText = (value, isFloat) => {
    if (Number.isNaN(value))
        return ".nan";
    if (!Number.isFinite(value))
        return value > 0 ? ".inf" : "-.inf";
    if (isFloat && Number.isInteger(value))
        return `${value}.0`;
    return String(value);
};
/**
 * One scalar, including the space that precedes it.
 *
 * `column` is where the line stands before that space; `indent` is where a
 * continuation line would begin.
 */
const scalar = (value, column, indent, isFloat) => {
    if (value === null || value === undefined)
        return " null\n";
    if (typeof value === "boolean")
        return value ? " true\n" : " false\n";
    if (typeof value === "number")
        return " " + numberText(value, isFloat) + "\n";
    const text = String(value);
    if (allowsPlain(text) && !resolvesAsNonString(text)) {
        return " " + write(text, column + 1, indent, false) + "\n";
    }
    // The opening quote is an indicator: it and the space before it advance the
    // column before any of the text is written.
    return " '" + write(text.replace(/'/g, "''"), column + 2, indent, true) + "'\n";
};
const key = (name) => allowsPlain(name) && !resolvesAsNonString(name) ? name : "'" + name.replace(/'/g, "''") + "'";
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
// --------------------------------------------------------------------------
// Blocks
// --------------------------------------------------------------------------
/**
 * The text that follows a `key:` or a `-`, including the separating space.
 *
 * `indent` is where this node's own lines begin. `inline` means the caller has
 * left the cursor mid-line — a sequence item's first key sits on the dash's
 * line, so it takes a space instead of an indent.
 */
const block = (value, indent, inline, column, path, isFloat) => {
    if (Array.isArray(value)) {
        if (!value.length)
            return " []\n";
        let out = inline ? "" : "\n";
        value.forEach((item, index) => {
            out += inline && index === 0 ? " " : indent;
            // A sequence item's own lines begin two columns in from the dash.
            out += "-" + block(item, indent + INDENT, true, indent.length + 1, path, isFloat);
        });
        return out;
    }
    if (isObject(value)) {
        const entries = Object.entries(value);
        if (!entries.length)
            return " {}\n";
        let out = inline ? "" : "\n";
        entries.forEach(([name, child], index) => {
            const lead = inline && index === 0 ? " " : indent;
            const label = key(name);
            out += lead + label + ":";
            // Rule 3: a sequence value stays at this mapping's own indent.
            const childIndent = Array.isArray(child) ? indent : indent + INDENT;
            const childColumn = (inline && index === 0 ? column : indent.length) + label.length + 1;
            out += block(child, childIndent, false, childColumn, [...path, name], isFloat);
        });
        return out;
    }
    return scalar(value, column, indent, isFloat(path));
};
/** Render a document, as `safe_dump` would. */
export const dump = (value, isFloat = () => false) => {
    const rendered = block(value, "", false, 0, [], isFloat);
    // A block opened by the document rather than by a key needs no leading break,
    // and a bare scalar document needs no leading space.
    return rendered.startsWith("\n") ? rendered.slice(1) : rendered.replace(/^ /, "");
};
