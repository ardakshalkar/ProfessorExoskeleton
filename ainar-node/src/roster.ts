/**
 * Roster import, and the boundary that keeps students out of the repository.
 * Ported from `ainar/roster.py`.
 *
 * Course content is meant to be reviewable, diffable and shareable. Student
 * identities are none of those things. So the repository holds **only**
 * pseudonymous identifiers, and the mapping back to real people lives outside
 * it, in a directory the professor controls.
 *
 *     Platonus export  ──►  ainar roster import  ──┬─►  enrollments.yaml  (in the
 *                                                  │     repo, pseudonyms only)
 *                                                  └─►  ~/.ainar/roster/   (outside
 *                                                        the repo, never committed)
 *
 * Pseudonyms are derived by HMAC from a secret salt, so they are:
 *
 * * **stable across course runs** — the same student keeps the same identifier
 *   in every course, which is what makes a capability map possible at all;
 * * **not reversible** without the salt — a plain hash of an eight-digit
 *   student number would be brute-forced in seconds.
 *
 * Lose the salt and you lose the ability to say who `STUDENT-A3F9K2` is. That
 * is the intended failure mode: the repository alone must never be enough.
 *
 * ## Why this port needed proving rather than writing
 *
 * `bin/ainar.ts` refused this command with a reason: "a derivation that differs
 * by a byte would silently break every cross-course identity, so there is one
 * implementation of it and it is Python's." The refusal was right about the
 * hazard and wrong about the remedy — a second implementation is safe exactly
 * when it is pinned to the same public standards, and both halves of the
 * derivation are public standards:
 *
 *   * HMAC-SHA256, which `node:crypto` and `hmac`+`hashlib` both implement
 *     against RFC 4231;
 *   * base32 as RFC 4648 §6, which is what `base64.b32encode` emits.
 *
 * So `test/roster.test.ts` holds the RFC 4648 §10 vectors for the encoder and
 * fixed HMAC vectors for the whole derivation. If either implementation drifts,
 * a test fails rather than a student silently acquiring a second identity.
 *
 * ## Two deliberate divergences from `roster.py`
 *
 * 1. **Enrollments are written to `versions/<term>/enrollments.yaml`**, where
 *    the loader reads them (`RECORD_GLOBS.enrollments`). Python still writes
 *    `runs/<term>/enrollments.yaml`, which is the layout from before version
 *    and run were merged into one `CourseVersion` — a file written there today
 *    is a file nothing loads.
 * 2. **`status` counts runs from `runs`, which is the key `record()` writes.**
 *    Python reads `person.get("versions", [])` there, so its "course runs" line
 *    is always empty. Same bug, reported once, not carried across.
 *
 * One capability is missing rather than diverged: `.xlsx` input. Python reads
 * it through openpyxl and exits with instructions when that is absent; there is
 * no equivalent here and no dependency worth adding for it, so an `.xlsx` path
 * is refused with the same instruction — export the sheet as CSV.
 */

import { createHmac, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve, sep } from "node:path";

/** base32, with no 0/1/8/9 to confuse for O/I/B/g. */
export const PSEUDONYM_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const PSEUDONYM_LENGTH = 6;
export const STORE_VERSION = 1;

/** Header names recognised without being told, lowercased and stripped. */
export const ID_HEADERS = [
  "student_id", "id", "studentid", "student number", "student no", "iin",
  "barcode", "номер", "id студента", "студент", "жеке нөмірі",
];
export const NAME_HEADERS = [
  "name", "full_name", "fullname", "student", "student_name", "fio",
  "ф.и.о.", "фио", "имя", "аты-жөні",
];
export const EMAIL_HEADERS = ["email", "e-mail", "mail", "почта"];
export const GROUP_HEADERS = ["group", "section", "cohort", "группа", "топ"];

// --------------------------------------------------------------------------
// The derivation
// --------------------------------------------------------------------------

/**
 * RFC 4648 §6 base32, byte for byte what `base64.b32encode` returns.
 *
 * Written out rather than borrowed: this is the one function whose output a
 * student's identity depends on, and a package that quietly switched to
 * Crockford's alphabet or dropped padding would change every pseudonym in
 * every course with nothing to show for it in a diff.
 */
