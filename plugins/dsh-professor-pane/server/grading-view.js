/**
 * The grading policy, drawn from the run's `grading_scheme`.
 *
 * A flat list of twenty-one weights summing to 100% says nothing about how a
 * grade is built. An institution builds it in blocks — Narxoz: ВСК1 30, ВСК2 30,
 * final 40 — and each block out of kinds of work. So this draws, in order:
 *
 * 1. **The grade as one bar**: a segment per block at its weight, each split by
 *    the kinds of work inside it. The shape of the grade at a glance.
 * 2. **A card per block**: its weight against what its members add up to, the
 *    kinds of work with count and per-item share, the assessments themselves
 *    with their dates and whether any marks are in, the dates the block spans,
 *    and whether each Canvas course has its assignment group mapped.
 * 3. **What counts in no block**, which the bar cannot show and must not hide.
 *
 * Nothing here computes a grade. It reads the scheme, the assessments and
 * which of them have marks, and draws them; the sums it shows are the same
 * ones `ainar validate` checks, at the same tolerance.
 */

const TOLERANCE = 0.001;

const escape = (text) =>
  String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** A share of the whole grade as a person reads it: 30%, 1.33%, 0.57%. */
const pct = (fraction) => {
  const value = Math.round(fraction * 10000) / 100;
  return (Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, "")) + "%";
};

/** The kinds of work, in the order a block is read: the big pieces first. */
const KINDS = [
  { type: "exam", one: "Exam", many: "Exams" },
  { type: "project", one: "Project", many: "Projects" },
  { type: "assignment", one: "Homework", many: "Homework" },
  { type: "quiz", one: "Quiz", many: "Quizzes" },
  { type: "lab", one: "Lab", many: "Labs" },
  { type: "presentation", one: "Presentation", many: "Presentations" },
  { type: "participation", one: "Participation", many: "Participation" },
];
const kindOf = (type) => KINDS.find((kind) => kind.type === type) ?? { type, one: type ?? "Other", many: type ?? "Other" };

const shortDate = (iso) => (iso ? String(iso).slice(5, 10).replace("-", ".") : null);

/** The members of one block, grouped by kind, biggest share first. */
const kindsIn = (members) => {
  const groups = new Map();
  for (const assessment of members) {
    const kind = kindOf(assessment.type);
    if (!groups.has(kind.type)) groups.set(kind.type, { kind, items: [] });
    groups.get(kind.type).items.push(assessment);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, weight: group.items.reduce((sum, a) => sum + (a.weight ?? 0), 0) }))
    .sort((a, b) => b.weight - a.weight);
};

/** "Exam · 10%", "Homework ×4 · 16% (4% each)", "Quizzes ×3 · 4% (1.33% each)". */
const kindLabel = (group) => {
  const n = group.items.length;
  const label = n === 1 ? group.items[0].title ?? group.kind.one : `${group.kind.many} ×${n}`;
  const weights = group.items.map((a) => a.weight ?? 0);
  const even = n > 1 && weights.every((w) => Math.abs(w - weights[0]) < 1e-6);
  return `${escape(label)} · ${pct(group.weight)}${even ? ` <span class="dim">(${pct(weights[0])} each)</span>` : ""}`;
};

/**
 * The HTML for the scheme: the bar, a card per block, the unassigned.
 *
 * `run` carries `grading_scheme` and `extensions.lms`; `assessments` are the
 * run's, as the view shows them (drafts or not); `graded` is the set of
 * assessment ids with at least one mark decided.
 */
