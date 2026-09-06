import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { expectJson } from "./http.ts";
import type { FetchLike, Publication, PublishResult, TelegramProfile } from "./types.ts";

export function telegramPlan(profile: TelegramProfile, publication: Publication) {
  const chatId = publication.chatId ?? profile.chatId;
  if (!chatId) throw new Error("Telegram publication needs chatId in the publication or profile");
  if (["message", "announcement"].includes(publication.kind)) {
    if (!publication.content) throw new Error("Telegram message needs content");
    return { method: "POST", apiMethod: "sendMessage", kind: publication.kind, chatId, parseMode: profile.parseMode };
  }
  if (publication.kind === "document") {
    if (!publication.filePath) throw new Error("Telegram document needs filePath");
    return { method: "POST", apiMethod: "sendDocument", kind: publication.kind, chatId, filePath: publication.filePath, parseMode: profile.parseMode };
  }
  throw new Error(`Telegram does not support publication kind ${publication.kind}`);
}

export async function publishTelegram(profile: TelegramProfile, token: string, publication: Publication, fetcher: FetchLike = fetch): Promise<PublishResult> {
  const plan = telegramPlan(profile, publication);
  const endpoint = `https://api.telegram.org/bot${token}/${plan.apiMethod}`;
  let response: Response;
  try {
    if (plan.apiMethod === "sendMessage") {
      const form = new URLSearchParams({ chat_id: plan.chatId, text: publication.content! });
      if (profile.parseMode) form.set("parse_mode", profile.parseMode);
      response = await fetcher(endpoint, { method: "POST", body: form });
    } else {
      const bytes = await readFile(publication.filePath!);
      const form = new FormData();
      form.set("chat_id", plan.chatId);
      form.set("document", new Blob([bytes]), publication.fileName ?? basename(publication.filePath!));
      if (publication.content) form.set("caption", publication.content);
      if (profile.parseMode) form.set("parse_mode", profile.parseMode);
      response = await fetcher(endpoint, { method: "POST", body: form });
    }
  } catch {
    throw new Error("Telegram request failed before a response was received");
  }
  const body = await expectJson(response, "Telegram");
  if (!body?.ok) throw new Error(`Telegram error: ${body?.description ?? "unknown response"}`);
  return { provider: "telegram", id: String(body.result?.message_id ?? ""), raw: body.result };
}

export async function doctorTelegram(_profile: TelegramProfile, token: string, fetcher: FetchLike = fetch): Promise<unknown> {
  const response = await fetcher(`https://api.telegram.org/bot${token}/getMe`);
  const body = await expectJson(response, "Telegram");
  if (!body?.ok) throw new Error(`Telegram error: ${body?.description ?? "unknown response"}`);
  return { provider: "telegram", ok: true, bot: body.result?.username ?? body.result?.id };
}
