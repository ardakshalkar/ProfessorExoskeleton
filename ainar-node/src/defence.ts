/**
 * Preparing an oral defence of a homework fork.
 *
 * BACKLOG E26: DEF-2, DEF-3 with VIV-1. The professor presses *Start defence*
 * beside a student's submission in the pane, and two things happen, split the
 * way the Scans tab splits reading from judging:
 *
 * 1. **`ainar defence prepare`**, run by the pane in the harness's own process:
 *    clone the repository the student handed in and pin it to the code as it
 *    was at the hand-in. No judgement, so no model.
 * 2. **`/defend-submission`**, sent into the open session: the model the
 *    professor is already talking to reads that code (`ainar defence code`)
 *    against the brief and the rubric and drafts the questions, which
 *    `ainar defence questions --from` checks and writes. Whichever model the
 *    session runs drafts them; nothing here calls one.
 *
 * Where each half lives, and why it is two places:
 *
 *     ~/.ainar/submissions/<RUN>/<ASSESSMENT>/<STUDENT>/defence/
 *       repo/        the clone, detached at the pinned commit
 *       pin.yaml     which commit, and why that one
 *     <workspace>/output/<RUN>/defence/<ASSESSMENT>/<STUDENT>.yaml
 *                  the questions
 *
 * The clone is the student's work and stays with the rest of it in the private
 * folder; seventy-four clones do not belong in a synced workspace. The
 * questions are pseudonymous drafts, like an Evaluation, and the session's
 * sandbox can write `output/` without asking — it can never write `~/.ainar`,
 * so questions kept there would cost the professor an approval per student.
 * When DEF-4 records spoken answers, those go to the private folder, written
 * by the pane.
 *
 * Which commit. The last one at or before `submitted_at`, when the submission
 * has a time — a student who keeps pushing after the deadline is defended on
 * what they handed in (LAT-2's rule). Without a time, the head of the default
 * branch, and `pin.yaml` says so.
 *
 * Every question is `approval: draft`. The professor edits or cuts them before
 * asking any (VIV-4); writing over questions already there is refused unless
 * forced, because those may be the professor's edits.
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";
import { promisify } from "node:util";
import { parse, stringify } from "yaml";

const execFileAsync = promisify(execFile);

// --------------------------------------------------------------------------
// Where
// --------------------------------------------------------------------------

export interface DefencePlace {
  /** `~/.ainar/submissions/<RUN>/<ASSESSMENT>/<STUDENT>/defence` */
  dir: string;
  repo: string;
  pin: string;
  /** `<workspace>/output/<RUN>/defence/<ASSESSMENT>/<STUDENT>.yaml` */
  questions: string;
}

export const defencePlace = (
  submissions: string,
  root: string,
  runId: string,
  assessmentId: string,
  studentId: string,
): DefencePlace => {
  const dir = join(submissions, runId, assessmentId, studentId, "defence");
  return {
    dir,
    repo: join(dir, "repo"),
    pin: join(dir, "pin.yaml"),
    questions: join(root, "output", runId, "defence", assessmentId, `${studentId}.yaml`),
  };
};

// --------------------------------------------------------------------------
// The repository
// --------------------------------------------------------------------------

/**
 * The repository a handed-in link names, as a URL `git clone` can take.
 *
 * Only `https`. A `file://` or a local path would have the clone read this
 * machine, and an `ssh` URL needs a key the harness should not be lending to
 * whatever a student typed. A GitHub link to a page inside the repository —
 * `/tree/main/src`, `/blob/…` — is cut back to the repository itself, because
 * that is what students paste.
 */
export const repoUrl = (handedIn: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(handedIn.trim());
  } catch {
    throw new Error(`"${handedIn}" is not a link to a repository`);
  }
  if (parsed.protocol !== "https:") throw new Error(`${handedIn}: only https links are cloned`);
  if (["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) {
    throw new Error(`${handedIn}: a link to this machine is not a student's repository`);
  }
  if (parsed.hostname === "github.com" || parsed.hostname === "www.github.com") {
    const [owner, name] = parsed.pathname.split("/").filter(Boolean);
    if (!owner || !name) throw new Error(`${handedIn}: names no repository (expected github.com/<owner>/<repo>)`);
    return `https://github.com/${owner}/${name.replace(/\.git$/, "")}`;
  }
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString().replace(/\/+$/, "");
};

