/**
 * Publishing: the one grammar, and the promotion it carries with it.
 *
 * Four things in this project reach an audience — the students' page, a
 * homework starter repository, an assessment's definition in Canvas, and a
 * Telegram announcement. They were four commands with four shapes, and each one
 * was preceded by a step the professor had to remember and perform somewhere
 * else: `ainar approve`, in a terminal, before the deck they had just drafted
 * could appear on the page at all.
 *
 * That step has not been removed. It has been **folded in**: `ainar publish`
 * runs the same gate, in the same order of operations (`runApproval` in
 * `approve.ts`), and then publishes. Two presses rather than two programs — a
 * plan that names what it would promote and what it would then publish, and a
 * `--confirm` that does both.
 *
 * ## What may be promoted this way, and what may never be
 *
 * `MATERIAL_COLLECTIONS` is the whole of the answer, and it is enforced in code
 * rather than asserted in prose: `runApproval` is handed that list, so a drafted
 * evaluation sitting in the same `work/<RUN>/` directory is not promoted, is not
 * validated against, and is named in the plan as left alone.
 *
 * The reason the line falls exactly there: a `Document` or a `Resource` is an
 * artefact — a deck, a handout, a brief. Publishing one IS the act of standing
 * behind it, and a professor who pressed *publish the course page* having read
 * what would go on it has made the decision the gate exists to capture. An
 * `Evaluation` is a judgement about a person, and nothing about pressing
 * *publish* says whether a suggested score is right. `ainar approve` remains
 * the only way one of those becomes a record, and the professor runs it.
 */

import { readFileSync } from "node:fs";
import { promoteIdentifier } from "./approve.ts";
import type { CourseBundle } from "./bundle.ts";
import { type Drafted, loadDrafts } from "./drafts.ts";
import { type Transport, TransportError, json } from "./lms/http.ts";
import { IssueList, describe } from "./issues.ts";
import { publishable } from "./page.ts";
import { describeLeak, scan } from "./safety.ts";

export const TARGETS = ["page", "homework", "canvas", "telegram"] as const;
export type Target = (typeof TARGETS)[number];

/**
 * The only draft collections a publication may promote on the professor's
 * behalf. See this file's header for why the line is here and not elsewhere.
 */
export const MATERIAL_COLLECTIONS = ["documents", "resources"] as const;

export const describeTarget = (target: Target): string =>
  ({
    page: "the students' course page",
    homework: "a homework starter repository on GitHub",
    canvas: "an assessment's definition in Canvas",
    telegram: "a course announcement on Telegram",
  })[target];

// --------------------------------------------------------------------------
// What a publication would promote
// --------------------------------------------------------------------------

export interface Promotion {
  collection: string;
  draftId: string;
  title: string;
  /**
   * The record this draft has already become, if it has.
   *
   * `ainar approve` leaves the drafts where they are and prints that they can
   * now be removed, which is fine for a command a professor runs once and then
   * tidies up after. It is not fine for a button: the second press would find
   * the same draft, promote it to an identifier the record already holds, and
   * refuse with `approve.collision` — four errors about a deck that is
   * published and correct. So a draft whose promoted identifier is already in
   * the course is reported here and rejected from the approval, and pressing
   * Publish twice publishes twice.
   */
  recordedAs: string | null;
}

export interface Pending {
  /** Material drafts this publication would promote. */
  promotions: Promotion[];
  /** Everything else in the drafts directory, by collection, left alone. */
  leftAlone: Map<string, number>;
  /** The drafts did not load. Publishing does not proceed past this. */
  errors: string[];
}

/** The promotions that still have something to do. */
export const outstanding = (pending: Pending): Promotion[] =>
  pending.promotions.filter((entry) => entry.recordedAs === null);

const TITLE_FIELDS = ["title", "name", "label"];

const titleOf = (record: Record<string, unknown>): string => {
  for (const field of TITLE_FIELDS) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "(untitled)";
};

/**
 * Read `work/<RUN>/` and say what a publication would promote out of it.
 *
 * This is the plan's first half and it writes nothing. It loads the drafts the
 * same way the gate does, so a directory that will not load fails here — in the
 * preview, where a professor is reading — rather than half way through a push
 * to GitHub.
 */
