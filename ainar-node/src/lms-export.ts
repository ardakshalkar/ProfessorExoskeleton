import { deflateRawSync } from "node:zlib";

export type LmsQuestion = {
  number: number;
  title?: string;
  marks?: number;
  prompt: string;
  options?: Array<{ label: string; text: string }>;
  correctOptions?: string[];
};

export type LmsExam = { title?: string; questions: LmsQuestion[] };
export type LmsExportTarget = "moodle-xml" | "canvas-qti" | "qti-1.2";
export type ExportArtifact = { mediaType: string; data: Uint8Array };

export interface LmsExporter {
  readonly target: LmsExportTarget;
  readonly extension: ".xml" | ".zip";
  export(exam: LmsExam): ExportArtifact;
}

const encoder = new TextEncoder();

export function validateLmsExam(value: unknown): LmsExam {
  if (!value || typeof value !== "object") throw new Error("Exam input must be an object");
  const exam = value as Partial<LmsExam>;
  if (!Array.isArray(exam.questions) || exam.questions.length === 0) throw new Error("Exam input must contain at least one question");
  const numbers = new Set<number>();
  for (const [index, question] of exam.questions.entries()) {
    if (!Number.isInteger(question.number) || question.number < 1) throw new Error(`questions[${index}].number must be a positive integer`);
    if (numbers.has(question.number)) throw new Error(`Duplicate question number ${question.number}`);
    numbers.add(question.number);
    if (!question.prompt?.trim()) throw new Error(`Question ${question.number} has no prompt`);
    if (question.marks !== undefined && (!Number.isFinite(question.marks) || question.marks <= 0)) throw new Error(`Question ${question.number} marks must be positive`);
    if (question.options?.length) {
      if (!question.correctOptions?.length) throw new Error(`Question ${question.number} requires correctOptions for LMS export`);
      if (question.correctOptions.length !== 1) throw new Error(`Question ${question.number} currently supports exactly one correct option`);
      const labels = new Set(question.options.map((option) => option.label));
      if (!labels.has(question.correctOptions[0])) throw new Error(`Question ${question.number} correct option does not match an option label`);
    }
  }
  return exam as LmsExam;
}

export function moodleXml(exam: LmsExam): string {
  const questions = exam.questions.map((question) => {
    const title = question.title ? `Question ${question.number} - ${question.title}` : `Question ${question.number}`;
    const lines = [
      `  <question type="${question.options?.length ? "multichoice" : "essay"}">`,
      `    <name><text>${xml(title)}</text></name>`,
      `    <questiontext format="html"><text>${cdata(`<p>${xml(question.prompt)}</p>`)}</text></questiontext>`,
      `    <defaultgrade>${formatNumber(question.marks ?? 1)}</defaultgrade>`,
      "    <penalty>0.3333333</penalty>",
      "    <hidden>0</hidden>",
    ];
    if (question.options?.length) {
      lines.push("    <single>true</single>", "    <shuffleanswers>true</shuffleanswers>", "    <answernumbering>ABCD</answernumbering>");
      for (const option of question.options) {
        const correct = question.correctOptions?.includes(option.label) ? 100 : 0;
        lines.push(
          `    <answer fraction="${correct}" format="html">`,
          `      <text>${cdata(`<p>${xml(option.text)}</p>`)}</text>`,
          "      <feedback format=\"html\"><text></text></feedback>",
          "    </answer>",
        );
      }
    } else {
      lines.push(
        "    <responseformat>editor</responseformat>",
        "    <responserequired>1</responserequired>",
        "    <responsefieldlines>15</responsefieldlines>",
        "    <attachments>0</attachments>",
        "    <answer fraction=\"0\"><text></text></answer>",
      );
    }
    lines.push("  </question>");
    return lines.join("\n");
  });
  return ["<?xml version=\"1.0\" encoding=\"UTF-8\"?>", "<quiz>", ...questions, "</quiz>", ""].join("\n");
}

export function qtiAssessmentXml(exam: LmsExam, assessmentId = "professorharness_exam"): string {
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<questestinterop xmlns=\"http://www.imsglobal.org/xsd/ims_qtiasiv1p2\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd\">",
    `  <assessment ident="${xml(assessmentId)}" title="${xml(exam.title ?? "Exam")}">`,
    "    <section ident=\"root_section\">",
    exam.questions.map(qtiItem).join("\n"),
    "    </section>",
    "  </assessment>",
    "</questestinterop>",
    "",
  ].join("\n");
}

