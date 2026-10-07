/**
 * Materials as links: which files the pane can show, the PDF conversion of
 * office files, and the material links added to a payload.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";

import { officeAt } from "@ainar/core/src/materials.ts";

import { BASE } from "./http.js";

/**
 * Whether the browser will paint this format in a frame, or only download it.
 *
 * The narrow list, not the broad one. A `.pptx` and a `.docx` are downloads in
 * every browser this runs in, and marking one showable would put a blank panel
 * over the harness and call it a slide deck — worse than the tab it replaced.
 *
 * `.md` was out for that same reason and is now in, because the reason stopped
 * being true rather than because the rule was relaxed. Chrome does download
 * `text/markdown`, whatever the file is made of — so `/file` no longer sends
 * one. A markdown document is RENDERED there and served as HTML, which is a
 * format on this list, and the professor gets the document instead of a file
 * in Downloads. That is not a cosmetic preference: this project's own skills
 * write a deck as Marp markdown and the brief students read as markdown beside
 * the YAML, so `.md` is the format most of a course is actually in.
 *
 * A format that is out is not broken here; it keeps the link it always had,
 * and the overlay's header offers the same tab for a format that turns out to
 * be a download after all.
 *
 * At module scope rather than inside `withMaterialLinks`, because the class
 * list reads it as well — a student's handed-in PDF is the same question about
 * the same route, and two copies of this list would drift.
 */
export const SHOWABLE = new Set([
  "pdf",
  "html",
  "svg",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "txt",
  "csv",
  "json",
  "md",
  "markdown",
]);

/**
 * The formats that become showable by being converted, and the machinery for it.
 *
 * A `.pptx` and a `.docx` are downloads in every browser this runs in, which is
 * why they are not in `SHOWABLE` and why the overlay has always sent them to a
 * tab. That is still true of the bytes on disk. What changed is that this
 * project already converts them: `ainar materials` builds a deck and renders a
 * PDF beside it through LibreOffice, and `officeAt` is how it finds the binary.
 *
 * So the rule is narrower than "open a pptx". It is: **when this machine has a
 * converter, the pane may offer the PDF of a document it cannot frame.** The
 * professor presses the material and reads it over the harness; what they are
 * shown is a rendering, and the overlay's own "Open in a tab" still reaches the
 * original.
 *
 * Three properties worth keeping:
 *
 * - **A capability, not a flag.** `officeAt()` is probed per request. Where
 *   there is no LibreOffice the link behaves exactly as it did yesterday — a
 *   tab — rather than becoming a control that opens a blank panel. This is the
 *   same shape `runtime.js` uses for `openMaterial`: the host offers it or it
 *   does not, and the view has one code path.
 * - **The conversion is cached by content.** The key is the document id and the
 *   source file's size and mtime, so editing a deck invalidates it and opening
 *   the same deck twice spawns LibreOffice once. The cache is under the
 *   system temp directory and never inside the workspace, because a converted
 *   PDF is not a course record and `courses/` is not a build output.
 * - **A failure is reported, not swallowed.** The exit code AND the appearance
 *   of the output file are both checked. `render-deck.ts` fixed exactly this
 *   bug on 2026-09-06 in the other converter, where a non-zero exit produced a
 *   silent success and a missing file.
 */
export const CONVERTIBLE = new Set(["pptx", "ppt", "docx", "doc", "odp", "odt", "rtf"]);

/** Where converted PDFs live. Not the workspace: this is derived, not recorded. */
const CONVERT_CACHE = join(tmpdir(), "professor-pane-pdf");

/**
 * The PDF of an office document, converted once and kept.
 *
 * Returns the path, or throws with what LibreOffice said. Sixty seconds is
 * generous for a deck and short enough that a wedged soffice does not hold a
 * request open until the professor reloads.
 */
