/**
 * Where the time went, when somebody asks.
 *
 * Every slow thing in this CLI is slow for one of three reasons — a network
 * that does not answer, a course that is large, or LibreOffice — and until this
 * existed there was no way to tell which, because they all look like `pres`
 * taking eleven seconds. So each of them records a span and the spans print at
 * exit, in the order they happened:
 *
 *     course source: 180 ms
 *       database probe: 141 ms
 *     context: 42 ms
 *     render pptx: 1.8 s
 *     pdf conversion: 2.4 s
 *
 * Off unless asked for, by `PRES_TIMING=1` or `--timing`, and printed to stderr
 * so a `--json` payload stays machine-readable while it is on.
 *
 * Local only. Nothing here writes a file, opens a socket or aggregates across
 * runs: it is a measuring stick, not analytics, and a performance tool that
 * phones home is a performance tool nobody is allowed to enable.
 */

export interface Span {
  label: string;
  ms: number;
  /** How deep this span sits under another one, for the report's indentation. */
  depth: number;
  /** Anything worth saying beside the number — a route, a count, a skip reason. */
  detail?: string;
}

let spans: Span[] | null = null;
let depth = 0;

/** Whether `PRES_TIMING` asks for this, so `--timing` is not the only way in. */
const askedForByEnvironment = (): boolean => {
  const value = process.env.PRES_TIMING;
  return value !== undefined && value !== "" && value !== "0" && value.toLowerCase() !== "false";
};

export function enableTiming(on = true): void {
  spans = on ? (spans ?? []) : null;
  depth = 0;
}

/** Turn timing on if the environment asked for it. Called once, from the CLI. */
export function enableTimingFromEnvironment(): void {
  if (askedForByEnvironment()) enableTiming(true);
}

export const timingEnabled = (): boolean => spans !== null;

/** For tests, which need each case to start from nothing. */
export function resetTimings(): void {
  spans = spans === null ? null : [];
  depth = 0;
}

export const takeTimings = (): Span[] => (spans ? [...spans] : []);

const record = (label: string, ms: number, at: number, detail?: string): void => {
  if (!spans) return;
  spans.push({ label, ms, depth: at, ...(detail ? { detail } : {}) });
};

/**
 * Time an async step. Free when timing is off — no clock is read and no closure
 * is allocated beyond the one the caller already wrote.
 */
export async function timed<T>(label: string, run: () => Promise<T> | T): Promise<T> {
  if (!spans) return run();
  const at = depth;
  depth += 1;
  const started = performance.now();
  try {
    return await run();
  } finally {
    depth = at;
    record(label, performance.now() - started, at);
  }
}

/** The same, for a step that is not async. */
export function timedSync<T>(label: string, run: () => T): T {
  if (!spans) return run();
  const at = depth;
  depth += 1;
  const started = performance.now();
  try {
    return run();
  } finally {
    depth = at;
    record(label, performance.now() - started, at);
  }
}

/**
 * Record a measurement taken elsewhere.
 *
 * Wanted by anything that already knows its own duration — a connection attempt
 * that failed, a route read from the cache instead of probed — and by the
 * places that want to say *why* a step was fast, which is often the interesting
 * half. A skip is worth a line: `database probe: 0 ms (skipped — unreachable
 * 40 s ago)`.
 */
export function noteTiming(label: string, ms: number, detail?: string): void {
  record(label, ms, depth, detail);
}

/** A stopwatch, for a step whose start and end are in different functions. */
export function startSpan(label: string): (detail?: string) => void {
  if (!spans) return () => {};
  const at = depth;
  const started = performance.now();
  return (detail?: string) => record(label, performance.now() - started, at, detail);
};

/**
 * Milliseconds, then seconds, then minutes.
 *
 * Three scales because all three occur: a check is milliseconds, a PDF
 * conversion is seconds, and a remembered failure's age and time-to-live are
 * minutes. "600.0 s" is a number a reader has to divide.
 */
export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 90_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 60_000)} min`;
}

export function describeTimings(): string {
  if (!spans || !spans.length) return "";
  return spans
    .map((span) => {
      const indent = "  ".repeat(span.depth);
      const detail = span.detail ? ` (${span.detail})` : "";
      return `${indent}${span.label}: ${formatMs(span.ms)}${detail}`;
    })
    .join("\n");
}

/**
 * Print the report, to stderr.
 *
 * stderr rather than stdout because `pres context --json --timing` has to stay
 * pipeable: a timing report in the middle of a JSON document is a timing report
 * that broke the caller.
 */
export function reportTimings(write: (line: string) => void = console.error): void {
  const report = describeTimings();
  if (report) write(report);
}
