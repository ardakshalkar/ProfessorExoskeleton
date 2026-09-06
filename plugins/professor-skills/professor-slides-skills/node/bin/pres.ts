#!/usr/bin/env node

/**
 * `pres` — the mechanical half of the presentation skills.
 *
 * Everything here is a thing better done by a program than by judgement:
 * finding the course, bounding what one session may cover, choosing how deep a
 * harness the request needs, projecting the render contract out of the two files
 * that are actually edited, and refusing to render a deck whose figures carry no
 * credit. The writing is the skills' job; the bookkeeping is this.
 *
 *     pres route   "make 5 slides explaining RAG"
 *     pres source  --course CSS-4008
 *     pres context --course CSS-4008 --module MODULE-06 --brief
 *     pres grammar --deck technical_lecture
 *     pres beats   --family create_need
 *     pres outline check work/CSS-4008-2026-FALL/presentations/MODULE-06-slides.outline.yaml
 *     pres plan build work/.../MODULE-06-slides.md --mode standard
 *     pres check   work/.../MODULE-06-slides.md
 *     pres render  work/.../MODULE-06-slides.md --pdf
 *     pres find-image --search "confusion matrix"
 *
 * `--timing` on any command, or `PRES_TIMING=1`, prints where the time went.
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildModuleContext,
  describeContext,
  describeContextBrief,
  inTeachingOrder,
  moduleOnDate,
} from "../src/context.ts";
import { checkDeck, describeProblems, errorsIn } from "../src/check.ts";
import { describeResults, downloadImage, figureEntry, searchImages } from "../src/find-image.ts";
import { checkOutline, loadOutline } from "../src/plan.ts";
import { buildPlan } from "../src/compile.ts";
import { renderDeck } from "../src/render.ts";
import { describeDraft } from "../src/draft.ts";
import { describeProvenance, resolveCourse, type ResolveOptions } from "../src/source.ts";
import { decideMode, describeRoute, isMode, MODES, type Mode, type SourcePreference } from "../src/route.ts";
import { describeGrammar, describeGrammars, grammarFor } from "../src/grammars.ts";
import { describeBeat, describeCatalogue, findBeat, loadBeats, selectBeats } from "../src/beats.ts";
import { describeArchetypes } from "../src/rules.ts";
import { describeRules, RULE_GROUPS } from "../src/rules.ts";
import { enableTiming, enableTimingFromEnvironment, reportTimings } from "../src/timing.ts";
import type { Origin } from "../src/model.ts";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);

/** Flags that consume the token after them, so a path is never mistaken for one. */
const VALUE_FLAGS = new Set([
  "--course", "--version", "--course-file", "--only", "--module", "--date",
  "--out", "--search", "--limit", "--pick", "--name", "--into",
  "--source", "--mode", "--approval", "--slides", "--minutes", "--deck",
  "--discipline", "--family", "--phase", "--outline", "--request",
]);

/**
 * The bare arguments after the command word, in order.
 *
 * `pres render --out DIR DECK.md` has to find `DECK.md` and not `DIR`, so this
 * skips the value of every flag that takes one rather than taking the first
 * token that does not start with a dash.
 */
function positional(from: number): string[] {
  const out: string[] = [];
  for (let index = from; index < args.length; index += 1) {
    const token = args[index]!;
    if (token.startsWith("--")) {
      if (VALUE_FLAGS.has(token)) index += 1;
      continue;
    }
    out.push(token);
  }
  return out;
}

