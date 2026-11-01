// How long the pane's reads take on the server, warm, through the router —
// the numbers docs/PANE-SPEED.md is measured with (JOB-6) and JOB-7 is
// checked against.
//
//   set AINAR_WORKSPACE=<a course workspace>
//   node --experimental-strip-types plugins/dsh-professor-pane/test/reads-timing.mjs RUN [read]
//
// For each read: how many times it asks the course store whether the course
// moved (each one a walk of courses/), then its time on four calls in a row.
// `PROFILE_OUT=<file>.cpuprofile` also writes a CPU profile of the warm calls
// alone, after the course has been parsed. Reads only; nothing is written.

import { writeFileSync } from "node:fs";
import { Readable } from "node:stream";

import { handle } from "../server/router.js";
import { YamlCourseStore } from "@ainar/core/src/store/course.ts";

const RUN = process.argv[2] ?? "CSS-4007-2026-FALL";
const ONLY = process.argv[3] ?? "";

const call = (path) =>
  new Promise((resolve) => {
    const req = Readable.from([]);
    Object.assign(req, { method: "GET", url: "/professor-pane" + path, headers: {} });
    handle(req, { writeHead() {}, setHeader() {}, end: (body) => resolve(String(body ?? "").length) }, { registry: { list: () => [] } });
  });

const READS = {
  today: `/api/today?run=${RUN}`,
  navigator: `/api/navigator?run=${RUN}`,
  students: `/view/students?run=${RUN}&names=1`,
  files: `/api/files?run=${RUN}`,
  scans: `/api/scans?run=${RUN}`,
  course: `/api/course?run=${RUN}&mode=planning&drafts=1`,
  gradebook: `/view/gradebook?run=${RUN}&drafts=1`,
  integrations: `/api/integrations?run=${RUN}`,
  syncs: `/api/syncs?run=${RUN}&names=1`,
  unpublished: `/api/unpublished?run=${RUN}`,
  recent: `/api/recent?r=1`,
};
const wanted = Object.entries(READS).filter(([name]) => !ONLY || name === ONLY);

let started = performance.now();
await call(READS.navigator);
console.log(`first request (the course parsed): ${Math.round(performance.now() - started)} ms`);

let loads = 0;
const load = YamlCourseStore.prototype.load;
YamlCourseStore.prototype.load = function (...args) {
  loads += 1;
  return load.apply(this, args);
};
const walk = (() => {
  const store = new YamlCourseStore(process.env.AINAR_WORKSPACE);
  const id = store.courseIds()[0];
  store.load(id);
  const at = performance.now();
  for (let i = 0; i < 5; i++) store.load(id);
  return (performance.now() - at) / 5;
})();
console.log(`one store load once parsed (the walk of courses/): ${walk.toFixed(0)} ms`);

let session = null;
if (process.env.PROFILE_OUT) {
  const inspector = await import("node:inspector/promises");
  session = new inspector.Session();
  session.connect();
  await session.post("Profiler.enable");
  await session.post("Profiler.setSamplingInterval", { interval: 200 });
  await session.post("Profiler.start");
}

for (const [name, path] of wanted) {
  loads = 0;
  await call(path);
  const asked = loads;
  const times = [];
  let bytes = 0;
  for (let i = 0; i < 4; i++) {
    const at = performance.now();
    bytes = await call(path);
    times.push(Math.round(performance.now() - at));
  }
  console.log(`${name.padEnd(12)} ${times.join(" / ").padEnd(22)} ms  ${String(asked).padStart(2)} store loads  ${Math.round(bytes / 1024)} KB`);
}

if (session) {
  const { profile } = await session.post("Profiler.stop");
  writeFileSync(process.env.PROFILE_OUT, JSON.stringify(profile));
  session.disconnect();
  console.log(`profile: ${process.env.PROFILE_OUT}`);
}
