/** PostgreSQL-backed CourseStore over the canonical CourseBundle read model. */
import { COLLECTION_NAMES, COLLECTION_SCHEMAS } from "../bundle.js";
import { IssueList } from "../issues.js";
import { Course } from "../model/academic.js";
import { LoadedCourseStore } from "./course-store.js";
export const withIdentityClient = async (pool, identity, operation) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const resolved = await client.query(RESOLVE_IDENTITY_SQL, [
            identity.issuer,
            identity.subject,
        ]);
        const userId = resolved.rows[0]?.user_id;
        if (!userId)
            throw new Error("OAuth identity is not linked to an AINAR user");
        await client.query("SELECT set_config('ainar.user_id', $1, true)", [userId]);
        const result = await operation(client);
        await client.query("COMMIT");
        return result;
    }
    catch (error) {
        try {
            await client.query("ROLLBACK");
        }
        catch {
            // Preserve the original authorization/database error.
        }
        throw error;
    }
    finally {
        client.release();
    }
};
export const READ_BUNDLES_SQL = `
SELECT course_code, format_version, payload
  FROM content.course_bundle_read_models
 ORDER BY course_code
`;
export const RESOLVE_IDENTITY_SQL = `
SELECT user_id::text AS user_id
  FROM delivery.user_identities
 WHERE issuer = $1 AND subject = $2
`;
const parsePayload = (row) => {
    const issues = new IssueList();
    let envelope = row.payload;
    if (typeof envelope === "string") {
        try {
            envelope = JSON.parse(envelope);
        }
        catch (error) {
            issues.error("postgres.bundle_json", `invalid JSON: ${error.message}`, row.course_code);
            return { bundle: null, issues };
        }
    }
    if (!envelope || typeof envelope !== "object") {
        issues.error("postgres.bundle_shape", "payload is not a JSON object", row.course_code);
        return { bundle: null, issues };
    }
    if (envelope.format !== "ainar.course-bundle") {
        issues.error("postgres.bundle_format", `unsupported format ${String(envelope.format)}`, row.course_code);
    }
    if (String(envelope.format_version) !== "1" || String(row.format_version) !== "1") {
        issues.error("postgres.bundle_version", `unsupported format version ${String(envelope.format_version)}`, row.course_code);
    }
    if (envelope.course_id !== row.course_code) {
        issues.error("postgres.bundle_course", `row is ${row.course_code} but payload is ${String(envelope.course_id)}`, row.course_code);
    }
    const parsedCourse = Course.safeParse(envelope.course);
    if (!parsedCourse.success) {
        for (const issue of parsedCourse.error.issues) {
            issues.error("postgres.bundle_entity", issue.message, `course.${issue.path.join(".")}`);
        }
    }
    const data = {};
    for (const name of COLLECTION_NAMES) {
        const collection = envelope[name];
        if (!Array.isArray(collection)) {
            issues.error("postgres.bundle_collection", `${name} is not an array`, row.course_code);
            data[name] = [];
            continue;
        }
        const schema = COLLECTION_SCHEMAS[name];
        data[name] = collection.flatMap((entry, index) => {
            const result = schema.safeParse(entry);
            if (result.success)
                return [result.data];
            for (const issue of result.error.issues) {
                issues.error("postgres.bundle_entity", issue.message, `${name}.${index}.${issue.path.join(".")}`);
            }
            return [];
        });
    }
    if (!parsedCourse.success || issues.errors.length)
        return { bundle: null, issues };
    return { bundle: { course: parsedCourse.data, ...data }, issues };
};
/**
 * Load the tenant-visible read models into the synchronous engine boundary.
 * Row-level security on the supplied SQL client decides which courses appear.
 */
export const loadPostgresCourseStore = async (client, options = {}) => {
    const result = await client.query(READ_BUNDLES_SQL);
    return new LoadedCourseStore(result.rows.map((row) => [row.course_code, parsePayload(row)]), {
        root: options.documentRoot,
        label: options.label ?? "PostgreSQL CourseBundle read model",
    });
};
/**
 * Resolve an OAuth subject and establish a transaction-local PostgreSQL user.
 * RLS policies read `ainar.user_id`; SET LOCAL prevents identity leakage when
 * the pooled connection is returned and reused for another professor.
 */
export const loadPostgresCourseStoreForIdentity = async (pool, identity, options = {}) => {
    return withIdentityClient(pool, identity, (client) => loadPostgresCourseStore(client, options));
};
