/**
 * How learning is measured: assessments, rubrics, criteria, items, evaluations.
 * Ported from `ainar/model/assessment.py`.
 *
 * `Evaluation` is the one to read carefully: `ai_suggestion` and
 * `professor_decision` sit beside each other and neither replaces the other.
 */
import { z } from "zod";
export declare const AssessmentBlueprintCell: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    outcome_id: z.ZodString;
    cognitive_level: z.ZodEnum<["remember", "understand", "apply", "analyze", "evaluate", "create"]>;
    difficulty: z.ZodEnum<["easy", "medium", "complex"]>;
    item_type: z.ZodEnum<["multiple_choice", "multiple_select", "true_false", "short_answer", "numeric", "essay", "code", "practical", "other"]>;
    item_count: z.ZodNumber;
    marks: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    outcome_id: string;
    cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
    difficulty: "easy" | "medium" | "complex";
    item_type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
    item_count: number;
    marks: number;
}, {
    outcome_id: string;
    cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
    difficulty: "easy" | "medium" | "complex";
    item_type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
    item_count: number;
    marks: number;
    extensions?: Record<string, unknown> | undefined;
}>;
export declare const AssessmentDesign: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    purpose: z.ZodString;
    duration_minutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    target_item_count: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    cells: z.ZodDefault<z.ZodArray<z.ZodObject<{
        extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    } & {
        outcome_id: z.ZodString;
        cognitive_level: z.ZodEnum<["remember", "understand", "apply", "analyze", "evaluate", "create"]>;
        difficulty: z.ZodEnum<["easy", "medium", "complex"]>;
        item_type: z.ZodEnum<["multiple_choice", "multiple_select", "true_false", "short_answer", "numeric", "essay", "code", "practical", "other"]>;
        item_count: z.ZodNumber;
        marks: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        extensions: Record<string, unknown>;
        outcome_id: string;
        cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
        difficulty: "easy" | "medium" | "complex";
        item_type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
        item_count: number;
        marks: number;
    }, {
        outcome_id: string;
        cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
        difficulty: "easy" | "medium" | "complex";
        item_type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
        item_count: number;
        marks: number;
        extensions?: Record<string, unknown> | undefined;
    }>, "many">>;
    constraints: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    purpose: string;
    cells: {
        extensions: Record<string, unknown>;
        outcome_id: string;
        cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
        difficulty: "easy" | "medium" | "complex";
        item_type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
        item_count: number;
        marks: number;
    }[];
    constraints: Record<string, unknown>;
    duration_minutes?: number | null | undefined;
    target_item_count?: number | null | undefined;
}, {
    purpose: string;
    extensions?: Record<string, unknown> | undefined;
    duration_minutes?: number | null | undefined;
    target_item_count?: number | null | undefined;
    cells?: {
        outcome_id: string;
        cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
        difficulty: "easy" | "medium" | "complex";
        item_type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
        item_count: number;
        marks: number;
        extensions?: Record<string, unknown> | undefined;
    }[] | undefined;
    constraints?: Record<string, unknown> | undefined;
}>;
export declare const ItemModel: z.ZodEffects<z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    item_model_id: z.ZodString;
    course_version_id: z.ZodString;
    title: z.ZodString;
    outcome_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    capability_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    concepts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    cognitive_level: z.ZodEnum<["remember", "understand", "apply", "analyze", "evaluate", "create"]>;
    evidence_requirements: z.ZodArray<z.ZodString, "many">;
    task_structure: z.ZodArray<z.ZodString, "many">;
    scenario_variables: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber]>, "many">>>;
    difficulty_features: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber]>>>>;
    misconceptions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    answer_requirements: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    allowed_item_types: z.ZodDefault<z.ZodArray<z.ZodEnum<["multiple_choice", "multiple_select", "true_false", "short_answer", "numeric", "essay", "code", "practical", "other"]>, "many">>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    title: string;
    concepts: string[];
    cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
    item_model_id: string;
    course_version_id: string;
    evidence_requirements: string[];
    task_structure: string[];
    scenario_variables: Record<string, (string | number)[]>;
    difficulty_features: Record<string, Record<string, string | number>>;
    misconceptions: string[];
    answer_requirements: string[];
    allowed_item_types: ("other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical")[];
    outcome_id?: string | null | undefined;
    capability_id?: string | null | undefined;
}, {
    title: string;
    cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
    item_model_id: string;
    course_version_id: string;
    evidence_requirements: string[];
    task_structure: string[];
    extensions?: Record<string, unknown> | undefined;
    outcome_id?: string | null | undefined;
    concepts?: string[] | undefined;
    capability_id?: string | null | undefined;
    scenario_variables?: Record<string, (string | number)[]> | undefined;
    difficulty_features?: Record<string, Record<string, string | number>> | undefined;
    misconceptions?: string[] | undefined;
    answer_requirements?: string[] | undefined;
    allowed_item_types?: ("other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical")[] | undefined;
}>, {
    extensions: Record<string, unknown>;
    title: string;
    concepts: string[];
    cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
    item_model_id: string;
    course_version_id: string;
    evidence_requirements: string[];
    task_structure: string[];
    scenario_variables: Record<string, (string | number)[]>;
    difficulty_features: Record<string, Record<string, string | number>>;
    misconceptions: string[];
    answer_requirements: string[];
    allowed_item_types: ("other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical")[];
    outcome_id?: string | null | undefined;
    capability_id?: string | null | undefined;
}, {
    title: string;
    cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
    item_model_id: string;
    course_version_id: string;
    evidence_requirements: string[];
    task_structure: string[];
    extensions?: Record<string, unknown> | undefined;
    outcome_id?: string | null | undefined;
    concepts?: string[] | undefined;
    capability_id?: string | null | undefined;
    scenario_variables?: Record<string, (string | number)[]> | undefined;
    difficulty_features?: Record<string, Record<string, string | number>> | undefined;
    misconceptions?: string[] | undefined;
    answer_requirements?: string[] | undefined;
    allowed_item_types?: ("other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical")[] | undefined;
}>;
export declare const CriterionLevel: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    score: z.ZodNumber;
    label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodString;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    description: string;
    score: number;
    label?: string | null | undefined;
}, {
    description: string;
    score: number;
    extensions?: Record<string, unknown> | undefined;
    label?: string | null | undefined;
}>;
export declare const RubricCriterion: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    criterion_id: z.ZodString;
    rubric_id: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    maximum_score: z.ZodNumber;
    weight: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    outcome_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    capability_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    concepts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    levels: z.ZodDefault<z.ZodArray<z.ZodObject<{
        extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    } & {
        score: z.ZodNumber;
        label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        description: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        extensions: Record<string, unknown>;
        description: string;
        score: number;
        label?: string | null | undefined;
    }, {
        description: string;
        score: number;
        extensions?: Record<string, unknown> | undefined;
        label?: string | null | undefined;
    }>, "many">>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    title: string;
    concepts: string[];
    levels: {
        extensions: Record<string, unknown>;
        description: string;
        score: number;
        label?: string | null | undefined;
    }[];
    criterion_id: string;
    rubric_id: string;
    maximum_score: number;
    description?: string | null | undefined;
    outcome_id?: string | null | undefined;
    weight?: number | null | undefined;
    capability_id?: string | null | undefined;
}, {
    title: string;
    criterion_id: string;
    rubric_id: string;
    maximum_score: number;
    extensions?: Record<string, unknown> | undefined;
    description?: string | null | undefined;
    outcome_id?: string | null | undefined;
    weight?: number | null | undefined;
    concepts?: string[] | undefined;
    capability_id?: string | null | undefined;
    levels?: {
        description: string;
        score: number;
        extensions?: Record<string, unknown> | undefined;
        label?: string | null | undefined;
    }[] | undefined;
}>;
export declare const Rubric: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    rubric_id: z.ZodString;
    title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    criteria: z.ZodDefault<z.ZodArray<z.ZodObject<{
        extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    } & {
        criterion_id: z.ZodString;
        rubric_id: z.ZodString;
        title: z.ZodString;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        maximum_score: z.ZodNumber;
        weight: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        outcome_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        capability_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        concepts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        levels: z.ZodDefault<z.ZodArray<z.ZodObject<{
            extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        } & {
            score: z.ZodNumber;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            description: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            extensions: Record<string, unknown>;
            description: string;
            score: number;
            label?: string | null | undefined;
        }, {
            description: string;
            score: number;
            extensions?: Record<string, unknown> | undefined;
            label?: string | null | undefined;
        }>, "many">>;
    }, "strict", z.ZodTypeAny, {
        extensions: Record<string, unknown>;
        title: string;
        concepts: string[];
        levels: {
            extensions: Record<string, unknown>;
            description: string;
            score: number;
            label?: string | null | undefined;
        }[];
        criterion_id: string;
        rubric_id: string;
        maximum_score: number;
        description?: string | null | undefined;
        outcome_id?: string | null | undefined;
        weight?: number | null | undefined;
        capability_id?: string | null | undefined;
    }, {
        title: string;
        criterion_id: string;
        rubric_id: string;
        maximum_score: number;
        extensions?: Record<string, unknown> | undefined;
        description?: string | null | undefined;
        outcome_id?: string | null | undefined;
        weight?: number | null | undefined;
        concepts?: string[] | undefined;
        capability_id?: string | null | undefined;
        levels?: {
            description: string;
            score: number;
            extensions?: Record<string, unknown> | undefined;
            label?: string | null | undefined;
        }[] | undefined;
    }>, "many">>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    rubric_id: string;
    criteria: {
        extensions: Record<string, unknown>;
        title: string;
        concepts: string[];
        levels: {
            extensions: Record<string, unknown>;
            description: string;
            score: number;
            label?: string | null | undefined;
        }[];
        criterion_id: string;
        rubric_id: string;
        maximum_score: number;
        description?: string | null | undefined;
        outcome_id?: string | null | undefined;
        weight?: number | null | undefined;
        capability_id?: string | null | undefined;
    }[];
    title?: string | null | undefined;
    description?: string | null | undefined;
}, {
    rubric_id: string;
    extensions?: Record<string, unknown> | undefined;
    title?: string | null | undefined;
    description?: string | null | undefined;
    criteria?: {
        title: string;
        criterion_id: string;
        rubric_id: string;
        maximum_score: number;
        extensions?: Record<string, unknown> | undefined;
        description?: string | null | undefined;
        outcome_id?: string | null | undefined;
        weight?: number | null | undefined;
        concepts?: string[] | undefined;
        capability_id?: string | null | undefined;
        levels?: {
            description: string;
            score: number;
            extensions?: Record<string, unknown> | undefined;
            label?: string | null | undefined;
        }[] | undefined;
    }[] | undefined;
}>;
export declare const Assessment: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    assessment_id: z.ZodString;
    course_version_id: z.ZodString;
    title: z.ZodString;
    type: z.ZodEnum<["assignment", "quiz", "exam", "project", "presentation", "oral_defense", "participation", "other"]>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    module_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    maximum_score: z.ZodDefault<z.ZodNumber>;
    weight: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    opens_at: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>>>;
    due_at: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>>>;
    outcomes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    rubric_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    rubric: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    } & {
        rubric_id: z.ZodString;
        title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        criteria: z.ZodDefault<z.ZodArray<z.ZodObject<{
            extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        } & {
            criterion_id: z.ZodString;
            rubric_id: z.ZodString;
            title: z.ZodString;
            description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            maximum_score: z.ZodNumber;
            weight: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            outcome_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            capability_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            concepts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            levels: z.ZodDefault<z.ZodArray<z.ZodObject<{
                extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            } & {
                score: z.ZodNumber;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                description: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                extensions: Record<string, unknown>;
                description: string;
                score: number;
                label?: string | null | undefined;
            }, {
                description: string;
                score: number;
                extensions?: Record<string, unknown> | undefined;
                label?: string | null | undefined;
            }>, "many">>;
        }, "strict", z.ZodTypeAny, {
            extensions: Record<string, unknown>;
            title: string;
            concepts: string[];
            levels: {
                extensions: Record<string, unknown>;
                description: string;
                score: number;
                label?: string | null | undefined;
            }[];
            criterion_id: string;
            rubric_id: string;
            maximum_score: number;
            description?: string | null | undefined;
            outcome_id?: string | null | undefined;
            weight?: number | null | undefined;
            capability_id?: string | null | undefined;
        }, {
            title: string;
            criterion_id: string;
            rubric_id: string;
            maximum_score: number;
            extensions?: Record<string, unknown> | undefined;
            description?: string | null | undefined;
            outcome_id?: string | null | undefined;
            weight?: number | null | undefined;
            concepts?: string[] | undefined;
            capability_id?: string | null | undefined;
            levels?: {
                description: string;
                score: number;
                extensions?: Record<string, unknown> | undefined;
                label?: string | null | undefined;
            }[] | undefined;
        }>, "many">>;
    }, "strict", z.ZodTypeAny, {
        extensions: Record<string, unknown>;
        rubric_id: string;
        criteria: {
            extensions: Record<string, unknown>;
            title: string;
            concepts: string[];
            levels: {
                extensions: Record<string, unknown>;
                description: string;
                score: number;
                label?: string | null | undefined;
            }[];
            criterion_id: string;
            rubric_id: string;
            maximum_score: number;
            description?: string | null | undefined;
            outcome_id?: string | null | undefined;
            weight?: number | null | undefined;
            capability_id?: string | null | undefined;
        }[];
        title?: string | null | undefined;
        description?: string | null | undefined;
    }, {
        rubric_id: string;
        extensions?: Record<string, unknown> | undefined;
        title?: string | null | undefined;
        description?: string | null | undefined;
        criteria?: {
            title: string;
            criterion_id: string;
            rubric_id: string;
            maximum_score: number;
            extensions?: Record<string, unknown> | undefined;
            description?: string | null | undefined;
            outcome_id?: string | null | undefined;
            weight?: number | null | undefined;
            concepts?: string[] | undefined;
            capability_id?: string | null | undefined;
            levels?: {
                description: string;
                score: number;
                extensions?: Record<string, unknown> | undefined;
                label?: string | null | undefined;
            }[] | undefined;
        }[] | undefined;
    }>>>;
    submission_type: z.ZodDefault<z.ZodArray<z.ZodEnum<["pdf", "docx", "pptx", "notebook", "code_repo", "audio", "video", "image", "url", "text", "oral_defense"]>, "many">>;
    delivery: z.ZodOptional<z.ZodNullable<z.ZodEnum<["canvas_upload", "github_repo", "paper_exam", "oral_defense", "presentation", "instructor_collected", "other"]>>>;
    instructions_document_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    settings: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    design: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    } & {
        purpose: z.ZodString;
        duration_minutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        target_item_count: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        cells: z.ZodDefault<z.ZodArray<z.ZodObject<{
            extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        } & {
            outcome_id: z.ZodString;
            cognitive_level: z.ZodEnum<["remember", "understand", "apply", "analyze", "evaluate", "create"]>;
            difficulty: z.ZodEnum<["easy", "medium", "complex"]>;
            item_type: z.ZodEnum<["multiple_choice", "multiple_select", "true_false", "short_answer", "numeric", "essay", "code", "practical", "other"]>;
            item_count: z.ZodNumber;
            marks: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            extensions: Record<string, unknown>;
            outcome_id: string;
            cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
            difficulty: "easy" | "medium" | "complex";
            item_type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
            item_count: number;
            marks: number;
        }, {
            outcome_id: string;
            cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
            difficulty: "easy" | "medium" | "complex";
            item_type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
            item_count: number;
            marks: number;
            extensions?: Record<string, unknown> | undefined;
        }>, "many">>;
        constraints: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strict", z.ZodTypeAny, {
        extensions: Record<string, unknown>;
        purpose: string;
        cells: {
            extensions: Record<string, unknown>;
            outcome_id: string;
            cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
            difficulty: "easy" | "medium" | "complex";
            item_type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
            item_count: number;
            marks: number;
        }[];
        constraints: Record<string, unknown>;
        duration_minutes?: number | null | undefined;
        target_item_count?: number | null | undefined;
    }, {
        purpose: string;
        extensions?: Record<string, unknown> | undefined;
        duration_minutes?: number | null | undefined;
        target_item_count?: number | null | undefined;
        cells?: {
            outcome_id: string;
            cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
            difficulty: "easy" | "medium" | "complex";
            item_type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
            item_count: number;
            marks: number;
            extensions?: Record<string, unknown> | undefined;
        }[] | undefined;
        constraints?: Record<string, unknown> | undefined;
    }>>>;
}, "strict", z.ZodTypeAny, {
    type: "other" | "assignment" | "quiz" | "exam" | "project" | "presentation" | "oral_defense" | "participation";
    extensions: Record<string, unknown>;
    title: string;
    outcomes: string[];
    course_version_id: string;
    maximum_score: number;
    assessment_id: string;
    submission_type: ("oral_defense" | "pdf" | "docx" | "pptx" | "notebook" | "code_repo" | "audio" | "video" | "image" | "url" | "text")[];
    settings: Record<string, unknown>;
    description?: string | null | undefined;
    weight?: number | null | undefined;
    module_id?: string | null | undefined;
    rubric_id?: string | null | undefined;
    opens_at?: string | null | undefined;
    due_at?: string | null | undefined;
    rubric?: {
        extensions: Record<string, unknown>;
        rubric_id: string;
        criteria: {
            extensions: Record<string, unknown>;
            title: string;
            concepts: string[];
            levels: {
                extensions: Record<string, unknown>;
                description: string;
                score: number;
                label?: string | null | undefined;
            }[];
            criterion_id: string;
            rubric_id: string;
            maximum_score: number;
            description?: string | null | undefined;
            outcome_id?: string | null | undefined;
            weight?: number | null | undefined;
            capability_id?: string | null | undefined;
        }[];
        title?: string | null | undefined;
        description?: string | null | undefined;
    } | null | undefined;
    delivery?: "other" | "presentation" | "oral_defense" | "canvas_upload" | "github_repo" | "paper_exam" | "instructor_collected" | null | undefined;
    instructions_document_id?: string | null | undefined;
    design?: {
        extensions: Record<string, unknown>;
        purpose: string;
        cells: {
            extensions: Record<string, unknown>;
            outcome_id: string;
            cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
            difficulty: "easy" | "medium" | "complex";
            item_type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
            item_count: number;
            marks: number;
        }[];
        constraints: Record<string, unknown>;
        duration_minutes?: number | null | undefined;
        target_item_count?: number | null | undefined;
    } | null | undefined;
}, {
    type: "other" | "assignment" | "quiz" | "exam" | "project" | "presentation" | "oral_defense" | "participation";
    title: string;
    course_version_id: string;
    assessment_id: string;
    extensions?: Record<string, unknown> | undefined;
    description?: string | null | undefined;
    weight?: number | null | undefined;
    module_id?: string | null | undefined;
    outcomes?: string[] | undefined;
    rubric_id?: string | null | undefined;
    maximum_score?: number | undefined;
    opens_at?: string | Date | null | undefined;
    due_at?: string | Date | null | undefined;
    rubric?: {
        rubric_id: string;
        extensions?: Record<string, unknown> | undefined;
        title?: string | null | undefined;
        description?: string | null | undefined;
        criteria?: {
            title: string;
            criterion_id: string;
            rubric_id: string;
            maximum_score: number;
            extensions?: Record<string, unknown> | undefined;
            description?: string | null | undefined;
            outcome_id?: string | null | undefined;
            weight?: number | null | undefined;
            concepts?: string[] | undefined;
            capability_id?: string | null | undefined;
            levels?: {
                description: string;
                score: number;
                extensions?: Record<string, unknown> | undefined;
                label?: string | null | undefined;
            }[] | undefined;
        }[] | undefined;
    } | null | undefined;
    submission_type?: ("oral_defense" | "pdf" | "docx" | "pptx" | "notebook" | "code_repo" | "audio" | "video" | "image" | "url" | "text")[] | undefined;
    delivery?: "other" | "presentation" | "oral_defense" | "canvas_upload" | "github_repo" | "paper_exam" | "instructor_collected" | null | undefined;
    instructions_document_id?: string | null | undefined;
    settings?: Record<string, unknown> | undefined;
    design?: {
        purpose: string;
        extensions?: Record<string, unknown> | undefined;
        duration_minutes?: number | null | undefined;
        target_item_count?: number | null | undefined;
        cells?: {
            outcome_id: string;
            cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
            difficulty: "easy" | "medium" | "complex";
            item_type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
            item_count: number;
            marks: number;
            extensions?: Record<string, unknown> | undefined;
        }[] | undefined;
        constraints?: Record<string, unknown> | undefined;
    } | null | undefined;
}>, {
    type: "other" | "assignment" | "quiz" | "exam" | "project" | "presentation" | "oral_defense" | "participation";
    extensions: Record<string, unknown>;
    title: string;
    outcomes: string[];
    course_version_id: string;
    maximum_score: number;
    assessment_id: string;
    submission_type: ("oral_defense" | "pdf" | "docx" | "pptx" | "notebook" | "code_repo" | "audio" | "video" | "image" | "url" | "text")[];
    settings: Record<string, unknown>;
    description?: string | null | undefined;
    weight?: number | null | undefined;
    module_id?: string | null | undefined;
    rubric_id?: string | null | undefined;
    opens_at?: string | null | undefined;
    due_at?: string | null | undefined;
    rubric?: {
        extensions: Record<string, unknown>;
        rubric_id: string;
        criteria: {
            extensions: Record<string, unknown>;
            title: string;
            concepts: string[];
            levels: {
                extensions: Record<string, unknown>;
                description: string;
                score: number;
                label?: string | null | undefined;
            }[];
            criterion_id: string;
            rubric_id: string;
            maximum_score: number;
            description?: string | null | undefined;
            outcome_id?: string | null | undefined;
            weight?: number | null | undefined;
            capability_id?: string | null | undefined;
        }[];
        title?: string | null | undefined;
        description?: string | null | undefined;
    } | null | undefined;
    delivery?: "other" | "presentation" | "oral_defense" | "canvas_upload" | "github_repo" | "paper_exam" | "instructor_collected" | null | undefined;
    instructions_document_id?: string | null | undefined;
    design?: {
        extensions: Record<string, unknown>;
        purpose: string;
        cells: {
            extensions: Record<string, unknown>;
            outcome_id: string;
            cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
            difficulty: "easy" | "medium" | "complex";
            item_type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
            item_count: number;
            marks: number;
        }[];
        constraints: Record<string, unknown>;
        duration_minutes?: number | null | undefined;
        target_item_count?: number | null | undefined;
    } | null | undefined;
}, {
    type: "other" | "assignment" | "quiz" | "exam" | "project" | "presentation" | "oral_defense" | "participation";
    title: string;
    course_version_id: string;
    assessment_id: string;
    extensions?: Record<string, unknown> | undefined;
    description?: string | null | undefined;
    weight?: number | null | undefined;
    module_id?: string | null | undefined;
    outcomes?: string[] | undefined;
    rubric_id?: string | null | undefined;
    maximum_score?: number | undefined;
    opens_at?: string | Date | null | undefined;
    due_at?: string | Date | null | undefined;
    rubric?: {
        rubric_id: string;
        extensions?: Record<string, unknown> | undefined;
        title?: string | null | undefined;
        description?: string | null | undefined;
        criteria?: {
            title: string;
            criterion_id: string;
            rubric_id: string;
            maximum_score: number;
            extensions?: Record<string, unknown> | undefined;
            description?: string | null | undefined;
            outcome_id?: string | null | undefined;
            weight?: number | null | undefined;
            concepts?: string[] | undefined;
            capability_id?: string | null | undefined;
            levels?: {
                description: string;
                score: number;
                extensions?: Record<string, unknown> | undefined;
                label?: string | null | undefined;
            }[] | undefined;
        }[] | undefined;
    } | null | undefined;
    submission_type?: ("oral_defense" | "pdf" | "docx" | "pptx" | "notebook" | "code_repo" | "audio" | "video" | "image" | "url" | "text")[] | undefined;
    delivery?: "other" | "presentation" | "oral_defense" | "canvas_upload" | "github_repo" | "paper_exam" | "instructor_collected" | null | undefined;
    instructions_document_id?: string | null | undefined;
    settings?: Record<string, unknown> | undefined;
    design?: {
        purpose: string;
        extensions?: Record<string, unknown> | undefined;
        duration_minutes?: number | null | undefined;
        target_item_count?: number | null | undefined;
        cells?: {
            outcome_id: string;
            cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
            difficulty: "easy" | "medium" | "complex";
            item_type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
            item_count: number;
            marks: number;
            extensions?: Record<string, unknown> | undefined;
        }[] | undefined;
        constraints?: Record<string, unknown> | undefined;
    } | null | undefined;
}>, {
    type: "other" | "assignment" | "quiz" | "exam" | "project" | "presentation" | "oral_defense" | "participation";
    extensions: Record<string, unknown>;
    title: string;
    outcomes: string[];
    course_version_id: string;
    maximum_score: number;
    assessment_id: string;
    submission_type: ("oral_defense" | "pdf" | "docx" | "pptx" | "notebook" | "code_repo" | "audio" | "video" | "image" | "url" | "text")[];
    settings: Record<string, unknown>;
    description?: string | null | undefined;
    weight?: number | null | undefined;
    module_id?: string | null | undefined;
    rubric_id?: string | null | undefined;
    opens_at?: string | null | undefined;
    due_at?: string | null | undefined;
    rubric?: {
        extensions: Record<string, unknown>;
        rubric_id: string;
        criteria: {
            extensions: Record<string, unknown>;
            title: string;
            concepts: string[];
            levels: {
                extensions: Record<string, unknown>;
                description: string;
                score: number;
                label?: string | null | undefined;
            }[];
            criterion_id: string;
            rubric_id: string;
            maximum_score: number;
            description?: string | null | undefined;
            outcome_id?: string | null | undefined;
            weight?: number | null | undefined;
            capability_id?: string | null | undefined;
        }[];
        title?: string | null | undefined;
        description?: string | null | undefined;
    } | null | undefined;
    delivery?: "other" | "presentation" | "oral_defense" | "canvas_upload" | "github_repo" | "paper_exam" | "instructor_collected" | null | undefined;
    instructions_document_id?: string | null | undefined;
    design?: {
        extensions: Record<string, unknown>;
        purpose: string;
        cells: {
            extensions: Record<string, unknown>;
            outcome_id: string;
            cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
            difficulty: "easy" | "medium" | "complex";
            item_type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
            item_count: number;
            marks: number;
        }[];
        constraints: Record<string, unknown>;
        duration_minutes?: number | null | undefined;
        target_item_count?: number | null | undefined;
    } | null | undefined;
}, {
    type: "other" | "assignment" | "quiz" | "exam" | "project" | "presentation" | "oral_defense" | "participation";
    title: string;
    course_version_id: string;
    assessment_id: string;
    extensions?: Record<string, unknown> | undefined;
    description?: string | null | undefined;
    weight?: number | null | undefined;
    module_id?: string | null | undefined;
    outcomes?: string[] | undefined;
    rubric_id?: string | null | undefined;
    maximum_score?: number | undefined;
    opens_at?: string | Date | null | undefined;
    due_at?: string | Date | null | undefined;
    rubric?: {
        rubric_id: string;
        extensions?: Record<string, unknown> | undefined;
        title?: string | null | undefined;
        description?: string | null | undefined;
        criteria?: {
            title: string;
            criterion_id: string;
            rubric_id: string;
            maximum_score: number;
            extensions?: Record<string, unknown> | undefined;
            description?: string | null | undefined;
            outcome_id?: string | null | undefined;
            weight?: number | null | undefined;
            concepts?: string[] | undefined;
            capability_id?: string | null | undefined;
            levels?: {
                description: string;
                score: number;
                extensions?: Record<string, unknown> | undefined;
                label?: string | null | undefined;
            }[] | undefined;
        }[] | undefined;
    } | null | undefined;
    submission_type?: ("oral_defense" | "pdf" | "docx" | "pptx" | "notebook" | "code_repo" | "audio" | "video" | "image" | "url" | "text")[] | undefined;
    delivery?: "other" | "presentation" | "oral_defense" | "canvas_upload" | "github_repo" | "paper_exam" | "instructor_collected" | null | undefined;
    instructions_document_id?: string | null | undefined;
    settings?: Record<string, unknown> | undefined;
    design?: {
        purpose: string;
        extensions?: Record<string, unknown> | undefined;
        duration_minutes?: number | null | undefined;
        target_item_count?: number | null | undefined;
        cells?: {
            outcome_id: string;
            cognitive_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
            difficulty: "easy" | "medium" | "complex";
            item_type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
            item_count: number;
            marks: number;
            extensions?: Record<string, unknown> | undefined;
        }[] | undefined;
        constraints?: Record<string, unknown> | undefined;
    } | null | undefined;
}>;
export declare const ItemOption: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    label: z.ZodString;
    text: z.ZodString;
    correct: z.ZodDefault<z.ZodBoolean>;
    indicates_misconception_of: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    text: string;
    extensions: Record<string, unknown>;
    label: string;
    correct: boolean;
    note?: string | null | undefined;
    indicates_misconception_of?: string | null | undefined;
}, {
    text: string;
    label: string;
    extensions?: Record<string, unknown> | undefined;
    note?: string | null | undefined;
    correct?: boolean | undefined;
    indicates_misconception_of?: string | null | undefined;
}>;
export declare const AssessmentItem: z.ZodEffects<z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    item_id: z.ZodString;
    assessment_id: z.ZodString;
    item_model_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type: z.ZodEnum<["multiple_choice", "multiple_select", "true_false", "short_answer", "numeric", "essay", "code", "practical", "other"]>;
    prompt: z.ZodString;
    number: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    maximum_score: z.ZodDefault<z.ZodNumber>;
    role: z.ZodDefault<z.ZodEnum<["preparation", "main", "followup"]>>;
    difficulty: z.ZodOptional<z.ZodNullable<z.ZodEnum<["easy", "medium", "complex"]>>>;
    outcome_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    criterion_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    concepts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    options: z.ZodDefault<z.ZodArray<z.ZodObject<{
        extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    } & {
        label: z.ZodString;
        text: z.ZodString;
        correct: z.ZodDefault<z.ZodBoolean>;
        indicates_misconception_of: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strict", z.ZodTypeAny, {
        text: string;
        extensions: Record<string, unknown>;
        label: string;
        correct: boolean;
        note?: string | null | undefined;
        indicates_misconception_of?: string | null | undefined;
    }, {
        text: string;
        label: string;
        extensions?: Record<string, unknown> | undefined;
        note?: string | null | undefined;
        correct?: boolean | undefined;
        indicates_misconception_of?: string | null | undefined;
    }>, "many">>;
    answer_key: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    marking_guidance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    options: {
        text: string;
        extensions: Record<string, unknown>;
        label: string;
        correct: boolean;
        note?: string | null | undefined;
        indicates_misconception_of?: string | null | undefined;
    }[];
    type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
    extensions: Record<string, unknown>;
    concepts: string[];
    maximum_score: number;
    assessment_id: string;
    item_id: string;
    prompt: string;
    role: "preparation" | "main" | "followup";
    number?: number | null | undefined;
    outcome_id?: string | null | undefined;
    difficulty?: "easy" | "medium" | "complex" | null | undefined;
    item_model_id?: string | null | undefined;
    criterion_id?: string | null | undefined;
    answer_key?: string | null | undefined;
    marking_guidance?: string | null | undefined;
}, {
    type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
    assessment_id: string;
    item_id: string;
    prompt: string;
    number?: number | null | undefined;
    options?: {
        text: string;
        label: string;
        extensions?: Record<string, unknown> | undefined;
        note?: string | null | undefined;
        correct?: boolean | undefined;
        indicates_misconception_of?: string | null | undefined;
    }[] | undefined;
    extensions?: Record<string, unknown> | undefined;
    outcome_id?: string | null | undefined;
    concepts?: string[] | undefined;
    difficulty?: "easy" | "medium" | "complex" | null | undefined;
    item_model_id?: string | null | undefined;
    criterion_id?: string | null | undefined;
    maximum_score?: number | undefined;
    role?: "preparation" | "main" | "followup" | undefined;
    answer_key?: string | null | undefined;
    marking_guidance?: string | null | undefined;
}>, {
    options: {
        text: string;
        extensions: Record<string, unknown>;
        label: string;
        correct: boolean;
        note?: string | null | undefined;
        indicates_misconception_of?: string | null | undefined;
    }[];
    type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
    extensions: Record<string, unknown>;
    concepts: string[];
    maximum_score: number;
    assessment_id: string;
    item_id: string;
    prompt: string;
    role: "preparation" | "main" | "followup";
    number?: number | null | undefined;
    outcome_id?: string | null | undefined;
    difficulty?: "easy" | "medium" | "complex" | null | undefined;
    item_model_id?: string | null | undefined;
    criterion_id?: string | null | undefined;
    answer_key?: string | null | undefined;
    marking_guidance?: string | null | undefined;
}, {
    type: "other" | "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "numeric" | "essay" | "code" | "practical";
    assessment_id: string;
    item_id: string;
    prompt: string;
    number?: number | null | undefined;
    options?: {
        text: string;
        label: string;
        extensions?: Record<string, unknown> | undefined;
        note?: string | null | undefined;
        correct?: boolean | undefined;
        indicates_misconception_of?: string | null | undefined;
    }[] | undefined;
    extensions?: Record<string, unknown> | undefined;
    outcome_id?: string | null | undefined;
    concepts?: string[] | undefined;
    difficulty?: "easy" | "medium" | "complex" | null | undefined;
    item_model_id?: string | null | undefined;
    criterion_id?: string | null | undefined;
    maximum_score?: number | undefined;
    role?: "preparation" | "main" | "followup" | undefined;
    answer_key?: string | null | undefined;
    marking_guidance?: string | null | undefined;
}>;
export declare const ItemResponse: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    response_id: z.ZodString;
    submission_id: z.ZodString;
    item_id: z.ZodString;
    student_id: z.ZodString;
    chosen_options: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    raw_response: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    correct: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    scored_by: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    responded_at: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>>>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    item_id: string;
    response_id: string;
    submission_id: string;
    student_id: string;
    chosen_options: string[];
    score?: number | null | undefined;
    correct?: boolean | null | undefined;
    raw_response?: string | null | undefined;
    scored_by?: string | null | undefined;
    responded_at?: string | null | undefined;
}, {
    item_id: string;
    response_id: string;
    submission_id: string;
    student_id: string;
    extensions?: Record<string, unknown> | undefined;
    score?: number | null | undefined;
    correct?: boolean | null | undefined;
    chosen_options?: string[] | undefined;
    raw_response?: string | null | undefined;
    scored_by?: string | null | undefined;
    responded_at?: string | Date | null | undefined;
}>;
export declare const SubmissionFile: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    document_id: z.ZodString;
    type: z.ZodEnum<["pdf", "docx", "pptx", "notebook", "code_repo", "audio", "video", "image", "url", "text", "oral_defense"]>;
}, "strict", z.ZodTypeAny, {
    type: "oral_defense" | "pdf" | "docx" | "pptx" | "notebook" | "code_repo" | "audio" | "video" | "image" | "url" | "text";
    extensions: Record<string, unknown>;
    document_id: string;
}, {
    type: "oral_defense" | "pdf" | "docx" | "pptx" | "notebook" | "code_repo" | "audio" | "video" | "image" | "url" | "text";
    document_id: string;
    extensions?: Record<string, unknown> | undefined;
}>;
export declare const Submission: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    submission_id: z.ZodString;
    assessment_id: z.ZodString;
    student_id: z.ZodString;
    submitted_at: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>>>;
    files: z.ZodDefault<z.ZodArray<z.ZodObject<{
        extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    } & {
        document_id: z.ZodString;
        type: z.ZodEnum<["pdf", "docx", "pptx", "notebook", "code_repo", "audio", "video", "image", "url", "text", "oral_defense"]>;
    }, "strict", z.ZodTypeAny, {
        type: "oral_defense" | "pdf" | "docx" | "pptx" | "notebook" | "code_repo" | "audio" | "video" | "image" | "url" | "text";
        extensions: Record<string, unknown>;
        document_id: string;
    }, {
        type: "oral_defense" | "pdf" | "docx" | "pptx" | "notebook" | "code_repo" | "audio" | "video" | "image" | "url" | "text";
        document_id: string;
        extensions?: Record<string, unknown> | undefined;
    }>, "many">>;
    status: z.ZodDefault<z.ZodEnum<["missing", "draft", "submitted", "late", "resubmitted", "withdrawn"]>>;
    attempt: z.ZodDefault<z.ZodNumber>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    status: "draft" | "missing" | "submitted" | "late" | "resubmitted" | "withdrawn";
    extensions: Record<string, unknown>;
    assessment_id: string;
    submission_id: string;
    student_id: string;
    files: {
        type: "oral_defense" | "pdf" | "docx" | "pptx" | "notebook" | "code_repo" | "audio" | "video" | "image" | "url" | "text";
        extensions: Record<string, unknown>;
        document_id: string;
    }[];
    attempt: number;
    note?: string | null | undefined;
    submitted_at?: string | null | undefined;
}, {
    assessment_id: string;
    submission_id: string;
    student_id: string;
    status?: "draft" | "missing" | "submitted" | "late" | "resubmitted" | "withdrawn" | undefined;
    extensions?: Record<string, unknown> | undefined;
    note?: string | null | undefined;
    submitted_at?: string | Date | null | undefined;
    files?: {
        type: "oral_defense" | "pdf" | "docx" | "pptx" | "notebook" | "code_repo" | "audio" | "video" | "image" | "url" | "text";
        document_id: string;
        extensions?: Record<string, unknown> | undefined;
    }[] | undefined;
    attempt?: number | undefined;
}>;
export declare const AiSuggestion: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    score: z.ZodNumber;
    confidence: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    comment: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    evidence: z.ZodDefault<z.ZodArray<z.ZodObject<{
        extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    } & {
        document_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        location: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        text_reference: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        source_ref: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strict", z.ZodTypeAny, {
        extensions: Record<string, unknown>;
        document_id?: string | null | undefined;
        location?: string | null | undefined;
        text_reference?: string | null | undefined;
        source_ref?: string | null | undefined;
    }, {
        extensions?: Record<string, unknown> | undefined;
        document_id?: string | null | undefined;
        location?: string | null | undefined;
        text_reference?: string | null | undefined;
        source_ref?: string | null | undefined;
    }>, "many">>;
    provenance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    } & {
        produced_by: z.ZodString;
        model_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        workflow_version: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        prompt_version: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        input_refs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        created_at: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>>>;
    }, "strict", z.ZodTypeAny, {
        produced_by: string;
        input_refs: string[];
        extensions: Record<string, unknown>;
        model_id?: string | null | undefined;
        workflow_version?: string | null | undefined;
        prompt_version?: string | null | undefined;
        created_at?: string | null | undefined;
    }, {
        produced_by: string;
        model_id?: string | null | undefined;
        workflow_version?: string | null | undefined;
        prompt_version?: string | null | undefined;
        input_refs?: string[] | undefined;
        created_at?: string | Date | null | undefined;
        extensions?: Record<string, unknown> | undefined;
    }>>>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    score: number;
    evidence: {
        extensions: Record<string, unknown>;
        document_id?: string | null | undefined;
        location?: string | null | undefined;
        text_reference?: string | null | undefined;
        source_ref?: string | null | undefined;
    }[];
    confidence?: number | null | undefined;
    comment?: string | null | undefined;
    provenance?: {
        produced_by: string;
        input_refs: string[];
        extensions: Record<string, unknown>;
        model_id?: string | null | undefined;
        workflow_version?: string | null | undefined;
        prompt_version?: string | null | undefined;
        created_at?: string | null | undefined;
    } | null | undefined;
}, {
    score: number;
    extensions?: Record<string, unknown> | undefined;
    confidence?: number | null | undefined;
    comment?: string | null | undefined;
    evidence?: {
        extensions?: Record<string, unknown> | undefined;
        document_id?: string | null | undefined;
        location?: string | null | undefined;
        text_reference?: string | null | undefined;
        source_ref?: string | null | undefined;
    }[] | undefined;
    provenance?: {
        produced_by: string;
        model_id?: string | null | undefined;
        workflow_version?: string | null | undefined;
        prompt_version?: string | null | undefined;
        input_refs?: string[] | undefined;
        created_at?: string | Date | null | undefined;
        extensions?: Record<string, unknown> | undefined;
    } | null | undefined;
}>;
export declare const ProfessorDecision: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    score: z.ZodNumber;
    comment: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    decided_by: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    decided_at: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>>>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    score: number;
    comment?: string | null | undefined;
    decided_by?: string | null | undefined;
    decided_at?: string | null | undefined;
}, {
    score: number;
    extensions?: Record<string, unknown> | undefined;
    comment?: string | null | undefined;
    decided_by?: string | null | undefined;
    decided_at?: string | Date | null | undefined;
}>;
export declare const Evaluation: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    evaluation_id: z.ZodString;
    submission_id: z.ZodString;
    criterion_id: z.ZodString;
    ai_suggestion: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    } & {
        score: z.ZodNumber;
        confidence: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        comment: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        evidence: z.ZodDefault<z.ZodArray<z.ZodObject<{
            extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        } & {
            document_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            location: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            text_reference: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            source_ref: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strict", z.ZodTypeAny, {
            extensions: Record<string, unknown>;
            document_id?: string | null | undefined;
            location?: string | null | undefined;
            text_reference?: string | null | undefined;
            source_ref?: string | null | undefined;
        }, {
            extensions?: Record<string, unknown> | undefined;
            document_id?: string | null | undefined;
            location?: string | null | undefined;
            text_reference?: string | null | undefined;
            source_ref?: string | null | undefined;
        }>, "many">>;
        provenance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        } & {
            produced_by: z.ZodString;
            model_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            workflow_version: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            prompt_version: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            input_refs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            created_at: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>>>;
        }, "strict", z.ZodTypeAny, {
            produced_by: string;
            input_refs: string[];
            extensions: Record<string, unknown>;
            model_id?: string | null | undefined;
            workflow_version?: string | null | undefined;
            prompt_version?: string | null | undefined;
            created_at?: string | null | undefined;
        }, {
            produced_by: string;
            model_id?: string | null | undefined;
            workflow_version?: string | null | undefined;
            prompt_version?: string | null | undefined;
            input_refs?: string[] | undefined;
            created_at?: string | Date | null | undefined;
            extensions?: Record<string, unknown> | undefined;
        }>>>;
    }, "strict", z.ZodTypeAny, {
        extensions: Record<string, unknown>;
        score: number;
        evidence: {
            extensions: Record<string, unknown>;
            document_id?: string | null | undefined;
            location?: string | null | undefined;
            text_reference?: string | null | undefined;
            source_ref?: string | null | undefined;
        }[];
        confidence?: number | null | undefined;
        comment?: string | null | undefined;
        provenance?: {
            produced_by: string;
            input_refs: string[];
            extensions: Record<string, unknown>;
            model_id?: string | null | undefined;
            workflow_version?: string | null | undefined;
            prompt_version?: string | null | undefined;
            created_at?: string | null | undefined;
        } | null | undefined;
    }, {
        score: number;
        extensions?: Record<string, unknown> | undefined;
        confidence?: number | null | undefined;
        comment?: string | null | undefined;
        evidence?: {
            extensions?: Record<string, unknown> | undefined;
            document_id?: string | null | undefined;
            location?: string | null | undefined;
            text_reference?: string | null | undefined;
            source_ref?: string | null | undefined;
        }[] | undefined;
        provenance?: {
            produced_by: string;
            model_id?: string | null | undefined;
            workflow_version?: string | null | undefined;
            prompt_version?: string | null | undefined;
            input_refs?: string[] | undefined;
            created_at?: string | Date | null | undefined;
            extensions?: Record<string, unknown> | undefined;
        } | null | undefined;
    }>>>;
    professor_decision: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    } & {
        score: z.ZodNumber;
        comment: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        decided_by: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        decided_at: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>>>;
    }, "strict", z.ZodTypeAny, {
        extensions: Record<string, unknown>;
        score: number;
        comment?: string | null | undefined;
        decided_by?: string | null | undefined;
        decided_at?: string | null | undefined;
    }, {
        score: number;
        extensions?: Record<string, unknown> | undefined;
        comment?: string | null | undefined;
        decided_by?: string | null | undefined;
        decided_at?: string | Date | null | undefined;
    }>>>;
    status: z.ZodDefault<z.ZodEnum<["suggested", "in_review", "approved", "overridden"]>>;
}, "strict", z.ZodTypeAny, {
    status: "in_review" | "approved" | "suggested" | "overridden";
    extensions: Record<string, unknown>;
    criterion_id: string;
    submission_id: string;
    evaluation_id: string;
    ai_suggestion?: {
        extensions: Record<string, unknown>;
        score: number;
        evidence: {
            extensions: Record<string, unknown>;
            document_id?: string | null | undefined;
            location?: string | null | undefined;
            text_reference?: string | null | undefined;
            source_ref?: string | null | undefined;
        }[];
        confidence?: number | null | undefined;
        comment?: string | null | undefined;
        provenance?: {
            produced_by: string;
            input_refs: string[];
            extensions: Record<string, unknown>;
            model_id?: string | null | undefined;
            workflow_version?: string | null | undefined;
            prompt_version?: string | null | undefined;
            created_at?: string | null | undefined;
        } | null | undefined;
    } | null | undefined;
    professor_decision?: {
        extensions: Record<string, unknown>;
        score: number;
        comment?: string | null | undefined;
        decided_by?: string | null | undefined;
        decided_at?: string | null | undefined;
    } | null | undefined;
}, {
    criterion_id: string;
    submission_id: string;
    evaluation_id: string;
    status?: "in_review" | "approved" | "suggested" | "overridden" | undefined;
    extensions?: Record<string, unknown> | undefined;
    ai_suggestion?: {
        score: number;
        extensions?: Record<string, unknown> | undefined;
        confidence?: number | null | undefined;
        comment?: string | null | undefined;
        evidence?: {
            extensions?: Record<string, unknown> | undefined;
            document_id?: string | null | undefined;
            location?: string | null | undefined;
            text_reference?: string | null | undefined;
            source_ref?: string | null | undefined;
        }[] | undefined;
        provenance?: {
            produced_by: string;
            model_id?: string | null | undefined;
            workflow_version?: string | null | undefined;
            prompt_version?: string | null | undefined;
            input_refs?: string[] | undefined;
            created_at?: string | Date | null | undefined;
            extensions?: Record<string, unknown> | undefined;
        } | null | undefined;
    } | null | undefined;
    professor_decision?: {
        score: number;
        extensions?: Record<string, unknown> | undefined;
        comment?: string | null | undefined;
        decided_by?: string | null | undefined;
        decided_at?: string | Date | null | undefined;
    } | null | undefined;
}>;
