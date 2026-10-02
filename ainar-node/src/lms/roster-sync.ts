/**
 * The class list, read from Canvas instead of from an export.
 *
 * `roster import` takes a file, which is right for the first import — Platonus
 * is the registrar's list — and wrong for every one after it: add/drop happens
 * in Canvas, and asking the professor to export one gradebook per section to
 * learn that two people joined is the long way round. So `roster sync` reads
 * each Canvas course the run names and hands `buildRoster` and
 * `reconcileEnrollments` the rows a file would have given them.
 *
 * ## Finding who is who
 *
 * A pseudonym is an HMAC of the identifier the first import used, and Canvas
 * need not carry that identifier at all. The run this was written for keyed its
 * roster on `name.surname@narxoz.kz`, while Canvas holds an uppercase login,
 * a numeric SIS id and a personal email — no field reproduces a single
 * pseudonym, and keying on any of them would have given 73 of 74 students a
 * second identity. So each Canvas student is matched, first to last:
 *
 *   1. **linked** — a Canvas user id an earlier sync (or `--link`) recorded;
 *   2. **id** — an SIS id, login or email the private roster already holds;
 *   3. **name** — the matcher scans use: word for word, then the same words in
 *      another script or without the patronymic, then a close spelling when
 *      nobody else in the run is near it. A close match is reported to check.
 *
 * Whoever matches none of them is **new**, keyed on their SIS id (else their
 * login). Whoever the name matcher finds ambiguous — two people, or one near
 * miss — is neither: they are reported and left out, because adding them would
 * be the duplicate this file exists to prevent. `--link CANVAS_ID=STUDENT-X`
 * settles one, and the link is kept.
 *
 * Every match records the person's Canvas ids in the private roster, so the
 * next sync is step 1 for everybody, and `lms push` can join on them too.
 *
 * Names cross into the private roster and nowhere else. What is printed and what
 * lands in `enrollments.yaml` is pseudonyms, Canvas ids and counts.
 */

import type { CanvasClient } from "./canvas-api.ts";
import { assignmentTargets } from "./command.ts";
import { type RosterStore, pseudonym } from "../roster.ts";
import { type PlanPaper, identify } from "../scans.ts";

/** One Canvas course's class list, as read. */
export interface CanvasSection {
  group: string | null;
  courseId: string;
  users: Record<string, any>[];
}

export type How = "linked" | "id" | "name" | "close" | "new";

export interface SyncMatch {
  group: string | null;
  canvasId: string;
  /** Null when the student could not be placed; `problem` says why. */
  student: string | null;
  how: How | null;
  /** The identifier `buildRoster` keys the row on. */
  institutionalId: string | null;
  problem?: string;
  user: Record<string, any>;
}

/** Read every Canvas course the run is taught in, or the one `--group` names. */
export const readSections = async (
  client: CanvasClient,
  run: any,
  group: string | null,
): Promise<CanvasSection[]> => {
  const targets = assignmentTargets(run, group);
  if (!targets.length) {
    throw new Error(
      `${run.course_version_id} has no Canvas course recorded. Add ` +
        "extensions.lms.canvas_course_id to the run, or extensions.lms.canvas_courses " +
        "for a course per subgroup.",
    );
  }
  const sections: CanvasSection[] = [];
  for (const [label, courseId] of targets) {
    sections.push({ group: label, courseId, users: await client.classList(courseId) });
  }
  return sections;
};

const clean = (value: unknown): string => String(value ?? "").trim();

/** `--link 123=STUDENT-ABCDEF`, as a map from Canvas user id to pseudonym. */
export const parseLinks = (specs: string[]): Map<string, string> => {
  const links = new Map<string, string>();
  for (const spec of specs) {
    const [canvasId, student] = spec.split("=").map((part) => part.trim());
    if (!canvasId || !student || !/^STUDENT-[A-Z0-9]+$/.test(student)) {
      throw new Error(`--link takes CANVAS_USER_ID=STUDENT-XXXXXX, not '${spec}'`);
    }
    links.set(canvasId, student);
  }
  return links;
};

/** Everything the private roster can recognise a person by, besides a name. */
const knownIds = (store: RosterStore): { byCanvas: Map<string, string>; byId: Map<string, string> } => {
  const byCanvas = new Map<string, string>();
  const byId = new Map<string, string>();
  for (const [studentId, person] of Object.entries(store.people)) {
    const canvas = clean(person.canvas_user_id);
    if (canvas) byCanvas.set(canvas, studentId);
    for (const value of [person.institutional_id, person.sis_user_id, person.login_id, person.email]) {
      const key = clean(value).toLowerCase();
      if (key && !byId.has(key)) byId.set(key, studentId);
    }
  }
  return { byCanvas, byId };
};

