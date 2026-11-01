/**
 * How many times this process has written a course file — the one thing a
 * course store watching its folder (`YamlCourseStore` with `watch`) cannot
 * learn in time from the folder itself: a watch event arrives on a later
 * turn of the event loop, and a route that writes a record and reads the
 * course back in the same turn must see its own write.
 *
 * Bumped by the writers every course edit goes through (record-edit.ts,
 * records-write.ts). On `globalThis`, so a re-imported copy of this module
 * (the pane reloads its server on a save) counts the same writes.
 */

const KEY = Symbol.for("ainar.course-writes");
const counter = ((globalThis as Record<symbol, { count: number }>)[KEY] ??= { count: 0 });

export const noteCourseWrite = (): void => {
  counter.count += 1;
};

export const courseWrites = (): number => counter.count;
