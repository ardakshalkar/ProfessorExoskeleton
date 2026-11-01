/**
 * Dates in the run's own timezone — one mechanism, so two readers of the same
 * moment cannot put it on two different days.
 *
 * A course's calendar is local: week 3 starts on a Monday in Almaty, not in
 * Greenwich. An aware timestamp, though, can be written in any offset — Canvas
 * hands them over in UTC, a professor may type `Z` — and the date printed in
 * its own text is the date in *that* offset. `2026-10-15T20:00:00Z` is the
 * 16th in Almaty, and reading it as the 15th puts a deadline in the wrong
 * week at a week's edge and in the wrong grading half at the midpoint (LNG-6).
 *
 * Date-only arithmetic between two plain dates (`2026-09-01`, `2026-12-20`)
 * has no timezone in it at all and is done in UTC on purpose; only turning an
 * instant into a day, or a day into an instant, needs the zone.
 */

import { activeProfile } from "./profile.ts";

/** A zone's UTC offset in minutes at `now`, or null for a zone Intl does not know. */
const offsetOf = (zone: string, now: Date): number | null => {
  try {
    const format = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" });
    const part = format.formatToParts(now).find((entry) => entry.type === "timeZoneName")?.value ?? "";
    if (part === "GMT") return 0; // UTC itself carries no offset to read
    const match = /GMT([+-])(\d{2}):(\d{2})/.exec(part);
    return match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : null;
  } catch {
    return null;
  }
};

/**
 * A run's UTC offset in minutes — `run_timezone(...)`, resolved once.
 *
 * Exported because more than one place needs the same answer: the lms ledger
 * stamps a push with it, and `lms.pull` converts Canvas's UTC timestamps into
 * it. Two mechanisms for one question is how two records of the same moment end
 * up an hour apart.
 */
export const zoneOffsetMinutes = (timezone: string | undefined, now: Date = new Date()): number => {
  const home = activeProfile().locale.timezone;
  // A run's zone Intl does not know falls back to the profile's, never to a
  // guessed constant: a stamp with the wrong offset misreports when it happened.
  const offset = offsetOf(timezone || home, now) ?? offsetOf(home, now);
  if (offset === null) {
    throw new Error(`"${home}" is not a timezone this runtime knows. Set a valid one in the profile (locale.timezone).`);
  }
  return offset;
};

/**
 * The day an aware timestamp falls on in `timezone`. A stamp that does not
 * parse is read off its own text, as before, rather than lost.
 */
export const localDate = (stamp: string, timezone: string | undefined): string => {
  const at = Date.parse(stamp);
  if (!Number.isFinite(at)) return stamp.slice(0, 10);
  const shifted = new Date(at + zoneOffsetMinutes(timezone, new Date(at)) * 60_000);
  return shifted.toISOString().slice(0, 10);
};

/** The instant a local day begins in `timezone`: midnight there, as epoch milliseconds. */
export const startOfDay = (day: string, timezone: string | undefined): number => {
  const utcMidnight = Date.parse(`${day}T00:00:00Z`);
  // The offset at the local midnight, not at UTC's: they differ across a DST change.
  const guess = utcMidnight - zoneOffsetMinutes(timezone, new Date(utcMidnight)) * 60_000;
  return utcMidnight - zoneOffsetMinutes(timezone, new Date(guess)) * 60_000;
};
