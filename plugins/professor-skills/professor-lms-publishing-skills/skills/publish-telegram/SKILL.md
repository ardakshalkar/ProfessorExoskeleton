---
name: publish-telegram
description: Preview and publish professor-approved messages or documents to a Telegram channel or group through a bot. Use when the user asks to post a course announcement or file to Telegram; do not use for private student data.
---

# Publish to Telegram

Use the bundled `prof-publish` CLI. A bot must already have permission to post
at the configured `chatId`.

1. Prepare JSON with `kind: "message"` and `content`, or `kind: "document"`,
   `filePath`, and optional `content` caption. `chatId` may override the profile.
   Respect the profile's `parseMode` (`HTML` or `MarkdownV2`).
2. Keep grades, submissions, private feedback, and identified student data out
   of channel publications.
3. Run `prof-publish plan --profile NAME --input FILE` and show the destination,
   kind, and non-secret content summary to the professor.
4. Only after explicit approval for that exact message/file, run
   `prof-publish publish --profile NAME --input FILE --confirm`.
5. Report the Telegram message ID. Never retry an ambiguous write automatically.

Use `prof-publish doctor --profile NAME` for the read-only Bot API `getMe` check.
