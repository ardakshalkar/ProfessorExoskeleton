import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  DEFAULT_TOKEN_ENV,
  connectionAsJson,
  findConnection,
  loadRegistry,
  readConnection,
  saveRegistry,
  tokenFor,
  tokenPresent,
  tokenSource,
  usable,
} from "../src/connections/index.ts";
import { forgetCredentials } from "../src/connections/store.ts";
import { merge, nameForHost } from "../src/connections/legacy.ts";
import { probe } from "../src/connections/probe.ts";
import { runConnections } from "../src/connections/command.ts";
import { loadCanvasConfig } from "../src/lms/canvas-api.ts";
import { RecordedTransport, type Response } from "../src/lms/http.ts";

/**
 * The behaviours that would be dangerous to get wrong in a merged registry:
 * that a secret never lands in the file or in output, that a named connection
 * is never quietly swapped for another, and that a migration cannot destroy a
 * setup that already works.
 *
 * Nothing here reaches the network — `RecordedTransport` replays canned
 * responses — and nothing reads the real `~/.ainar/connections.json`: every
 * test names its own file in a temporary directory.
 */

const scratch = (): string => mkdtempSync(join(tmpdir(), "ainar-connections-"));

/** A registry file with the given connections, and its path. */
const registryWith = (document: unknown): string => {
  const path = join(scratch(), "connections.json");
  writeFileSync(path, JSON.stringify(document, null, 2), "utf-8");
  return path;
};

const response = (status: number, body: string): Response => ({ status, body, headers: {} });

/** Run a command and collect what it printed. */
const collect = async (
  args: Partial<Parameters<typeof runConnections>[0]> & { subcommand: string },
  transport?: RecordedTransport,
): Promise<{ code: number; lines: string[] }> => {
  const lines: string[] = [];
  const code = await runConnections(
    {
      name: null,
      connections: null,
      rosterDir: null,
      profiles: null,
      json: false,
      dryRun: false,
      ...args,
    },
    { out: (line) => lines.push(line) },
    transport,
  );
  return { code, lines };
};

