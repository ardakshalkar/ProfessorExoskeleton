/**
 * Files the professor drops on the pane, put where the skills look for them.
 *
 * The harness takes images and nothing else — a pasted picture becomes an
 * opaque attachment the model sees but cannot hand to a command — so a scanned
 * exam, a PDF of forty pages, had no way in at all. This is that way in, and it
 * puts each kind of file exactly where the skill that reads it already looks
 * (STORAGE.md §5, "Scanned papers"):
 *
 *   scans   ~/.ainar/submissions/<RUN>/_inbox/   the run's unfiled inbox —
 *           which exam the pile is gets worked out from the covers and put to
 *           the professor (/import-assessment §1) before anything is filed.
 *   paper   ~/.ainar/submissions/<RUN>/_papers/  a question paper or a key, to
 *           be read and imported (/import-assessment §3–§5).
 *   recordings  ~/.ainar/submissions/<RUN>/_recordings/  oral defences recorded
 *           elsewhere — a phone, a room the harness was not in — to be matched
 *           to students and transcribed (`ainar defence batch`, DEF-6).
 *
 * Both are under the private submissions folder (`AINAR_SUBMISSIONS_DIR`
 * honoured), never inside the workspace: a scan carries names and handwriting,
 * and an answer key in the repository is a key one `git push` from students.
 *
 * **A scan is renamed by its content.** An upload called `Ivanova_A_quiz3.pdf`
 * carries a student's name, and its name would go into the chat message that
 * tells the agent it arrived — and from there into the transcript. So a scan is
 * stored as `scan-<first 10 of its sha256>.pdf`: the same file uploaded twice is
 * the same name and is recognised, not doubled. What it was called is kept in
 * `_inbox/uploads.json`, beside the scans, in the private folder.
 *
 * Nothing here is a model call or a record. It writes bytes and says where.
 */

import { createHash, randomBytes } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { basename, extname, join } from "node:path";

/** What each kind accepts, and where it goes under `<submissions>/<RUN>/`. */
export const KINDS = {
  scans: { folder: "_inbox", extensions: [".pdf"] },
  paper: { folder: "_papers", extensions: [".pdf", ".docx", ".odt", ".md", ".txt", ".png", ".jpg", ".jpeg"] },
  recordings: { folder: "_recordings", extensions: [".m4a", ".mp4", ".mp3", ".wav", ".webm", ".ogg"] },
};

/** Kinds renamed by their content, because their names carry a student's: `scan-…`, `rec-…`. */
const RENAMED = { scans: "scan", recordings: "rec" };

/** Per file. A class's scans in one batch at 300 dpi is tens of MB, not hundreds. */
export const UPLOAD_LIMIT = 200 * 1024 * 1024;

const RUN_ID = /^[A-Z0-9][A-Z0-9-]*$/;

/** Where an upload of this kind for this run lands. */
export const uploadFolder = (submissions, runId, kind) => {
  if (!RUN_ID.test(runId)) throw new Error(`"${runId}" is not a course run id`);
  const spec = KINDS[kind];
  if (!spec) throw new Error(`upload kind is scans, paper or recordings, not "${kind}"`);
  return join(submissions, runId, spec.folder);
};

/**
 * A name safe to write and safe to say: no directory parts, no characters a
 * shell or a YAML file would trip on, the extension kept and lowercased.
 */
export const safeName = (original) => {
  const base = basename(String(original || "")).replace(/[\\/]/g, "");
  const extension = extname(base).toLowerCase();
  const stem = base.slice(0, base.length - extname(base).length)
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return (stem || "upload") + extension;
};

