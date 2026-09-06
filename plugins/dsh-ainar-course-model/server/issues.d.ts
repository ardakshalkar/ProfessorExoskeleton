/** Issues reported while loading or validating authored content. Ported from `ainar/issues.py`. */
export type Level = "error" | "warning";
export interface Issue {
    level: Level;
    code: string;
    message: string;
    location?: string | null;
}
export declare const describe: (issue: Issue) => string;
export declare class IssueList {
    items: Issue[];
    error(code: string, message: string, location?: string | null): void;
    warn(code: string, message: string, location?: string | null): void;
    extend(other: IssueList | Issue[]): void;
    get errors(): Issue[];
    get warnings(): Issue[];
    get length(): number;
    [Symbol.iterator](): Iterator<Issue>;
}
