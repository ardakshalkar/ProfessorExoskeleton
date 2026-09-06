/**
 * Where a Professor Harness action belongs.
 *
 * The split is about authority and state, not implementation language:
 *
 * - skills carry judgement and workflow;
 * - local helpers perform deterministic, files-in/files-out work;
 * - the backend owns shared state, credentials and official side effects.
 *
 * An action may prefer the backend while retaining a personal/offline fallback.
 * That is how the same plugin grows from one professor's YAML workspace into a
 * faculty service without maintaining two workflows.
 */
export type ExecutionTarget = "skill" | "local" | "backend";
export type BackendPolicy = "not-needed" | "preferred" | "required";
export type LocalPolicy = "supported" | "fallback" | "forbidden";
export type ApprovalPolicy = "none" | "human";
export interface ActionPolicy {
    name: string;
    kind: "judgement" | "deterministic" | "stateful" | "integration";
    backend: BackendPolicy;
    local: LocalPolicy;
    approval: ApprovalPolicy;
    credentials: boolean;
    reason: string;
}
export interface ExecutionContext {
    backendAvailable: boolean;
    actor: "agent" | "human";
}
export type ExecutionPlan = {
    available: true;
    target: ExecutionTarget;
    action: ActionPolicy;
} | {
    available: false;
    action: ActionPolicy;
    reason: string;
};
/**
 * The canonical execution boundary. Names are product actions rather than
 * transport names: CLI, MCP and a future REST surface must resolve identically.
 */
export declare const ACTIONS: readonly ActionPolicy[];
export declare const ACTION_BY_NAME: Map<string, ActionPolicy>;
export declare const resolveExecution: (name: string, context: ExecutionContext) => ExecutionPlan;
