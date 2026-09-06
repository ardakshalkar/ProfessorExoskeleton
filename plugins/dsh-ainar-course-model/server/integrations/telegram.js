/** Telegram publication through the authenticated shared backend. */
import { withIdentityClient, } from "../mcp/postgres-course-store.js";
export const READ_TELEGRAM_CHANNEL_SQL = `
SELECT channel.chat_id, channel.title
  FROM delivery.telegram_channels AS channel
  JOIN delivery.course_versions AS run ON run.id = channel.course_run_id
 WHERE run.code = $1
   AND channel.enabled = TRUE
`;
export class PostgresTelegramPublisher {
    pool;
    botToken;
    send;
    constructor(pool, botToken, send = fetch) {
        if (!botToken.trim())
            throw new Error("AINAR_TELEGRAM_BOT_TOKEN is required");
        this.pool = pool;
        this.botToken = botToken;
        this.send = send;
    }
    async channel(identity, courseVersionId) {
        return withIdentityClient(this.pool, identity, async (client) => {
            const result = await client.query(READ_TELEGRAM_CHANNEL_SQL, [courseVersionId]);
            const row = result.rows[0];
            if (!row) {
                throw new Error(`no enabled Telegram channel is configured for ${courseVersionId}`);
            }
            return { chatId: row.chat_id, title: row.title };
        });
    }
    async publish(identity, courseVersionId, message) {
        const channel = await this.channel(identity, courseVersionId);
        const response = await this.send(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                chat_id: channel.chatId,
                text: message,
                disable_web_page_preview: true,
            }),
        });
        const body = await response.json();
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