export const schemeHtml = ({ run, assessments, graded = new Set() }) => {
  const components = run?.grading_scheme?.components ?? [];
  if (!components.length) return null;
  const top = components.filter((c) => !c.parent);
  const childrenOf = (id) => components.filter((c) => c.parent === id);
  const membersOf = (id) => assessments.filter((a) => a.component === id);
  const deepMembers = (id) => [...membersOf(id), ...childrenOf(id).flatMap((child) => deepMembers(child.component_id))];
  const known = new Set(components.map((c) => c.component_id));
  const unassigned = assessments.filter((a) => !a.component || !known.has(a.component));

  // The bar: one segment per top-level block, each split by kind.
  const hue = (index) => ["--b1", "--b2", "--b3", "--b4", "--b5"][index % 5];
  const bar =
    '<div class="gbar" role="img" aria-label="' +
    escape(top.map((c) => `${c.title} ${pct(c.weight)}`).join(", ")) +
    '">' +
    top
      .map((component, index) => {
        const kinds = kindsIn(deepMembers(component.component_id));
        const filled = kinds.reduce((sum, k) => sum + k.weight, 0);
        // Sizes in hundredths: flex-grow values that add up to less than 1 hand
        // out only that fraction of the space, which left each bar a third full.
        const parts = kinds
          .map(
            (k, i) =>
              `<span class="gpart" style="flex:${k.weight * 100} 1 0;opacity:${1 - i * 0.18}" title="${escape(k.kind.many)} ${pct(k.weight)}"></span>`,
          )
          .join("");
        const gap = component.weight - filled > TOLERANCE
          ? `<span class="gpart gempty" style="flex:${(component.weight - filled) * 100} 1 0" title="not assigned yet ${pct(component.weight - filled)}"></span>`
          : "";
        return (
          `<div class="gseg" style="flex:${component.weight * 100} 1 0;--c:var(${hue(index)})">` +
          `<div class="glabel"><b>${escape(component.title)}</b> ${pct(component.weight)}</div>` +
          `<div class="gfill">${parts}${gap}</div></div>`
        );
      })
      .join("") +
    "</div>";

  const lmsGroups = run?.extensions?.lms?.canvas_assignment_groups ?? {};
  const courses = run?.extensions?.lms?.canvas_courses ?? null;
  const canvasLine = (component) => {
    const mapped = lmsGroups[component.component_id];
    if (courses && typeof courses === "object") {
      const groups = Object.keys(courses).sort();
      const have = groups.filter((g) => mapped && typeof mapped === "object" && mapped[g]);
      if (have.length === groups.length) return `<span class="ok">Canvas group mapped in all ${groups.length} courses</span>`;
      return `<span class="todo">Canvas group not mapped in ${groups.filter((g) => !have.includes(g)).join(", ")}</span>`;
    }
    if (run?.extensions?.lms?.canvas_course_id) {
      return mapped ? '<span class="ok">Canvas group mapped</span>' : '<span class="todo">Canvas group not mapped</span>';
    }
    return "";
  };

  const card = (component, index, depth = 0) => {
    const members = membersOf(component.component_id);
    const children = childrenOf(component.component_id);
    const sum =
      members.reduce((total, a) => total + (a.weight ?? 0), 0) + children.reduce((total, c) => total + c.weight, 0);
    const missingWeight = members.some((a) => a.weight === null || a.weight === undefined);
    const balanced = Math.abs(sum - component.weight) <= TOLERANCE;
    const dated = deepMembers(component.component_id).map((a) => a.due_at).filter(Boolean).sort();
    const span = dated.length ? `${shortDate(dated[0])} – ${shortDate(dated[dated.length - 1])}` : "no dates yet";
    const all = deepMembers(component.component_id);
    const marked = all.filter((a) => graded.has(a.assessment_id)).length;

    const kinds = kindsIn(members)
      .map(
        (group) =>
          `<div class="gkind"><div class="row"><span class="k">${kindLabel(group)}</span></div>` +
          `<div class="gitems">${group.items
            .slice()
            .sort((a, b) => String(a.due_at ?? "9").localeCompare(String(b.due_at ?? "9")))
            .map(
              (a) =>
                `<span class="gitem${graded.has(a.assessment_id) ? " gdone" : ""}" title="${escape(`${a.title ?? ""} · ${a.assessment_id} · ${pct(a.weight ?? 0)}`)}">` +
                `${escape(a.title ?? a.assessment_id)}${a.due_at ? ` <span class="dim">${shortDate(a.due_at)}</span>` : ""}` +
                `${graded.has(a.assessment_id) ? " ✓" : ""}</span>`,
            )
            .join("")}</div></div>`,
      )
      .join("");

    return (
      `<section class="gcard" style="--c:var(${hue(index)});margin-left:${depth * 14}px">` +
      `<div class="ghead"><h3>${escape(component.title)} <span class="id">${escape(component.component_id)}</span></h3>` +
      `<span class="gweight">${pct(component.weight)}</span></div>` +
      `<p class="tally">${span} · ${marked} of ${all.length} with marks · ` +
      (missingWeight
        ? '<span class="todo">an assessment here has no weight</span>'
        : balanced
          ? `<span class="ok">adds up to ${pct(sum)} ✓</span>`
          : `<span class="todo">adds up to ${pct(sum)} of ${pct(component.weight)}</span>`) +
      `${canvasLine(component) ? " · " + canvasLine(component) : ""}</p>` +
      (component.description ? `<p class="dim">${escape(component.description)}</p>` : "") +
      kinds +
      (members.length || children.length ? "" : '<p class="empty">Nothing counts in this block yet.</p>') +
      children.map((child) => card(child, index, depth + 1)).join("") +
      "</section>"
    );
  };

  const loose = unassigned.length
    ? '<section class="gcard gloose"><div class="ghead"><h3>In no block</h3></div>' +
      '<p class="tally"><span class="todo">These count in the grade but in none of its blocks — set <code>component</code> on each.</span></p>' +
      `<div class="gitems">${unassigned
        .map((a) => `<span class="gitem">${escape(a.title ?? a.assessment_id)} <span class="dim">${a.weight != null ? pct(a.weight) : "no weight"}</span></span>`)
        .join("")}</div></section>`
    : "";

  const total = top.reduce((sum, c) => sum + c.weight, 0);
  const head =
    `<section><h2>How the grade is built</h2>` +
    `<p class="tally">${top.length} blocks · ${Math.abs(total - 1) <= TOLERANCE ? "100% ✓" : `<span class="todo">${pct(total)} of 100%</span>`}</p>${bar}` +
    (run.grading_scheme.description ? `<p class="dim gdesc">${escape(run.grading_scheme.description)}</p>` : "") +
    "</section>";

  return head + top.map((component, index) => card(component, index)).join("") + loose;
};

