/** Issues reported while loading or validating authored content. Ported from `ainar/issues.py`. */

export type Level = "error" | "warning";

export interface Issue {
  level: Level;
  code: string;
  message: string;
  location?: string | null;
}

export const describe = (issue: Issue): string => {
  const where = issue.location ? ` [${issue.location}]` : "";
  return `${issue.level.toUpperCase().padEnd(7)} ${issue.code.padEnd(24)} ${issue.message}${where}`;
};

export class IssueList {
  items: Issue[] = [];

  error(code: string, message: string, location?: string | null): void {
    this.items.push({ level: "error", code, message, location: location ?? null });
  }

  warn(code: string, message: string, location?: string | null): void {
    this.items.push({ level: "warning", code, message, location: location ?? null });
  }

  extend(other: IssueList | Issue[]): void {
    this.items.push(...(other instanceof IssueList ? other.items : other));
  }

  get errors(): Issue[] {
    return this.items.filter((item) => item.level === "error");
  }

  get warnings(): Issue[] {
    return this.items.filter((item) => item.level === "warning");
  }

  get length(): number {
    return this.items.length;
  }

  [Symbol.iterator](): Iterator<Issue> {
    return this.items[Symbol.iterator]();
  }
}