const USAGE = `pres — routing, course source, catalogues, checking and rendering

  pres route [REQUEST] [--mode fast|standard|deep] [--slides N] [--json]
      Which execution depth this request needs, and the workflow for it.
      FAST for small and straightforward, STANDARD by default, DEEP when
      there is a concrete reason. An explicit --mode always wins.

  pres source [--course ID] [--version TERM] [--source auto|database|local]
              [--only SOURCE] [--fresh-route] [--json]
      Where the course is, and what it says. --source database refuses to
      fall back; --source local never touches the network. --only is
      supabase, course-directory or flat-file, for diagnosing a fallback.

  pres courses
      Every course this machine can reach, and from where.

  pres context --module MODULE-ID [--course ID] [--brief] [--json]
  pres context --date YYYY-MM-DD [--course ID] [--brief]
      Everything one session's outline may be built from, and nothing else.
      --brief is the short form STANDARD mode reads.

  pres grammar [--deck ARCHETYPE] [--discipline NAME]
      The phase spine for a kind of session, a default beat chain, and the
      discipline's representation ladder. The compact form of
      references/deck-grammars.md.

  pres beats [--family F | --phase P]      one line per beat, to choose from
  pres beats BEAT-ID                       one beat in full
  pres archetypes [--name X]               the eighteen, as a table
  pres rules [GROUP …]                     writing · visual · questions · figures · record

  pres outline check FILE [--course ID] [--module MODULE-ID]
      Whether an outline is sound, and honest about what it leaves out.

  pres plan build DECK.md [--mode M] [--approval A] [--outline FILE] [--dry-run]
      Generates <deck>.plan.yaml from the deck and its outline. Nothing
      should write that file by hand: every field in it is a copy of one in
      a file that is edited, except figure attributions, which are kept.

  pres check DECK.md
      Whether a deck is renderable: gated correctly for its mode, matching
      its plan, figures present and credited.

  pres render DECK.md [--pdf] [--out DIR] [--draft]
      The .pptx, and with --pdf the LibreOffice conversion of that same deck.
      --draft writes a second deck beside it, <name>-draft.pptx, in which
      every planned-but-undrawn visual appears as a card carrying what it
      must show and the prompt that would make it. Set PRES_IMAGE_COMMAND to
      a command taking {prompt} and {out} and the draft fills itself instead.

  pres find-image --search QUERY [--limit N] [--any-licence]
                  [--pick N --name STEM --into DIR]
      An openly-licensed picture, with the plan entry that credits it.

Common flags: --help on any command. --timing (or PRES_TIMING=1) prints where
the time went, to stderr. Nothing is sent anywhere.`;

const SOURCE_FLAGS = (): ResolveOptions => {
  const options: ResolveOptions = {};
  const course = flag("course");
  if (course) options.course = course;
  const version = flag("version");
  if (version) options.version = version;
  const courseFile = flag("course-file");
  if (courseFile) options.courseFile = courseFile;
  const only = flag("only");
  if (only) options.only = only as Origin;
  const source = flag("source");
  if (source) {
    if (!["auto", "database", "local"].includes(source)) {
      throw new Error(`--source is auto, database or local, not '${source}'`);
    }
    options.source = source as SourcePreference;
  }
  if (has("fresh-route")) options.freshRoute = true;
  return options;
};

const print = (value: unknown): void => console.log(JSON.stringify(value, null, 2));

function commandRoute(): void {
  // Everything after the command word that is not a flag is the request, joined
  // — a professor's sentence arrives as several argv entries whether or not it
  // was quoted, and refusing to route an unquoted one would be a papercut on
  // the cheapest command here.
  const request = positional(1).join(" ");
  const mode = flag("mode");
  const slides = flag("slides");
  const minutes = flag("minutes");
  const routed = decideMode({
    request,
    ...(mode ? { mode } : {}),
    ...(slides ? { slides: Number(slides) } : {}),
    ...(minutes ? { minutes: Number(minutes) } : {}),
  });
  if (has("json")) {
    print(routed);
    return;
  }
  console.log(describeRoute(routed));
}