/**
 * The styles the scheme adds to the page `documentPage` builds. `dark` is the
 * pane's own flag, which wins over the system's, as it does for the page.
 */
const DARK = ":root{--b1:#6e9ed6;--b2:#5fbf98;--b3:#d69563;--b4:#a983cf;--b5:#d6708f;--ok:#6cc08a}";
export const schemeStyle = (dark) =>
  "<style>" +
  ":root{--b1:#3b6ea8;--b2:#2f8f6b;--b3:#a8632f;--b4:#7a4fa3;--b5:#a83b5d;--ok:#2f7a4a}" +
  (dark ? DARK : `@media(prefers-color-scheme:dark){${DARK}}`) +
  ".gbar{display:flex;gap:4px;margin:8px 0 6px}" +
  ".gseg{min-width:0}" +
  ".glabel{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--c);margin-bottom:3px}" +
  ".glabel b{font-weight:600}" +
  ".gfill{display:flex;height:22px;border-radius:4px;overflow:hidden;gap:1px}" +
  ".gpart{background:var(--c)}" +
  ".gempty{background:repeating-linear-gradient(45deg,transparent 0 4px,var(--line) 4px 8px)}" +
  ".gdesc{font-size:12px;margin-top:6px}" +
  ".gcard{border-left:3px solid var(--c);padding:6px 0 4px 12px;margin:0 0 14px}" +
  ".gloose{--c:var(--warn)}" +
  ".ghead{display:flex;justify-content:space-between;align-items:baseline;gap:8px}" +
  ".ghead h3{margin:0;font-size:14px}" +
  ".gweight{font-size:18px;font-weight:600;color:var(--c)}" +
  ".ok{color:var(--ok)}" +
  ".gkind{margin:4px 0 8px}" +
  ".gkind .row{border:none;padding:2px 0}" +
  ".gitems{display:flex;flex-wrap:wrap;gap:4px}" +
  ".gitem{font-size:11px;border:1px solid var(--line);border-radius:3px;padding:1px 6px;white-space:nowrap;" +
  "max-width:100%;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box}" +
  ".gdone{border-color:var(--ok)}" +
  "</style>";
