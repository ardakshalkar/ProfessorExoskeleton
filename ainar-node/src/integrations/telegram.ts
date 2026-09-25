/** Telegram publication through the authenticated shared backend. */

import {
  type OAuthIdentity,
  type SqlPool,
  withIdentityClient,
} from "../store/postgres.ts";

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
  publish(
    identity: OAuthIdentity,
    courseVersionId: string,
    message: string,
  ): Promise<TelegramPublishResult>;
}

interface ChannelRow extends Record<string, unknown> {
  chat_id: string;
  title: string | null;
}

export const READ_TELEGRAM_CHANNEL_SQL = `
SELECT channel.chat_id, channel.title
  FROM delivery.telegram_channels AS channel
  JOIN delivery.course_versions AS run ON run.id = channel.course_run_id
 WHERE run.code = $1
   AND channel.enabled = TRUE
`;

type Fetch = typeof fetch;

export class PostgresTelegramPublisher implements TelegramPublisher {
  private readonly pool: SqlPool;
  private readonly botToken: string;
  private readonly send: Fetch;

  constructor(
    pool: SqlPool,
    botToken: string,
    send: Fetch = fetch,
  ) {
    if (!botToken.trim()) throw new Error("AINAR_TELEGRAM_BOT_TOKEN is required");
    this.pool = pool;
    this.botToken = botToken;
    this.send = send;
  }

  async channel(identity: OAuthIdentity, courseVersionId: string): Promise<TelegramChannel> {
    return withIdentityClient(this.pool, identity, async (client) => {
      const result = await client.query<ChannelRow>(READ_TELEGRAM_CHANNEL_SQL, [courseVersionId]);
      const row = result.rows[0];
      if (!row) {
        throw new Error(`no enabled Telegram channel is configured for ${courseVersionId}`);
      }
      return { chatId: row.chat_id, title: row.title };
    });
  }

  async publish(
    identity: OAuthIdentity,
    courseVersionId: string,
    message: string,
  ): Promise<TelegramPublishResult> {
    const channel = await this.channel(identity, courseVersionId);
    const response = await this.send(
      `https://api.telegram.org/bot${this.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: channel.chatId,
          text: message,
          disable_web_page_preview: true,
        }),
      },
    );
    const body = await response.json() as any;
    if (!response.ok || body?.ok !== true || !body?.result?.message_id) {
      throw new Error(`Telegram rejected the message: ${String(body?.description ?? response.status)}`);
    }
    return {
      ...channel,
      messageId: Number(body.result.message_id),
      sentAt: typeof body.result.date === "number" ? body.result.date : null,
    };
  }
}