export const b32encode = (bytes: Uint8Array): string => {
  let out = "";
  for (let index = 0; index < bytes.length; index += 5) {
    const chunk = bytes.subarray(index, index + 5);
    // Five bytes become eight characters; a short final chunk is zero-filled
    // and the characters it did not fill become `=`.
    let bits = 0n;
    for (let byte = 0; byte < 5; byte += 1) bits = (bits << 8n) | BigInt(chunk[byte] ?? 0);
    const filled = Math.ceil((chunk.length * 8) / 5);
    for (let position = 0; position < 8; position += 1) {
      const value = Number((bits >> BigInt(5 * (7 - position))) & 31n);
      out += position < filled ? PSEUDONYM_ALPHABET[value] : "=";
    }
  }
  return out;
};

/** A stable, non-reversible identifier for one person. */
export const pseudonym = (institutionalId: string, salt: Uint8Array): string => {
  const digest = createHmac("sha256", salt).update(institutionalId.trim(), "utf8").digest();
  const encoded = b32encode(digest);
  let body = "";
  for (const character of encoded) {
    if (body.length >= PSEUDONYM_LENGTH) break;
    if (PSEUDONYM_ALPHABET.includes(character)) body += character;
  }
  return `STUDENT-${body}`;
};

/** Where the identity mapping lives. Never inside the repository. */
export const rosterDir = (explicit?: string | null): string => {
  const expand = (value: string): string =>
    value.startsWith("~") ? resolve(homedir(), value.slice(1).replace(/^[\\/]/, "")) : resolve(value);
  if (explicit) return expand(explicit);
  const fromEnv = (process.env.AINAR_ROSTER_DIR ?? "").trim();
  if (fromEnv) return expand(fromEnv);
  return join(homedir(), ".ainar", "roster");
};

/**
 * Owner-only, where the filesystem has an opinion.
 *
 * `chmod` on Windows sets the read-only bit and nothing about other users, so
 * this is a no-op there rather than a protection. The protection that does hold
 * on every platform is the location: outside the repository, so no commit, push
 * or archive can carry it.
 */
const restrict = (path: string): void => {
  try {
    chmodSync(path, 0o600);
  } catch {
    // A filesystem without POSIX permissions. The path is the protection.
  }
};

/** Read the pseudonym salt, creating one on first use. */
export const loadSalt = (directory: string, options: { create?: boolean } = {}): Buffer => {
  const path = join(directory, "salt");
  if (existsSync(path) && statSync(path).isFile()) {
    return Buffer.from(readFileSync(path, "utf-8").trim(), "hex");
  }
  if (options.create === false) {
    throw new Error(
      `no salt at ${path} — run \`ainar roster import\` first, or point ` +
        "--roster-dir at the directory holding it",
    );
  }
  mkdirSync(directory, { recursive: true });
  const salt = randomBytes(32);
  writeFileSync(path, salt.toString("hex") + "\n", { encoding: "utf-8" });
  restrict(path);
  return salt;
};

// --------------------------------------------------------------------------
// The private store
// --------------------------------------------------------------------------

export interface Person {
  institutional_id?: string;
  name?: string;
  email?: string;
  first_seen?: string;
  runs?: string[];
  [key: string]: unknown;
}

/** `json.dumps(..., sort_keys=True)` sorts every mapping, not just the top. */
const sortDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
};

export class RosterStore {
  readonly directory: string;
  people: Record<string, Person>;

  constructor(directory: string, people: Record<string, Person> = {}) {
    this.directory = directory;
    this.people = people;
  }

  get path(): string {
    return join(this.directory, "people.json");
  }

  static load(directory: string): RosterStore {
    const store = new RosterStore(directory);
    if (existsSync(store.path) && statSync(store.path).isFile()) {
      const payload = JSON.parse(readFileSync(store.path, "utf-8"));
      store.people = payload.people ?? {};
    }
    return store;
  }

  save(): string {
    mkdirSync(this.directory, { recursive: true });
    const payload = sortDeep({ version: STORE_VERSION, people: this.people });
    writeFileSync(this.path, JSON.stringify(payload, null, 2) + "\n", { encoding: "utf-8" });
    restrict(this.path);
    return this.path;
  }

  byInstitutionalId(): Map<string, string> {
    const out = new Map<string, string>();
    for (const [studentId, person] of Object.entries(this.people)) {
      if (person.institutional_id) out.set(person.institutional_id, studentId);
    }
    return out;
  }