export type Git = (args: string[], cwd?: string) => Promise<string>;

/** `git`, never prompting: a private or missing repository fails rather than waits for a password. */
export const runGit: Git = async (args, cwd) => {
  // Long paths on: the clone sits four folders deep in the submissions folder,
  // and on Windows a student's nested project then passes 260 characters.
  const { stdout } = await execFileAsync("git", ["-c", "core.longpaths=true", ...args], {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" },
    maxBuffer: 16 * 1024 * 1024,
    timeout: 300000,
  });
  return stdout.trim();
};

export interface Pin {
  url: string;
  commit: string;
  committed_at: string | null;
  head: string;
  /** `submitted_at` when the commit was chosen by the hand-in time, else `head`. */
  pinned_by: "submitted_at" | "head";
  cloned_at: string;
  /** Why the head was used although there was a hand-in time. */
  note?: string;
}

/**
 * Clone `url` into `place.repo` and detach it at the code as handed in.
 *
 * A blobless clone: every commit, so the hand-in commit can be found, and the
 * file contents of only the one checked out. An existing clone is reused with
 * its pin unless `refresh` — the questions cite that commit, and moving it
 * under them would make the line numbers point at different code.
 */
export const cloneAtHandIn = async (options: {
  url: string;
  repoDir: string;
  submittedAt?: string | null;
  refresh?: boolean;
  previous?: Pin | null;
  git?: Git;
  now?: Date;
}): Promise<Pin> => {
  const git = options.git ?? runGit;
  const url = repoUrl(options.url);
  if (existsSync(join(options.repoDir, ".git")) && options.previous && !options.refresh && options.previous.url === url) {
    return options.previous;
  }
  rmSync(options.repoDir, { recursive: true, force: true });
  mkdirSync(join(options.repoDir, ".."), { recursive: true });
  try {
    await git(["clone", "--quiet", "--filter=blob:none", "--no-checkout", url, options.repoDir]);
  } catch (error) {
    throw new Error(
      `could not clone ${url}: ${String((error as any)?.stderr ?? (error as Error).message).trim().split("\n").pop()} ` +
        "— is the fork public, and is the link the repository?",
    );
  }
  const head = await git(["rev-parse", "HEAD"], options.repoDir);
  let commit = head;
  let pinnedBy: Pin["pinned_by"] = "head";
  let note: string | undefined;
  if (options.submittedAt) {
    const before = await git(["rev-list", "-1", `--before=${options.submittedAt}`, "HEAD"], options.repoDir);
    if (before) {
      commit = before;
      pinnedBy = "submitted_at";
    } else {
      // The link was handed in before anything was pushed. The head is all
      // there is to defend, and the professor should know it came later.
      note = `no commit at or before the hand-in (${options.submittedAt}); every commit came after it`;
    }
  }
  await git(["checkout", "--quiet", "--detach", commit], options.repoDir);
  const committedAt = (await git(["show", "-s", "--format=%cI", commit], options.repoDir)) || null;
  return {
    url,
    commit,
    committed_at: committedAt,
    head,
    pinned_by: pinnedBy,
    cloned_at: (options.now ?? new Date()).toISOString(),
    ...(note ? { note } : {}),
  };
};

// --------------------------------------------------------------------------
// The code, as the session's model reads it
// --------------------------------------------------------------------------

const SKIP_DIRS = new Set([
  ".git", "node_modules", "__pycache__", ".venv", "venv", "env", ".ipynb_checkpoints",
  "dist", "build", ".idea", ".vscode", ".pytest_cache", ".mypy_cache", "site-packages",
]);

const CODE = new Set([
  ".py", ".ipynb", ".r", ".rmd", ".jl", ".m", ".js", ".ts", ".jsx", ".tsx", ".java", ".kt",
  ".c", ".h", ".cpp", ".hpp", ".cs", ".go", ".rs", ".rb", ".php", ".scala", ".sql", ".sh",
  ".html", ".css", ".vue", ".svelte",
]);
const PROSE = new Set([".md", ".txt", ".rst"]);
const CONFIG = new Set([".toml", ".cfg", ".ini", ".yaml", ".yml"]);

