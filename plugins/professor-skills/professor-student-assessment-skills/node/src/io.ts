import { readFile } from "node:fs/promises";
import type { Evaluation, Rubric } from "./types.ts";

export async function readRubric(path: string): Promise<Rubric> {
  let parsed: unknown;
  try { parsed = JSON.parse(await readFile(path, "utf8")); }
  catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`cannot read rubric JSON ${path}: ${detail}`);
  }
  if (!parsed || typeof parsed !== "object" || typeof (parsed as Rubric).rubric_id !== "string") {
    throw new Error("rubric must contain rubric_id");
  }
  return parsed as Rubric;
}

export async function readStdin(): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) throw new Error("expected evaluation JSON on stdin");
  try { return JSON.parse(text); }
  catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`stdin is not valid JSON: ${detail}`);
  }
}

export function evaluationsFrom(value: unknown): Evaluation[] {
  const candidate = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { evaluations?: unknown }).evaluations)
      ? (value as { evaluations: unknown[] }).evaluations
      : [value];
  for (const item of candidate) {
    if (!item || typeof item !== "object") throw new Error("each evaluation must be an object");
  }
  return candidate as Evaluation[];
}
