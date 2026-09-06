/** Shared MCP protocol surface for both local stdio and remote HTTP transports. */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { TOOLS, callTool } from "./tools.js";
import { TELEGRAM_TOOL, callTelegramTool } from "./telegram-tool.js";
import { BY_TOOL, BY_URI, WIDGETS } from "./widgets.js";
const resolveWorkspace = async (provider, authInfo) => typeof provider === "function" ? await provider(authInfo) : provider;
/**
 * Build one MCP server definition. Transports only decide where it runs; they
 * do not get separate tool lists or semantics.
 */
export const createAinarMcpServer = (provider, integrations = {}) => {
    const server = new Server({ name: "ainar", version: "0.1.0" }, {
        capabilities: {
            tools: {},
            resources: { listChanged: false, subscribe: false },
        },
    });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
            ...TOOLS.map(({ name, description, inputSchema }) => {
                const widget = BY_TOOL.get(name);
                return widget
                    ? { name, description, inputSchema, _meta: widget.toolMeta() }
                    : { name, description, inputSchema };
            }),
            ...(integrations.telegram ? [TELEGRAM_TOOL] : []),
        ],
    }));
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
        resources: WIDGETS.map((widget) => widget.descriptor()),
    }));
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const widget = BY_URI.get(request.params.uri);
        if (!widget) {
            throw new Error(`no such resource: ${request.params.uri}. Available: ` +
                [...BY_URI.keys()].sort().join(", "));
        }
        return { contents: [widget.contents()] };
    });
    server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
        const args = (request.params.arguments ?? {});
        if (request.params.name === TELEGRAM_TOOL.name && integrations.telegram) {
            return callTelegramTool(integrations.telegram, extra.authInfo, args);
        }
        return callTool(await resolveWorkspace(provider, extra.authInfo), request.params.name, args);
    });
    return server;
};