/** Place every Canvas student: an existing pseudonym, a new one, or a problem. */
export const matchSections = (
  sections: CanvasSection[],
  context: {
    store: RosterStore;
    salt: Uint8Array;
    enrolled: ReadonlySet<string>;
    links?: Map<string, string>;
  },
): SyncMatch[] => {
  const { store, salt } = context;
  const links = context.links ?? new Map<string, string>();
  const { byCanvas, byId } = knownIds(store);
  const claimed = new Map<string, string>();
  const matches: SyncMatch[] = [];

  const place = (group: string | null, user: Record<string, any>): SyncMatch => {
    const canvasId = clean(user.id);
    const found = (student: string, how: How): SyncMatch => {
      const holder = claimed.get(student);
      if (holder) {
        return {
          group, canvasId, student: null, how: null, institutionalId: null, user,
          problem: `is the same roster person as Canvas user ${holder} (${student})`,
        };
      }
      const institutionalId =
        how === "new" ? clean(user.sis_user_id) || clean(user.login_id) : clean(store.people[student]?.institutional_id);
      if (!institutionalId) {
        return {
          group, canvasId, student: null, how: null, institutionalId: null, user,
          problem: `is linked to ${student}, whom the private roster does not hold`,
        };
      }
      claimed.set(student, canvasId);
      return { group, canvasId, student, how, institutionalId, user };
    };

    const linked = links.get(canvasId) ?? byCanvas.get(canvasId);
    if (linked) return found(linked, "linked");

    for (const field of ["sis_user_id", "login_id", "email"]) {
      const hit = byId.get(clean(user[field]).toLowerCase());
      if (hit) return found(hit, "id");
    }

    // Only students of this run who are not already spoken for: a name is
    // evidence about this class, not about everyone the roster has ever held.
    const open = new Set([...context.enrolled].filter((id) => !claimed.has(id)));
    const name = clean(user.name) || clean(user.sortable_name);
    const who = name
      ? identify({ pages: "", name } as PlanPaper, { store, salt, enrolled: open })
      : { problem: "the name matches no enrolled student" };
    if ("student" in who) return found(who.student, who.match === "close" ? "close" : "name");
    if (who.problem !== "the name matches no enrolled student") {
      return { group, canvasId, student: null, how: null, institutionalId: null, user, problem: who.problem };
    }
    // Someone already placed under this name — usually one student enrolled in
    // two Canvas shells. Minting them a second identity is the failure to avoid.
    const taken = new Set(claimed.keys());
    const twin = name ? identify({ pages: "", name } as PlanPaper, { store, salt, enrolled: taken }) : null;
    if (twin && "student" in twin) {
      return {
        group, canvasId, student: null, how: null, institutionalId: null, user,
        problem: `has the name of ${twin.student}, already placed as Canvas user ${claimed.get(twin.student)}`,
      };
    }

    const institutionalId = clean(user.sis_user_id) || clean(user.login_id);
    if (!institutionalId) {
      return {
        group, canvasId, student: null, how: null, institutionalId: null, user,
        problem: "is new, and Canvas gives no SIS id or login to key them on",
      };
    }
    return found(pseudonym(institutionalId, salt), "new");
  };

  for (const section of sections) {
    for (const user of section.users) matches.push(place(section.group, user));
  }
  return matches;
};

/**
 * The rows `buildRoster` reads, one per placed student.
 *
 * A known person is keyed on the identifier they were imported under, which is
 * what reproduces their pseudonym, and keeps the name the roster has: the
 * registrar's spelling is the one on the papers, and scans match against it.
 */
export const syncRows = (matches: SyncMatch[]): Record<string, string>[] =>
  matches
    .filter((match) => match.student && match.institutionalId)
    .map((match) => ({
      id: match.institutionalId!,
      name: match.how === "new" ? clean(match.user.sortable_name) || clean(match.user.name) : "",
      email: match.how === "new" ? clean(match.user.email) : "",
      group: match.group ?? "",
    }));

/** Keep each placed student's Canvas ids, so the next sync matches them exactly. */
export const recordCanvasIds = (matches: SyncMatch[], store: RosterStore): void => {
  for (const match of matches) {
    const person = match.student ? store.people[match.student] : undefined;
    if (!person) continue;
    person.canvas_user_id = match.canvasId;
    const sis = clean(match.user.sis_user_id);
    const login = clean(match.user.login_id);
    if (sis) person.sis_user_id = sis;
    if (login) person.login_id = login;
  }
};
