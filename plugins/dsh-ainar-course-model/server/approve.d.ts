/**
 * Promoting agent proposals into the record. Ported from `ainar/approve.py`.
 *
 * Agents write drafts to `work/`. Nothing an agent writes is a record until a
 * person approves it, and approval is a distinct, traceable act:
 *
 * * an `ai_suggestion` gains a `professor_decision` beside it — never on top of
 *   it;
 * * a proposed intervention gains an approver;
 * * the `-DRAFT-` marker is stripped from the identifier, which is what makes
 *   the promotion visible in a diff.
 *
 * **This is a second implementation of the one gate**, which is a cost the port
 * has to earn rather than assume. `docs/node-migration.md` argued for keeping it
 * in Python precisely because two gates can disagree; what makes a second one
 * defensible is that the disagreement is *checked* —
 * `tests/test_approve_parity.py` runs both against the same drafts and compares
 * the resulting trees byte for byte, and `tests/test_yaml_parity.py` compares
 * the emitters scalar by scalar. Neither the promotion rules nor the file layout
 * live here twice by review; they live here twice by fixture.
 *
 * What is **not** equivalent, and must be said on every run rather than
 * discovered: the Python gate refuses to write when the merged bundle fails any
 * of `validate.py`'s 94 checks, and this one can only run the subset
 * `src/validate.ts` implements. The refusal is the gate. A narrower refusal is a
 * narrower gate, so `bin/ainar.ts approve` prints its coverage every time.
 */
import { z } from "zod";
import type { CourseBundle } from "./bundle.ts";
import { type Drafted } from "./drafts.ts";
import { IssueList } from "./issues.ts";
export declare const DRAFT_MARKER = "-DRAFT-";
/**
 * Where each collection lands, relative to `versions/<TERM>/`.
 *
 * Runtime records go to `records/`. Documents and resources go beside their
 * authored counterparts but in a separate `generated.yaml` — writing YAML back
 * into a hand-authored file would strip its comments and reformat it.
 *
 * Concepts and modules are not here, and no longer anywhere: they are authored
 * into `courses/` directly rather than approved. `CLAIM_FILES` was removed with
 * them on 2026-09-05.
 */
export declare const RECORD_FILES: Record<string, string>;
export declare const ID_FIELDS: Record<string, string>;
type Record_ = Record<string, unknown>;
/** `EVAL-DRAFT-9081-0401` becomes `EVAL-9081-0401`. */
export declare const promoteIdentifier: (value: string) => string;
/**
 * `datetime.now(run_timezone(...)).replace(microsecond=0).isoformat()`.
 *
 * The offset comes from the run's own `timezone`, falling back to Asia/Almaty
 * the way Python's does — a stamp is the record of when a person decided, so a
 * silent UTC substitution would misreport it by five hours.
 */
export declare const decidedAt: (timezone: string | undefined, now?: Date) => string;
export interface Approval {
    records: Map<string, Record_[]>;
    idMap: Map<string, string>;
    skipped: string[];
    notes: string[];
}
export declare const total: (approval: Approval) => number;
/** Turn drafted proposals into records a person stands behind. */
export declare const approveDrafts: (bundle: CourseBundle, drafted: Drafted, options: {
    approver: string;
    decidedAt: string;
    issues: IssueList;
    only?: Set<string>;
    reject?: Set<string>;
}) => Approval;
/** Repository-relative keys have no scheme; object-storage keys use `://`. */
export declare const isRepoKey: (storageKey: string) => boolean;
/**
 * Move approved material out of `work/` and stamp size and checksum.
 *
 * Size and checksum are computed here rather than asked of the agent, because an
 * agent hand-writing a sha256 is an invitation to error.
 */
export declare const stageDocuments: (approval: Approval, options: {
    root: string;
    runDir: string;
    issues: IssueList;
    dryRun?: boolean;
}) => void;
/**
 * Drop empty `extensions` maps and sink the rest to the end of a record.
 *
 * Purely for the humans who read `records/` in a diff — an `extensions: {}` on
 * every nested object buries the fields that matter.
 */
export declare const tidy: (node: unknown) => unknown;
/**
 * Which numbers in this collection are floats.
 *
 * Pydantic decides by the declared field type, so a `score: 8` in a draft is
 * written back as `8.0`. The zod schemas carry the same distinction —
 * `z.number()` against `z.number().int()` — so the paths are read off the schema
 * rather than off the value, which is the only way to agree with pydantic.
 */
export declare const floatPaths: (schema: z.ZodTypeAny, prefix?: string[], seen?: Set<z.ZodTypeAny>) => Set<string>;
export declare const HEADER: string;
/**
 * Append approved records to their destination, one file per collection.
 *
 * Everything approvable lands under `versions/<TERM>/`, so `runDir` is the only
 * destination there is.
 */
export declare const writeRecords: (runDir: string, approval: Approval) => string[];
export {};
