/**
 * Who is asking (GRD-3): the commands that decide a grade or send one run on
 * the professor's word, and this is where the CLI tells that word from the
 * assistant's.
 *
 * Two roads are the professor's:
 *
 *   - **Their own terminal.** stdin or stdout is a terminal, and the
 *     environment carries none of the marks an assistant's shell sets on every
 *     command it runs (`DSH_SHELL`, `CLAUDECODE`, …). DSH runs its shell in a
 *     pseudo-terminal, so a terminal alone proves nothing; the marks are what
 *     tell the two apart.
 *   - **A press in the pane.** The harness signs the command line it spawns,
 *     with an Ed25519 key it makes at start and keeps in memory. Only the
 *     public half is written down, under `~/.ainar/press/`, one file per running
 *     harness. A press names its argv, the hash of what it writes to stdin and
 *     when; the CLI checks all three.
 *
 * What this does not stop, said plainly: a process of this user that unsets
 * the marks and fakes a terminal, or writes a public key of its own into
 * `~/.ainar/press/`. Each is a deliberate act, not a road anyone takes by
 * following a skill; and under DSH's sandbox `~/.ainar` cannot be written
 * without the professor's approval of that very write.
 */

import { createHash, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Set by an assistant's shell on every command it runs. One name per harness;
 * a harness not listed here is told apart only by its lack of a terminal.
 */
export const AGENT_MARKS: Readonly<Record<string, string>> = {
  DSH_SHELL: "DSH's shell (dsh-terminal-bash)",
  CLAUDECODE: "Claude Code's shell",
  AI_AGENT: "an agent that names itself (AI_AGENT)",
  CODEX_SANDBOX: "Codex's sandbox",
  GEMINI_CLI: "Gemini CLI's shell",
  CURSOR_AGENT: "Cursor's agent",
};

/** How long a press stays good after the harness signs it. */
export const PRESS_TTL_MS = 5 * 60_000;

/** Where running harnesses leave the public half of their press key. */
export const pressDir = (): string => process.env.AINAR_PRESS_DIR ?? join(homedir(), ".ainar", "press");

/** The commands whose run is the professor's word: a grade decided, held, curved or sent. */
export const decidesOrSends = (positional: string[], args: string[]): string | null => {
  const [command, sub] = positional;
  const confirm = args.includes("--confirm");
  if (command === "grade" && sub === "decide") return "grade decide";
  // With a criterion it changes the mark; without, it records whether the
  // student defended, a fact the professor may tell the assistant to note.
  if (command === "defence" && sub === "mark" && args.includes("--criterion")) return "defence mark --criterion";
  if (command === "curve") return "curve";
  if (command === "integrity" && (sub === "open" || sub === "decide")) return `integrity ${sub}`;
  if (command === "decisions" && sub === "adopt") return "decisions adopt";
  if (command === "lms" && (sub === "push" || sub === "send-reports") && confirm) return `lms ${sub} --confirm`;
  if (command === "sync" && sub === "run" && confirm) return "sync run --confirm";
  return null;
};

const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");
const message = (press: { at: number; argv: string[]; input: string }): Buffer =>
  Buffer.from(JSON.stringify({ v: 1, at: press.at, argv: press.argv, input: press.input }));

// --------------------------------------------------------------------------
// The harness's half
// --------------------------------------------------------------------------

let mine: { privateKey: KeyObject; id: string } | null = null;

/** Whether a harness that wrote a key file is still running. */
const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

/**
 * This process's press key, made on first use. The public half is written
 * under `pressDir()` as `<pid>-<id>.pub` and removed on exit; files left by a
 * harness that is no longer running are removed here.
 */
const pressKey = (): { privateKey: KeyObject; id: string } => {
  if (mine) return mine;
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const id = sha256(pem).slice(0, 16);
  const dir = pressDir();
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) {
    const pid = Number(name.split("-")[0]);
    if (name.endsWith(".pub") && Number.isInteger(pid) && pid !== process.pid && !alive(pid)) {
      try {
        unlinkSync(join(dir, name));
      } catch {
        // Another harness removed it first.
      }
    }
  }
  const file = join(dir, `${process.pid}-${id}.pub`);
  writeFileSync(file, pem, { mode: 0o600 });
  process.once("exit", () => {
    try {
      unlinkSync(file);
    } catch {
      // Already gone.
    }
  });
  mine = { privateKey, id };
  return mine;
};

/**
 * The environment variable that makes a spawned `ainar …` the professor's
 * press: this argv (exactly what follows the script path), this stdin, now.
 */
