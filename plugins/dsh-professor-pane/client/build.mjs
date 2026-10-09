/**
 * Builds `lib/client.js` from the modules in this folder.
 *
 *   node client/build.mjs          write lib/client.js
 *   node client/build.mjs --check  exit 1 if lib/client.js is not what the sources build
 *
 * Why a build at all, and why this one rather than a bundler. dsh serves
 * exactly one file per package — `exports["./client"]`, at
 * `/plugins/<id>/client.js`, and nothing else under that prefix (see
 * `serveBundle` in `@deepseek-ai/dsh-client-modules/lib/index.js`) — so a
 * browser half split across files has to be joined before the harness sees it.
 * The modules here were cut out of one factory closure, every top-level name
 * in them is unique, and none of them needs a package from npm, so joining is
 * all a bundler would do: drop the `import` lines, drop the `export` keywords,
 * concatenate in the order below, and wrap the result in the module loader's
 * registration form. That is this file, using the TypeScript parser the
 * project already depends on to find the imports and exports rather than a
 * regular expression. Adding esbuild would have meant an install over the
 * whole `@deepseek-ai` tree for a step this small.
 *
 * The `import`/`export` lines are for the reader and the editor — they say what
 * each module takes from the others, and they make go-to-definition work. They
 * are not a module system at runtime: everything shares the factory's scope,
 * exactly as it did when this was one file. Two consequences:
 *
 * * Order matters for top-level code that runs at load — a `const` read while
 *   the factory runs must be declared earlier in `ORDER`. Functions and
 *   components run later and are unaffected. The build checks this.
 * * `require`, `module` and `exports` are the factory's own; `react.js` and
 *   `main.js` use them as free names.
 *
 * The output is the sources indented four spaces into the factory, with the
 * lines inside a template literal left as written (the stylesheet), and one
 * `// ── client/<file>` line where each module starts so a stack trace in the
 * browser can be found here. `test/client-build.test.mjs` fails when
 * `lib/client.js` is out of step with this folder.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const HERE = fileURLToPath(new URL(".", import.meta.url));
const OUT = fileURLToPath(new URL("../lib/client.js", import.meta.url));

/** The modules, in the order their code runs inside the factory. */
export const ORDER = [
  "react.js",
  "tabs.js",
  "style.js",
  "common.js",
  "preferences.js",
  "integration-parts.js",
  "integrations.js",
  "syncs.js",
  "course-escape.js",
  "materials.js",
  "publish.js",
  "marks.js",
  "grade-board.js",
  "scans.js",
  "defence-turn.js",
  "defence-dots.js",
  "defence-marks.js",
  "defence-captions.js",
  "defence-screen.js",
  "defence-views.js",
  "defence-stage.js",
  "defence-desk.js",
  "upload.js",
  "pane.js",
  "main.js",
];

const BANNER = "// Built by client/build.mjs from client/*.js — edit those, then `npm run build`.\n";

const PROLOGUE = `window.__ModuleLoader__.load({
  id: "dsh-professor-pane",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
`;

const EPILOGUE = `    return module.exports;
  },
});
`;

/** 0-based line numbers that sit inside a template literal, after its first line. */
const templateLines = (sf) => {
  const lines = new Set();
  const visit = (node) => {
    if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      const first = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
      const last = sf.getLineAndCharacterOfPosition(node.end).line;
      for (let line = first + 1; line <= last; line++) lines.add(line);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return lines;
};

const isExported = (st) => st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/** A module's names declared at the top, and those its load-time code reads. */
const declaredNames = (st) => {
  if (ts.isVariableStatement(st)) return st.declarationList.declarations.map((d) => d.name.getText());
  if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name) return [st.name.text];
  return [];
};

/**
 * Names a statement reads while the factory is still running: everything in a
 * variable initializer or a bare statement, except inside function bodies.
 */