async function commandSource(): Promise<void> {
  const { source, warnings } = await resolveCourse(SOURCE_FLAGS());
  if (has("json")) {
    print({ ...source, warnings });
    return;
  }
  console.log(describeProvenance(source));
  console.log("");
  console.log(`${source.course.course_id} — ${source.course.title}`);
  if (source.version) {
    const window = [source.version.start_date, source.version.end_date].filter(Boolean).join(" to ");
    console.log(`Run: ${source.version.course_version_id}${window ? ` (${window})` : ""}`);
  } else {
    console.log("Run: none chosen — pass --version if the course has more than one.");
  }
  console.log(
    `${source.outcomes.length} outcomes · ${source.concepts.length} concepts · ` +
    `${source.modules.length} modules · ${source.activities.length} scheduled · ` +
    `${source.references.length} references`,
  );
  console.log("");
  for (const module of inTeachingOrder(source.modules)) {
    const week = module.week === undefined ? "  " : String(module.week).padStart(2, " ");
    console.log(`  ${week}  ${module.module_id}  ${module.title}`);
  }
  for (const warning of warnings) console.warn(`\nwarning: ${warning}`);
}

async function commandCourses(): Promise<void> {
  const { source } = await resolveCourse(SOURCE_FLAGS());
  console.log(describeProvenance(source));
  console.log(`  ${source.course.course_id} — ${source.course.title}`);
}

async function commandContext(): Promise<void> {
  const { source, warnings } = await resolveCourse(SOURCE_FLAGS());
  let moduleId = flag("module");
  const date = flag("date");
  if (!moduleId && date) {
    const found = moduleOnDate(source, date);
    if (!found) throw new Error(`nothing is scheduled on ${date}, so there is no module to prepare`);
    moduleId = found.module_id;
  }
  if (!moduleId) throw new Error("pres context needs --module MODULE-ID or --date YYYY-MM-DD");

  const context = buildModuleContext(source, moduleId);
  if (has("json")) {
    print({ ...context, warnings });
    return;
  }
  console.log(describeProvenance(source));
  console.log("");
  console.log(has("brief") ? describeContextBrief(context) : describeContext(context));
  for (const warning of warnings) console.warn(`\nwarning: ${warning}`);
}

function commandGrammar(): void {
  const deck = flag("deck");
  const discipline = flag("discipline");
  if (!deck) {
    console.log(describeGrammars());
    if (discipline) {
      console.log("");
      const grammar = grammarFor("conceptual_lecture")!;
      console.log(describeGrammar(grammar, discipline).split("\n").slice(-6).join("\n"));
    }
    return;
  }
  const grammar = grammarFor(deck);
  if (!grammar) {
    throw new Error(
      `'${deck}' is not a deck archetype. Run \`pres grammar\` with no flags for the seven.`,
    );
  }
  console.log(describeGrammar(grammar, discipline));
}

function commandBeats(): void {
  const [id] = positional(1);
  const beats = loadBeats();
  if (id) {
    const beat = findBeat(id, beats);
    if (!beat) {
      throw new Error(
        `no beat '${id}'. Run \`pres beats\` for the catalogue, or ` +
        "`pres beats --family create_need` for one family.",
      );
    }
    console.log(describeBeat(beat));
    return;
  }
  const family = flag("family");
  const phase = flag("phase");
  const options = { ...(family ? { family } : {}), ...(phase ? { phase } : {}) };
  const selected = selectBeats(options, beats);
  if (!selected.length && (family || phase)) {
    throw new Error(
      `no beats for ${family ? `family '${family}'` : `phase '${phase}'`}. ` +
      "Run `pres beats` for all of them.",
    );
  }
  console.log(describeCatalogue(selected, options));
}

async function commandOutlineCheck(): Promise<void> {
  const [path] = positional(2);
  if (!path) throw new Error("pres outline check needs the path to an outline file");
  const outline = loadOutline(resolve(path));

  // The module check is the half that matters, so it is attempted even when the
  // command line does not name a course: the outline says which one it is for.
  let context = null;
  const moduleId = flag("module") ?? outline.module_id;
  if (moduleId) {
    try {
      const options = SOURCE_FLAGS();
      if (!options.course && outline.course_id) options.course = outline.course_id;
      if (!options.version && outline.course_version_id) options.version = outline.course_version_id;
      const { source } = await resolveCourse(options);
      context = buildModuleContext(source, moduleId);
    } catch (error) {
      console.warn(
        `Could not load ${moduleId} to check coverage against it, so only the outline's internal\n` +
        `consistency was checked: ${String((error as Error).message ?? error).split("\n")[0]}\n`,
      );
    }
  }

  const problems = checkOutline(outline, context);
  console.log(describeProblems(problems));
  if (errorsIn(problems).length) process.exitCode = 1;
}

