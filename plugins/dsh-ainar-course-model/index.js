/**
 * The AINAR course model as native DeepSeek Harness tools.
 *
 * The other route was MCP: `@deepseek-ai/dsh-mcp-client` spawning
 * `python -m ainar mcp` over stdio. It would work today with no code at all —
 * one row in `cordis.patch.yml` — and it is still the right choice for anyone
 * who wants the Python engine to be the one answering.
 *
 * This exists because that bridge carries Tools and nothing else. Our server
 * also serves `resources/list` and `resources/read`, and everything behind them
 * is the widgets: `vendor/ainar/mcp/widget-assets/` rendered per tool, bound by
 * `BY_TOOL`. Over the MCP client they are simply absent — not broken, not
 * degraded, absent — and the loss is silent at both ends.
 *
 * Registering natively keeps them reachable, because `defineTool` has a place
 * to put them (`presentationMeta`) and the MCP bridge has none.
 *
 * The cost is honest and worth stating: this runs `node/`, the TypeScript port,
 * not `ainar/`. The port is complete and `tests/test_yaml_parity.py` and
 * `tests/test_approve_parity.py` hold it to the Python behaviour — but Python
 * is still the authoritative implementation, and a divergence would show up
 * here first.
 *
 * Read-only throughout. Every tool in `TOOLS` reads a `CourseBundle` and
 * returns a payload; not one of them writes, approves, or touches a credential.
 * That is a property of the tool list, not of this file, which is why this file
 * does not try to enforce it.
 */
/// <reference path="./dsh-tools.d.ts" />
// `defineTool` is a module export of the host's tool package, not a method on
// `ctx.tools`. Reading it off the registry — which an earlier revision did —
// throws `defineTool is not a function` while applying, and a plugin that fails
// to apply fails the whole tree: the harness does not come up at all.
//
// The host is not a dependency of `node/`, so the import resolves at runtime
// from wherever `dsh` installed the bundle and is typed here by the ambient
// declaration referenced above. See `dsh-tools.d.ts` for why that is a
// declaration rather than a devDependency.
import { defineTool } from "@deepseek-ai/dsh-tools";
import { TOOLS } from "@ainar/core/src/tools/index.ts";
import { BY_TOOL } from "@ainar/core/src/tools/widgets.ts";
import { ToolError, Workspace, workspaceRootFor } from "@ainar/core/src/workspace.ts";
export const name = "ainar-course-model";
/**
 * Cordis waits for the tool registry before calling `apply`, so the plugin
 * never has to sequence its own boot. `ctx.tools.register` returns a disposer
 * attached to this plugin, which is what makes unloading actually unload.
 */
export const inject = ["tools"];
/**
 * The session's working directory off the run context, or `undefined`.
 *
 * Every hop is optional because a caller need not be an agent, and the value is
 * type-checked at the end because the declaration promises nothing about it. A
 * non-string reaching `workspaceRootFor` would be `resolve`'s problem, thrown
 * from inside a tool call and reported as a course error.
 */
const sessionCwd = (exec) => {
    const cwd = exec?.agent?.session?.header?.cwd;
    return typeof cwd === "string" && cwd.trim() ? cwd : undefined;
};
/** The JSON Schema keywords worth carrying across as they are.
 *
 * `items` in particular: without it `assessment_blueprint.outcomes` reaches the
 * model as a bare `array` and the element type the tool declared is thrown away
 * on the way. The host accepts that, so nothing complains — the model is simply
 * told less than the tool knows.
 */
const KEYWORDS = ["items", "enum", "const", "properties", "additionalProperties"];
/**
 * Our tools carry JSON Schema because that is what MCP speaks. DeepSeek Harness
 * wants a flat parameter map instead. The shapes are close enough that the
 * translation is mechanical, and doing it here rather than editing `tools.ts`
 * keeps one description of each tool for both hosts.
 *
 * Mechanical, but the host's schema DSL is stricter than "close enough"
 * suggests, and each violation is fatal at registration rather than local to one
 * parameter — so a single optional argument takes the whole harness down:
 *
 *   `required` must be `true` or absent. Writing `required: false` is rejected
 *   with "required must be true when present", and most parameters here are
 *   optional.
 *
 *   `description` must be a string or absent. Passing `undefined` through for a
 *   property that carries no description is rejected as "description annotation
 *   must be lossless JSON data".
 *
 * So: emit a key or omit it. Never emit a value the DSL refuses.
 */