export const convertedPdf = (documentId, source) => {
  const office = officeAt();
  if (!office) throw new Error("no LibreOffice on this machine to render it with");

  const stamp = statSync(source);
  const key = createHash("sha256")
    .update([documentId, source, stamp.size, stamp.mtimeMs].join("\0"))
    .digest("hex")
    .slice(0, 16);
  const outDir = join(CONVERT_CACHE, key);
  const target = join(outDir, basename(source).replace(/\.[^.]+$/, "") + ".pdf");
  if (existsSync(target)) return target;

  mkdirSync(outDir, { recursive: true });
  const run = spawnSync(
    office,
    ["--headless", "--convert-to", "pdf", "--outdir", outDir, source],
    { encoding: "utf-8", timeout: 60_000 },
  );
  if (run.error) throw new Error(`${basename(office)} would not run: ${run.error.message}`);
  if (run.status !== 0) {
    throw new Error(
      `${basename(office)} exited ${run.status}: ` +
        (String(run.stderr || run.stdout || "").trim().split("\n").pop() || "no reason given"),
    );
  }
  // Exit zero and no file is a real outcome: LibreOffice reports a format it
  // cannot read this way. Checking the code alone is the bug this avoids.
  if (!existsSync(target)) {
    throw new Error(`${basename(office)} exited 0 but wrote no PDF for ${basename(source)}`);
  }
  return target;
};

