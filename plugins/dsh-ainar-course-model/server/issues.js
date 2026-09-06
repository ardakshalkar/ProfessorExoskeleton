/** Issues reported while loading or validating authored content. Ported from `ainar/issues.py`. */
export const describe = (issue) => {
    const where = issue.location ? ` [${issue.location}]` : "";
    return `${issue.level.toUpperCase().padEnd(7)} ${issue.code.padEnd(24)} ${issue.message}${where}`;
};
export class IssueList {
    items = [];
    error(code, message, location) {
        this.items.push({ level: "error", code, message, location: location ?? null });
    }
    warn(code, message, location) {
        this.items.push({ level: "warning", code, message, location: location ?? null });
    }
    extend(other) {
        this.items.push(...(other instanceof IssueList ? other.items : other));
    }
    get errors() {
        return this.items.filter((item) => item.level === "error");
    }
    get warnings() {
        return this.items.filter((item) => item.level === "warning");
    }
    get length() {
        return this.items.length;
    }
    [Symbol.iterator]() {
        return this.items[Symbol.iterator]();
    }
}
