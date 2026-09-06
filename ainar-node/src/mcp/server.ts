/** Shared MCP protocol surface for both local stdio and remote HTTP transports. */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOLS, callTool } from "./tools.ts";
import type { TelegramPublisher } from "../integrations/telegram.ts";
import { TELEGRAM_TOOL, callTelegramTool } from "./telegram-tool.ts";
import { BY_TOOL, BY_URI, WIDGETS } from "./widgets.ts";
import type { Workspace } from "./workspace.ts";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

export type WorkspaceProvider =
  | Workspace
  | ((authInfo?: AuthInfo) => Workspace | Promise<Workspace>);

const resolveWorkspace = async (
  provider: WorkspaceProvider,
  authInfo?: AuthInfo,
): Promise<Workspace> => typeof provider === "function" ? await provider(authInfo) : provider;

/**
 * Build one MCP server definition. Transports only decide where it runs; they
 * do not get separate tool lists or semantics.
 */
export const createAinarMcpServer = (
  provider: WorkspaceProvider,
  integrations: { telegram?: TelegramPublisher } = {},
): Server => {
  const server = new Server(
    { name: "ainar", version: "0.1.0" },
    {
      capabilities: {
        tools: {},
        resources: { listChanged: false, subscribe: false },
      },
    },
  );

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
      throw new Error(
        `no such resource: ${request.params.uri}. Available: ` +
          [...BY_URI.keys()].sort().join(", "),
      );
    }
    return { contents: [widget.contents()] };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    if (request.params.name === TELEGRAM_TOOL.name && integrations.telegram) {
      return callTelegramTool(integrations.telegram, extra.authInfo, args);
    }
    return callTool(await resolveWorkspace(provider, extra.authInfo), request.params.name, args);
  });

  return server;
};