  /** Add or update one person. Returns true when newly added. */
  record(studentId: string, person: Person, courseVersionId: string, today: string): boolean {
    const existing = this.people[studentId];
    if (existing === undefined) {
      this.people[studentId] = { ...person, runs: [courseVersionId], first_seen: person.first_seen ?? today };
      return true;
    }
    for (const [key, value] of Object.entries(person)) {
      // Falsy means "the export did not carry this", which must not erase what
      // an earlier import knew. Same test as Python's `if value:`.
      if (value) existing[key] = value;
    }
    const runs = (existing.runs ??= []);
    if (!runs.includes(courseVersionId)) runs.push(courseVersionId);
    return false;
  }

  whois(studentId: string): Person | null {
    return this.people[studentId] ?? null;
  }
}

// --------------------------------------------------------------------------
// Reading the export
// --------------------------------------------------------------------------

const matchHeader = (headers: string[], candidates: string[]): string | null => {
  const lowered = new Map<string, string>();
  for (const header of headers) {
    if (header) lowered.set(header.trim().toLowerCase(), header);
  }
  for (const candidate of candidates) {
    const hit = lowered.get(candidate);
    if (hit !== undefined) return hit;
  }
  for (const [key, original] of lowered) {
    if (candidates.some((candidate) => key.includes(candidate))) return original;
  }
  return null;
};

/**
 * Which character separates the fields.
 *
 * Python hands this to `csv.Sniffer`, which is a heuristic over the whole
 * sample; this counts each candidate in the header line, outside quotes, and
 * takes the most frequent. The two agree on every export shaped like a table
 * and this one is easier to predict when they would not — `--delimiter`
 * settles it either way.
 */
export const sniffDelimiter = (headerLine: string): string => {
  let best = ",";
  let bestCount = 0;
  for (const candidate of [",", ";", "\t"]) {
    let count = 0;
    let quoted = false;
    for (const character of headerLine) {
      if (character === '"') quoted = !quoted;
      else if (character === candidate && !quoted) count += 1;
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
};

/** RFC 4180: quoted fields may hold the delimiter, newlines and doubled quotes. */
export const parseDelimited = (text: string, delimiter: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let index = 0;
  const push = (): void => {
    row.push(field);
    field = "";
  };
  while (index < text.length) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += character;
      index += 1;
      continue;
    }
    if (character === '"') {
      quoted = true;
      index += 1;
    } else if (character === delimiter) {
      push();
      index += 1;
    } else if (character === "\r" && text[index + 1] === "\n") {
      push();
      rows.push(row);
      row = [];
      index += 2;
    } else if (character === "\n" || character === "\r") {
      push();
      rows.push(row);
      row = [];
      index += 1;
    } else {
      field += character;
      index += 1;
    }
  }
  if (field !== "" || row.length) {
    push();
    rows.push(row);
  }
  // A file ending in a newline yields one trailing empty row, and a wholly
  // blank line inside one is not a student.
  return rows.filter((entry) => entry.some((cell) => cell.trim() !== ""));
};

/** Read a CSV export into objects keyed by header, as `csv.DictReader` does. */
export const readRows = (path: string, delimiter?: string): Record<string, string>[] => {
  if (/\.xlsx?$|\.xlsm$/i.test(path)) {
    throw new Error(
      "reading .xlsx is not implemented here — export the roster as CSV and " +
        "import that instead. (Python's `ainar roster import` reads it through " +
        "openpyxl; nothing in this project runs Python.)",
    );
  }
  const text = readFileSync(path, "utf-8").replace(/^﻿/, "");
  const firstBreak = text.search(/\r\n|\n|\r/);
  const headerLine = firstBreak === -1 ? text : text.slice(0, firstBreak);
  const table = parseDelimited(text, delimiter ?? sniffDelimiter(headerLine));
  if (!table.length) return [];
  const headers = table[0]!.map((header) => header.trim());
  return table.slice(1).map((values) => {
    const row: Record<string, string> = {};
    headers.forEach((header, position) => {
      row[header] = values[position] ?? "";
    });
    return row;
  });
};

// --------------------------------------------------------------------------
// Building the roster
// --------------------------------------------------------------------------