export interface CodeFile {
  path: string;
  /** Numbered lines, so a question can cite `lines: 12-30` and mean it. */
  text: string;
  lines: number;
}

/** A notebook as its cells' source, numbered as one file; outputs are left out. */
export const notebookSource = (raw: string): string => {
  const notebook = JSON.parse(raw);
  return (notebook.cells ?? [])
    .map((cell: any, index: number) => {
      const source = Array.isArray(cell.source) ? cell.source.join("") : String(cell.source ?? "");
      return `# ── cell ${index + 1} (${cell.cell_type ?? "?"}) ──\n${source}`;
    })
    .join("\n\n");
};

const numbered = (text: string): { text: string; lines: number } => {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const width = String(lines.length).length;
  return { text: lines.map((line, index) => `${String(index + 1).padStart(width)}│ ${line}`).join("\n"), lines: lines.length };
};

/**
 * The repository's readable files, code first, inside a character budget.
 *
 * Code before prose before configuration, and the student's own files before
 * anything that looks vendored. What does not fit is listed by name, so the
 * model knows it exists and the professor can see what was not read.
 */
export const collectCode = (
  repoDir: string,
  budget = 160_000,
  perFile = 40_000,
): { files: CodeFile[]; unread: string[] } => {
  const found: { path: string; rank: number; size: number }[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > 8) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), depth + 1);
        continue;
      }
      const full = join(dir, entry.name);
      const extension = extname(entry.name).toLowerCase();
      const rank = CODE.has(extension) ? 0 : PROSE.has(extension) ? 1 : CONFIG.has(extension) ? 2 : -1;
      if (rank < 0) continue;
      found.push({ path: relative(repoDir, full).split(sep).join("/"), rank, size: statSync(full).size });
    }
  };
  walk(repoDir, 0);
  found.sort((a, b) => a.rank - b.rank || a.size - b.size || a.path.localeCompare(b.path));

  const files: CodeFile[] = [];
  const unread: string[] = [];
  let used = 0;
  for (const entry of found) {
    let raw: string;
    try {
      raw = readFileSync(join(repoDir, entry.path), "utf-8");
      if (entry.path.toLowerCase().endsWith(".ipynb")) raw = notebookSource(raw);
    } catch {
      unread.push(entry.path);
      continue;
    }
    const { text, lines } = numbered(raw);
    if (text.length > perFile || used + text.length > budget) {
      unread.push(entry.path);
      continue;
    }
    files.push({ path: entry.path, text, lines });
    used += text.length;
  }
  return { files, unread };
};

/**
 * Everything the drafting needs, as one text: the brief, the rubric, and the
 * code with its lines numbered. `ainar defence code` prints it, so the
 * session's model reads the clone without reading the private folder itself.
 */
export const codeDigest = (context: {
  title: string;
  assessmentId: string;
  studentId: string;
  brief: string | null;
  criteria: Criterion[];
  pin: Pin;
  files: CodeFile[];
  unread: string[];
}): string =>
  [
    `# ${context.title} (${context.assessmentId}) — ${context.studentId}`,
    `Repository: ${context.pin.url}`,
    `Commit: ${context.pin.commit}` +
      (context.pin.pinned_by === "submitted_at"
        ? ` (the last commit at or before the hand-in${context.pin.committed_at ? `, committed ${context.pin.committed_at}` : ""})`
        : ` (the head of the default branch: ${context.pin.note ?? "the submission has no time"})`) +
      (context.pin.head !== context.pin.commit ? `. The fork has moved on since, to ${context.pin.head.slice(0, 7)}.` : ""),
    "",
    "## Brief",
    context.brief?.trim() || "(no brief on record)",
    "",
    "## Rubric criteria",
    context.criteria.length
      ? context.criteria
          .map((c) => `- ${c.criterion_id}: ${c.title}${c.description ? ` — ${c.description}` : ""}`)
          .join("\n")
      : "(no rubric on record: leave criterion_id null)",
    "",
    "## Code (line numbers are this commit's)",
    ...context.files.map((file) => `\n=== ${file.path} (${file.lines} lines) ===\n${file.text}`),
    ...(context.unread.length ? ["", `## In the repository, not shown\n${context.unread.join("\n")}`] : []),
  ].join("\n");

