import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { CanvasClient } from "../src/lms/canvas-api.ts";
import { Directory } from "../src/lms/base.ts";
import { RecordedTransport, type Response } from "../src/lms/http.ts";
import {
  type CanvasSection,
  matchSections,
  parseLinks,
  readSections,
  recordCanvasIds,
  syncRows,
} from "../src/lms/roster-sync.ts";
import { RosterStore, buildRoster, pseudonym, reconcileEnrollments } from "../src/roster.ts";

const CONFIG = { base_url: "https://canvas.example.edu", token: "secret" };
const SALT = Buffer.from("a fixed salt for tests");
const RUN_ID = "CSS-1-2026-FALL";
const response = (body: unknown): Response => ({ status: 200, body: JSON.stringify(body), headers: {} });

const RUN = {
  course_version_id: RUN_ID,
  extensions: { lms: { canvas_courses: { "ENG-8": "7434", "ENG-9": "8870" } } },
};

/** Canvas the way Narxoz has it: an uppercase login, a numeric SIS id, a personal email. */
const user = (id: number, name: string, email = `${id}@gmail.com`) => ({
  id,
  name,
  sortable_name: name,
  login_id: `B${id}X`,
  sis_user_id: String(200000 + id),
  email,
});

/**
 * A roster keyed on a university email Canvas does not hold, in Cyrillic, as
 * the registrar's import left it.
 */
const registrar = () => {
  const store = new RosterStore(mkdtempSync(join(tmpdir(), "roster-sync-")));
  const add = (email: string, name: string) => {
    const student = pseudonym(email, SALT);
    store.record(student, { institutional_id: email, name, email }, RUN_ID, "2026-09-01");
    return student;
  };
  return {
    store,
    aru: add("aru.sapar@uni.kz", "Сапар Ару Ерланқызы"),
    bek: add("bek.nurlan@uni.kz", "Нурлан Бекзат Маратұлы"),
    gone: add("gone.away@uni.kz", "Кеткен Адам"),
    // Two people the name "Asel Omar" fits equally.
    asel1: add("asel.omar1@uni.kz", "Омар Әсел"),
    asel2: add("asel.omar2@uni.kz", "Омар Асель"),
  };
};

const section = (group: string, users: Record<string, any>[]): CanvasSection => ({
  group,
  courseId: group === "ENG-8" ? "7434" : "8870",
  users,
});

test("every Canvas course of the run is read, with invited students included", async () => {
  const transport = new RecordedTransport({
    "GET /api/v1/courses/7434/users": response([user(1, "A")]),
    "GET /api/v1/courses/8870/users": response([user(2, "B"), user(3, "C")]),
  });
  const sections = await readSections(new CanvasClient(CONFIG, transport), RUN, null);
  assert.deepEqual(
    sections.map((entry) => [entry.group, entry.courseId, entry.users.length]),
    [["ENG-8", "7434", 1], ["ENG-9", "8870", 2]],
  );
  const query = new URL(transport.calls[0]![1]).searchParams;
  assert.deepEqual(query.getAll("enrollment_state[]"), ["active", "invited"]);
});

test("a roster keyed on something Canvas lacks is matched by name, not duplicated", () => {
  const people = registrar();
  const enrolled = new Set([people.aru, people.bek, people.gone, people.asel1, people.asel2]);
  const matches = matchSections(
    [
      section("ENG-8", [user(1, "Aru Sapar"), user(2, "Bekzat Nurlan")]),
      section("ENG-9", [user(3, "Dana Newcomer"), user(4, "Asel Omar")]),
    ],
    { store: people.store, salt: SALT, enrolled },
  );
  const by = new Map(matches.map((match) => [match.canvasId, match]));

  // Latin against Cyrillic, patronymic left off: the same person.
  assert.equal(by.get("1")!.student, people.aru);
  assert.equal(by.get("2")!.student, people.bek);
  assert.equal(by.get("1")!.institutionalId, "aru.sapar@uni.kz");
  // Nobody like her: new, keyed on the SIS id.
  assert.equal(by.get("3")!.how, "new");
  assert.equal(by.get("3")!.student, pseudonym("200003", SALT));
  // Fits two people: left out, never added.
  assert.equal(by.get("4")!.student, null);
  assert.match(by.get("4")!.problem!, /matches 2 enrolled students/);

  const rows = syncRows(matches);
  assert.equal(rows.length, 3);
  // Known people keep the roster's name; only the newcomer brings Canvas's.
  assert.deepEqual(rows.map((row) => row.name), ["", "", "Dana Newcomer"]);
});

