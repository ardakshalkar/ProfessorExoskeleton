/** Human-confirmed Telegram publishing tool, available only on the shared backend. */
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { TelegramPublisher } from "../integrations/telegram.ts";
import type { ToolResult } from "./tools.ts";
export declare const TELEGRAM_TOOL: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            course_version_id: {
                type: string;
                description: string;
            };
            message: {
                type: string;
                description: string;
            };
            confirm: {
                type: string;
                description: string;
            };
        };
        required: string[];
        additionalProperties: boolean;
    };
};
export declare const callTelegramTool: (publisher: TelegramPublisher, authInfo: AuthInfo | undefined, args: Record<string, unknown>) => Promise<ToolResult>;
