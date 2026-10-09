/**
 * One road between this run and a service outside it, described the same way
 * for every service.
 *
 * Before this, each integration kept its settings somewhere of its own —
 * `extensions.lms` on the run and the assessment, `~/.ainar/sheets/RUN.json`,
 * the run's `extensions.telegram` — and each had its own idea of which way data
 * went, how a person was found, and who won a disagreement. A `Sync` says all
 * of that in one vocabulary, borrowed from tools that already settled it:
 * Airbyte's source and destination, Census's write behaviours, OneRoster's
 * stable identifiers, Canvas SIS stickiness.
 *
 * It lives on the run, in the repository, because it holds neither names nor
 * secrets: a connection NAME (the address and the credential's variable are in
 * `~/.ainar/connections.json`), a sheet id, a column map. Which person a row
 * is — a pin, an anchor, a Canvas user id — is a link, and links are private:
 * `src/sync/links.ts`.
 */

import { z } from "zod";
import { entity } from "./common.ts";

/** `hw-sheet`, `canvas-grades`: lower case, short, stable — the ledger and the links are keyed by it. */
export const SyncId = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);

/** Which service, matching the connection types in `src/connections/`. */
export const SyncService = z.enum(["canvas", "sheets", "telegram", "github", "moodle", "file"]);

/**
 * Which way data goes. `source` feeds the course; `target` is fed by it;
 * `both` does each, deciding per value by what changed since the last sync —
 * one side changed, it wins; both changed, the value is held for a person.
 */
export const SyncRole = z.enum(["source", "target", "both"]);

/** What kind of thing moves. */
export const SyncStream = z.enum([
  "roster", "submissions", "marks", "grades", "assignment", "announcement", "repo", "page",
]);

/**
 * How a row on the far side is found to be one of our students, tried in the
 * order written. The first that succeeds is saved as a link, so the next sync
 * starts with `link` and a name is only ever how a person is found once.
 *
 * `code` is a row that already carries `STUDENT-…`; `key:*` is an identifier
 * the private roster holds; `name` is the roster's name matcher, `name:one-word`
 * the same allowing a single written word.
 */
export const SyncMatch = z.enum([
  "link", "anchor", "code", "key:sis-id", "key:login", "key:email", "key:number", "name", "name:one-word",
]);

/**
 * A match the matcher is not sure of — a close spelling, a single word. `hold`
 * writes nothing for it until a person confirms; `ask` writes it and lists it.
 */
export const SyncUnsure = z.enum(["hold", "ask"]);

/** How the receiving side is changed. `mirror` also removes what the sending side no longer has. */
export const SyncWrite = z.enum(["upsert", "update-only", "create-only", "mirror", "append"]);

/**
 * What may be removed, kept apart from `write` so a delete is never a side
 * effect. `own` is only what this sync itself wrote.
 */
export const SyncRemove = z.enum(["never", "own", "mark-dropped"]);

/**
 * When the far side changed since this sync last wrote it. `refuse` holds it
 * for a person; `fill-blanks` writes only where the receiving side is empty.
 */
export const SyncConflict = z.enum(["refuse", "course-wins", "remote-wins", "fill-blanks"]);

export const Sync = entity({
  sync_id: SyncId,
  service: SyncService,
  /** A connection's name in the registry; absent, the service's default connection. */
  connection: z.string().nullish(),
  role: SyncRole,
  stream: SyncStream,
  /**
   * Where on the far side: `{sheet, tab}`, `{canvas_course}`, `{chat}`,
   * `{repo}`. Service-specific; `validate` checks the keys each one needs.
   */
  where: z.record(z.string(), z.unknown()).default({}),
  match: z.array(SyncMatch).default([]),
  unsure: SyncUnsure.default("hold"),
  write: SyncWrite.default("upsert"),
  remove: SyncRemove.default("never"),
  conflict: SyncConflict.default("refuse"),
  /**
   * What corresponds to what: `columns` (header → assessment), `marks`
   * (word → factor), `rows` (which header holds the name). Service-specific.
   */
  map: z.record(z.string(), z.unknown()).default({}),
  /**
   * Leave an invisible tag on each row and column the sync has matched, so a
   * renamed header, a retyped name or a sorted sheet is still found. Writes
   * into the far side, so it is off until asked for. The tag is random; which
   * student it is stays in the private links.
   */
  anchors: z.boolean().default(false),
  enabled: z.boolean().default(true),
  description: z.string().nullish(),
});

export type SyncSpec = z.infer<typeof Sync>;
