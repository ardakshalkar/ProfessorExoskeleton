/**
 * The fourteen portable read-only tools. Ported from `ainar/mcp/tools.py`.
 *
 * What is **not** here is the point of the file. `approve`, `lms push`,
 * `roster whois` and the rest are absent by construction, not disabled by a
 * flag — a rule in CLAUDE.md is an instruction to a model, and a verb that does
 * not exist is not. `WITHHELD` records each omission with its reason so the
 * list cannot quietly shrink. Shared-backend integrations are added separately
 * by `server.ts`; they never appear in the local stdio or MCPB surface.
 */
import { Workspace } from "./workspace.ts";
export declare const WITHHELD: Record<string, string>;
declare const schema: (properties: object, required?: string[]) => {
    type: "object";
    properties: object;
    required: string[];
    additionalProperties: boolean;
};
export interface Tool {
    name: string;
    description: string;
    inputSchema: ReturnType<typeof schema>;
    handler: (workspace: Workspace, args: Record<string, unknown>) => unknown;
}
export declare const TOOLS: Tool[];
export interface ToolResult {
    content: {
        type: "text";
        text: string;
    }[];
    structuredContent?: unknown;
    _meta?: Record<string, unknown>;
    isError?: boolean;
}
/**
 * One tool call, as text for the model and — where there is one — structure.
 *
 * `structuredContent` is not decoration. A widget is handed it through
 * `window.openai.toolOutput` and renders it; without it a component gets nothing
 * to draw. A markdown-producing tool has no structure to give, so it returns text
 * alone, which is also why `syllabus` and `alignment_report` have no widget.
 *
 * The `_meta` repeats the template URI. The declaration on the tool definition is
 * what the specification requires; some hosts read it from the result instead,
 * and saying it twice costs one key.
 */
export declare const callTool: (workspace: Workspace, name: string, args: Record<string, unknown>) => ToolResult;
export {};