/** Refuse what the kind does not take, before a byte is written. */
export const checkUpload = (kind, original) => {
  const spec = KINDS[kind];
  if (!spec) return `upload kind is scans, paper or recordings, not "${kind}"`;
  const extension = extname(String(original || "")).toLowerCase();
  if (!spec.extensions.includes(extension)) {
    return kind === "scans"
      ? `${original}: scanned papers are uploaded as PDF`
      : kind === "recordings"
        ? `${original}: a recording is one of ${spec.extensions.join(", ")}`
        : `${original}: a question paper or key is one of ${spec.extensions.join(", ")}`;
  }
  return null;
};

/**
 * Read a request body to a file, under the limit, without holding it in memory.
 *
 * Event-driven rather than `pipe`, so the route reads a request the same way
 * `readBody` does and the same stub drives both in a test. The bytes go to a
 * temporary name in the destination folder and are renamed only when complete,
 * so a dropped connection never leaves half a PDF where a skill would find it.
 */
export const receiveFile = (req, folder, limit = UPLOAD_LIMIT) =>
  new Promise((resolve, reject) => {
    mkdirSync(folder, { recursive: true });
    const temporary = join(folder, `.upload-${randomBytes(6).toString("hex")}.part`);
    const fd = openSync(temporary, "w");
    const hash = createHash("sha256");
    let size = 0;
    let head = Buffer.alloc(0);
    let failed = false;
    const fail = (error) => {
      if (failed) return;
      failed = true;
      try {
        closeSync(fd);
      } catch {}
      rmSync(temporary, { force: true });
      reject(error);
    };
    req.on("data", (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > limit) {
        fail(new Error(`the file is larger than ${Math.round(limit / 1024 / 1024)} MB`));
        req.destroy?.();
        return;
      }
      if (head.length < 8) head = Buffer.concat([head, chunk.subarray(0, 8)]);
      hash.update(chunk);
      writeSync(fd, chunk);
    });
    req.on("end", () => {
      if (failed) return;
      closeSync(fd);
      if (size === 0) {
        rmSync(temporary, { force: true });
        reject(new Error("the file is empty"));
        return;
      }
      resolve({ temporary, size, sha256: hash.digest("hex"), head });
    });
    req.on("error", fail);
  });

/**
 * Put a received file under its final name. Returns what was stored and
 * whether it was already there — an identical file uploaded again is not an
 * error and not a second copy.
 */
export const storeUpload = ({ kind, folder, original, received, now }) => {
  const { temporary, size, sha256, head } = received;
  if (extname(original).toLowerCase() === ".pdf" && !head.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    rmSync(temporary, { force: true });
    throw new Error(`${original} does not start like a PDF — was it saved as something else?`);
  }
  let name = RENAMED[kind] ? `${RENAMED[kind]}-${sha256.slice(0, 10)}${extname(original).toLowerCase()}` : safeName(original);
  let target = join(folder, name);
  let duplicate = false;
  if (existsSync(target)) {
    const same = createHash("sha256").update(readFileSync(target)).digest("hex") === sha256;
    if (same) duplicate = true;
    else {
      // A paper of the same name but different bytes: a corrected key, say.
      // Both are kept, and the new one says which it is.
      const extension = extname(name);
      name = `${name.slice(0, name.length - extension.length)}-${sha256.slice(0, 6)}${extension}`;
      target = join(folder, name);
      duplicate = existsSync(target);
    }
  }
  if (duplicate) rmSync(temporary, { force: true });
  else renameSync(temporary, target);

  if (RENAMED[kind] && !duplicate) {
    // The private map back to what the file was called. Names may be in it;
    // it is beside the scans, outside the repository, and nowhere else.
    const ledger = join(folder, "uploads.json");
    let entries = [];
    try {
      entries = JSON.parse(readFileSync(ledger, "utf-8"));
      if (!Array.isArray(entries)) entries = [];
    } catch {}
    entries.push({ file: name, original: basename(original), bytes: size, sha256, uploaded_at: now });
    writeFileSync(ledger, JSON.stringify(entries, null, 2) + "\n", "utf-8");
  }
  return { file: name, path: target, bytes: size, duplicate };
};
