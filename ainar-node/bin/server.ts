/**
 * The AINAR course model over MCP, on the official TypeScript SDK.
 *
 * Replaces `ainar/mcp/server.py`, which spoke JSON-RPC over stdio by hand. The
 * SDK owns the protocol now; what is left here is the workspace and the tool
 * list, which is the part that was ever ours.
 *
 *     AINAR_WORKSPACE=/path/to/courses node bin/server.js
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { statSync } from "node:fs";
import { createAinarMcpServer } from "../src/mcp/server.ts";
import { TOOLS } from "../src/tools/index.ts";
import { WIDGETS } from "../src/tools/widgets.ts";
import { Workspace } from "../src/workspace.ts";

const resolveWorkspace = (): string => {
  const value = (process.env.AINAR_WORKSPACE ?? "").trim();
  if (!value) {
    console.error(
      "AINAR_WORKSPACE is not set. In Claude Desktop: Settings → Extensions → " +
        "AINAR Course Model, and choose the folder holding your courses/ directory.",
    );
    process.exit(1);
  }
  try {
    if (!statSync(value).isDirectory()) throw new Error();
  } catch {
    console.error(`AINAR_WORKSPACE points at ${value}, which is not a directory.`);
    process.exit(1);
  }
  return value;
};

const root = resolveWorkspace();
// The one host where AINAR_WORKSPACE really is the answer: Claude Desktop sets
// it, nothing else here is consulted, and advice naming it is advice a
// professor can act on.
const workspace = new Workspace(root, "env");

const server = createAinarMcpServer(workspace);

console.error(
  `ainar-mcp: serving ${TOOLS.length} read-only tool(s) and ${WIDGETS.length} widget(s) ` +
    `over ${root} — no writes, no credentials, no student names`,
);

await server.connect(new StdioServerTransport());
