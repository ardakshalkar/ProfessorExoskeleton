// Builds vendor/dots-swarm.js: the DotSwarm component of `dots-swarm`
// (MIT, https://dotsui.dev), bundled once so the pane can use it with no build
// step of its own. React is not bundled: the pane must share the harness's
// React instance, or hooks break, so the bundle reads it from
// `window.__professorPaneReact`, which lib/client.js sets before loading it.
//
//   cd <a scratch folder> && npm install dots-swarm@0.1.0-alpha.4 esbuild@0.25
//   node <checkout>/plugins/dsh-professor-pane/vendor/build-dots.mjs <that folder>
//
// The output is committed, with the package's licence beside it, so nothing
// here runs when the pane loads.

import { build } from "esbuild";
import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const from = process.argv[2];
if (!from) throw new Error("usage: node build-dots.mjs <folder where dots-swarm and esbuild are installed>");
const here = fileURLToPath(new URL(".", import.meta.url));

const shared = {
  name: "shared-react",
  setup(b) {
    b.onResolve({ filter: /^react(\/jsx-runtime)?$/ }, (args) => ({ path: args.path, namespace: "shared-react" }));
    b.onLoad({ filter: /.*/, namespace: "shared-react" }, (args) => ({
      loader: "js",
      contents:
        args.path === "react"
          ? `const R = window.__professorPaneReact;
             export default R;
             export const { Fragment, createContext, forwardRef, useCallback, useContext, useEffect, useId,
               useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } = R;`
          : `const R = window.__professorPaneReact;
             // jsx has one child or none; jsxs has a fixed list, passed as
             // arguments so React does not ask the list for keys.
             const element = (spread) => (type, props, key) => {
               const { children, ...rest } = props || {};
               const own = key === undefined ? rest : { ...rest, key };
               if (children === undefined) return R.createElement(type, own);
               return spread && Array.isArray(children) ? R.createElement(type, own, ...children) : R.createElement(type, own, children);
             };
             export const jsx = element(false);
             export const jsxs = element(true);
             export const Fragment = R.Fragment;`,
    }));
  },
};

await build({
  stdin: {
    contents: `import { DotSwarm } from "dots-swarm"; window.__professorPaneDots = { DotSwarm };`,
    resolveDir: from,
    loader: "js",
  },
  bundle: true,
  format: "iife",
  minify: true,
  target: "es2020",
  legalComments: "eof",
  plugins: [shared],
  outfile: join(here, "dots-swarm.js"),
  nodePaths: [join(from, "node_modules")],
});
copyFileSync(join(from, "node_modules", "dots-swarm", "LICENSE"), join(here, "dots-swarm.LICENSE"));
console.log("wrote vendor/dots-swarm.js and vendor/dots-swarm.LICENSE");
