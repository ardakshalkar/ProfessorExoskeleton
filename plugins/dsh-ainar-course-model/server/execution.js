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
const policy = (name, values) => ({ name, ...values });
const SKILL = {
    kind: "judgement",
    backend: "not-needed",
    local: "supported",
    approval: "none",
    credentials: false,
    reason: "Pedagogical judgement belongs in a reviewable skill workflow.",
};
const PORTABLE = {
    kind: "deterministic",
    backend: "preferred",
    local: "fallback",
    approval: "none",
    credentials: false,
    reason: "The same deterministic engine can run over backend state or local files.",
};
const LOCAL_FILE = {
    kind: "deterministic",
    backend: "not-needed",
    local: "supported",
    approval: "none",
    credentials: false,
    reason: "This is a deterministic transformation of explicit local files.",
};
const LOCAL_LOOKUP = {
    kind: "integration",
    backend: "not-needed",
    local: "supported",
    approval: "none",
    credentials: false,
    reason: "A public lookup may run locally because it holds no secret and produces only a draft file.",
};
const HUMAN_STATE = {
    kind: "stateful",
    backend: "preferred",
    local: "fallback",
    approval: "human",
    credentials: false,
    reason: "A person may commit the decision locally in personal mode or through the shared backend.",
};
const INTEGRATION = {
    kind: "integration",
    backend: "required",
    local: "forbidden",
    approval: "human",
    credentials: true,
    reason: "Credentials and external side effects belong behind the authenticated backend.",
};
const INTEGRATION_READ = {
    ...INTEGRATION,
    approval: "none",
    reason: "The authenticated backend may read the external system and return data or a proposal.",
};
/**
 * The canonical execution boundary. Names are product actions rather than
 * transport names: CLI, MCP and a future REST surface must resolve identically.
 */
export const ACTIONS = [
    ...[
        "syllabus-review",
        "course-reflection",
        "onboard-course",
        "find-ideas",
        "propose-concepts",
        "plan-term",
        "prepare-lesson",
        "make-materials",
        "design-assessment",
        "grade-submission",
        "grade-batch",
        "find-gaps",
        "action-inbox",
        "student-report",
        "visualize-course",
        "visualize-student",
        "publish-telegram",
    ].map((name) => policy(name, SKILL)),
    ...[
        "validate",
        "context",
        "course-outline",
        "assessment-rubric",
        "assessment-blueprint",
        "pending-judgements",
        "score-items",
        "gradebook",
        "calibration",
        "extract-evidence",
        "roll-up",
        "class-progress",
        "action-inbox-data",
        "syllabus",
        "alignment-report",
    ].map((name) => policy(name, PORTABLE)),
    ...[
        "render-deck",
        "render-exam",
        "export-bundle",
        "generate-schema",
        "generate-import-sql",
    ].map((name) => policy(name, LOCAL_FILE)),
    policy("find-image", LOCAL_LOOKUP),
    policy("approve", HUMAN_STATE),
    policy("roster-import", {
        ...HUMAN_STATE,
        reason: "Pseudonymisation is a human-started write; identities remain in the private store.",
    }),
    ...[
        "lms-plan",
        "lms-diff",
        "lms-import-submissions",
        "notion-pull",
        "notion-diff",
        "shared-analytics",
    ].map((name) => policy(name, INTEGRATION_READ)),
    ...[
        "lms-push-grades",
        "notion-push",
        "calendar-publish",
        "telegram-publish",
    ].map((name) => policy(name, INTEGRATION)),
];
export const ACTION_BY_NAME = new Map(ACTIONS.map((action) => [action.name, action]));
export const resolveExecution = (name, context) => {
    const action = ACTION_BY_NAME.get(name);
    if (!action)
        throw new Error(`unknown Professor Harness action '${name}'`);
    if (action.approval === "human" && context.actor !== "human") {
        return {
            available: false,
            action,
            reason: `${name} requires a human decision and is not agent-callable.`,
        };
    }
    if (action.kind === "judgement") {
        return { available: true, target: "skill", action };
    }
    if (action.backend === "required") {
        return context.backendAvailable
            ? { available: true, target: "backend", action }
            : {
                available: false,
                action,
                reason: `${name} requires the authenticated backend; no local fallback is permitted.`,
            };
    }
    if (context.backendAvailable && action.backend === "preferred") {
        return { available: true, target: "backend", action };
    }
    if (action.local !== "forbidden") {
        return { available: true, target: "local", action };
    }
    return {
        available: false,
        action,
        reason: `${name} is unavailable in this execution context.`,
    };
};
