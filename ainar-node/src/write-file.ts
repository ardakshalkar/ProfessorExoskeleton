/**
 * A file written whole or not at all.
 *
 * `writeFileSync` on the file itself leaves it half-written when the process
 * dies partway — and since the pane can cancel a running `scans read` or
 * `defence batch transcribe` (BACKLOG JOB-5), a killed child is an ordinary
 * event, not a crash. Written beside it under a name of this process's, then
 * renamed into place: a reader sees the old file or the new one, never part
 * of either. A leftover `.tmp` is what a kill can still leave, and nothing
 * reads it.
 */

import { renameSync, rmSync, writeFileSync } from "node:fs";

export const writeFileWhole = (path: string, data: string | Uint8Array, encoding: BufferEncoding = "utf-8"): void => {
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, data, typeof data === "string" ? encoding : undefined);
    renameSync(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
};
