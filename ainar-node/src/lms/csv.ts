/**
 * Writing CSV the way Python's `csv` module writes it.
 *
 * Python's default dialect is `excel`: comma-separated, CRLF line endings, and
 * `QUOTE_MINIMAL` — a field is quoted only when it holds a comma, a quote, a
 * carriage return or a newline, and an embedded quote is doubled.
 *
 * The CRLF is not a Windows accident; it is what `csv.writer` emits on every
 * platform, and it is what a gradebook importer expects. A file written with
 * bare newlines will still import, but it stops being byte-comparable against
 * what the Python implementation produced — which is the only way anyone can
 * check that this port is faithful.
 */

const NEEDS_QUOTING = /[",\r\n]/;

const field = (value: string): string =>
  NEEDS_QUOTING.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** One row, terminated. */
export const csvRow = (values: readonly string[]): string =>
  values.map(field).join(",") + "\r\n";

/** A whole table, as `csv.writer(...).writerows(...)` would write it. */
export const csvText = (rows: readonly (readonly string[])[]): string =>
  rows.map(csvRow).join("");

/**
 * A CSV into rows, tolerating quoted fields that hold commas and newlines.
 *
 * Written out rather than borrowed from `roster.ts`: that one splits on a single
 * delimiter for a class list, and a Canvas gradebook export routinely carries a
 * comma inside a student's name.
 */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  let index = 0;

  // A UTF-8 BOM is what `encoding="utf-8-sig"` strips; Canvas writes one.
  const source = text.startsWith("﻿") ? text.slice(1) : text;

  const endField = (): void => {
    row.push(value);
    value = "";
  };
  const endRow = (): void => {
    endField();
    rows.push(row);
    row = [];
  };

  while (index < source.length) {
    const char = source[index]!;
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          value += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      value += char;
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = true;
      index += 1;
      continue;
    }
    if (char === ",") {
      endField();
      index += 1;
      continue;
    }
    if (char === "\r" || char === "\n") {
      endRow();
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      index += 1;
      continue;
    }
    value += char;
    index += 1;
  }

  // A trailing newline ends the last row; anything else means one is still open.
  if (value || row.length) endRow();
  return rows;
};

/**
 * `csv.DictReader`: the first row names the columns, and a short row leaves the
 * missing ones empty rather than absent.
 */
export const parseCsvDicts = (text: string): { fieldnames: string[]; rows: Record<string, string>[] } => {
  const rows = parseCsv(text).filter((row) => row.length > 1 || (row[0] ?? "") !== "");
  if (!rows.length) return { fieldnames: [], rows: [] };
  const fieldnames = rows[0]!.map((name) => name ?? "");
  return {
    fieldnames,
    rows: rows.slice(1).map((row) => {
      const record: Record<string, string> = {};
      fieldnames.forEach((name, index) => {
        record[name] = row[index] ?? "";
      });
      return record;
    }),
  };
};
