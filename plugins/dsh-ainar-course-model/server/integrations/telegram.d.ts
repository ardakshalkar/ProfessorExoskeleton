/** Telegram publication through the authenticated shared backend. */
import { type OAuthIdentity, type SqlPool } from "../mcp/postgres-course-store.ts";
export interface TelegramChannel {
    chatId: string;
    title: string | null;
}
export interface TelegramPublishResult extends TelegramChannel {
    messageId: number;
    sentAt: number | null;
}
export interface TelegramPublisher {
    channel(identity: OAuthIdentity, courseVersionId: string): Promise<TelegramChannel>;
    publish(identity: OAuthIdentity, courseVersionId: string, message: string): Promise<TelegramPublishResult>;
}
export declare const READ_TELEGRAM_CHANNEL_SQL = "\nSELECT channel.chat_id, channel.title\n  FROM delivery.telegram_channels AS channel\n  JOIN delivery.course_versions AS run ON run.id = channel.course_run_id\n WHERE run.code = $1\n   AND channel.enabled = TRUE\n";
type Fetch = typeof fetch;
export declare class PostgresTelegramPublisher implements TelegramPublisher {
    private readonly pool;
    private readonly botToken;
    private readonly send;
    constructor(pool: SqlPool, botToken: string, send?: Fetch);
    channel(identity: OAuthIdentity, courseVersionId: string): Promise<TelegramChannel>;
    publish(identity: OAuthIdentity, courseVersionId: string, message: string): Promise<TelegramPublishResult>;
}
export {};