function commandPlanBuild(): void {
  const [path] = positional(2);
  if (!path) throw new Error("pres plan build needs the path to a deck");
  const mode = flag("mode");
  if (mode && !isMode(mode)) throw new Error(`--mode is ${MODES.join(", ")}, not '${mode}'`);
  const approval = flag("approval");
  if (approval && !["not_required", "required", "given"].includes(approval)) {
    throw new Error(`--approval is not_required, required or given, not '${approval}'`);
  }
  const outline = flag("outline");

  const result = buildPlan(resolve(path), {
    ...(mode ? { mode: mode.toLowerCase() as Mode } : {}),
    ...(approval ? { approval: approval as "not_required" | "required" | "given" } : {}),
    ...(outline ? { outlinePath: resolve(outline) } : {}),
    ...(has("dry-run") ? { dryRun: true } : {}),
  });

  const { plan } = result;
  console.log(
    `${plan.slides.length} slides · mode ${plan.mode ?? "unstated"} · approval ${plan.approval ?? "required"}` +
    `${plan.figures ? ` · ${Object.keys(plan.figures).length} figures` : ""}`,
  );
  for (const warning of result.warnings) console.warn(`  warning  ${warning}`);
  if (has("dry-run")) {
    console.log(result.changed ? "\nthe plan on disk is out of date." : "\nthe plan on disk is current.");
    return;
  }
  console.log(`wrote ${result.planPath}`);
  console.log("\nThen: pres check " + path);
}

function commandCheck(): void {
  const [path] = positional(1);
  if (!path) throw new Error("pres check needs the path to a deck");
  const checked = checkDeck(resolve(path));
  console.log(`${checked.deck}: ${checked.slides.length} slides, plan ${checked.planPath}`);
  console.log(describeProblems(checked.problems));
  if (errorsIn(checked.problems).length) process.exitCode = 1;
}

async function commandRender(): Promise<void> {
  const [path] = positional(1);
  if (!path) throw new Error("pres render needs the path to a deck");
  const outDir = flag("out");
  const result = await renderDeck(resolve(path), {
    pdf: has("pdf"),
    draft: has("draft"),
    ...(outDir ? { outDir } : {}),
  });

  // Before the "wrote" lines, not after. A slide that runs past the bottom
  // margin loses its last lines *silently* — they are not clipped with a mark,
  // they are simply off the slide — and a warning printed under a success
  // message is a warning nobody reads until the lecture.
  const overflow = result.warnings.filter((warning) => / runs to /.test(warning));
  const others = result.warnings.filter((warning) => !/ runs to /.test(warning));
  if (overflow.length) {
    console.warn(
      `\n${overflow.length} slide(s) run past the bottom of the slide. Whatever falls below is\n` +
      "not clipped or marked — it is simply not on the slide, and you will find out in the room:\n",
    );
    for (const warning of overflow) console.warn(`  ${warning}`);
    console.warn("\nShorten those slides or split them. Nothing here can do it for you: which half\nbelongs on which slide is a teaching decision.\n");
  }
  for (const warning of others) console.warn(`  ${warning}`);

  console.log(`wrote ${result.pptx}`);
  if (has("pdf")) {
    if (result.pdf) console.log(`wrote ${result.pdf}`);
    else {
      console.warn(
        "LibreOffice not found — the .pptx is written, the PDF is not. Set SOFFICE_PATH, or\n" +
        "render a review PDF with Marp and say which it is:\n" +
        `    npx @marp-team/marp-cli ${path} --pdf --pdf-outlines -o output/review.pdf\n` +
        "That is a second rendering of the markdown, not a picture of this deck — fine for\n" +
        "reading through, wrong for anything presented or handed out.",
      );
    }
  }
  // What the file honestly is. A .pptx from a fast deck and one from an approved
  // outline are the same file format and nothing about either says which.
  for (const line of result.provenance) console.log(line);
  if (result.missing) {
    console.log("");
    console.log(describeDraft(result.missing));
  }
  console.log("\nThen look at it. The first render usually has a real defect or two, and they are\nobvious in the pages and invisible in the source.");
}

