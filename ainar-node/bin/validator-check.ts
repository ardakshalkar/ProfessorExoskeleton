/**
 * Check the validator port against `golden/validator/`.
 *
 * Each fixture is the example course broken one way, and what `validate.py`
 * said about it. The mutation is data, so the same break is applied here rather
 * than reimplemented — see `MUTATIONS` in `ainar/golden.py`.
 *
 * Only codes in `IMPLEMENTED` are compared, and an expected issue whose code this
 * port does not implement is reported as **skipped**, never as passing. Since
 * Phase 4 that path should never be taken — a non-zero skip count means the port
 * has fallen behind `validate.py` again, which is exactly what it is there to say.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { discoverCourses, loadCourse } from "../src/loader.ts";
import { IMPLEMENTED, coverage, validatePayload } from "../src/validate.ts";

const root = resolve(process.argv[2] ?? join(import.meta.dirname, "..", ".."));
const corpus = join(root, "golden", "validator");
const implemented = new Set<string>(IMPLEMENTED);

const apply = (payload: any, path: string, value: unknown): void => {
  const parts = path.split(".");
  let node = payload;
  for (const part of parts.slice(0, -1)) node = node[/^\d+$/.test(part) ? Number(part) : part];
  const last = parts.at(-1)!;
  node[/^\d+$/.test(last) ? Number(last) : last] = value;
};

const courseDir = discoverCourses(root)[0]!;
const { bundle } = loadCourse(courseDir, root);
if (!bundle) throw new Error("the example course did not load");

let checked = 0, failed = 0, skipped = 0;

for (const file of readdirSync(corpus).sort()) {
  const fixture = JSON.parse(readFileSync(join(corpus, file), "utf-8"));
  const payload = JSON.parse(JSON.stringify(bundle));
  for (const [path, value] of Object.entries(fixture.patch)) apply(payload, path, value);

  const expected = fixture.issues.filter((i: any) => implemented.has(i.code));
  const missed = fixture.issues.filter((i: any) => !implemented.has(i.code));
  skipped += missed.length;

  const ours = validatePayload(payload).issues.filter((i) => implemented.has(i.code));

  checked += 1;
  const key = (i: any) => `${i.level} ${i.code} ${i.location} ${i.message}`;
  const oursKeys = ours.map(key).sort();
  const theirsKeys = expected.map(key).sort();
  if (JSON.stringify(oursKeys) === JSON.stringify(theirsKeys)) {
    const note = missed.length ? `  (${missed.length} issue(s) skipped: not implemented)` : "";
    console.log(`ok    ${fixture.mutation}${note}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${fixture.mutation}`);
    for (const k of theirsKeys.filter((k) => !oursKeys.includes(k))) console.log(`        missing: ${k}`);
    for (const k of oursKeys.filter((k) => !theirsKeys.includes(k))) console.log(`        extra:   ${k}`);
  }
}

const c = coverage();
console.log(`\n${checked - failed}/${checked} mutation(s) reproduced`);
console.log(`${c.implemented}/${c.total} validator codes implemented; ${skipped} expected issue(s) skipped`);
process.exit(failed ? 1 : 0);