export const pendingMaterials = (draftsDir: string, bundle?: CourseBundle): Pending => {
  const issues = new IssueList();
  const loaded = loadDrafts(draftsDir, issues) as Drafted;
  if (issues.errors.length) {
    return {
      promotions: [],
      leftAlone: new Map(),
      errors: issues.errors.map((issue) => describe(issue)),
    };
  }

  const already = new Set<string>();
  for (const collection of MATERIAL_COLLECTIONS) {
    const field = collection === "documents" ? "document_id" : "resource_id";
    for (const record of ((bundle ?? {}) as Record<string, unknown>)[collection] as
      | Record<string, unknown>[]
      | undefined ?? []) {
      const value = record[field];
      if (typeof value === "string") already.add(value);
    }
  }

  const drafted = loaded as unknown as Record<string, Record<string, unknown>[]>;
  const allowed = new Set<string>(MATERIAL_COLLECTIONS);
  const promotions: Promotion[] = [];
  const leftAlone = new Map<string, number>();
  for (const [collection, records] of Object.entries(drafted)) {
    if (!records || !records.length) continue;
    if (!allowed.has(collection)) {
      leftAlone.set(collection, records.length);
      continue;
    }
    const idField = collection === "documents" ? "document_id" : "resource_id";
    for (const record of records) {
      const draftId = String(record[idField] ?? "(no id)");
      const promoted = promoteIdentifier(draftId);
      promotions.push({
        collection,
        draftId,
        title: titleOf(record),
        recordedAs: already.has(promoted) ? promoted : null,
      });
    }
  }
  return { promotions, leftAlone, errors: [] };
};

// --------------------------------------------------------------------------
// What the page would carry
// --------------------------------------------------------------------------

export interface PagePlan {
  /** Materials that would be copied beside the page. */
  publishing: { documentId: string; title: string; filename: string }[];
  /** Materials that would not, and why — the model's own sentences. */
  heldBack: string[];
  /** Whole categories excluded by rule: student work, object storage. */
  tally: Record<string, number>;
}

/**
 * The page's own half of the plan, computed over the record as it stands.
 *
 * Deliberately NOT over the merge. A promotion moves a material out of `work/`,
 * so what it would publish is a question about the record after promoting, and
 * the honest way to answer it before promoting is to name the promotions
 * separately — which `pendingMaterials` does. A merged answer would read as
 * though the file were already where it will be, which is the one thing a
 * preview must not do.
 */
export const pagePlan = (
  bundle: CourseBundle,
  courseVersionId: string,
  root: string,
  holdBack?: Map<string, string>,
): PagePlan => {
  const { published, heldBack, tally } = publishable(bundle, courseVersionId, root, holdBack);
  return {
    publishing: published.map((material) => ({
      documentId: material.documentId,
      title: material.title,
      filename: material.filename,
    })),
    heldBack,
    tally,
  };
};

// --------------------------------------------------------------------------
// Telegram
// --------------------------------------------------------------------------

export const TELEGRAM_LIMIT = 4096;

export interface Announcement {
  text: string;
  refusals: string[];
  warnings: string[];
}

/**
 * An announcement, checked before anybody can press send.
 *
 * Three refusals, each of them a thing that cannot be taken back once a channel
 * of students has seen it:
 *
 * * **an answer.** The same scan `ainar page` runs over every file it copies,
 *   run over the message text. It is given the run's whole item set rather than
 *   one assessment's, which `safety.ts` says only makes it stricter.
 * * **a student's identifier.** An announcement is the one surface where every
 *   reader is a different student, so `STUDENT-…` in the text is refused
 *   outright. A real name the professor typed is beyond what this can detect,
 *   which is why the message is theirs to read before sending.
 * * **nothing, or more than Telegram accepts.** Length is checked here rather
 *   than discovered as a 400 from the Bot API.
 */
export const checkAnnouncement = (text: string, items: unknown[]): Announcement => {
  const refusals: string[] = [];
  const warnings: string[] = [];
  const trimmed = text.trim();

  if (!trimmed) refusals.push("the message is empty");
  if (trimmed.length > TELEGRAM_LIMIT) {
    refusals.push(
      `the message is ${trimmed.length} characters and Telegram accepts ${TELEGRAM_LIMIT}`,
    );
  }

  const result = scan(trimmed, items as never[]);
  for (const leak of result.leaks) refusals.push(`it carries an answer — ${describeLeak(leak)}`);
  if (result.unchecked.length) {
    warnings.push(
      `the answer scan could not cover ${result.unchecked.length} recorded answer(s): ` +
        result.unchecked.join(", "),
    );
  }

  const student = /STUDENT-[A-Za-z0-9]+/.exec(trimmed);
  if (student) {
    refusals.push(`it names ${student[0]}, and an announcement goes to everybody in the channel`);
  }

  return { text: trimmed, refusals, warnings };
};

