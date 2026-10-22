/**
 * Where exam reports live: outside the repository, because a report names a
 * student. Apart from `exam-report.ts` so that what only reads the folder —
 * `lms send-reports`, the pane — does not load the document writer.
 */

import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** `--dir`, else `AINAR_REPORTS_DIR`, else `~/.ainar/reports`. */
export const reportsDir = (explicit?: string | null): string => {
  const expand = (value: string): string =>
    value.startsWith("~") ? resolve(homedir(), value.slice(1).replace(/^[\\/]/, "")) : resolve(value);
  if (explicit) return expand(explicit);
  const fromEnv = (process.env.AINAR_REPORTS_DIR ?? "").trim();
  if (fromEnv) return expand(fromEnv);
  return join(homedir(), ".ainar", "reports");
};

/** One assessment's report folder: `<base>/<RUN>/<ASSESSMENT>/`. */
export const reportPlace = (base: string, runId: string, assessmentId: string) => {
  const dir = join(base, runId, assessmentId);
  return {
    dir,
    /** Who has a report, with what total, made when. */
    manifest: join(dir, "report.json"),
    classPdf: join(dir, "class.pdf"),
    studentPdf: (student: string) => join(dir, "students", `${student}.pdf`),
    /** Who was sent theirs, and when. */
    sent: join(dir, "sent.json"),
  };
};
