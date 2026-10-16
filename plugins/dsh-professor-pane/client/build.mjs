/**
 * Builds `lib/client.js` from the modules in this folder, with esbuild.
 *
 *   node client/build.mjs          write lib/client.js
 *   node client/build.mjs --check  exit 1 if lib/client.js is not what the sources build
 *   node client/build.mjs --watch  rebuild on every save, with a source map
 *
 * WHAT DSH WANTS
 * --------------
 * dsh serves exactly one file per package — `exports["./client"]`, at
 * `/plugins/<id>/client.js`, plus `client.js.map` beside it if there is one
 * (`serveBundle` in `@deepseek-ai/dsh-client-modules/lib/index.js`) — in the
 * module loader's registration form: `window.__ModuleLoader__.load({ id,
 * factory })`, where the factory takes a synchronous `require` and returns
 * `module.exports`. So the bundle is CommonJS, and the banner and footer below
 * wrap it in that form. esbuild counts them in the source map.
 *
 * `react` and `react-dom` are external: the bundle calls `require("react")`
 * and the loader answers with the host's copy. Everything else, npm packages
 * included, is bundled.
 *
 * JSX and TSX work in `.jsx` and `.tsx` modules, compiled to `h(...)` and
 * `Fragment` (the classic transform; the loader has no `react/jsx-runtime`),
 * so such a module imports both from `./react.js`. The `.js` modules stay
 * plain JavaScript.
 *
 * WATCH
 * -----
 * `--watch` writes on every save. dsh's own dev chain (`dsh-client-hmr`)
 * stat-polls each plugin's `client.js` every 500ms and swaps the new module
 * into the open page, so a save shows up in the running harness without a
 * reload. Watch builds also write `lib/client.js.map` (not committed) and
 * point at it, which makes the committed file differ: run `npm run build`
 * before committing. `test/client-build.test.mjs` fails until you do.
 *
 * The committed build has no map and is deterministic for a given esbuild —
 * pinned exactly in the project's package.json for that reason.
 */

import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const PLUGIN = fileURLToPath(new URL("..", import.meta.url));
const OUT = fileURLToPath(new URL("../lib/client.js", import.meta.url));

const BANNER = `// Built by client/build.mjs from client/ — edit those, then \`npm run build\`.
window.__ModuleLoader__.load({
  id: "dsh-professor-pane",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;`;

const FOOTER = `    if (!Object.prototype.hasOwnProperty.call(module.exports, Symbol.toStringTag)) {
      Object.defineProperty(module.exports, Symbol.toStringTag, { value: "Module" });
    }
    return module.exports;
  },
});`;

/** The esbuild options, shared by the one-off build, the check and the watch. */
export const options = (dev = false) => ({
  absWorkingDir: PLUGIN,
  entryPoints: ["client/main.js"],
  outfile: "lib/client.js",
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  external: ["react", "react-dom"],
  jsx: "transform",
  jsxFactory: "h",
  jsxFragment: "Fragment",
  resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
  charset: "utf8",
  legalComments: "inline",
  banner: { js: BANNER },
  footer: { js: FOOTER },
  sourcemap: dev ? "linked" : false,
  logLevel: "silent",
});

/**
 * Every module in client/ must be reached from `main.js`. A bundler includes
 * only what the entry imports, so a module nobody imports — a stylesheet that
 * only runs for its side effect, say — would vanish without an error.
 */
const unreached = (metafile) => {
  const reached = new Set(Object.keys(metafile.inputs));
  return readdirSync(PLUGIN + "client")
    .filter((file) => /\.(jsx?|tsx?)$/.test(file))
    .map((file) => "client/" + file)
    .filter((file) => !reached.has(file));
};

/** The bundle as text, in memory: what `lib/client.js` should hold. */
export const build = () => {
  const result = esbuild.buildSync({ ...options(false), write: false, metafile: true });
  const missing = unreached(result.metafile);
  if (missing.length) {
    throw new Error(`not imported from client/main.js, so left out of the bundle: ${missing.join(", ")}`);
  }
  return result.outputFiles.find((file) => file.path.endsWith(".js")).text;
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain && process.argv.includes("--watch")) {
  const report = {
    name: "report",
    setup(b) {
      b.onEnd((result) => {
        const at = new Date().toLocaleTimeString();
        if (result.errors.length) {
          for (const message of esbuild.formatMessagesSync(result.errors, { kind: "error", color: true })) {
            console.error(message);
          }
          console.error(`${at}  build failed; lib/client.js left as it was`);
        } else {
          console.log(`${at}  wrote lib/client.js`);
          const missing = result.metafile ? unreached(result.metafile) : [];
          if (missing.length) console.warn(`  not imported from client/main.js, so not in it: ${missing.join(", ")}`);
        }
      });
    },
  };
  const context = await esbuild.context({ ...options(true), metafile: true, plugins: [report] });
  await context.watch();
  console.log("watching client/ — Ctrl+C to stop; run `npm run build` before committing");
} else if (isMain) {
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
    // A map left by a watch would no longer match; the committed build has none.
    rmSync(OUT + ".map", { force: true });
    console.log(`wrote lib/client.js (${built.split("\n").length} lines)`);
  }
}
