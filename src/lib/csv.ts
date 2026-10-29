// Quotes every field and neutralizes spreadsheet formulas (cells starting with = + - @ tab or CR),
// so names or report text cannot run as formulas when the file is opened in Excel.
export function csvField(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  // The byte-order mark makes Excel read the file as UTF-8 (names with ñ, é, etc.).
  return "﻿" + [headers, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}
