/**
 * Sandbox first: an escalation request reaches the professor only after the
 * sandbox has refused that same call in this harness process.
 *
 * Stock dsh lets the model put `sandbox_permissions` on any call, and the
 * approval card goes straight to the professor. The tool description says
 * "never escalate speculatively", and the professor preset says it again more
 * firmly, and neither held. On 2026-10-18 the sandbox failed once (its temp
 * directory had been deleted; see the `sandboxTempRecreated` patch in
 * `patches/apply.mjs`). After the restart that fixed it, deepseek-v4-flash asked
 * for full access on twenty commands across three turns and two days, including
 * `Get-Date`, without trying the sandbox once. The preset rule was in its system
 * prompt for thirteen of them. A dozen earlier escalations in the conversation
 * outweighed one paragraph of instructions, and each request sat waiting on a
 * professor who was not watching the chat (session-704e6afd).
 *
 * So this is enforced here instead of asked for. On `tools/pre-execute`, a call
 * that carries `sandbox_permissions` is denied, without running and without an
 * approval card, unless the same call (same tool, same arguments apart from the
 * escalation fields and the description) was refused when it ran confined
 * earlier in this process, for this session. The model gets the reason as a
 * tool error, runs the command plainly, and either it works (no approval needed
 * at all) or it is refused and the retry with escalation goes through as stock.
 *
 * What counts as refused is deliberately loose: an error result, a sandbox
 * denial, a runner failure, any non-zero exit, or a permission error anywhere
 * in the output. A rule that blocked one real escalation would be worse than
 * the waste it removes; EPERM from a piped spawn surfaces only as a failing
 * exit, and in a chained command not even as that.
 *
 * The record lives in memory and dies with the process, which is the point: a
 * refusal before a restart says nothing about the sandbox after it.
 */

/** The row id this plugin answers to. */
export const name = "sandbox-first";

/** Arguments that differ between a plain call and its escalated retry without changing what runs. */
const IGNORED_ARGS = new Set(["sandbox_permissions", "justification", "description", "timeoutMs"]);

/** A stable identity for "the same call": tool name plus the arguments that decide what runs. */
function callKey(name, args) {
  if (args === null || typeof args !== "object") return `${name}\0${JSON.stringify(args)}`;
  const kept = Object.keys(args)
    .filter((key) => !IGNORED_ARGS.has(key))
    .sort()
    .map((key) => [key, typeof args[key] === "string" ? args[key].trim() : args[key]]);
  return `${name}\0${JSON.stringify(kept)}`;
}

/**
 * What a write the sandbox blocked looks like in the output, whatever the exit:
 * Node's `EPERM … mkdir` from the ainar CLI, PowerShell's "Access to the path
 * … is denied". On 2026-10-20 `scans file …; scans status …` failed on the
 * first and exited 0 on the second, so the call counted as a success and the
 * escalated retry was refused three times (session-704e6afd, turn 9).
 */
const DENIED_TEXT = /\b(EPERM|EACCES)\b|operation not permitted|Access to the path .{0,300}? is denied|UnauthorizedAccessException/i;

const outputText = (value) =>
  [value.stdout, value.stderr].map((stream) => (typeof stream === "string" ? stream : stream?.text ?? "")).join("\n");

/** Whether a confined call's outcome means the sandbox (or the command under it) said no. */
function refused(result) {
  if (result.isError) return true;
  const value = result.value;
  if (value === null || typeof value !== "object") return false;
  if (value.sandbox?.denied === true || value.sandbox?.runnerFailed === true) return true;
  if (typeof value.exitCode === "number" && value.exitCode !== 0) return true;
  return DENIED_TEXT.test(outputText(value));
}

const sessionOf = (exec) => exec.agent?.session.id ?? "(no session)";

const escalates = (exec) =>
  exec.arguments !== null && typeof exec.arguments === "object" && exec.arguments.sandbox_permissions !== undefined;

const DENIAL =
  "Not run, and no approval was asked: this exact call has not been refused by the sandbox in this harness " +
  "process. Run it again without sandbox_permissions and justification. Sandbox failures earlier in the " +
  "conversation may be from a previous harness process and do not count. If the sandbox refuses it now, " +
  "retry the same call with sandbox_permissions and the request will reach the professor.";

export function apply(ctx) {
  /** session id → keys of calls that were refused while confined. */
  const refusals = new Map();

  ctx.on("tools/pre-execute", (exec, next) => {
    if (!escalates(exec) || exec.arguments.run_in_background === true) return next();
    if (refusals.get(sessionOf(exec))?.has(callKey(exec.name, exec.arguments))) return next();
    return Promise.resolve({ kind: "deny", reason: DENIAL });
    // First in the waterfall, so no later gate raises an approval card for a call this one denies.
  }, { prepend: true });

  ctx.on("tools/result", (exec, result) => {
    if (escalates(exec) || !refused(result)) return;
    const session = sessionOf(exec);
    if (!refusals.has(session)) refusals.set(session, new Set());
    refusals.get(session).add(callKey(exec.name, exec.arguments));
  });
}
