/**
 * One way to write a CSV cell — safe in a spreadsheet.
 *
 * Every export wrote its cells its own way: some quoted, some joined with
 * bare commas (a name with a comma in it slid every later column one to the
 * right), none of them guarded the first character. A spreadsheet treats a
 * cell that starts with = + - @ as a formula, and some of these cells hold
 * text a customer typed in the portal — a declared product name like
 * `=HYPERLINK("http://…"&A1)` became a live formula on an office computer.
 *
 * Such a cell is written with a leading apostrophe, which spreadsheets read
 * as "this is text" and do not display. A plain number stays a number, so
 * "-25.50" still adds up.
 */
const FORMULA_START = /^[=+\-@\t\r]/;
// -25.50, +3, -5%, -$1,250.00: a figure, never a formula.
const PLAIN_NUMBER = /^[-+]?\$?\d[\d,]*(\.\d+)?%?$/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let text = String(value);
  if (FORMULA_START.test(text) && !PLAIN_NUMBER.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function csvRow(cells: readonly unknown[]): string {
  return cells.map(csvCell).join(",");
}

export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map(csvRow).join("\n");
}

/**
 * Hand text to the browser as a download, and let go of it afterwards.
 * Each export used to keep its whole file in memory until the tab closed.
 */
export function downloadText(text: string, filename: string, type = "text/csv;charset=utf-8;"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