export interface Enrollment {
  enrollment_id: string;
  course_version_id: string;
  student_id: string;
  role: string;
  status: string;
  group?: string;
}

export interface ImportResult {
  enrollments: Enrollment[];
  added: string[];
  known: string[];
  skipped: string[];
  columns: Record<string, string | null>;
}

export interface BuildOptions {
  courseVersionId: string;
  store: RosterStore;
  salt: Uint8Array;
  idColumn?: string | null;
  nameColumn?: string | null;
  emailColumn?: string | null;
  groupColumn?: string | null;
  enrollmentPrefix?: string;
  today?: string;
}

/** Turn export rows into enrollments, recording identities privately. */
export const buildRoster = (
  rows: Record<string, string>[],
  options: BuildOptions,
): ImportResult => {
  const result: ImportResult = {
    enrollments: [],
    added: [],
    known: [],
    skipped: [],
    columns: {},
  };
  if (!rows.length) return result;

  const headers = Object.keys(rows[0]!);
  const columns: Record<string, string | null> = {
    id: options.idColumn || matchHeader(headers, ID_HEADERS),
    name: options.nameColumn || matchHeader(headers, NAME_HEADERS),
    email: options.emailColumn || matchHeader(headers, EMAIL_HEADERS),
    group: options.groupColumn || matchHeader(headers, GROUP_HEADERS),
  };
  result.columns = columns;
  if (!columns.id) {
    throw new Error(
      "could not find a student identifier column; name it with --id-column. " +
        `Columns present: ${headers.filter(Boolean).join(", ")}`,
    );
  }

  const prefix = options.enrollmentPrefix ?? "ENR";
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const seen = new Set<string>();
  // Row 2 is the first record: row 1 is the header, and the number is meant to
  // match what the professor sees in their spreadsheet.
  let line = 1;
  for (const row of rows) {
    line += 1;
    const institutionalId = (row[columns.id] ?? "").trim();
    if (!institutionalId) {
      result.skipped.push(`row ${line}: no identifier`);
      continue;
    }

    const studentId = pseudonym(institutionalId, options.salt);
    if (seen.has(studentId)) {
      result.skipped.push(`row ${line}: ${institutionalId} appears twice`);
      continue;
    }
    seen.add(studentId);

    const person: Person = { institutional_id: institutionalId };
    for (const key of ["name", "email"] as const) {
      const column = columns[key];
      if (column && (row[column] ?? "").trim()) person[key] = row[column]!.trim();
    }

    if (options.store.record(studentId, person, options.courseVersionId, today)) {
      result.added.push(studentId);
    } else {
      result.known.push(studentId);
    }

    const enrollment: Enrollment = {
      enrollment_id: `${prefix}-${studentId.replace(/^STUDENT-/, "")}`,
      course_version_id: options.courseVersionId,
      student_id: studentId,
      role: "student",
      status: "active",
    };
    const groupColumn = columns.group;
    if (groupColumn && (row[groupColumn] ?? "").trim()) enrollment.group = row[groupColumn]!.trim();
    result.enrollments.push(enrollment);
  }

  return result;
};

export const ENROLLMENTS_HEADER = `# Course membership. Written by \`ainar roster import\`.
#
# Pseudonymous identifiers only. The mapping to real students lives outside
# this repository — see \`ainar roster status\` for where — and must never be
# committed. \`ainar roster whois STUDENT-XXXXXX\` resolves one, for your eyes.
#
# Re-importing an updated export is safe: identifiers are derived from the
# student's institutional id, so the same person keeps the same pseudonym
# across every course and semester.

`;

/**
 * Identities must not be written anywhere the repository can capture them.
 *
 * The comparison is on resolved paths with a separator appended, so that a
 * sibling directory whose name merely starts with the workspace's — `…/AI
 * Course 2026 v1-private` beside `…/AI Course 2026 v1` — is not mistaken for
 * something inside it.
 */
export const refuseInsideRepo = (out: string | null | undefined, root: string): void => {
  if (!out) return;
  const target = isAbsolute(out) ? resolve(out) : resolve(out);
  const inside = resolve(root) + sep;
  if ((target + sep).startsWith(inside)) {
    throw new Error(
      `refusing to write student identities to ${target}, which is inside the ` +
        "workspace. Choose a path outside it — this repository must never hold " +
        "student names.",
    );
  }
};
