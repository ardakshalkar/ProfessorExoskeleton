import { runCli } from "../src/cli.ts";

runCli(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`prof-assess: ${message}`);
  process.exitCode = 1;
});
