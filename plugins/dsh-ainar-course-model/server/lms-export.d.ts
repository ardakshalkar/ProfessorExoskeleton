export type LmsQuestion = {
    number: number;
    title?: string;
    marks?: number;
    prompt: string;
    options?: Array<{
        label: string;
        text: string;
    }>;
    correctOptions?: string[];
};
export type LmsExam = {
    title?: string;
    questions: LmsQuestion[];
};
export type LmsExportTarget = "moodle-xml" | "canvas-qti" | "qti-1.2";
export type ExportArtifact = {
    mediaType: string;
    data: Uint8Array;
};
export interface LmsExporter {
    readonly target: LmsExportTarget;
    readonly extension: ".xml" | ".zip";
    export(exam: LmsExam): ExportArtifact;
}
export declare function validateLmsExam(value: unknown): LmsExam;
export declare function moodleXml(exam: LmsExam): string;
export declare function qtiAssessmentXml(exam: LmsExam, assessmentId?: string): string;
export declare function qtiManifestXml(exam: LmsExam, assessmentFile?: string): string;
export declare function qtiZip(exam: LmsExam): Uint8Array;
export declare function exporterFor(target: LmsExportTarget): LmsExporter;
