/**
 * A widget document's scripts, run against a stub host, printing what rendered.
 *
 * This started as a test harness and is now also a build step, which is why it
 * lives here rather than under `tests/`. Two callers, one job:
 *
 *   - `tests/test_mcp_widgets.py` runs it to prove a view *renders*. The tests
 *     can check that a view does not compute a figure and does not reach the
 *     network, because those are properties of the source; whether it renders is
 *     not. The views build markup by string concatenation, so a missing bracket
 *     or a field read off the wrong nesting level is invisible until something
 *     executes it.
 *   - `ainar page` runs it to prerender the public course page. The markup a
 *     student loads is then finished HTML rather than a payload plus the
 *     instructions for turning it into one — and it is the *same* view that
 *     produced it, so the hosted page and the widget in a chat client cannot
 *     drift into two renderings of one course.
 *
 * So this is the host, reduced to the two things a widget actually touches:
 * `document.getElementById('root')` and `window.openai`. It is deliberately not
 * a DOM implementation. A widget that needed one would be doing more than
 * rendering a payload.
 *
 *     node prerender-widget.mjs <document.html|-> [output.html|--markup]
 *
 * `-` reads the document from stdin, and `--markup` writes the rendered markup
 * to stdout with the summary on stderr — which together are what let a caller
 * pipe a document through without either side touching a temporary file.
 *
 * Plain `.mjs` among a directory of `.ts`, because it is invoked by Python with
 * a bare `node` and no flags; adding `--experimental-strip-types` to that call
 * would buy nothing but a version requirement.
 *
 * Exits non-zero if a script threw, if nothing was rendered, or if the widget
 * fell back to its "waiting" or "could not render" state — which is what a
 * payload read incorrectly looks like from the outside.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const [, , input, output] = process.argv;
if (!input) {
  console.error('usage: node prerender-widget.mjs <document.html|-> [output.html|--markup]');
  process.exit(2);
}

const markupOnly = output === '--markup';
const html = readFileSync(input === '-' ? 0 : input, 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];

if (!scripts.length) {
  console.error('no <script> in the document');
  process.exit(1);
}

// `querySelectorAll` returning empty is honest here: the handler-wiring loop
// runs either way, and what it wires up needs a real DOM to exercise.
const root = { innerHTML: '', querySelectorAll: () => [] };
const listeners = [];

const context = {
  console,
  document: { getElementById: (id) => (id === 'root' ? root : null) },
};
context.window = context;
context.addEventListener = (name, fn) => listeners.push([name, fn]);
vm.createContext(context);

let failed = 0;
for (const [index, code] of scripts.entries()) {
  try {
    vm.runInContext(code, context, { filename: `${input}#script-${index}` });
  } catch (error) {
    console.error(`script ${index} threw: ${error.message}`);
    failed = 1;
  }
}

if (!root.innerHTML) {
  console.error('rendered nothing');
  failed = 1;
} else if (/Waiting for the course model|could not render/.test(root.innerHTML)) {
  console.error(`rendered a fallback: ${root.innerHTML.slice(0, 200)}`);
  failed = 1;
}

const summary = `${listeners.length} listener(s), ${root.innerHTML.length} bytes`;
console[markupOnly ? 'error' : 'log'](summary);

if (failed) process.exit(failed);

// The markup alone, for a caller assembling its own page around it. Nothing is
// added: the caller has the stylesheet already, and a `<style>` emitted here
// would be the second copy of it.
if (markupOnly) process.stdout.write(root.innerHTML);
else if (output) {
  // Script-free, so it can be opened anywhere — including a viewer that
  // refuses inline script, which is how these were reviewed by eye.
  writeFileSync(
    output,
    `<style>body{padding:1.25rem;max-width:78rem;margin:0 auto}${style}</style>${root.innerHTML}`,
    'utf8',
  );
}

process.exit(0);
