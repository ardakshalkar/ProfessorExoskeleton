/** Human-confirmed Telegram publishing tool, available only on the shared backend. */
export const TELEGRAM_TOOL = {
    name: "publish_telegram",
    description: "Preview or publish one plain-text course announcement to the Telegram channel configured for a course run. Publishing is student-visible and requires explicit professor confirmation in the current request.",
    inputSchema: {
        type: "object",
        properties: {
            course_version_id: { type: "string", description: "Course run id" },
            message: { type: "string", description: "Exact student-facing plain text, maximum 4096 characters" },
            confirm: { type: "boolean", description: "False previews the channel; true sends one message" },
        },
        required: ["course_version_id", "message", "confirm"],
        additionalProperties: false,
    },
};
const result = (payload) => ({
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
});
export const callTelegramTool = async (publisher, authInfo, args) => {
    if (!authInfo)
        throw new Error("Telegram publishing requires OAuth");
    if (!authInfo.scopes.includes("integrations:publish")) {
        throw new Error("Telegram publishing requires the integrations:publish scope");
    }
    const courseVersionId = String(args.course_version_id ?? "").trim();
    const message = String(args.message ?? "").trim();
    if (!courseVersionId)
        throw new Error("course_version_id is required");
    if (!message)
        throw new Error("message is required");
    if (message.length > 4096)
        throw new Error("Telegram messages may not exceed 4096 characters");
    const identity = {
        issuer: String(authInfo.extra?.issuer ?? ""),
        subject: String(authInfo.extra?.subject ?? ""),
    };
    if (!identity.issuer || !identity.subject)
        throw new Error("OAuth identity is incomplete");
    if (args.confirm !== true) {
        const channel = await publisher.channel(identity, courseVersionId);
        return result({
            published: false,
            course_version_id: courseVersionId,
            channel: { chat_id: channel.chatId, title: channel.title },
            message,
        });
    }
    const published = await publisher.publish(identity, courseVersionId, message);
    return result({
        published: true,
        course_version_id: courseVersionId,
        channel: { chat_id: published.chatId, title: published.title },
        telegram_message_id: published.messageId,
        sent_at: published.sentAt,
    });
};