export const signPress = (argv: string[], input: string | null = null, at = Date.now()): string => {
  const key = pressKey();
  const press = { at, argv, input: sha256(input ?? "") };
  const sig = sign(null, message(press), key.privateKey).toString("base64");
  return Buffer.from(JSON.stringify({ ...press, key: key.id, sig })).toString("base64url");
};

// --------------------------------------------------------------------------
// The CLI's half
// --------------------------------------------------------------------------

/** The public keys of the harnesses running now, by id. */
const knownKeys = (): Map<string, KeyObject> => {
  const keys = new Map<string, KeyObject>();
  const dir = pressDir();
  if (!existsSync(dir)) return keys;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".pub")) continue;
    const path = join(dir, name);
    try {
      if (!statSync(path).isFile()) continue;
      keys.set(name.slice(0, -4).split("-").slice(1).join("-"), createPublicKey(readFileSync(path, "utf-8")));
    } catch {
      // An unreadable or half-written file is no key.
    }
  }
  return keys;
};

export interface Asker {
  /** `terminal`, `press`, or null when neither road is the professor's. */
  via: "terminal" | "press" | null;
  /** For a press: the hash of the stdin it was signed with. */
  input?: string;
  /** Why not, in a sentence, when `via` is null. */
  why?: string;
}

/**
 * Whether a press signed for `signed` covers `argv`: the same command line,
 * or a command `sync run RUN … --confirm` hands its work to (`lms push`, …),
 * which the sync spawns with the press it was given.
 */
const covers = (signed: string[], argv: string[]): boolean => {
  if (signed.length === argv.length && signed.every((word, at) => word === argv[at])) return true;
  // The pane spawns a sync as `sync run RUN SYNC …`.
  const [command, sub, runId] = signed;
  return command === "sync" && sub === "run" && signed.includes("--confirm") && Boolean(runId) && argv.includes(runId!);
};

/** Whether `env` carries a press that covers `argv`, and the stdin hash it names. */
export const pressFor = (argv: string[], env: NodeJS.ProcessEnv, now = Date.now()): Asker => {
  const raw = env.AINAR_PRESS;
  if (!raw) return { via: null, why: "no press from the pane" };
  let press: { at: number; argv: string[]; input: string; key: string; sig: string };
  try {
    press = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8"));
  } catch {
    return { via: null, why: "the press could not be read" };
  }
  if (!Array.isArray(press.argv) || typeof press.at !== "number" || typeof press.sig !== "string") {
    return { via: null, why: "the press could not be read" };
  }
  if (now - press.at > PRESS_TTL_MS || press.at - now > 60_000) return { via: null, why: "the press is older than five minutes" };
  if (!covers(press.argv, argv)) return { via: null, why: "the press was for another command" };
  const key = knownKeys().get(press.key);
  if (!key) return { via: null, why: "the press was signed by no harness running now" };
  if (!verify(null, message(press), key, Buffer.from(press.sig, "base64"))) return { via: null, why: "the press's signature does not hold" };
  return { via: "press", input: press.input };
};

/** The assistant shell this environment says it is, or null. */
export const agentMark = (env: NodeJS.ProcessEnv): string | null => {
  const name = Object.keys(AGENT_MARKS).find((key) => env[key] !== undefined && env[key] !== "");
  return name ? `${AGENT_MARKS[name]} (${name} is set)` : null;
};

/**
 * Who is running this command: the professor at their own terminal, the
 * professor's press in the pane, or neither.
 */
export const whoIsAsking = (
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  tty: boolean = Boolean(process.stdin.isTTY || process.stdout.isTTY),
  now = Date.now(),
): Asker => {
  const pressed = pressFor(argv, env, now);
  if (pressed.via) return pressed;
  const mark = agentMark(env);
  if (mark) return { via: null, why: `it was run from ${mark}` };
  if (!tty) return { via: null, why: `it was run with no terminal and ${pressed.why}` };
  return { via: "terminal" };
};

/** Whether stdin read by a pressed command is what the press was signed with. */
export const sameInput = (asker: Asker, text: string): boolean => asker.via !== "press" || asker.input === sha256(text);

/** The refusal a deciding command prints, or null when it may run. */
export const refusal = (what: string, asker: Asker): string | null =>
  asker.via
    ? null
    : `ainar ${what} decides or sends a grade, so it runs only on the professor's word: ` +
      `typed at their own terminal, or pressed in the pane. Not run: ${asker.why}.`;
