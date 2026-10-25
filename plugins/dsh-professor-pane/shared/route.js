/**
 * A place in course mode as a URL fragment, and back.
 *
 * The harness has no router: it never writes the URL, never listens for
 * `popstate`, keeps the open chat in localStorage, and serves 404 for any path
 * but its root. So the pane owns the hash — `#/gradebook/policy` — and a place
 * can be linked, bookmarked, reloaded and stepped through with Back and
 * Forward. client/route-sync.js keeps it and the screen in step.
 *
 * The URL speaks the navigator's words (`waiting`, `sync`, `weeks/teaching`);
 * the pane's state keeps its own ids (`tasks`, `syncs`, `{ mode }`). The one
 * table below is the translation, so neither side renames anything. No
 * imports: Node and the bundle both load it.
 */

import { resolveRequest } from "./places.js";

/**
 * The places by their URL name: the view (or the weeks' modes) and its parts,
 * the first being the default. A part's URL name maps to its id where the two
 * differ (`everything` is Waiting's `waiting`, `all` the weeks' `term`).
 */
export const ROUTES = {
  today: { view: "today" },
  weeks: { mode: true, parts: { planning: "planning", teaching: "teaching", evidence: "evidence", all: "term" } },
  waiting: { view: "tasks", parts: { everything: "waiting", ready: "ready", checklist: "checklist" } },
  students: { view: "students" },
  gradebook: { view: "gradebook", parts: { marks: "marks", policy: "policy", changes: "changes" } },
  concepts: { view: "concepts" },
  materials: { view: "materials", parts: { assessments: "assessments", slides: "slides", exams: "exams", outline: "outline" } },
  files: { view: "files" },
  sync: { view: "syncs" },
  settings: { view: "settings", parts: { integrations: "integrations", accounts: "accounts", preferences: "preferences" } },
};

/** Internal view id → URL name, and the internal names an old link may still use. */
const NAME_OF = Object.fromEntries(Object.entries(ROUTES).filter(([, r]) => r.view).map(([name, r]) => [r.view, name]));

/** An id as the records write it: `ASSESSMENT-HW-06`, `STUDENT-3BCIXS`, `CONCEPT-RAG`. */
const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,80}$/;
const FOCUS = /^[a-z]{1,20}$/;

/** The query keys a place carries, in the order they are written. */
const KEYS = ["week", "student", "concept", "focus", "kind", "grade", "scans", "desk", "run"];

const partName = (route, id) => (route.parts ? Object.keys(route.parts).find((name) => route.parts[name] === id) || null : null);

/**
 * The fragment for a place: `#/<place>[/<part>][?key=value…]`, or "" when
 * nothing of course mode is open. `place` takes the pane's own shape —
 * `{ mode }` or `{ view, sub }` — plus `week`, `student`, `concept`,
 * `focus`, `kind`, and the windows over it: `grade`, `scans`, `desk`
 * (`{ assessment, student }`).
 */
export const placeToHash = (place) => {
  if (!place || (!place.view && !place.mode)) return "";
  let path;
  if (!place.view) {
    path = "weeks/" + (partName(ROUTES.weeks, place.mode) || "planning");
  } else {
    const name = NAME_OF[place.view];
    if (!name) return "";
    const route = ROUTES[name];
    const part = route.parts ? partName(route, place.sub) || Object.keys(route.parts)[0] : null;
    path = part ? name + "/" + part : name;
  }
  const query = [];
  for (const key of KEYS) {
    let value = place[key];
    if (key === "desk" && value) value = value.assessment + (value.student ? ":" + value.student : "");
    if (value === null || value === undefined || value === "" || value === false) continue;
    query.push(key + "=" + encodeURIComponent(String(value)));
  }
  return "#/" + path + (query.length ? "?" + query.join("&") : "");
};

/**
 * The place a fragment names, in the pane's own shape, or null for a
 * fragment that names none. Anything unknown or malformed is dropped rather
 * than thrown: a link someone typed should land somewhere sensible.
 */
export const hashToPlace = (hash) => {
  const match = /^#?\/([a-z]+)(?:\/([a-z]+))?(?:\?(.*))?$/.exec(String(hash || "").trim());
  if (!match) return null;
  const [, name, part, search] = match;
  let place;
  const route = ROUTES[name];
  if (route && route.mode) {
    place = { mode: (part && route.parts[part]) || "planning" };
  } else {
    // A known place, or an internal or older name (`tasks/unpublished`,
    // `syncs`, `materials/grading`): an older part folds into its new home
    // first (shared/places.js), then an unknown part is the default.
    const resolved = resolveRequest({ view: route ? route.view : name, sub: route && route.parts && route.parts[part] ? route.parts[part] : part || undefined });
    const home = ROUTES[NAME_OF[resolved.view]];
    if (!home) return null;
    place = Object.fromEntries(Object.entries(resolved).filter(([, value]) => value !== undefined));
    if (home.parts && !Object.values(home.parts).includes(place.sub)) place.sub = Object.values(home.parts)[0];
    if (!home.parts) delete place.sub;
  }
  for (const pair of String(search || "").split("&")) {
    const at = pair.indexOf("=");
    if (at < 1) continue;
    const key = pair.slice(0, at);
    let value;
    try {
      value = decodeURIComponent(pair.slice(at + 1));
    } catch {
      continue;
    }
    if (key === "week") {
      const week = Number(value);
      if (Number.isInteger(week) && week > 0 && week < 100) place.week = week;
    } else if (key === "focus" || key === "kind") {
      if (FOCUS.test(value)) place[key] = value;
    } else if (key === "desk") {
      const [assessment, student] = value.split(":");
      if (ID.test(assessment || "") && (!student || ID.test(student))) place.desk = { assessment, student: student || null };
    } else if (KEYS.includes(key) && ID.test(value)) {
      place[key] = value;
    }
  }
  return place;
};
