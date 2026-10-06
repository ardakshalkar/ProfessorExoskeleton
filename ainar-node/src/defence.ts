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
import { parseReply } from "./scan-read.ts";
import { type Range, type Transcriber, type Transcript, labelSpeakers } from "./transcribe.ts";

const execFileAsync = promisify(execFile);

// --------------------------------------------------------------------------
// Where
// --------------------------------------------------------------------------

export interface DefencePlace {
  /** `~/.ainar/submissions/<RUN>/<ASSESSMENT>/<STUDENT>/defence` */
  dir: string;
  repo: string;
  pin: string;
  /** The recordings, one file per take. Private: a student's voice. */
  answers: string;
  /** What was asked and answered, with each transcript. Private for the same reason. */
  session: string;
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
    answers: join(dir, "answers"),
    session: join(dir, "session.yaml"),
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
  /** `follow_up`: asked after an answer, about that answer; `follows` names the question. */
  kind: "opening" | "probe" | "follow_up";
  follows?: string;
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
  /** Questions already asked: appended ones number after them, and may follow one of them. */
  existing: Question[] = [],
): { questions: Question[]; notes: string[] } => {
  const notes: string[] = [];
  const known = new Set(criteria.map((c) => c.criterion_id));
  const lengths = new Map(files.map((f) => [f.path, f.lines]));
  const raw = Array.isArray(reply?.questions) ? reply.questions : [];
  const questions: Question[] = [];
  for (const entry of raw) {
    const text = String(entry?.text ?? "").trim();
    if (!text) continue;
    const id = `Q${existing.length + questions.length + 1}`;
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
    // A follow-up must follow something: a question already there, or one
    // written earlier in the same reply.
    const follows = entry?.follows ? String(entry.follows) : null;
    const before = new Set([...existing, ...questions].map((question) => question.id));
    let kind: Question["kind"] = existing.length + questions.length === 0 ? "opening" : "probe";
    if (follows && before.has(follows)) kind = "follow_up";
    else if (follows) notes.push(`${id}: follows ${follows}, which is not a question here — kept as a probe`);
    questions.push({
      id,
      kind,
      ...(kind === "follow_up" ? { follows: follows! } : {}),
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

// --------------------------------------------------------------------------
// The answers
// --------------------------------------------------------------------------

/**
 * One recorded answer to one question.
 *
 * A question can be answered more than once — the student asks to start
 * again, the professor presses record twice — and every take is kept, in
 * order, rather than the last overwriting the first: a regrade or an appeal
 * replays what was actually said (LIV-3).
 */
export interface Answer {
  question_id: string;
  take: number;
  /** Relative to the defence folder: `answers/Q2-1.webm`. */
  audio: string;
  mime: string;
  recorded_at: string;
  /** When the question was put up and listening began, if the desk said. */
  asked_at?: string;
  seconds: number | null;
  transcript: Transcript | null;
  /** Recorded before the student withdrew consent (AGT-7): kept, never cited. */
  withdrawn?: boolean;
  /**
   * Where the professor held the speak key during this take, in seconds from
   * its start (AGT-6): those stretches are theirs, never the student's.
   */
  professor_spoke?: Range[];
  /** Why there is no transcript: no provider configured, or the provider refused. */
  error?: string;
}

export interface Session {
  submission_id: string;
  assessment_id: string;
  student_id: string;
  answers: Answer[];
  /** What the hands-free desk chose to ask, why, and what the professor did about it (AGT-2, AGT-7). */
  decisions?: Decision[];
  /** Whether the student agreed to be recorded, to what, and when (AGT-7). */
  consent?: Consent;
}

/**
 * The student's agreement to be recorded (AGT-7), as the professor confirmed
 * it. `statement` is what the student was told, written by the server from
 * the transcription provider actually configured, so it cannot claim the
 * voice stays where it does not. No name: the professor confirms it, and the
 * session already says whose defence this is.
 */
export interface Consent {
  agreed: boolean;
  at: string;
  statement: string;
  /** The transcription connection named in the statement. */
  provider: string | null;
  /** When the student withdrew it. Recording stops; what was recorded is kept and marked. */
  withdrawn_at?: string;
}

/** Whether recording is allowed now: agreed, and not withdrawn since. */
export const consentGiven = (session: Session | null): boolean =>
  !!session?.consent?.agreed && !session.consent.withdrawn_at;

/**
 * What the student is told before they agree: what is recorded, who hears
 * it, and that they may stop. Built from the provider actually in use.
 */
export const consentStatement = (transcription: { name: string; provider: string; model: string; local: boolean } | null): string =>
  [
    "This oral defence will be recorded: your spoken answers, as audio.",
    transcription
      ? transcription.local
        ? `The recordings are transcribed on this machine (${transcription.model}) and do not leave it.`
        : `The recordings are sent to ${transcription.provider === "elevenlabs" ? "ElevenLabs" : "the transcription provider"} (${transcription.name}, ${transcription.model}) to be transcribed.`
      : "No transcription service is set up yet; the recordings are kept on this machine until one is.",
    "Your professor reads the transcripts and decides your mark; the system only proposes.",
    "You may ask to stop at any time.",
  ].join(" ");

/** Record the student's answer to the consent statement. A later answer replaces an earlier one. */
export const recordConsent = (
  place: DefencePlace,
  ids: { submission_id: string; assessment_id: string; student_id: string },
  consent: Omit<Consent, "withdrawn_at">,
): Session => {
  const session = readSession(place.session) ?? { ...ids, answers: [] };
  session.consent = consent;
  writeSession(place.session, session);
  return session;
};

/**
 * The student withdrew. Recording stops, every take so far is marked
 * `withdrawn` so nothing cites it, and the recordings stay: deleting a
 * student's recordings is the professor's decision under their university's
 * rules, not something the desk does on the way past.
 */
export const withdrawConsent = (place: DefencePlace, at: string): Session => {
  const session = readSession(place.session);
  if (!session?.consent?.agreed) throw new Error("there is no consent to withdraw");
  session.consent.withdrawn_at = at;
  for (const answer of session.answers) answer.withdrawn = true;
  writeSession(place.session, session);
  return session;
};

const SESSION_HEADER =
  "# PRIVATE — what one student said at their oral defence. Outside the\n" +
  "# repository, beside the recordings in answers/. A transcript is what a model\n" +
  "# heard; a segment marked `confidence: low` is to be listened to, not scored.\n\n";

export const readSession = (file: string): Session | null => {
  if (!existsSync(file)) return null;
  const value = parse(readFileSync(file, "utf-8"));
  return value && typeof value === "object" && Array.isArray(value.answers) ? (value as Session) : null;
};

export const writeSession = (file: string, session: Session): void => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, SESSION_HEADER + stringify(session, { lineWidth: 0 }), "utf-8");
};

const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

/** The audio types a recording is accepted in: what browsers record, and what phones save. */
export const audioExtension = (mime: string): string | null => EXTENSIONS[mime.split(";")[0]!.trim().toLowerCase()] ?? null;

/**
 * Keep one take: the audio under `answers/`, and an entry in the session with
 * no transcript yet. The transcript is added by `setTranscript` once the
 * provider has answered, so a provider that fails leaves the recording safe.
 */
export const saveAnswer = (options: {
  place: DefencePlace;
  ids: { submission_id: string; assessment_id: string; student_id: string };
  questionId: string;
  bytes: Uint8Array;
  mime: string;
  seconds?: number | null;
  professorSpoke?: Range[];
  askedAt?: string | null;
  now?: Date;
}): { answer: Answer; path: string } => {
  if (!/^Q\d+$/.test(options.questionId)) throw new Error(`${options.questionId} is not a question id`);
  const extension = audioExtension(options.mime);
  if (!extension) throw new Error(`${options.mime} is not an audio type this keeps`);
  const session = readSession(options.place.session) ?? { ...options.ids, answers: [] };
  // AGT-7: nothing is kept without the student's recorded agreement. The
  // bytes are not written at all, so a refused take leaves no trace.
  if (!consentGiven(session)) {
    throw new Error(
      session.consent?.withdrawn_at
        ? "the student withdrew consent; nothing more is recorded"
        : "no recorded consent: the student has to agree to be recorded first",
    );
  }
  const take = session.answers.filter((answer) => answer.question_id === options.questionId).length + 1;
  const audio = `answers/${options.questionId}-${take}.${extension}`;
  const path = join(options.place.dir, audio);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, options.bytes);
  const answer: Answer = {
    question_id: options.questionId,
    take,
    audio,
    mime: options.mime.split(";")[0]!.trim(),
    recorded_at: (options.now ?? new Date()).toISOString(),
    ...(options.askedAt ? { asked_at: options.askedAt } : {}),
    seconds: typeof options.seconds === "number" && options.seconds > 0 ? Math.round(options.seconds * 10) / 10 : null,
    transcript: null,
    ...(options.professorSpoke?.length ? { professor_spoke: options.professorSpoke } : {}),
  };
  session.answers.push(answer);
  writeSession(options.place.session, session);
  return { answer, path };
};

/** Put a transcript, or the reason there is none, on one take. */
export const setTranscript = (
  place: DefencePlace,
  questionId: string,
  take: number,
  result: { transcript: Transcript } | { error: string },
): Answer => {
  const session = readSession(place.session);
  const answer = session?.answers.find((entry) => entry.question_id === questionId && entry.take === take);
  if (!session || !answer) throw new Error(`no take ${take} of ${questionId} in ${place.session}`);
  if ("transcript" in result) {
    answer.transcript = result.transcript;
    delete answer.error;
    if (answer.seconds === null && result.transcript.seconds !== null) answer.seconds = result.transcript.seconds;
  } else {
    answer.error = result.error;
  }
  writeSession(place.session, session);
  return answer;
};

/** The words a provider should expect: the question, and the names it cites. */
export const transcriptionPrompt = (question: Question | undefined): string | null =>
  question
    ? [question.text, ...question.evidence.map((cite) => cite.path)].join(" ").slice(0, 800)
    : null;

/**
 * Transcribe one take and write the result onto it. A provider that fails is
 * written down as the take's `error`, not thrown: the recording is already
 * safe, and the professor can transcribe it again later.
 */
export const transcribeTake = async (options: {
  place: DefencePlace;
  answer: Answer;
  transcribe: Transcriber;
  question?: Question;
  language?: string | null;
}): Promise<Answer> => {
  const { place, answer } = options;
  try {
    const transcript = await options.transcribe(
      { path: join(place.dir, answer.audio), mime: answer.mime, seconds: answer.seconds },
      { language: options.language ?? null, prompt: transcriptionPrompt(options.question) },
    );
    return setTranscript(place, answer.question_id, answer.take, {
      transcript: labelSpeakers(transcript, answer.professor_spoke ?? []),
    });
  } catch (error) {
    return setTranscript(place, answer.question_id, answer.take, { error: (error as Error).message });
  }
};

// --------------------------------------------------------------------------
// The brief
// --------------------------------------------------------------------------

/**
 * The brief students were given, as text, when the course holds it as a
 * markdown or text file in the workspace; else the assessment's description.
 */
export const briefText = (
  root: string,
  documents: { document_id: string; storage_key?: string }[],
  assessment: { instructions_document_id?: string | null; description?: string | null },
): string | null => {
  const document = documents.find((entry) => entry.document_id === assessment.instructions_document_id);
  const key = String(document?.storage_key ?? "");
  if (key && !key.includes("://") && /\.(md|txt)$/i.test(key) && existsSync(join(root, key))) {
    return readFileSync(join(root, key), "utf-8");
  }
  return assessment.description ?? null;
};

// --------------------------------------------------------------------------
// What to ask next (AGT-2)
// --------------------------------------------------------------------------

/**
 * One choice the hands-free desk made after an answer: ask a follow-up it
 * wrote, ask a prepared question, or stop. Kept in the session with the reason
 * and with what the professor did in the five seconds they had to step in, so
 * an appeal replays not only what was said but why each question came.
 */
export interface Decision {
  after: string | null;
  action: "follow_up" | "next" | "done";
  question_id: string | null;
  why: string;
  by: string;
  at: string;
  /** What the professor did instead, if anything. */
  overridden?: "skip" | "edit" | "ask_now" | "pause";
  notes?: string[];
}

/** How deep a chain of follow-ups may go before the desk moves on regardless. */
export const FOLLOW_UP_DEPTH = 2;

export const NEXT_SYSTEM = [
  "You run a short oral defence of one student's homework, one question at a time, for a university professor who is listening.",
  "After each answer you choose what is asked next: a follow-up on the answer just given, the next prepared question, or that the defence is done.",
  "You never grade, never tell the student whether they were right, and never accuse. Your only output is the choice, as JSON.",
].join(" ");

/** The prompt for one choice: the code first, which does not change, then the defence so far. */
export const nextPrompt = (context: {
  digest: string;
  questions: Question[];
  answers: Answer[];
  after: string | null;
}): string => {
  const said = (id: string): string => {
    const takes = context.answers.filter((answer) => answer.question_id === id);
    if (!takes.length) return "  (not asked yet)";
    return takes
      .map((take) => {
        if (!take.transcript) return "  (recorded, no transcript)";
        // Only the student's words are the answer. The professor's are shown
        // as theirs, so a follow-up is never built on what the professor said.
        const words = take.transcript.segments
          .map((segment) => {
            const text = segment.confidence === "low" ? `[unsure: ${segment.text}]` : segment.text;
            if (segment.speaker === "professor") return `[professor: ${segment.text}]`;
            if (segment.speaker === "unknown") return `[another voice: ${segment.text}]`;
            return text;
          })
          .join(" ");
        return take.transcript.speakers?.unclear
          ? `  (voices unclear, not the student's answer for certain: ${take.transcript.speakers.note ?? ""}) ${words}`
          : "  " + words;
      })
      .join("\n");
  };
  const open = context.questions.filter((q) => !context.answers.some((answer) => answer.question_id === q.id));
  return [
    context.digest,
    "",
    "## The defence so far",
    ...context.questions.map(
      (question) =>
        `${question.id}${question.follows ? ` (follow-up on ${question.follows})` : ""}` +
        `${question.criterion_id ? ` [${question.criterion_id}]` : ""}: ${question.text}\n${said(question.id)}`,
    ),
    "",
    "## Now",
    context.after ? `The student has just answered ${context.after}.` : "The defence is starting.",
    `Prepared questions not asked yet: ${open.map((q) => q.id).join(", ") || "none"}.`,
    "",
    "Return only a JSON object, one of:",
    '{"action": "follow_up", "text": "...", "criterion_id": "CRIT-..." or null, "why": "..."}',
    '{"action": "next", "question_id": "Q3", "why": "..."}',
    '{"action": "done", "why": "..."}',
    "",
    "Rules:",
    "- A follow-up only when the answer just given left a gap that matters for a criterion: a claim not justified, a step skipped, something said that the code does not do. Otherwise move on.",
    "- A follow-up is one plain spoken question about that answer, in the language the student answered in. Never repeat a question already asked.",
    "- Words marked [unsure: ...] were hard to hear: do not build a question on them.",
    "- next names a prepared question not asked yet; prefer one whose criterion has no evidence so far.",
    "- done when every criterion has been asked about, or nothing useful is left to ask.",
    "- why is one sentence for the professor.",
  ].join("\n");
};

/**
 * The model's choice, checked rather than trusted, as the decision to record
 * and — for a follow-up — the question to add.
 *
 * Anything unusable falls back to the first prepared question not yet asked,
 * with a note: the defence must go on whatever the model replied. A follow-up
 * on a follow-up on a follow-up is refused for the same reason a person would
 * refuse it — the desk moves on.
 */
export const decideNext = (
  text: string,
  context: {
    questions: Question[];
    answers: Answer[];
    criteria: Criterion[];
    files: CodeFile[];
    after: string | null;
    by: string;
    at: string;
  },
): { decision: Decision; followUp: Question | null } => {
  const notes: string[] = [];
  const asked = new Set(context.answers.map((answer) => answer.question_id));
  const open = context.questions.filter((q) => !asked.has(q.id));
  const fallback = (why: string): { decision: Decision; followUp: null } => {
    notes.push(why);
    const next = open[0];
    return {
      decision: {
        after: context.after,
        action: next ? "next" : "done",
        question_id: next?.id ?? null,
        why: next ? "the next prepared question" : "every prepared question has been asked",
        by: context.by,
        at: context.at,
        notes,
      },
      followUp: null,
    };
  };
  const reply = parseReply(text);
  if (!reply || typeof reply.action !== "string") return fallback("the model's reply was not a choice");
  const why = String(reply.why ?? "").trim();
  const base = { after: context.after, why, by: context.by, at: context.at };

  if (reply.action === "done") {
    return { decision: { ...base, action: "done", question_id: null }, followUp: null };
  }
  if (reply.action === "next") {
    const id = String(reply.question_id ?? "");
    if (!open.some((q) => q.id === id)) {
      return fallback(`the model chose ${id || "no question"}, which is not a prepared question still to ask`);
    }
    return { decision: { ...base, action: "next", question_id: id }, followUp: null };
  }
  if (reply.action === "follow_up") {
    if (!context.after) return fallback("a follow-up before any answer");
    let depth = 0;
    let at = context.questions.find((q) => q.id === context.after);
    while (at?.follows) {
      depth += 1;
      const parent: string = at.follows;
      at = context.questions.find((q) => q.id === parent);
    }
    if (depth >= FOLLOW_UP_DEPTH) return fallback(`${context.after} is already ${depth} follow-ups deep`);
    const { questions, notes: checked } = checkQuestions(
      {
        questions: [
          { text: reply.text, criterion_id: reply.criterion_id ?? null, why, evidence: reply.evidence ?? [], follows: context.after },
        ],
      },
      context.criteria,
      context.files,
      context.questions,
    );
    const followUp = questions[0];
    if (!followUp) return fallback("the model's follow-up had no text");
    notes.push(...checked);
    return {
      decision: { ...base, action: "follow_up", question_id: followUp.id, ...(notes.length ? { notes } : {}) },
      followUp,
    };
  }
  return fallback(`"${reply.action}" is not a choice the desk knows`);
};

/** Add a decision to the session, and return its index for the professor's override to point at. */
export const recordDecision = (
  place: DefencePlace,
  ids: { submission_id: string; assessment_id: string; student_id: string },
  decision: Decision,
): number => {
  const session = readSession(place.session) ?? { ...ids, answers: [] };
  session.decisions = [...(session.decisions ?? []), decision];
  writeSession(place.session, session);
  return session.decisions.length - 1;
};

/** Mark what the professor did instead of letting a decision stand. */
export const overrideDecision = (
  place: DefencePlace,
  index: number,
  override: NonNullable<Decision["overridden"]>,
): void => {
  const session = readSession(place.session);
  const decision = session?.decisions?.[index];
  if (!session || !decision) throw new Error(`no decision ${index} in ${place.session}`);
  decision.overridden = override;
  writeSession(place.session, session);
};

/** Change a question's text — the professor's edit before it is asked. */
export const editQuestion = (file: string, questionId: string, text: string): Question => {
  const drafted = readDefence(file);
  const question = drafted?.questions.find((entry) => entry.id === questionId);
  if (!drafted || !question) throw new Error(`no question ${questionId} in ${file}`);
  if (!text.trim()) throw new Error("a question needs words");
  question.text = text.trim();
  writeDefence(file, drafted);
  return question;
};

// --------------------------------------------------------------------------
// The replay (AGT-7, LIV-3)
// --------------------------------------------------------------------------

export interface ReplayEntry {
  at: string;
  kind: "consent" | "withdrawn" | "decision" | "answer";
  text: string;
}

const OVERRIDES: Record<NonNullable<Decision["overridden"]>, string> = {
  skip: "the professor skipped it",
  edit: "the professor reworded it",
  ask_now: "the professor asked it at once",
  pause: "the professor paused the defence",
};

/**
 * The whole exchange in the order it happened, for an appeal: what the
 * student agreed to, each question and why it came, what the professor did
 * instead, and what was said — whose words were whose, and which were
 * unclear or withdrawn. Built only from what the session recorded; nothing
 * here is inferred after the fact.
 */
export const replay = (session: Session | null, questions: Question[]): ReplayEntry[] => {
  if (!session) return [];
  const byId = new Map(questions.map((question) => [question.id, question]));
  const entries: ReplayEntry[] = [];
  if (session.consent) {
    entries.push({
      at: session.consent.at,
      kind: "consent",
      text: `${session.consent.agreed ? "The student agreed to be recorded" : "The student did not agree to be recorded"}, having been told: "${session.consent.statement}"`,
    });
    if (session.consent.withdrawn_at) {
      entries.push({ at: session.consent.withdrawn_at, kind: "withdrawn", text: "The student withdrew consent. Recording stopped; the takes before it are kept and marked withdrawn." });
    }
  }
  for (const decision of session.decisions ?? []) {
    const chosen = decision.question_id ? byId.get(decision.question_id) : null;
    const what =
      decision.action === "done"
        ? "chose to end the defence"
        : decision.action === "follow_up"
          ? `wrote a follow-up, ${decision.question_id}: "${chosen?.text ?? "?"}"`
          : `chose ${decision.question_id}: "${chosen?.text ?? "?"}"`;
    entries.push({
      at: decision.at,
      kind: "decision",
      text:
        `${decision.after ? `After ${decision.after}, ` : ""}${decision.by} ${what}` +
        (decision.why ? ` — ${decision.why.replace(/[.\s]+$/, "")}` : "") +
        (decision.overridden ? `. Then ${OVERRIDES[decision.overridden]}.` : "") +
        (decision.notes?.length ? ` (${decision.notes.join("; ")})` : ""),
    });
  }
  for (const answer of session.answers) {
    const heard = answer.transcript;
    const words = heard
      ? heard.segments
          .map((segment) =>
            segment.speaker === "professor"
              ? `[professor: ${segment.text}]`
              : segment.speaker === "unknown"
                ? `[another voice: ${segment.text}]`
                : segment.confidence === "low"
                  ? `[unsure: ${segment.text}]`
                  : segment.text,
          )
          .join(" ")
      : `(no transcript${answer.error ? `: ${answer.error}` : ""})`;
    const flags = [
      answer.withdrawn ? "WITHDRAWN" : null,
      heard?.speakers?.unclear ? "VOICES UNCLEAR" : null,
    ].filter(Boolean);
    entries.push({
      at: answer.asked_at ?? answer.recorded_at,
      kind: "answer",
      text: `${answer.question_id} take ${answer.take}${answer.seconds ? `, ${answer.seconds}s` : ""}${flags.length ? ` [${flags.join(", ")}]` : ""} (${answer.audio}): ${words}`,
    });
  }
  return entries.sort((a, b) => a.at.localeCompare(b.at));
};
