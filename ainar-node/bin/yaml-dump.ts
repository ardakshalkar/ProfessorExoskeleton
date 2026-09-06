/**
 * Emit YAML from JSON on stdin, so the emitter can be compared against PyYAML.
 *
 *     echo '{"value": {"a": 1}, "floats": ["a"]}' | node bin/yaml-dump.ts
 *
 * `floats` is a list of dotted paths whose numbers are floats — JavaScript
 * cannot tell `6` from `6.0` and PyYAML writes them differently, so the caller
 * says which is which. `tests/test_yaml_parity.py` is the reason this exists.
 */

import { dump } from "../src/yaml-out.ts";

const input = await new Promise<string>((resolve, reject) => {
  let text = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk) => (text += chunk));
  process.stdin.on("end", () => resolve(text));
  process.stdin.on("error", reject);
});

const { value, floats = [] } = JSON.parse(input) as { value: unknown; floats?: string[] };
const set = new Set(floats);
process.stdout.write(dump(value, (path) => set.has(path.join("."))));