// --------------------------------------------------------------------------
// The questions
// --------------------------------------------------------------------------

export interface Criterion {
  criterion_id: string;
  title: string;
  description?: string | null;
  maximum_score?: number;
}

export interface Question {
  id: string;
  kind: "opening" | "probe";
  text: string;
  criterion_id: string | null;
  why: string;
  evidence: { path: string; lines: string }[];
  approval: "draft";
}

/**
 * Drafted questions, checked rather than trusted.
 *
 * A criterion the rubric does not have becomes null, and a citation of a file
 * that was not in the code shown is dropped, each with a note: a question is still worth
 * asking when its reference was wrong, but a wrong reference must not reach
 * the professor looking like a right one.
 */
export const checkQuestions = (
  reply: any,
  criteria: Criterion[],
  files: CodeFile[],
): { questions: Question[]; notes: string[] } => {
  const notes: string[] = [];
  const known = new Set(criteria.map((c) => c.criterion_id));
  const lengths = new Map(files.map((f) => [f.path, f.lines]));
  const raw = Array.isArray(reply?.questions) ? reply.questions : [];
  const questions: Question[] = [];
  for (const entry of raw) {
    const text = String(entry?.text ?? "").trim();
    if (!text) continue;
    const id = `Q${questions.length + 1}`;
    let criterion = entry?.criterion_id ? String(entry.criterion_id) : null;
    if (criterion && !known.has(criterion)) {
      notes.push(`${id}: criterion ${criterion} is not in the rubric, left unset`);
      criterion = null;
    }
    const evidence: Question["evidence"] = [];
    for (const cite of Array.isArray(entry?.evidence) ? entry.evidence : []) {
      const path = String(cite?.path ?? "");
      const lines = String(cite?.lines ?? "").trim();
      const length = lengths.get(path);
      const first = Number(/^(\d+)/.exec(lines)?.[1] ?? NaN);
      if (length === undefined) {
        notes.push(`${id}: cited ${path || "a file"}, which was not shown — dropped`);
      } else if (lines && !(first >= 1 && first <= length)) {
        notes.push(`${id}: lines ${lines} are not in ${path} (${length} lines) — dropped`);
      } else {
        evidence.push({ path, lines });
      }
    }
    questions.push({
      id,
      kind: questions.length === 0 ? "opening" : "probe",
      text,
      criterion_id: criterion,
      why: String(entry?.why ?? "").trim(),
      evidence,
      approval: "draft",
    });
  }
  return { questions, notes };
};

// --------------------------------------------------------------------------
// The files
// --------------------------------------------------------------------------

const PIN_HEADER =
  "# The code this student is defended on: a clone beside this file, detached\n" +
  "# at `commit`. Written by `ainar defence prepare`; `--refresh` clones again.\n\n";

const QUESTIONS_HEADER =
  "# One student's oral defence: the questions to ask. Pseudonymous; the code\n" +
  "# they are about is in the private submissions folder, pinned at `commit`,\n" +
  "# and the line numbers in `evidence` are that commit's. Every question is\n" +
  "# `approval: draft` until the professor has read it: edit `text`, delete a\n" +
  "# question, or add one.\n\n";

export const readPin = (file: string): Pin | null => {
  if (!existsSync(file)) return null;
  const value = parse(readFileSync(file, "utf-8"));
  return value && typeof value === "object" && typeof value.commit === "string" ? (value as Pin) : null;
};

export const writePin = (file: string, pin: Pin): void => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, PIN_HEADER + stringify(pin, { lineWidth: 0 }), "utf-8");
};

export interface DefenceFile {
  submission_id: string;
  assessment_id: string;
  student_id: string;
  repo: { url: string; commit: string };
  drafted?: { by?: string; at: string; unread?: string[]; notes?: string[] };
  questions: Question[];
}

export const readDefence = (file: string): DefenceFile | null => {
  if (!existsSync(file)) return null;
  const value = parse(readFileSync(file, "utf-8"));
  return value && typeof value === "object" ? (value as DefenceFile) : null;
};

export const writeDefence = (file: string, value: DefenceFile): void => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, QUESTIONS_HEADER + stringify(value, { lineWidth: 0 }), "utf-8");
};
