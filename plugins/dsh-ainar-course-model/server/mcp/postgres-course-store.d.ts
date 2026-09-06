/** PostgreSQL-backed CourseStore over the canonical CourseBundle read model. */
import { LoadedCourseStore } from "./course-store.ts";
export interface SqlQueryResult<Row> {
    rows: Row[];
}
/** Implemented structurally by pg.Pool, pg.Client and transaction clients. */
export interface SqlClient {
    query<Row extends Record<string, unknown>>(text: string, values?: unknown[]): Promise<SqlQueryResult<Row>>;
}
export interface TransactionSqlClient extends SqlClient {
    release(): void;
}
export interface SqlPool extends SqlClient {
    connect(): Promise<TransactionSqlClient>;
}
export interface OAuthIdentity {
    issuer: string;
    subject: string;
}
export declare const withIdentityClient: <Result>(pool: SqlPool, identity: OAuthIdentity, operation: (client: TransactionSqlClient) => Promise<Result>) => Promise<Result>;
export declare const READ_BUNDLES_SQL = "\nSELECT course_code, format_version, payload\n  FROM content.course_bundle_read_models\n ORDER BY course_code\n";
export declare const RESOLVE_IDENTITY_SQL = "\nSELECT user_id::text AS user_id\n  FROM delivery.user_identities\n WHERE issuer = $1 AND subject = $2\n";
/**
 * Load the tenant-visible read models into the synchronous engine boundary.
 * Row-level security on the supplied SQL client decides which courses appear.
 */
export declare const loadPostgresCourseStore: (client: SqlClient, options?: {
    documentRoot?: string;
    label?: string;
}) => Promise<LoadedCourseStore>;
/**
 * Resolve an OAuth subject and establish a transaction-local PostgreSQL user.
 * RLS policies read `ainar.user_id`; SET LOCAL prevents identity leakage when
 * the pooled connection is returned and reused for another professor.
 */
export declare const loadPostgresCourseStoreForIdentity: (pool: SqlPool, identity: OAuthIdentity, options?: {
    documentRoot?: string;
    label?: string;
}) => Promise<LoadedCourseStore>;
