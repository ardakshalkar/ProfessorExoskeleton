import { resolve } from "node:path";
import { canvasPlan, doctorCanvas, publishCanvas } from "./canvas.ts";
import { defaultConnectionsPath, loadProfile, loadPublication, resolveToken } from "./config.ts";
import { doctorMoodle, moodlePlan, publishMoodle } from "./moodle.ts";
import { doctorTelegram, publishTelegram, telegramPlan } from "./telegram.ts";
import type { ConnectionProfile, Publication } from "./types.ts";

const usage = `Usage:
  prof-publish plan --profile NAME --input publication.json [--connections FILE]
  prof-publish doctor --profile NAME [--connections FILE]
  prof-publish publish --profile NAME --input publication.json --confirm [--connections FILE]

Connection path precedence: --connections, PROFESSOR_CONNECTIONS, ~/.professor/connections.json`;

function parseArgs(argv: string[]): { command: string; values: Map<string, string | boolean> } {
  const command = argv[0] ?? "help";
  const values = new Map<string, string | boolean>();
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (!arg.startsWith("--")) throw new Error(`unexpected argument ${arg}\n${usage}`);
    if (arg === "--confirm") { values.set("confirm", true); continue; }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${arg} needs a value`);
    values.set(arg.slice(2), value);
    index += 1;
  }
  return { command, values };
}

function required(values: Map<string, string | boolean>, key: string): string {
  const value = values.get(key);
  if (typeof value !== "string") throw new Error(`--${key} is required\n${usage}`);
  return value;
}

function plan(profile: ConnectionProfile, publication: Publication): object {
  if (profile.type === "canvas") return { provider: "canvas", ...canvasPlan(profile, publication) };
  if (profile.type === "moodle") return { provider: "moodle", ...moodlePlan(profile, publication) };
  return { provider: "telegram", ...telegramPlan(profile, publication) };
}

async function publish(profile: ConnectionProfile, publication: Publication): Promise<unknown> {
  const token = resolveToken(profile);
  if (profile.type === "canvas") return publishCanvas(profile, token, publication);
  if (profile.type === "moodle") return publishMoodle(profile, token, publication);
  return publishTelegram(profile, token, publication);
}

async function doctor(profile: ConnectionProfile): Promise<unknown> {
  const token = resolveToken(profile);
  if (profile.type === "canvas") return doctorCanvas(profile, token);
  if (profile.type === "moodle") return doctorMoodle(profile, token);
  return doctorTelegram(profile, token);
}

export async function runCli(argv: string[]): Promise<void> {
  const { command, values } = parseArgs(argv);
  if (["help", "--help", "-h"].includes(command)) { console.log(usage); return; }
  if (!["plan", "doctor", "publish"].includes(command)) throw new Error(`unknown command ${command}\n${usage}`);
  const connectionPath = resolve(String(values.get("connections") ?? process.env.PROFESSOR_CONNECTIONS ?? defaultConnectionsPath()));
  const profileName = required(values, "profile");
  const profile = await loadProfile(connectionPath, profileName);
  let output: unknown;
  if (command === "doctor") {
    output = await doctor(profile);
  } else {
    const publication = await loadPublication(resolve(required(values, "input")));
    if (command === "plan") output = { mode: "preview", profile: profileName, ...plan(profile, publication) };
    else {
      if (values.get("confirm") !== true) throw new Error("refusing external write: rerun publish with --confirm after reviewing prof-publish plan");
      output = await publish(profile, publication);
    }
  }
  console.log(JSON.stringify(output, null, 2));
}