export interface Channel {
  chatId: string;
  /** What the Bot API calls the chat, when it answered. */
  title: string | null;
}

/**
 * Ask Telegram what the channel is, without posting to it.
 *
 * `getChat` is the preview: it proves the token works and that the bot can see
 * the chat, and it says which chat by name — the fact a professor about to
 * announce something needs, because a chat id is unreadable and a message sent
 * to last term's channel cannot be recalled.
 */
export const readChannel = async (
  token: string,
  chatId: string,
  transport: Transport,
): Promise<Channel> => {
  const response = await transport.request(
    "GET",
    `https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`,
    { headers: { Accept: "application/json" } },
  );
  const payload = json(response) ?? {};
  if (response.status < 200 || response.status >= 300 || payload.ok !== true) {
    throw new TransportError(
      `Telegram refused to describe ${chatId}: ${payload.description ?? response.status}`,
    );
  }
  const chat = payload.result ?? {};
  return { chatId, title: chat.title ?? chat.username ?? null };
};

/** Send one plain-text message. The only thing in this file that reaches a student. */
export const sendAnnouncement = async (
  token: string,
  chatId: string,
  text: string,
  transport: Transport,
): Promise<number> => {
  const body = new TextEncoder().encode(
    JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  );
  const response = await transport.request("POST", `https://api.telegram.org/bot${token}/sendMessage`, {
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body,
  });
  const payload = json(response) ?? {};
  if (response.status < 200 || response.status >= 300 || payload.ok !== true) {
    throw new TransportError(`Telegram rejected the message: ${payload.description ?? response.status}`);
  }
  return Number(payload.result?.message_id ?? 0);
};

/**
 * The message text, from a file or from the argument.
 *
 * A file, because a shell eats newlines and an announcement is several lines;
 * the argument, because one line is the common case. Never composed here: what
 * students are told is the professor's own words, and a command that could
 * write them would be a command that could get them wrong.
 */
export const announcementText = (message: string | undefined, file: string | undefined): string => {
  if (message && file) throw new Error("--message and --message-file are alternatives; pass one");
  if (file) return readFileSync(file, "utf-8");
  if (message) return message;
  throw new Error("nothing to announce: pass --message TEXT or --message-file PATH");
};

// --------------------------------------------------------------------------
// Plan text
// --------------------------------------------------------------------------

/**
 * The plan every target prints before it does anything.
 *
 * One shape for all four, because the professor's question is the same each
 * time and a different layout per target is how a line gets skimmed: what would
 * be promoted, what would then happen, and what would not.
 */
export const publishPlan = (options: {
  target: Target;
  pending: Pending;
  actions: string[];
  refusals: string[];
}): string[] => {
  const { target, pending, actions, refusals } = options;
  const lines: string[] = [];

  const todo = outstanding(pending);
  if (todo.length) {
    lines.push(`Would promote ${todo.length} drafted material(s) first:`);
    for (const promotion of todo) {
      lines.push(`  ${promotion.draftId}  ${promotion.title}`);
    }
  } else {
    lines.push("Nothing drafted to promote — the record already holds what this publishes.");
  }

  for (const promotion of pending.promotions) {
    if (promotion.recordedAs === null) continue;
    lines.push(`  ${promotion.draftId} is already ${promotion.recordedAs} in the course — left as it is`);
  }

  for (const [collection, count] of pending.leftAlone) {
    lines.push(`  left alone: ${count} draft(s) in ${collection}, which publishing does not promote`);
  }

  lines.push("");
  lines.push(`Would then publish ${describeTarget(target)}:`);
  for (const action of actions) lines.push(`  ${action}`);

  if (refusals.length) {
    lines.push("");
    lines.push("It would refuse:");
    for (const refusal of refusals) lines.push(`  ${refusal}`);
  }

  return lines;
};