const parameters = (tool) => {
    const properties = (tool.inputSchema.properties ?? {});
    const required = new Set(tool.inputSchema.required ?? []);
    const out = {};
    for (const [key, property] of Object.entries(properties)) {
        const parameter = { type: property.type ?? "string" };
        if (typeof property.description === "string") {
            parameter.description = property.description;
        }
        if (required.has(key))
            parameter.required = true;
        for (const keyword of KEYWORDS) {
            if (property[keyword] !== undefined)
                parameter[keyword] = property[keyword];
        }
        out[key] = parameter;
    }
    return out;
};
/**
 * Which workspace one tool call is about.
 *
 * The MCP server reads `AINAR_WORKSPACE` and nothing else, and gives a reason:
 * "an MCP client is not standing anywhere" — it is launched as a subprocess and
 * picks a working directory for its own purposes, so the walk `ainar`'s CLI
 * does from the working directory would resolve to noise.
 *
 * That reasoning does not transfer to this host. Here someone *is* standing
 * somewhere: the professor chose a workspace, dsh recorded it on the session,
 * and every tool call arrives with it in hand. So the order below is the CLI's
 * own, with the session's directory standing in for the professor's:
 *
 *   1. the workspace the session is standing in — what the sidebar says
 *   2. `AINAR_WORKSPACE` — for a caller with no session, or one standing
 *      outside any course repository
 *   3. neither, and then the failure names both, because either would fix it
 *
 * `cwd` reaches this from `exec.agent.session.header.cwd`, which is the field
 * `@deepseek-ai/dsh-tool-fs` reads to decide where a file tool looks. Using the
 * same one is the point: a course tool and `read_file` cannot then disagree
 * about which folder the professor is working in, and a course tool answering
 * about whichever course the variable named while the sidebar said another
 * would be wrong with nothing on screen to show it.
 *
 * Deliberately not resolved at load time. dsh picks its own working directory,
 * a session may outlive a `cd`, and the professor may switch workspaces without
 * restarting the harness.
 */
const resolveWorkspace = (cwd) => {
    const standing = workspaceRootFor(cwd);
    if (standing)
        return new Workspace(standing, "session");
    const value = (process.env.AINAR_WORKSPACE ?? "").trim();
    if (!value) {
        throw new ToolError("No course workspace. This session is not standing in a folder that holds " +
            "a courses/ directory, and AINAR_WORKSPACE is not set. Either open the " +
            "course folder as a workspace, or point the variable at the folder that " +
            "contains your courses/ directory — not at a course, and not at " +
            "unmodelled material.");
    }
    const fallback = workspaceRootFor(value);
    if (!fallback) {
        throw new ToolError(`AINAR_WORKSPACE points at ${value}, which is not a directory holding ` +
            "courses/ — and neither is anything above it.");
    }
    return new Workspace(fallback, "env");
};
const text = (value) => typeof value === "string" ? value : JSON.stringify(value, null, 2);
export function apply(ctx) {
    for (const tool of TOOLS) {
        const widget = BY_TOOL.get(tool.name);
        ctx.tools.register(defineTool({
            name: tool.name,
            description: tool.description,
            parameters: parameters(tool),
            output: {
                // The payload is the value; the text is one rendering of it. Keeping
                // the schema loose is deliberate — these tools return course-shaped
                // documents that already validate against `ainar/model/`, and a
                // second, thinner schema here would be a second thing to keep true.
                //
                // `json` is the DSL's any-value root, and it compiles to `{}`. An
                // earlier revision wrote `{ type: "object" }`, which the host rejects
                // outright because every explicit object must declare
                // `additionalProperties` — and which would still be wrong once
                // declared: the registry validates each returned value against this
                // schema, and not every tool here returns an object at its root.
                schema: { type: "json" },
                render: (_args, value) => [
                    { type: "text", text: text(value) },
                ],
                // Where the widgets survive. `toolMeta()` is the same descriptor the
                // MCP server attaches, so a host that knows how to render one gets
                // exactly what Claude Desktop and ChatGPT get. A host that does not
                // ignores an extra key, which is the failure mode you want: inert,
                // not broken.
                ...(widget ? { presentationMeta: () => widget.toolMeta() } : {}),
            },
            // `exec` is the run context the registry hands every tool, and the
            // session header on it is where the professor's workspace lives.
            // `undefined` reaching the resolver means exactly "nobody is standing
            // anywhere" — which is the case `AINAR_WORKSPACE` is for.
            async execute(args, exec) {
                return tool.handler(resolveWorkspace(sessionCwd(exec)), args ?? {});
            },
        }));
    }
}