async function commandFindImage(): Promise<void> {
  const query = flag("search");
  if (!query) throw new Error("pres find-image needs --search QUERY");
  const results = await searchImages(query, Number(flag("limit") ?? 8), has("any-licence"));
  if (!results.length) {
    console.log(`nothing for "${query}". Try fewer words, or draw it instead.`);
    return;
  }

  const pick = flag("pick");
  if (!pick) {
    console.log(describeResults(results));
    return;
  }
  const chosen = results[Number(pick) - 1];
  if (!chosen) throw new Error(`--pick ${pick} but there are ${results.length} results`);

  const into = flag("into") ?? join(process.cwd(), "work");
  if (resolve(into).includes(`${"courses"}`) && existsSync(join(resolve(into), "..", "course.yaml"))) {
    throw new Error("refusing to download beside a course definition — a found image is a draft");
  }
  const name = flag("name") ?? `figure-${chosen.id.slice(0, 8)}`;
  const file = await downloadImage(chosen, { directory: into, name });
  const filename = file.replace(/^.*[\\/]/, "");

  console.log(`wrote ${file}`);
  console.log(
    "\nIt is recorded automatically: `pres plan build` keeps figure attributions across\n" +
    "regeneration. Paste this into the plan's figures: block if the plan does not exist yet —\n" +
    "the credit is part of the record, not a note to self:\n",
  );
  console.log(figureEntry(chosen, filename));
  console.log(
    `\nOn the slide, link it as a sibling of the deck:\n\n    ![DESCRIBE WHAT IT SHOWS](${filename})\n\n` +
    "The alt text is not the title. Say what a student who cannot see it would need.",
  );
}

async function main(): Promise<void> {
  const command = args[0];
  if (!command || has("help") && !command) {
    console.log(USAGE);
    process.exit(command ? 0 : 1);
  }

  switch (command) {
    case "route": return commandRoute();
    case "source": return commandSource();
    case "courses": return commandCourses();
    case "context": return commandContext();
    case "grammar": return commandGrammar();
    case "beats": return commandBeats();
    case "archetypes": {
      const name = flag("name") ?? positional(1)[0];
      console.log(describeArchetypes(name));
      return;
    }
    case "rules": {
      const wanted = positional(1);
      console.log(describeRules(wanted.length ? wanted : undefined));
      if (!wanted.length) {
        console.log(`\nOne group at a time: pres rules ${RULE_GROUPS.map((g) => g.key).join(" | ")}`);
      }
      return;
    }
    case "outline": {
      const sub = args[1];
      if (sub !== "check") throw new Error("the only outline subcommand is `check`");
      return commandOutlineCheck();
    }
    case "plan": {
      const sub = args[1];
      if (sub !== "build") throw new Error("the only plan subcommand is `build`");
      return commandPlanBuild();
    }
    case "check": return commandCheck();
    case "render": return commandRender();
    case "find-image": return commandFindImage();
    case "help": case "--help": console.log(USAGE); return;
    default:
      console.error(`unknown command '${command}'.\n`);
      console.log(USAGE);
      process.exitCode = 1;
  }
}

enableTimingFromEnvironment();
if (has("timing")) enableTiming(true);

main()
  .catch((error) => {
    console.error(String((error as Error).message ?? error));
    process.exitCode = 1;
  })
  .finally(() => reportTimings());