/** A storage key's extension, lowercased, or `""`. */
export const extensionOfKey = (key) => {
  const name = String(key ?? "").split(/[\\/]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
};

/**
 * Give every resource that names a document somewhere to go.
 *
 * The widget will not invent a path — `safeUrl` in its runtime returns null for
 * anything that is not http, https or a relative reference — and that is right:
 * the same document renders in a chat client that has no route to the file. So
 * the PANE supplies the URL, because the pane is the host that does have one.
 *
 * An ABSOLUTE http URL, not `/professor-pane/file?…`. `safeUrl` refuses a
 * leading slash outright, and the document is rendered inside a `srcdoc` iframe
 * where a relative reference resolves against a base the frame does not really
 * have. `http://<host>/…` is the only form that survives both.
 *
 * A resource that already carries its own `url` keeps it: an externally hosted
 * reading is not ours to redirect through a local file route.
 *
 * Both places the outline payload holds resources — the chips on each meeting,
 * and the required-materials list at the end. They are the same records reached
 * two ways, and a link in one place but not the other is what this pane looked
 * like before.
 */
export const withMaterialLinks = (data, origin, sessionId, workspace, dark, withDrafts) => {
  if (!origin || data === null || typeof data !== "object") return data;

  // `dark` travels on the address for one format only, and is inert for the
  // rest: a PDF and a PNG are painted by the browser's own viewer, which has
  // never asked this app what colour the harness is. It is on the URL because
  // a RENDERED markdown document is a page of ours, framed over the whole
  // harness, and a white brief in a dark harness is the one thing the overlay
  // was supposed to stop happening. The harness's theme is an explicit choice
  // and need not agree with the machine's, so it is passed rather than left to
  // `prefers-color-scheme`.
  // Whether this machine can render a `.pptx` into something a frame will
  // paint. Probed ONCE per payload rather than per document — it is a fact
  // about the machine, and thirty documents would otherwise stat the same six
  // paths thirty times — and never cached across requests, so installing
  // LibreOffice takes effect on the next reload rather than the next restart.
  const canRender = officeAt() !== null;
  const renderable = (documentId) =>
    canRender && CONVERTIBLE.has(extensionOf.get(documentId) ?? "");

  const address = (documentId) => {
    // `from` is carried on the address and nowhere else, because the only
    // consumer is the overlay's "ask about this" button and the overlay is
    // handed a URL, a label and a format — nothing that could look a record up.
    // Putting it here costs one parameter and saves a second route whose whole
    // job would be answering a question the payload already knew.
    const source = sourceOf(documentId);
    return (
      `${origin}${BASE}/file?doc=` +
      encodeURIComponent(documentId) +
      (source ? "&from=" + encodeURIComponent(source) : "") +
      (sessionId ? "&session=" + encodeURIComponent(sessionId) : "") +
      (dark ? "&dark=1" : "") +
      (renderable(documentId) ? "&as=pdf" : "")
    );
  };

  // Every document in the workspace, indexed by the basename of its storage key
  // with the extension removed.
  //
  // This is how one lecture in two formats is recognised. The model has no
  // "same thing, other format" relation — a `Resource` names ONE document — so
  // `…-Week-3.pptx` and `…-Week-3.pdf` are two unrelated records as far as the
  // schema is concerned. Pairing them by stem is a convention, and the draft
  // that registered the PDFs says so in as many words: rename one half and the
  // pairing quietly stops. It is a convention worth having because the
  // alternative is two chips both called "slides" on one meeting.
  const byStem = new Map();
  /** Every document's extension, so a link can say whether it is showable. */
  const extensionOf = new Map();
  /** `extensions.rendered_from`, one hop: the record this artefact came from. */
  const renderedFrom = new Map();
  /**
   * `extensions.origin`: built in this workspace, or brought in finished.
   *
   * A week may hold both — a deck rendered from its markdown and somebody
   * else's deck imported whole — and the two are different claims about what
   * the file IS, not merely about where it sits. The pane badges this, so the
   * professor is never guessing which of two chips is which; an artefact that
   * declares nothing is drawn as the unfinished state it is rather than
   * silently as "generated".
   */
  const originOf = new Map();
  /** `extensions.read_by`: text, ocr or vlm — how an imported outline was got. */
  const readByOf = new Map();
  /**
   * Documents carrying a `presentation_plan` — an outline somebody can read.
   *
   * Only these get an outline address. A deck with no plan has nothing to show,
   * and offering to open one would be the pane promising a page that renders
   * empty — the fault this whole line of work has been correcting.
   */
  const hasPlan = new Set();
  /**
   * Every printed paper of a piece of graded work, by the assessment it prints.
   *
   * `extensions.renders` is the edge: `ainar paper render` writes it on each
   * paper, and an exam with versions has one paper per version, told apart by
   * `extensions.variant` (`form`, on papers written before the convention had
   * a name). The assessment itself names only one of them as its
   * `instructions_document_id`, so without this the second version of a quiz
   * existed on disk and nowhere on screen.
   */
  const papersOf = new Map();
  for (const courseId of workspace.courseIds()) {
    let loaded;
    try {
      loaded = workspace.load(courseId);
    } catch {
      continue;
    }
    if (loaded.bundle === null) continue;
    for (const document of loaded.bundle.documents ?? []) {
      // Read before the storage-key guard: a source may legitimately be a
      // record this loop skips for its own reasons, and the edge is still true.
      const from = document.extensions?.rendered_from;
      if (typeof from === "string" && from !== "") {
        renderedFrom.set(document.document_id, from);
      }
      const origin = document.extensions?.origin;
      if (typeof origin === "string" && origin !== "") {
        originOf.set(document.document_id, origin);
      }
      const readBy = document.extensions?.read_by;
      if (typeof readBy === "string" && readBy !== "") {
        readByOf.set(document.document_id, readBy);
      }
      const plan = document.presentation_plan;
      if (plan && Array.isArray(plan.slides) && plan.slides.length > 0) {
        hasPlan.add(document.document_id);
      }
      const renders = document.extensions?.renders;
      if (typeof renders === "string" && renders !== "") {
        const version = document.extensions?.variant ?? document.extensions?.form ?? null;
        if (!papersOf.has(renders)) papersOf.set(renders, []);
        papersOf.get(renders).push({
          id: document.document_id,
          variant: typeof version === "string" && version !== "" ? version : null,
        });
      }
      const key = String(document.storage_key ?? "");
      if (!key || key.includes("://")) continue;
      const name = key.split(/[\\/]/).pop() ?? "";
      const dot = name.lastIndexOf(".");
      if (dot <= 0) continue;
      const stem = name.slice(0, dot);
      const extension = name.slice(dot + 1).toLowerCase();
      extensionOf.set(document.document_id, extension);
      if (!byStem.has(stem)) byStem.set(stem, []);
      byStem.get(stem).push({ id: document.document_id, extension });
    }
  }

  // Showable as it is, or showable once rendered. The second half is why a
  // deck now opens over the harness instead of landing in Downloads.
  const showable = (documentId) =>
    SHOWABLE.has(extensionOf.get(documentId) ?? "") || renderable(documentId);

  /** What `/file` will actually send, which is not always what is on disk. */
  const servedFormat = (documentId) =>
    renderable(documentId) ? "pdf" : (extensionOf.get(documentId) ?? "");

  /**
   * What a rendered artefact was produced from, following the chain to its end.
   *
   * `extensions.rendered_from` is a real edge in the record — a PDF names the
   * deck it was converted from, and that deck names the script that built it —
   * and this walks to the document at the end, because that is the one a
   * professor would edit. Changing a slide means changing the builder; nobody
   * edits a PDF.
   *
   * It replaces nothing: `formatsFor` still pairs siblings by filename stem,
   * which is a convention and stays one. This is the relation the schema
   * actually carries, and the two answer different questions — "the same thing
   * in another format" and "the thing this was made from".
   *
   * Cycles end the walk rather than hanging it. A record that names itself, or
   * two that name each other, is bad data and not worth a stack overflow; the
   * last id reached is returned and the validator is the place that complains.
   */
  const sourceOf = (documentId) => {
    const seen = new Set([documentId]);
    let at = documentId;
    for (;;) {
      const next = renderedFrom.get(at);
      if (next === undefined || seen.has(next)) break;
      seen.add(next);
      at = next;
    }
    return at === documentId ? null : at;
  };

  /** The formats a document is available in, itself first. */
  const formatsFor = (documentId) => {
    for (const [, group] of byStem) {
      const self = group.find((entry) => entry.id === documentId);
      if (!self) continue;
      // Only formats worth a separate button. A deck beside its own build
      // script shares no stem, so this stays a small set in practice.
      const shown = group.filter((entry) => ["pptx", "pdf", "docx"].includes(entry.extension));
      if (shown.length < 2) return [];
      return shown
        .sort((a, b) => (a.id === documentId ? -1 : b.id === documentId ? 1 : 0))
        .map((entry) => ({
          label: entry.extension.toUpperCase(),
          url: address(entry.id),
          viewable: showable(entry.id),
          // The extension travels with the link because the overlay sandboxes
          // a document and does not sandbox a PDF. See MEDIA in `client.js`.
          //
          // What is served, not what is stored: a `.pptx` this machine can
          // render arrives as a PDF, and a frame told it is a `.pptx` would
          // sandbox the browser's own PDF viewer and paint nothing.
          format: servedFormat(entry.id),
        }));
    }
    return [];
  };

  const link = (resource) => {
    if (!resource || typeof resource !== "object") return resource;
    if (!resource.document_id) return resource;
    const formats = formatsFor(resource.document_id);
    // A resource that carries its own URL is hosted elsewhere and is not ours
    // to frame: the overlay only shows what `/file` serves from this
    // workspace, so an external reading keeps the tab it always opened.
    const viewable = !resource.url && showable(resource.document_id);
    const url = resource.url || address(resource.document_id);
    return {
      ...resource,
      url,
      formats,
      viewable,
      format: servedFormat(resource.document_id),
      // Empty when the record says nothing, and the view draws that as its own
      // state rather than assuming the common case.
      origin: originOf.get(resource.document_id) ?? "",
      read_by: readByOf.get(resource.document_id) ?? "",
      // Empty unless there is an outline to open. The badge is a label when
      // this is empty and a control when it is not, so a chip never offers to
      // show something that is not there.
      outline_url: hasPlan.has(resource.document_id)
        ? outlineAddress(resource.document_id)
        : "",
    };
  };

  /**
   * The same address, for the brief a piece of graded work names.
   *
   * A `Resource` and an `Assessment` both point at a `Document` and neither
   * spells the field the same way: a resource carries `document_id`, an
   * assessment carries `instructions_document_id`, and that difference is the
   * only reason this is a second function rather than an argument to `link`.
   * Everything after the lookup — the absolute URL, whether the browser will
   * paint it, the extension that decides how the overlay frames it — is
   * identical, because it is the same route serving the same file.
   *
   * `formats` is left empty rather than paired by stem. The stem convention
   * exists for a deck that was built into three files from one source; a brief
   * is one document, and a second chip beside it would be inviting the
   * professor to choose between a file and itself.
   *
   * An assessment with no brief is returned untouched — no `url`, so every
   * view downstream keeps the "nothing to open" branch it already had rather
   * than being handed a link to a document that does not exist.
   */
  /**
   * Where this pane serves a piece of graded work's own text.
   *
   * Separate from `address`, and a separate field from `url`, because the two
   * answer different questions: `url` is the BRIEF DOCUMENT when one exists,
   * and this is the record's `description` rendered as a page. An assessment
   * can have both, and the chip and its "open" link then lead to different
   * things on purpose — the text somebody wrote in the record, and the file
   * they attached to it.
   *
   * `drafts` travels on the address, because the outline it was built from was
   * itself drafted or not and the brief must agree with the chip that opened
   * it. The pane defaults to `+ drafts`, so without this a professor reading a
   * proposed assessment's chip would be shown the approved text — or an error
   * saying the assessment does not exist, which is worse, since it does.
   */
  const briefAddress = (runId, assessmentId) =>
    `${origin}${BASE}/brief?run=` +
    encodeURIComponent(runId) +
    "&assessment=" +
    encodeURIComponent(assessmentId) +
    (sessionId ? "&session=" + encodeURIComponent(sessionId) : "") +
    (withDrafts ? "&drafts=1" : "") +
    (dark ? "&dark=1" : "");

  /** Where this pane serves what was read out of a deck. */
  const outlineAddress = (documentId) =>
    `${origin}${BASE}/outline?doc=` +
    encodeURIComponent(documentId) +
    (sessionId ? "&session=" + encodeURIComponent(sessionId) : "") +
    (dark ? "&dark=1" : "");

  const runId = String(data?.run?.id ?? "");
  const courseId = String(data?.run?.course_id ?? "");

  /** Where this pane serves a homework's starter README, by run and id. */
  const starterAddress = (runId, assessmentId) =>
    `${origin}${BASE}/starter?run=` +
    encodeURIComponent(runId) +
    "&assessment=" +
    encodeURIComponent(assessmentId) +
    (sessionId ? "&session=" + encodeURIComponent(sessionId) : "") +
    (withDrafts ? "&drafts=1" : "") +
    (dark ? "&dark=1" : "");

  /**
   * The papers of one assessment that the overlay can paint, one per version.
   *
   * A version printed in several formats is offered once, in the format a
   * frame paints best: the PDF a student is handed, else the markdown it was
   * written in, else whatever else is showable. Sorted by version so A comes
   * before B on every screen.
   */
  //
  // Ranked by the file's OWN format, not the format it is served as: a `.docx`
  // this machine converts is served as a PDF too, and ranking by that let a
  // LibreOffice rendering of the DOCX — two pages, nothing fitted — stand in
  // for the one-page PDF printed beside it.
  const RANK = { pdf: 0, md: 1, markdown: 1, html: 2 };
  const papersFor = (assessmentId) => {
    const byVersion = new Map();
    for (const paper of papersOf.get(assessmentId) ?? []) {
      if (!showable(paper.id)) continue;
      const rank = RANK[extensionOf.get(paper.id) ?? ""] ?? 9;
      const held = byVersion.get(paper.variant ?? "");
      if (held === undefined || rank < held.rank) byVersion.set(paper.variant ?? "", { ...paper, rank });
    }
    return [...byVersion.values()]
      .sort((a, b) => String(a.variant ?? "").localeCompare(String(b.variant ?? "")))
      .map((paper) => ({
        label: paper.variant ? `Variant ${paper.variant}` : "Paper",
        url: address(paper.id),
        format: servedFormat(paper.id),
      }));
  };

  const linkAssessment = (assessment) => {
    if (!assessment || typeof assessment !== "object") return assessment;
    const papers = assessment.assessment_id ? papersFor(assessment.assessment_id) : [];
    // Only when there is a choice to make. One paper is what the chip already
    // opens; a list of one would be a second way to say the same thing.
    if (papers.length > 1) return { ...linkOne(assessment), papers };
    return linkOne(assessment);
  };

  const linkOne = (assessment) => {
    // The record's own text, when it has any. This is what the chip opens, and
    // it is the usual case: most assessments in this model carry no brief
    // document at all, so without it the chip names work nobody can read.
    const brief =
      runId && assessment.assessment_id && String(assessment.description ?? "").trim()
        ? briefAddress(runId, assessment.assessment_id)
        : null;
    const documentId = assessment.instructions_document_id;
    if (!documentId) {
      // No brief document named, but the homework has a starter folder with a
      // README in it: that README IS the brief students read, so it opens
      // without anyone having to register it first. HW3 went unlinked for
      // exactly that reason — its README was on disk and its record was not.
      if (starterReadme(workspace.root, courseId, assessment)) {
        return {
          ...assessment,
          ...(brief ? { brief_url: brief } : {}),
          url: starterAddress(runId, assessment.assessment_id),
          viewable: true,
          format: "md",
          formats: [],
        };
      }
      return brief ? { ...assessment, brief_url: brief } : assessment;
    }
    return {
      ...assessment,
      ...(brief ? { brief_url: brief } : {}),
      url: address(documentId),
      viewable: showable(documentId),
      format: extensionOf.get(documentId) ?? "",
      formats: [],
    };
  };

  for (const week of Array.isArray(data.weeks) ? data.weeks : []) {
    for (const meeting of Array.isArray(week.meetings) ? week.meetings : []) {
      if (Array.isArray(meeting.resources)) meeting.resources = meeting.resources.map(link);
    }
    // Every list a week places graded work in. One assessment appears in two
    // of them — the week it opens and the week it falls due — and both rows
    // have to carry the link, because either is the one the professor happens
    // to be looking at.
    for (const key of ["opens", "due", "undated"]) {
      if (Array.isArray(week[key])) week[key] = week[key].map(linkAssessment);
    }
  }
  if (Array.isArray(data.required_materials)) {
    data.required_materials = data.required_materials.map(link);
  }
  // The flat list the Assessments and Exams tabs read, and the work `outline`
  // could not place on any week at all. The last one matters more than its
  // size suggests: an assessment with no module and no dates is exactly the
  // one whose brief a professor is trying to find.
  if (Array.isArray(data.assessments)) data.assessments = data.assessments.map(linkAssessment);
  if (data.unplaced && Array.isArray(data.unplaced.assessments)) {
    data.unplaced = {
      ...data.unplaced,
      assessments: data.unplaced.assessments.map(linkAssessment),
    };
  }
  return data;
};

/**
 * A homework's starter README on disk, or null.
 *
 * Found from the assessment rather than from anything a request supplies:
 * `extensions.github.local_path` when the record names one, then the storage
 * layout's own place for it, `courses/<COURSE>/assessments/<ID>/starter/`.
 * Either must resolve inside the workspace — the same rule `sendMaterial`
 * holds a `storage_key` to — so a record cannot point this outside it.
 */
export const starterReadme = (root, courseId, assessment) => {
  if (!root || !assessment?.assessment_id) return null;
  const base = resolve(root);
  const dirs = [];
  const local = assessment.github?.local_path;
  if (typeof local === "string" && local && !local.includes("://")) dirs.push(local);
  if (courseId) dirs.push(join("courses", courseId, "assessments", assessment.assessment_id, "starter"));
  for (const dir of dirs) {
    const full = resolve(base, dir, "README.md");
    if (!full.startsWith(base + sep)) continue;
    if (existsSync(full)) return full;
  }
  return null;
};
