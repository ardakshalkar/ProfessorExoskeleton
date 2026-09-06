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
/**
 * The wire MIME type for a component resource.
 *
 * The `ui` extension settled on a profile parameter over the older
 * `text/html+skybridge`, which ChatGPT still accepts. It comes from the manifest
 * so that a host wanting the other spelling is one edit for both servers.
 */
export declare const MIME: string;
/** `ui.resourceUri` is the standard key; this is the alias ChatGPT also honours. */
export declare const TEMPLATE_KEY: string;
export interface Widget {
    name: string;
    tool: string;
    title: string;
    description: string;
    uri: string;
    html: () => string;
    descriptor: () => Record<string, unknown>;
    contents: () => Record<string, unknown>;
    toolMeta: () => Record<string, unknown>;
}
export declare const WIDGETS: Widget[];
export declare const BY_TOOL: Map<string, Widget>;
export declare const BY_URI: Map<string, Widget>;