/** Set variables for one call and put the environment back afterwards. */
const withEnv = async <T>(
  values: Record<string, string | undefined>,
  body: () => T | Promise<T>,
): Promise<T> => {
  const saved: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(values)) {
    saved[name] = process.env[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    return await body();
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
};

// ------------------------------------------------------------------ the file

test("a literal token makes the connection unusable and says to revoke it", () => {
  const connection = readConnection("canvas-narxoz", {
    type: "canvas",
    baseUrl: "https://canvas.narxoz.kz",
    token: "a-real-looking-secret",
  });
  assert.equal(usable(connection), false, "a connection carrying a secret cannot be used");
  const issue = connection.issues.find((entry) => entry.code === "secret_in_file")!;
  assert.ok(issue, "and the reason is named");
  assert.match(issue.message, /revoke/i, "revoke, not relocate");
  assert.doesNotMatch(
    JSON.stringify(connection),
    /a-real-looking-secret/,
    "and the value itself is never carried into the loaded shape",
  );
});

test("the writer has no branch that could emit a token", () => {
  const path = join(scratch(), "connections.json");
  const connection = readConnection("canvas-x", {
    type: "canvas",
    baseUrl: "https://canvas.example.edu",
    token: "another-secret",
  });
  saveRegistry(path, [connection]);
  const written = readFileSync(path, "utf-8");
  assert.doesNotMatch(written, /another-secret/);
  assert.doesNotMatch(written, /"token"/, "not even an empty one");
  assert.match(written, /"tokenEnv": "AINAR_CANVAS_TOKEN"/, "the variable's name is what is kept");
  assert.equal(connectionAsJson(connection).token, undefined);
});

test("a Canvas course id that is a human handle is refused", () => {
  // `canvas-88219` is what CSS-4008's run record carries, and the API takes a
  // number. Accepting it would describe a push that cannot work.
  const connection = readConnection("c", {
    type: "canvas",
    baseUrl: "https://canvas.narxoz.kz",
    courseId: "canvas-88219",
  });
  assert.equal(usable(connection), false);
  assert.match(connection.issues[0]!.message, /numeric Canvas course id/);
});

test("a host that is not HTTPS is refused before a token can be sent to it", () => {
  const connection = readConnection("c", { type: "canvas", baseUrl: "http://canvas.narxoz.kz" });
  assert.equal(usable(connection), false);
  assert.match(connection.issues[0]!.message, /HTTPS/);
  // A loopback host is how a test double is addressed, and is allowed.
  assert.equal(usable(readConnection("c", { type: "canvas", baseUrl: "http://localhost:8080" })), true);
});

test("each type falls back to its own AINAR_ variable, never a bare one", () => {
  for (const [type, variable] of Object.entries(DEFAULT_TOKEN_ENV)) {
    const extras = type === "telegram" ? { chatId: "@x" } : { baseUrl: "https://x.example.edu" };
    const connection = readConnection("c", { type, ...extras });
    assert.equal(connection.tokenEnv, variable);
    assert.match(variable, /^AINAR_/, `${type} must not claim a bare variable name`);
  }
});

// ---------------------------------------------------------------- the lookup

test("two connections of a type and no default is an error, not a guess", () => {
  const path = registryWith({
    connections: {
      "canvas-a": { type: "canvas", baseUrl: "https://a.example.edu" },
      "canvas-b": { type: "canvas", baseUrl: "https://b.example.edu" },
    },
  });
  const registry = loadRegistry(path);
  assert.equal(
    findConnection(registry, { type: "canvas" }),
    null,
    "guessing between two Canvas hosts is how grades reach the wrong course",
  );
  assert.equal(findConnection(registry, { name: "canvas-b" })!.baseUrl, "https://b.example.edu");
});

test("a declared default resolves, and a single connection needs none", () => {
  const two = loadRegistry(
    registryWith({
      connections: {
        "canvas-a": { type: "canvas", baseUrl: "https://a.example.edu" },
        "canvas-b": { type: "canvas", baseUrl: "https://b.example.edu" },
      },
      defaults: { canvas: "canvas-b" },
    }),
  );
  assert.equal(findConnection(two, { type: "canvas" })!.name, "canvas-b");

  const one = loadRegistry(
    registryWith({ connections: { only: { type: "canvas", baseUrl: "https://a.example.edu" } } }),
  );
  assert.equal(findConnection(one, { type: "canvas" })!.name, "only");
});

test("a missing registry is empty rather than an error", () => {
  const registry = loadRegistry(join(scratch(), "nothing-here.json"));
  assert.equal(registry.present, false);
  assert.equal(registry.error, null);
  assert.deepEqual(registry.connections, []);
});

test("one malformed connection does not hide the others", () => {
  const registry = loadRegistry(
    registryWith({
      connections: {
        broken: { type: "carrier-pigeon" },
        working: { type: "canvas", baseUrl: "https://a.example.edu" },
      },
    }),
  );
  assert.equal(registry.connections.length, 2);
  assert.equal(usable(registry.connections.find((entry) => entry.name === "working")!), true);
});

// --------------------------------------------------------------- the merging

test("a host becomes a name a professor recognises", () => {
  assert.equal(nameForHost("canvas", "https://canvas.narxoz.kz"), "canvas-narxoz");
  assert.equal(nameForHost("canvas", "https://narxoz.instructure.com"), "canvas-narxoz");
  assert.equal(nameForHost("moodle", null), "moodle-main");
});

test("migration never overwrites, and never silently drops", () => {
  const existing = [readConnection("canvas-narxoz", { type: "canvas", baseUrl: "https://kept.example.edu" })];
  const found = [
    {
      connection: readConnection("canvas-narxoz", {
        type: "canvas",
        baseUrl: "https://different.example.edu",
      }),
      source: "somewhere",
      secretLeftBehind: false,
    },
  ];
  const { connections, added } = merge(existing, found);

  const kept = connections.find((entry) => entry.name === "canvas-narxoz")!;
  assert.equal(kept.baseUrl, "https://kept.example.edu", "the registry wins on its own name");
  assert.equal(added.length, 1);
  assert.equal(added[0]!.name, "canvas-narxoz-2", "and the discovered one is offered, not lost");
});

test("re-running a migration that has nothing new to add changes nothing", () => {
  const same = readConnection("canvas-a", { type: "canvas", baseUrl: "https://a.example.edu" });
  const { added, skipped } = merge([same], [{ connection: same, source: "x", secretLeftBehind: false }]);
  assert.deepEqual(added, []);
  assert.equal(skipped.length, 1);
});

test("migrate reports a literal token and does not copy it", async () => {
  const directory = scratch();
  const profiles = join(directory, "profiles.json");
  writeFileSync(
    profiles,
    JSON.stringify({
      profiles: {
        "canvas-narxoz": {
          type: "canvas",
          baseUrl: "https://canvas.narxoz.kz",
          token: "the-secret-that-must-not-travel",
        },
      },
    }),
    "utf-8",
  );
  const registry = join(directory, "connections.json");

  const { lines } = await collect({
    subcommand: "migrate",
    connections: registry,
    profiles,
    // A roster directory with no lms.toml in it, so the only source is the file above.
    rosterDir: scratch(),
  });

  const printed = lines.join("\n");
  assert.doesNotMatch(printed, /the-secret-that-must-not-travel/, "never printed");
  assert.match(printed, /NOT copied/);
  assert.match(printed, /Revoke that token/);

  const written = readFileSync(registry, "utf-8");
  assert.doesNotMatch(written, /the-secret-that-must-not-travel/, "never written");
  assert.match(written, /canvas\.narxoz\.kz/, "but the host does come across");
});

// ----------------------------------------------------------- the token store

/** A `$DSH_HOME` holding a credentials document with these refs. */
const dshHomeWith = (refs: Record<string, string>): string => {
  const home = scratch();
  const lines = ["version: 1", "refs:"];
  for (const [name, value] of Object.entries(refs)) lines.push(`  ${name}: ${value}`);
  writeFileSync(join(home, ".credentials.yaml"), lines.join("\n") + "\n", "utf-8");
  forgetCredentials();
  return home;
};

test("a token saved by the pane is found by the CLI", async () => {
  const home = dshHomeWith({ AINAR_CANVAS_TOKEN: "saved-by-the-pane" });
  const connection = readConnection("c", { type: "canvas", baseUrl: "https://canvas.example.edu" });

  await withEnv({ DSH_HOME: home, AINAR_CANVAS_TOKEN: undefined }, () => {
    forgetCredentials();
    assert.equal(tokenPresent(connection), true);
    assert.equal(tokenSource(connection), "file");
    assert.equal(tokenFor(connection), "saved-by-the-pane");
  });
  forgetCredentials();
});

test("a value exported in the shell shadows the saved one", async () => {
  // The provider's own precedence: a per-run override is operator intent for
  // this run and cannot be edited from inside, so it has to win visibly.
  const home = dshHomeWith({ AINAR_CANVAS_TOKEN: "saved" });
  const connection = readConnection("c", { type: "canvas", baseUrl: "https://canvas.example.edu" });

  await withEnv({ DSH_HOME: home, AINAR_CANVAS_TOKEN: "exported" }, () => {
    forgetCredentials();
    assert.equal(tokenFor(connection), "exported");
    assert.equal(tokenSource(connection), "env", "and the report says which won");
  });
  forgetCredentials();
});

test("an empty stored value is absent, not a configured blank", async () => {
  const home = dshHomeWith({ AINAR_CANVAS_TOKEN: '""' });
  const connection = readConnection("c", { type: "canvas", baseUrl: "https://canvas.example.edu" });

  await withEnv({ DSH_HOME: home, AINAR_CANVAS_TOKEN: undefined }, () => {
    forgetCredentials();
    assert.equal(tokenPresent(connection), false);
    assert.throws(() => tokenFor(connection), /is set neither in the environment nor in/);
  });
  forgetCredentials();
});

test("a malformed credentials document degrades to the environment", async () => {
  const home = scratch();
  writeFileSync(join(home, ".credentials.yaml"), "refs: [this is not a mapping\n", "utf-8");
  const connection = readConnection("c", { type: "canvas", baseUrl: "https://canvas.example.edu" });

  await withEnv({ DSH_HOME: home, AINAR_CANVAS_TOKEN: "from-the-shell" }, () => {
    forgetCredentials();
    // The harness has its own UI for reporting a broken document. Crashing a
    // grading command over it would be the wrong place to find out.
    assert.equal(tokenFor(connection), "from-the-shell");
  });
  forgetCredentials();
});

test("`ainar lms` reads a token the pane saved", async () => {
  const home = dshHomeWith({ AINAR_CANVAS_TOKEN: "saved-by-the-pane" });
  const path = registryWith({
    connections: { "canvas-a": { type: "canvas", baseUrl: "https://a.example.edu" } },
  });
  const config = await withEnv(
    { DSH_HOME: home, AINAR_CANVAS_TOKEN: undefined, AINAR_CANVAS_URL: undefined },
    () => {
      forgetCredentials();
      return loadCanvasConfig(null, { connectionsPath: path });
    },
  );
  assert.equal(config.token, "saved-by-the-pane", "the CLI and the pane agree");
  forgetCredentials();
});

test("list says whether a token came from the shell or was saved", async () => {
  const home = dshHomeWith({ AINAR_CANVAS_TOKEN: "saved" });
  const path = registryWith({
    connections: { "canvas-a": { type: "canvas", baseUrl: "https://a.example.edu" } },
  });
  const { lines } = await withEnv({ DSH_HOME: home, AINAR_CANVAS_TOKEN: undefined }, () => {
    forgetCredentials();
    return collect({ subcommand: "list", connections: path });
  });
  const printed = lines.join("\n");
  assert.match(printed, /✓ \(saved\)/);
  assert.doesNotMatch(printed, /saved-?by/, "and still never the value");
  forgetCredentials();
});

// ---------------------------------------------------------------- the doctor

test("Canvas answering is reported as a live token and nothing more", async () => {
  const connection = readConnection("c", { type: "canvas", baseUrl: "https://canvas.example.edu" });
  const transport = new RecordedTransport({
    "GET /api/v1/users/self/profile": response(200, JSON.stringify({ name: "A Professor" })),
  });
  const result = await withEnv({ AINAR_CANVAS_TOKEN: "t" }, () => probe(connection, transport));
  assert.equal(result.ok, true);
  assert.equal(result.identity, "A Professor");
  assert.match(result.detail, /separate question/, "it does not claim the token can grade");
});

test("a refused Canvas token names the variable to fix", async () => {
  const connection = readConnection("c", { type: "canvas", baseUrl: "https://canvas.example.edu" });
  const transport = new RecordedTransport({
    "GET /api/v1/users/self/profile": response(401, JSON.stringify({ errors: [{ message: "Invalid access token." }] })),
  });
  const result = await withEnv({ AINAR_CANVAS_TOKEN: "stale" }, () => probe(connection, transport));
  assert.equal(result.ok, false);
  assert.equal(result.checked, true);
  assert.match(result.detail, /AINAR_CANVAS_TOKEN/);
  assert.match(result.detail, /Invalid access token/);
});

test("Moodle putting its refusal in a 200 body is still a failure", async () => {
  const connection = readConnection("m", { type: "moodle", baseUrl: "https://moodle.example.edu" });
  const transport = new RecordedTransport({
    "POST /webservice/rest/server.php": response(
      200,
      JSON.stringify({ exception: "moodle_exception", message: "Invalid token" }),
    ),
  });
  const result = await withEnv({ AINAR_MOODLE_TOKEN: "t" }, () => probe(connection, transport));
  assert.equal(result.ok, false, "200 is not agreement when the body says otherwise");
  assert.match(result.detail, /Invalid token/);
});

test("the Moodle token goes in the body, never in the URL", async () => {
  const connection = readConnection("m", { type: "moodle", baseUrl: "https://moodle.example.edu" });
  const transport = new RecordedTransport({
    "POST /webservice/rest/server.php": response(200, JSON.stringify({ sitename: "Example" })),
  });
  await withEnv({ AINAR_MOODLE_TOKEN: "secret-token" }, () => probe(connection, transport));
  const [, url, body] = transport.calls[0]!;
  assert.doesNotMatch(url, /secret-token/, "a credential in a query string reaches every proxy log");
  assert.match(body ?? "", /wstoken=secret-token/);
});

test("nothing is asked of a provider when there is no token to ask with", async () => {
  const connection = readConnection("c", { type: "canvas", baseUrl: "https://canvas.example.edu" });
  const transport = new RecordedTransport({});
  const result = await withEnv({ AINAR_CANVAS_TOKEN: undefined }, () => probe(connection, transport));
  assert.equal(result.checked, false, "no request is made");
  assert.equal(transport.calls.length, 0, "and the professor's quota is not spent");
  assert.match(result.detail, /AINAR_CANVAS_TOKEN is not set/);
  assert.match(result.detail, /Account → Settings/, "with where to get one");
});

test("doctor exits non-zero when a connection cannot be used at all", async () => {
  const path = registryWith({
    connections: { "canvas-a": { type: "canvas", baseUrl: "https://a.example.edu" } },
  });
  const { code, lines } = await withEnv({ AINAR_CANVAS_TOKEN: undefined }, () =>
    collect({ subcommand: "doctor", connections: path }, new RecordedTransport({})),
  );
  assert.match(lines.join("\n"), /^skip/m);
  assert.equal(
    code,
    1,
    "a wall of `skip` is not a passing report — nothing here could push anything",
  );
});

test("a broken connection is skipped rather than probed", async () => {
  const connection = readConnection("c", { type: "canvas", baseUrl: "http://insecure.example.edu" });
  const transport = new RecordedTransport({});
  const result = await withEnv({ AINAR_CANVAS_TOKEN: "t" }, () => probe(connection, transport));
  assert.equal(result.checked, false);
  assert.equal(transport.calls.length, 0);
});

// --------------------------------------------------------------- the listing

test("list prints the variable's name and whether it is set, never a value", async () => {
  const path = registryWith({
    connections: { "canvas-narxoz": { type: "canvas", baseUrl: "https://canvas.narxoz.kz" } },
  });
  const { lines } = await withEnv({ AINAR_CANVAS_TOKEN: "a-secret-value" }, () =>
    collect({ subcommand: "list", connections: path }),
  );
  const printed = lines.join("\n");
  assert.doesNotMatch(printed, /a-secret-value/);
  assert.match(printed, /AINAR_CANVAS_TOKEN ✓/);
});

test("list --json carries presence, never the credential", async () => {
  const path = registryWith({
    connections: { "canvas-narxoz": { type: "canvas", baseUrl: "https://canvas.narxoz.kz" } },
  });
  const { lines } = await withEnv({ AINAR_CANVAS_TOKEN: "a-secret-value" }, () =>
    collect({ subcommand: "list", connections: path, json: true }),
  );
  const payload = JSON.parse(lines.join("\n"));
  assert.equal(payload.connections[0].tokenPresent, true);
  assert.doesNotMatch(lines.join("\n"), /a-secret-value/);
});

// -------------------------------------------------------------- the adapters

test("`ainar lms` finds the host in the registry", async () => {
  const path = registryWith({
    connections: {
      "canvas-narxoz": {
        type: "canvas",
        baseUrl: "https://canvas.narxoz.kz",
        courseId: "88219",
      },
    },
  });
  const config = await withEnv(
    { AINAR_CANVAS_TOKEN: "t", AINAR_CANVAS_URL: undefined },
    () => loadCanvasConfig(null, { connectionsPath: path }),
  );
  assert.equal(config.base_url, "https://canvas.narxoz.kz");
  assert.equal(config.course_id, "88219", "and a course the connection names comes with it");
  assert.match(config.source ?? "", /connection canvas-narxoz/, "and it says where it came from");
});

test("a connection named on the command line is never quietly swapped", async () => {
  const path = registryWith({
    connections: {
      "canvas-a": { type: "canvas", baseUrl: "https://a.example.edu" },
      "sheets-mine": { type: "sheets" },
    },
  });
  await withEnv({ AINAR_CANVAS_TOKEN: "t", AINAR_CANVAS_URL: undefined }, () => {
    // The other Canvas in the file is not offered as a substitute, and neither
    // is the sole Canvas when a different name was asked for.
    assert.throws(
      () => loadCanvasConfig(null, { connection: "canvas-b", connectionsPath: path }),
      /no connection called 'canvas-b'/,
    );
    assert.throws(
      () => loadCanvasConfig(null, { connection: "sheets-mine", connectionsPath: path }),
      /is a sheets connection, not canvas/,
    );
    assert.equal(
      loadCanvasConfig(null, { connection: "canvas-a", connectionsPath: path }).base_url,
      "https://a.example.edu",
    );
  });
});

test("--canvas-url still overrides the registry, for one invocation", async () => {
  const path = registryWith({
    connections: { "canvas-a": { type: "canvas", baseUrl: "https://registry.example.edu" } },
  });
  const config = await withEnv({ AINAR_CANVAS_TOKEN: "t", AINAR_CANVAS_URL: undefined }, () =>
    loadCanvasConfig(null, { baseUrl: "https://typed.example.edu", connectionsPath: path }),
  );
  assert.equal(config.base_url, "https://typed.example.edu");
  assert.equal(config.source, "--canvas-url");
});
