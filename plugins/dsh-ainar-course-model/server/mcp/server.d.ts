/** Shared MCP protocol surface for both local stdio and remote HTTP transports. */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { TelegramPublisher } from "../integrations/telegram.ts";
import type { Workspace } from "./workspace.ts";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
export type WorkspaceProvider = Workspace | ((authInfo?: AuthInfo) => Workspace | Promise<Workspace>);
/**
 * Build one MCP server definition. Transports only decide where it runs; they
 * do not get separate tool lists or semantics.
 */
export declare const createAinarMcpServer: (provider: WorkspaceProvider, integrations?: {
    telegram?: TelegramPublisher;
}) => Server;