test("--link settles an ambiguous student, and the link outlives the sync", () => {
  const people = registrar();
  const enrolled = new Set([people.asel1, people.asel2]);
  const asel = section("ENG-9", [user(4, "Asel Omar")]);

  const first = matchSections([asel], {
    store: people.store,
    salt: SALT,
    enrolled,
    links: parseLinks([`4=${people.asel2}`]),
  });
  assert.equal(first[0]!.student, people.asel2);
  assert.equal(first[0]!.how, "linked");
  recordCanvasIds(first, people.store);

  // No --link this time: the Canvas id the first sync kept is enough.
  const second = matchSections([asel], { store: people.store, salt: SALT, enrolled });
  assert.equal(second[0]!.student, people.asel2);
  assert.equal(second[0]!.how, "linked");
});

test("two Canvas users cannot both be one roster person", () => {
  const people = registrar();
  const matches = matchSections(
    [section("ENG-8", [user(1, "Aru Sapar")]), section("ENG-9", [user(9, "Aru Sapar")])],
    { store: people.store, salt: SALT, enrolled: new Set([people.aru]) },
  );
  assert.equal(matches[0]!.student, people.aru);
  // One student in two Canvas shells: reported, not given a second identity.
  assert.equal(matches[1]!.student, null);
  assert.match(matches[1]!.problem!, /already placed as Canvas user 1/);
});

test("a whole sync: the newcomer arrives, nobody is dropped, the Canvas ids join lms push", () => {
  const people = registrar();
  const existing = [people.aru, people.bek, people.gone].map((student, index) => ({
    enrollment_id: `ENR-${index}`,
    course_version_id: RUN_ID,
    student_id: student,
    role: "student",
    status: "active",
    group: "ENG-8",
  }));
  const matches = matchSections(
    [section("ENG-8", [user(1, "Aru Sapar"), user(2, "Bekzat Nurlan"), user(3, "Dana Newcomer")])],
    { store: people.store, salt: SALT, enrolled: new Set(existing.map((entry) => entry.student_id)) },
  );
  const result = buildRoster(syncRows(matches), {
    courseVersionId: RUN_ID,
    store: people.store,
    salt: SALT,
    idColumn: "id",
    nameColumn: "name",
    emailColumn: "email",
    groupColumn: "group",
    today: "2026-10-02",
  });
  recordCanvasIds(matches, people.store);
  const merged = reconcileEnrollments(existing, result.enrollments, { groups: ["ENG-8"], markDropped: false });

  const dana = pseudonym("200003", SALT);
  assert.deepEqual(merged.arrived, [dana]);
  assert.deepEqual(merged.dropped, []);
  assert.deepEqual(merged.held, [people.gone]);
  assert.equal(people.store.people[people.aru]!.name, "Сапар Ару Ерланқызы");
  assert.equal(people.store.people[dana]!.name, "Dana Newcomer");

  // The roster is keyed on emails Canvas does not carry; after a sync the
  // grade join still finds Aru by her Canvas SIS id and login.
  const directory = new Directory(people.store, SALT);
  assert.equal(directory.pseudonymFor("200001", "sis-id"), people.aru);
  assert.equal(directory.pseudonymFor("B1X", "login"), people.aru);
});