function qtiItem(question: LmsQuestion): string {
  const title = question.title ? `Question ${question.number} - ${question.title}` : `Question ${question.number}`;
  const score = formatNumber(question.marks ?? 1);
  const lines = [
    `      <item ident="question_${question.number}" title="${xml(title)}">`,
    "        <itemmetadata><qtimetadata>",
    `          <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>${question.options?.length ? "multiple_choice_question" : "essay_question"}</fieldentry></qtimetadatafield>`,
    `          <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${score}</fieldentry></qtimetadatafield>`,
    "        </qtimetadata></itemmetadata>",
    "        <presentation>",
    `          <material><mattext texttype="text/html">${xml(`<p>${question.prompt}</p>`)}</mattext></material>`,
  ];
  if (question.options?.length) {
    lines.push("          <response_lid ident=\"response\" rcardinality=\"Single\"><render_choice shuffle=\"Yes\">");
    for (const option of question.options) lines.push(`            <response_label ident="${xml(option.label)}"><material><mattext texttype="text/plain">${xml(option.text)}</mattext></material></response_label>`);
    lines.push(
      "          </render_choice></response_lid>",
      "        </presentation>",
      "        <resprocessing>",
      `          <outcomes><decvar maxvalue="${score}" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>`,
      "          <respcondition continue=\"No\"><conditionvar>",
      `            <varequal respident="response">${xml(question.correctOptions?.[0] ?? "")}</varequal>`,
      "          </conditionvar>",
      `          <setvar action="Set" varname="SCORE">${score}</setvar></respcondition>`,
      "        </resprocessing>",
    );
  } else {
    lines.push(
      "          <response_str ident=\"response\" rcardinality=\"Single\"><render_fib fibtype=\"String\" rows=\"12\" columns=\"80\"><response_label ident=\"answer\" rshuffle=\"No\"/></render_fib></response_str>",
      "        </presentation>",
      "        <resprocessing>",
      `          <outcomes><decvar maxvalue="${score}" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>`,
      "        </resprocessing>",
    );
  }
  lines.push("      </item>");
  return lines.join("\n");
}

export function qtiManifestXml(exam: LmsExam, assessmentFile = "assessment.xml"): string {
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<manifest xmlns=\"http://www.imsglobal.org/xsd/imscp_v1p1\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" identifier=\"professorharness_qti_package\">",
    "  <metadata>",
    "    <schema>IMS QTI</schema><schemaversion>1.2</schemaversion>",
    `    <lom xmlns="http://ltsc.ieee.org/xsd/LOM"><general><title><string>${xml(exam.title ?? "Exam")}</string></title></general></lom>`,
    "  </metadata>",
    "  <organizations/>",
    "  <resources>",
    `    <resource identifier="exam_resource" type="imsqti_xmlv1p2" href="${assessmentFile}"><file href="${assessmentFile}"/></resource>`,
    "  </resources>",
    "</manifest>",
    "",
  ].join("\n");
}

export function qtiZip(exam: LmsExam): Uint8Array {
  return createZip([
    { name: "imsmanifest.xml", data: encoder.encode(qtiManifestXml(exam)) },
    { name: "assessment.xml", data: encoder.encode(qtiAssessmentXml(exam)) },
  ]);
}

export function exporterFor(target: LmsExportTarget): LmsExporter {
  if (target === "moodle-xml") return { target, extension: ".xml", export: (exam) => ({ mediaType: "application/xml", data: encoder.encode(moodleXml(exam)) }) };
  return { target, extension: ".zip", export: (exam) => ({ mediaType: "application/zip", data: qtiZip(exam) }) };
}

function xml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function cdata(value: string): string {
  return `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

type ZipEntry = { name: string; data: Uint8Array };

function createZip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name.replaceAll("\\", "/"));
    const compressed = deflateRawSync(entry.data);
    const checksum = crc32(entry.data);
    const local = new Uint8Array(30 + name.length + compressed.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, 8, true);
    lv.setUint32(14, checksum, true); lv.setUint32(18, compressed.length, true); lv.setUint32(22, entry.data.length, true); lv.setUint16(26, name.length, true);
    local.set(name, 30); local.set(compressed, 30 + name.length); localParts.push(local);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 8, true);
    cv.setUint32(16, checksum, true); cv.setUint32(20, compressed.length, true); cv.setUint32(24, entry.data.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true);
    central.set(name, 46); centralParts.push(central); offset += local.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true); ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  return concat([...localParts, ...centralParts, end]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
