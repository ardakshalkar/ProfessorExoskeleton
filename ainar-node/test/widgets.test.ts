/**
 * The widget layer, and the guarantees it must not quietly widen.
 *
 * The documents themselves are shared with the Python server and checked there —
 * `tests/test_mcp_widgets.py` compares the two byte for byte, and executes each
 * one against a real payload. What is worth asserting on this side is what this
 * side decides: which tools carry a template, that a call still returns the
 * structure a component needs, and that the read-only shape of the server did not
 * change when resources were added to it.
 *
 *     node --experimental-strip-types --test test/
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BY_TOOL, BY_URI, MIME, TEMPLATE_KEY, WIDGETS } from "../src/tools/widgets.ts";
import { TOOLS, WITHHELD, callTool } from "../src/tools/index.ts";
import { Workspace } from "../src/workspace.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const RUN = "CSS-4008-2026-FALL";

test("the assets were found, and there are four of them", () => {
  assert.equal(WIDGETS.length, 4);
  assert.deepEqual(
    WIDGETS.map((w) => w.name),
    ["course-outline", "class-progress", "gradebook", "action-inbox"],
  );
});

test("every widget names a tool this server actually has", () => {
  for (const widget of WIDGETS) {
    assert.ok(
      TOOLS.some((tool) => tool.name === widget.tool),
      `${widget.name} points at ${widget.tool}, which is not a tool here`,
    );
  }
});

test("assessment_rubric has no widget", () => {
  // Its payload carries answer keys and marking guidance, and a component draws
  // itself the moment the model decides it is relevant — in a window that gets
  // screen-shared and projected. Changing this means changing the payload.
  assert.equal(BY_TOOL.has("assessment_rubric"), false);
});

test("a widget document is one self-contained page", () => {
  for (const widget of WIDGETS) {
    const html = widget.html();
    assert.equal(html.split("<script>").length - 1, 1);
    assert.equal(html.split("<style>").length - 1, 1);
    assert.ok(html.includes('<div id="root"></div>'));
    assert.ok(html.indexOf("const BANDS") < html.indexOf("function view"));
    // A component runs under a CSP with an empty allow-list and needs no host.
    assert.ok(!html.includes("http://"), widget.name);
    assert.ok(!html.includes("https://"), widget.name);
    assert.ok(!html.includes("fetch("), widget.name);
  }
});

test("a resource descriptor carries the ui mime type and an empty csp", () => {
  for (const widget of WIDGETS) {
    const descriptor = widget.descriptor() as Record<string, unknown>;
    assert.equal(descriptor.mimeType, MIME);
    const meta = descriptor._meta as { ui: { csp: Record<string, string[]> } };
    assert.deepEqual(meta.ui.csp.connectDomains, []);
    assert.deepEqual(meta.ui.csp.resourceDomains, []);
  }
});

test("a tool's _meta names the template under both keys", () => {
  for (const widget of WIDGETS) {
    const meta = widget.toolMeta() as Record<string, unknown>;
    // The standard key and the alias must land on the same document; a host
    // reading either one must render the same thing.
    assert.deepEqual(meta.ui, { resourceUri: widget.uri });
    assert.equal(meta[TEMPLATE_KEY], widget.uri);
    assert.ok(meta["openai/toolInvocation/invoking"]);
    assert.ok(meta["openai/toolInvocation/invoked"]);
  }
});

test("BY_URI is keyed by the uri the tool advertises", () => {
  for (const widget of WIDGETS) {
    assert.equal(BY_URI.get(widget.uri), widget);
    assert.match(widget.uri, /^ui:\/\/ainar\/[a-z-]+\.html$/);
  }
});

// -------------------------------------------------------- the call result

const workspace = () => new Workspace(ROOT);

test("a widget tool returns structuredContent for the component to render", (t) => {
  if (!existsSync(join(ROOT, "courses", "CSS-4008"))) {
    t.skip("no example course in this checkout");
    return;
  }
  for (const tool of BY_TOOL.keys()) {
    const result = callTool(workspace(), tool, { course_version_id: RUN });
    assert.equal(result.isError, undefined, `${tool}: ${result.content[0]?.text}`);
    // Without this a component is handed nothing to draw.
    assert.ok(result.structuredContent, `${tool} returned no structuredContent`);
    assert.deepEqual(result._meta, { ui: { resourceUri: BY_TOOL.get(tool)!.uri } });
  }
});

test("a markdown tool returns text alone, and no template", (t) => {
  if (!existsSync(join(ROOT, "courses", "CSS-4008"))) {
    t.skip("no example course in this checkout");
    return;
  }
  const result = callTool(workspace(), "syllabus", { course_version_id: RUN });
  assert.equal(result.structuredContent, undefined);
  assert.equal(result._meta, undefined);
  assert.ok(result.content[0].text.length > 100);
});

test("adding resources did not add a write verb", () => {
  // The tool list is the guarantee. A widget receives a payload and can ask the
  // model a question; it has no route to a verb that does not exist.
  for (const forbidden of ["approve", "push", "whois", "import"]) {
    assert.ok(
      !TOOLS.some((tool) => tool.name.includes(forbidden)),
      `a tool matching '${forbidden}' appeared`,
    );
  }
  assert.ok(Object.keys(WITHHELD).length >= 8);
});

// ---------------------------------------------------------------- the template

/**
 * The template language, loaded the way a widget document loads it: as source
 * evaluated in one scope, with `esc` beside it. The parser's refusals are the
 * part worth asserting here — a template with an escape hatch in it must fail
 * where somebody sees the failure, not render something dangerous quietly.
 */
