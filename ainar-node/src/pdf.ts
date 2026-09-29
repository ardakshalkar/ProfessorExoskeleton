/**
 * A `.pptx` to PDF through LibreOffice — the one converter, and the one way of
 * finding it.
 *
 * There were three: `render-deck` had a careful one, the slide engine had one
 * that ignored the exit code and looked for the PDF beside the source rather
 * than in `--outdir`, and `materials build` had its own probe with its own list
 * of install paths. Three probes disagree about whether a machine has a
 * converter, and the careless converter is the one that registered a stale PDF
 * as a fresh one.
 *
 * The PDF is a conversion of THIS deck rather than a second renderer's idea of
 * it: anything that renders the markdown twice produces two documents that
 * merely look the same.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

/** Where installers put it. Windows does not add it to PATH. */
const INSTALLS = [
  "C:/Program Files/LibreOffice/program/soffice.exe",
  "C:/Program Files (x86)/LibreOffice/program/soffice.exe",
  "/usr/bin/soffice",
  "/usr/bin/libreoffice",
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
];

/**
 * LibreOffice, by known location, or null.
 *
 * `SOFFICE` and `SOFFICE_PATH` both override: the first is what `materials
 * build` documented, the second what `bin/deck.cmd` sets, and a professor who
 * set either should not be told there is no converter.
 *
 * Exported for `dsh-professor-pane`, which asks the same question to decide
 * whether it may offer a `.pptx` preview — two probes with two lists of paths
 * would disagree, and the pane would offer a control that then failed.
 */
export const officeAt = (): string | null => {
  const candidates = [process.env.SOFFICE ?? "", process.env.SOFFICE_PATH ?? "", ...INSTALLS].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // not here; try the next
    }
  }
  return null;
};

export type PdfResult = { pdf: string } | { error: string };

/**
 * The deck through LibreOffice, or a reason it did not convert.
 *
 * What the converters before this got wrong, each of which read as
 * "LibreOffice not found":
 *
 * 1. **Looking for the PDF beside the source**, not in `--outdir`. The same
 *    directory in the normal path, different the moment anyone passes `--out`.
 * 2. **Ignoring the exit code**, so a failed conversion that left an older PDF
 *    in place was a success — and the stale file was then registered as this
 *    deck's render.
 * 3. **Trusting a zero exit.** LibreOffice exits 0 without converting when
 *    another instance holds its profile, so the file's age is checked too.
 * 4. **Saying nothing about why.** Its complaint is on stderr, and is carried.
 *
 * A failed attempt is retried once with a private user profile. On a machine
 * where the default profile is locked or unwritable — a sandboxed session, an
 * office suite already open — soffice crashes (0xC0000409 on Windows) or exits
 * quietly, and a throwaway profile is what makes it convert.
 */
export function toPdf(pptx: string, outDir: string): PdfResult {
  const found = officeAt();
  const binaries = [...new Set([...(found ? [found] : []), "soffice"])];
  const pdf = join(outDir, basename(pptx).replace(/\.pptx$/i, ".pdf"));
  const attempts: string[] = [];

  const attempt = (binary: string, profile: string | null): "ok" | "absent" | string => {
    const started = Date.now();
    const result = spawnSync(
      binary,
      [
        ...(profile ? [`-env:UserInstallation=${pathToFileURL(profile).href}`] : []),
        "--headless", "--convert-to", "pdf", "--outdir", outDir, pptx,
      ],
      { encoding: "utf8" },
    );
    if (result.error) return "absent";
    // A second of slack: some filesystems keep mtimes to the second.
    const fresh = existsSync(pdf) && statSync(pdf).mtimeMs >= started - 1000;
    if (result.status === 0 && fresh) return "ok";
    return (
      `exit ${result.status}` +
      (result.stderr?.trim() ? ` — ${result.stderr.trim().split(/\r?\n/)[0]}` : "") +
      (existsSync(pdf) && !fresh ? " (a PDF is there, but it is from an earlier run)" : "")
    );
  };

  for (const binary of binaries) {
    const first = attempt(binary, null);
    if (first === "ok") return { pdf };
    if (first === "absent") {
      attempts.push(`${binary}: not found`);
      continue;
    }
    const profile = mkdtempSync(join(tmpdir(), "ainar-soffice-"));
    try {
      const second = attempt(binary, profile);
      if (second === "ok") return { pdf };
      attempts.push(`${binary}: ${first}; with a private profile, ${second === "absent" ? "not found" : second}`);
    } finally {
      rmSync(profile, { recursive: true, force: true });
    }
  }
  return {
    error: attempts.some((line) => !line.endsWith("not found"))
      ? `LibreOffice did not convert it:\n    ${attempts.join("\n    ")}`
      : "No LibreOffice to run — looked on PATH and the usual install paths. Set SOFFICE_PATH to soffice.",
  };
}
