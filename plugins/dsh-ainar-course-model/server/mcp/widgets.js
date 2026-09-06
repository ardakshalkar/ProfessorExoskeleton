/**
 * Inline UI for the tools. Ported from `ainar/mcp/widgets.py`.
 *
 * "Ported" overstates it, and that is the interesting part. The CSS and the
 * JavaScript are not here — they are plain files in `ainar/mcp/widget-assets/`,
 * and this module reads the same bytes the Python server reads. What was ported
 * is the assembly and the metadata, which is about eighty lines; the four
 * hundred lines of view code exist once.
 *
 * That was a deliberate departure from how the rest of this directory works.
 * `tools.ts` duplicates `tools.py` and `bin/golden-check.ts` proves the two
 * agree on every payload, which is the right bargain for code — two
 * implementations, one behaviour, checked. It is the wrong bargain for a style
 * sheet: there is no behaviour to check, so drift would be silent, and the
 * failure mode is a professor seeing one grid in ChatGPT and a different one in
 * Claude Desktop. `tests/test_mcp_widgets.py` compares the documents the two
 * servers emit byte for byte.
 *
 * What this server does **not** get is a widget for `assessment_rubric`, for the
 * same reason the Python one does not: that payload carries answer keys, and a
 * component draws itself the moment the model decides it is relevant, in a window
 * that gets screen-shared and projected.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
/**
 * Where the assets are, relative to wherever this module ended up.
 *
 * Three layouts are real and none is worth privileging. Trying each and naming
 * all of them in the failure beats one path that is right two times in three,
 * because the third time is inside a `.mcpb` on someone else's machine.
 */
const CANDIDATES = [
    // Running the TypeScript in place: node/src/mcp → repo root.
    "../../../ainar/mcp/widget-assets",
    // Running the compiled output: node/dist/src/mcp → repo root.
    "../../../../ainar/mcp/widget-assets",
    // Inside either bundle, two directories above the compiled `mcp/`. There is
    // no Python there to own the assets, so each builder copies them in — and
    // "two above" lands somewhere different in each, because the two bundles nest
    // the core to different depths:
    //
    //   .mcpb   `build_mcpb.py` copies node/dist    → server/src/mcp → server/
    //   dsh     `dsh.py` copies node/dist/src       → server/mcp     → <bundle>/
    //
    // Both builders put the assets where their own arithmetic lands. Reading this
    // line as "beside the server" and copying them under it is how the dsh bundle
    // once shipped with no reachable assets at all.
    "../../widget-assets",
];
const findAssets = () => {
    for (const candidate of CANDIDATES) {
        const path = resolve(HERE, candidate);
        if (existsSync(join(path, "manifest.json")))
            return path;
    }
    throw new Error("the widget assets are missing. Looked in:\n" +
        CANDIDATES.map((c) => `  ${resolve(HERE, c)}`).join("\n") +
        "\nThey are shared with the Python server and live in ainar/mcp/widget-assets/.");
};
const ASSETS = findAssets();
/**
 * An asset, with newlines normalised to `\n`.
 *
 * Python's `Path.read_text` translates line endings and `readFileSync` does not,
 * so on a checkout where git handed these files CRLF the two servers would emit
 * documents differing by 199 invisible bytes — which is exactly the drift the
 * byte-for-byte test exists to catch, reported as a mystery. Normalising here
 * costs nothing and does not depend on anyone's `core.autocrlf`.
 */
const read = (name) => readFileSync(join(ASSETS, name), "utf8").replace(/\r\n/g, "\n");
const MANIFEST = JSON.parse(read("manifest.json"));
/**
 * The wire MIME type for a component resource.
 *
 * The `ui` extension settled on a profile parameter over the older
 * `text/html+skybridge`, which ChatGPT still accepts. It comes from the manifest
 * so that a host wanting the other spelling is one edit for both servers.
 */
export const MIME = MANIFEST.mime;
/** `ui.resourceUri` is the standard key; this is the alias ChatGPT also honours. */
export const TEMPLATE_KEY = MANIFEST.templateKey;
const STYLE = read("shell.css");
const RUNTIME = read("runtime.js");
const ENGINE = read("template.js");
/**
 * `text` as a JavaScript double-quoted literal, byte for byte as Python writes it.
 *
 * `JSON.stringify` is not used, and neither is `json.dumps`: Python escapes
 * non-ASCII by default and ECMAScript never does, so a template with a `·` in it
 * would make the two documents differ. This escapes the four characters that
 * matter and leaves every other code point alone. It must stay identical to
 * `js_string` in `ainar/mcp/widgets.py` — a test compares the documents.
 */
const jsString = (text) => {
    let out = '"';
    for (const char of text) {
        if (char === "\\")
            out += "\\\\";
        else if (char === '"')
            out += '\\"';
        else if (char === "\n")
            out += "\\n";
        else if (char === "<")
            out += "\\u003c";
        else if (char.charCodeAt(0) < 0x20)
            out += "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0");
        else
            out += char;
    }
    return out + '"';
};
const build = (entry) => {
    const uri = `ui://ainar/${entry.name}.html`;
    const view = read(entry.view);
    const structure = entry.structure ? read(entry.structure) : "";
    const meta = () => ({
        ui: { prefersBorder: entry.prefersBorder, csp: entry.csp },
    });
    /**
     * One self-contained document: style, bands, template, view, runtime.
     *
     * The order is load-bearing — the runtime calls `view`, which reads `TEMPLATE`
     * and `BANDS`, so all of it must be defined before it runs — and it must match
     * `Widget.html` in `ainar/mcp/widgets.py` exactly, including the newlines. A
     * test compares them. The engine ships only in a document that uses one.
     */
    const html = () => {
        const bands = JSON.stringify(MANIFEST.bands.map(([floor, css]) => [floor, css]));
        const template = structure
            ? `const TEMPLATE = ${jsString(structure)};\n${ENGINE}\n`
            : "";
        return ('<div id="root"></div>' +
            `<style>\n${STYLE}</style>` +
            "<script>\n" +
            `const BANDS = ${bands};\n` +
            `${template}` +
            `${view}\n` +
            `${RUNTIME}` +
            "</script>");
    };
    return {
        name: entry.name,
        tool: entry.tool,
        title: entry.title,
        description: entry.description,
        uri,
        html,
        descriptor: () => ({
            uri,
            name: entry.name,
            title: entry.title,
            description: entry.description,
            mimeType: MIME,
            _meta: meta(),
        }),
        contents: () => ({ uri, mimeType: MIME, text: html(), _meta: meta() }),
        toolMeta: () => ({
            ui: { resourceUri: uri },
            [TEMPLATE_KEY]: uri,
            "openai/toolInvocation/invoking": entry.invoking,
            "openai/toolInvocation/invoked": entry.invoked,
        }),
    };
};
export const WIDGETS = MANIFEST.widgets.map(build);
export const BY_TOOL = new Map(WIDGETS.map((widget) => [widget.tool, widget]));
export const BY_URI = new Map(WIDGETS.map((widget) => [widget.uri, widget]));