const engine = (): { tmpl: (s: string, m: unknown) => string } => {
  const source = readFileSync(
    join(ROOT, "ainar", "mcp", "widget-assets", "template.js"),
    "utf8",
  );
  const esc = `function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}`;
  return new Function(`${esc}\n${source}\nreturn { tmpl: tmpl };`)() as {
    tmpl: (s: string, m: unknown) => string;
  };
};

test("a value is escaped on its way into the document", () => {
  const { tmpl } = engine();
  const out = tmpl("<p>{{ title }}</p>", { title: '</p><script>alert(1)</script>' });
  assert.ok(!out.includes("<script>"));
  assert.ok(out.includes("&lt;script&gt;"));
});

test("there is no way to ask for unescaped output", () => {
  const { tmpl } = engine();
  assert.throws(() => tmpl("{{{ title }}}", { title: "x" }), /every value is escaped/);
});

test("an unknown tag and an unclosed block are parse errors", () => {
  const { tmpl } = engine();
  assert.throws(() => tmpl("{% include 'other' %}", {}), /unknown tag/);
  assert.throws(() => tmpl("{% for a in list %}x", { list: [] }), /never closed/);
  assert.throws(() => tmpl("{% endif %}", {}), /without/);
});

test("an empty list is false, so a section can ask whether it has rows", () => {
  const { tmpl } = engine();
  const source = "{% if rows %}has{% else %}none{% endif %}";
  assert.equal(tmpl(source, { rows: [] }), "none");
  assert.equal(tmpl(source, { rows: [1] }), "has");
});

test("a loop sees the enclosing scope, which is how a week reaches the run", () => {
  const { tmpl } = engine();
  const out = tmpl("{% for w in weeks %}[{{ w.n }} of {{ id }}]{% endfor %}", {
    id: "RUN-1",
    weeks: [{ n: 1 }, { n: 2 }],
  });
  assert.equal(out, "[1 of RUN-1][2 of RUN-1]");
});

test("a missing path is empty rather than the word undefined", () => {
  const { tmpl } = engine();
  assert.equal(tmpl("[{{ nope.deeper }}]", {}), "[]");
});

test("the template cannot compute: there are no expressions to compute with", () => {
  const { tmpl } = engine();
  // Not a filter, not arithmetic, not a call — each is text, because the parser
  // only recognises dotted paths. A template that could compute could compute a
  // figure no command produced.
  for (const source of ["{{ a | upper }}", "{{ a + 1 }}", "{{ total() }}"]) {
    assert.equal(tmpl(source, { a: 1, total: () => 9 }), source);
  }
});