const loadTimeReads = (st) => {
  if (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) return [];
  const out = [];
  const visit = (node) => {
    if (ts.isFunctionLike(node)) return;
    if (ts.isIdentifier(node) && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)) {
      out.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(st);
  return out;
};

/** One module's code, with its header, imports and `export` keywords taken out. */
const bodyOf = (file) => {
  const text = readFileSync(HERE + file, "utf8").replace(/\r\n/g, "\n");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const statements = sf.statements.filter((st) => !ts.isImportDeclaration(st));
  if (statements.length === 0) throw new Error(`client/${file} has no code`);

  // Cut from the end of the imports — or, with none, from the end of the
  // header comment — so the module's own header stays out of the output.
  const imports = sf.statements.filter(ts.isImportDeclaration);
  let start = imports.length ? imports[imports.length - 1].end : 0;
  if (!imports.length && text.startsWith("/**")) start = text.indexOf("*/") + 2;

  // Remove `export ` back to front so earlier offsets stay valid.
  const cuts = [];
  for (const st of statements) {
    if (!isExported(st)) continue;
    const keyword = st.modifiers.find((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    cuts.push([keyword.getStart(sf), keyword.end + 1]);
  }
  let code = text;
  for (const [from, to] of cuts.reverse()) code = code.slice(0, from) + code.slice(to);
  const removedBefore = (pos) => cuts.reduce((n, [from, to]) => (to <= pos ? n + (to - from) : n), 0);
  code = code.slice(start - removedBefore(start));

  // Indent into the factory, leaving template-literal lines exactly as written.
  const firstLine = text.slice(0, start).split("\n").length - 1;
  const inTemplate = templateLines(sf);
  const lines = code.split("\n").map((line, i) =>
    line === "" || inTemplate.has(firstLine + i) ? line : "    " + line,
  );
  return {
    code: lines.join("\n").replace(/^\n+/, "").replace(/\s+$/, ""),
    statements,
  };
};

/** The header of `main.js` is the header of the built file. */
const headerOf = (file) => {
  const text = readFileSync(HERE + file, "utf8").replace(/\r\n/g, "\n");
  return text.slice(0, text.indexOf("*/") + 2);
};

/**
 * The `import` lines are only for the reader, so nothing at runtime keeps them
 * true: every module shares the factory's scope, and a name used without being
 * imported still works. This makes them true by refusing to build when they
 * are not:
 *
 * * a name another module declares is used here without being imported,
 * * a name is imported but never used,
 * * a name is imported from a module that does not export it,
 * * a name is exported but no other module imports it,
 * * two modules declare the same top-level name — legal as modules, a
 *   duplicate declaration once they are joined into one scope.
 *
 * Scope-aware — a local that shadows another module's name is not a use of
 * it — because it asks the TypeScript checker what each identifier resolves to.
 */
const checkImports = () => {
  const paths = ORDER.map((file) => HERE + file);
  const program = ts.createProgram(paths, { allowJs: true, noEmit: true, types: [], noLib: true });
  const checker = program.getTypeChecker();
  const sources = new Map(ORDER.map((file) => [file, program.getSourceFile(HERE + file)]));

  const topNames = new Map(); // name -> declaring file
  const exportsOf = new Map(); // file -> Set of exported names
  const problems = [];
  for (const [file, sf] of sources) {
    const exported = new Set();
    for (const st of sf.statements) {
      for (const name of declaredNames(st)) {
        // One factory scope: a second declaration of the name is a SyntaxError
        // in the built file, whichever module it is in.
        if (topNames.has(name)) {
          problems.push(`client/${file} declares \`${name}\`, which client/${topNames.get(name)} already declares — all modules share one scope`);
        }
        topNames.set(name, file);
        if (isExported(st)) exported.add(name);
      }
    }
    exportsOf.set(file, exported);
  }

  const importedAnywhere = new Set(); // "file:name"
  for (const [file, sf] of sources) {
    const imported = new Map(); // local name -> { from, node }
    for (const st of sf.statements.filter(ts.isImportDeclaration)) {
      const from = st.moduleSpecifier.text.replace(/^\.\//, "");
      for (const el of st.importClause?.namedBindings?.elements ?? []) {
        imported.set(el.name.text, { from, node: el });
        importedAnywhere.add(`${from}:${(el.propertyName ?? el.name).text}`);
        if (!exportsOf.get(from)?.has((el.propertyName ?? el.name).text)) {
          problems.push(`client/${file} imports \`${el.name.text}\` from ./${from}, which does not export it`);
        }
      }
    }
    const used = new Set();
    const visit = (node) => {
      if (ts.isImportDeclaration(node)) return;
      if (ts.isIdentifier(node) && isReference(node)) {
        const symbol = ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node
          ? checker.getShorthandAssignmentValueSymbol(node.parent)
          : checker.getSymbolAtLocation(node);
        const declaration = symbol?.declarations?.[0];
        if (declaration && ts.isImportSpecifier(declaration)) used.add(node.text);
        else if (!declaration && topNames.has(node.text) && topNames.get(node.text) !== file) {
          problems.push(`client/${file} uses \`${node.text}\` from ./${topNames.get(node.text)} without importing it`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    for (const name of imported.keys()) {
      if (!used.has(name)) problems.push(`client/${file} imports \`${name}\` and never uses it`);
    }
  }
  for (const [file, names] of exportsOf) {
    for (const name of names) {
      if (!importedAnywhere.has(`${file}:${name}`)) {
        problems.push(`client/${file} exports \`${name}\`, which no module imports`);
      }
    }
  }
  if (problems.length) throw new Error("imports out of step:\n  " + [...new Set(problems)].join("\n  "));
};

/** An identifier that names a binding, not a property or a label. */
const isReference = (node) => {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if ((ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent)) && parent.name === node) return false;
  if (ts.isBindingElement(parent) && parent.propertyName === node) return false;
  if ((ts.isLabeledStatement(parent) || ts.isBreakOrContinueStatement(parent)) && parent.label === node) return false;
  return true;
};

export const build = () => {
  checkImports();
  const declared = new Set();
  const parts = [];
  for (const file of ORDER) {
    const { code, statements } = bodyOf(file);
    for (const st of statements) {
      for (const name of loadTimeReads(st)) {
        const later = ORDER.slice(ORDER.indexOf(file) + 1).find((f) => f !== file && laterNames(f).has(name));
        if (later && !declared.has(name)) {
          throw new Error(`client/${file} reads \`${name}\` while loading, but it is declared later, in client/${later}`);
        }
      }
      for (const name of declaredNames(st)) declared.add(name);
    }
    parts.push(`    // ── client/${file}\n\n${code}`);
  }
  return `${BANNER}${headerOf("main.js")}\n\n${PROLOGUE}\n${parts.join("\n\n")}\n${EPILOGUE}`;
};

const namesCache = new Map();
const laterNames = (file) => {
  if (!namesCache.has(file)) {
    const text = readFileSync(HERE + file, "utf8");
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    namesCache.set(file, new Set(sf.statements.flatMap(declaredNames)));
  }
  return namesCache.get(file);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const built = build();
  if (process.argv.includes("--check")) {
    const current = readFileSync(OUT, "utf8").replace(/\r\n/g, "\n");
    if (current !== built) {
      console.error("lib/client.js is out of date: run `npm run build` in plugins/dsh-professor-pane");
      process.exit(1);
    }
    console.log("lib/client.js is up to date");
  } else {
    writeFileSync(OUT, built, "utf8");
    console.log(`wrote lib/client.js (${built.split("\n").length} lines)`);
  }
}
