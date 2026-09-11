/**
 * A block copied from Excel or Google Sheets arrives as plain text: rows on
 * lines, cells split by tabs, and a cell holding a tab, a quote or a line
 * break wrapped in quotes. This turns it back into rows of cells, so a column
 * of tracking numbers or weights pasted once fills the rows below the cursor.
 */
export function parseClipboardGrid(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/\r\n?/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"' && cell === "") {
      quoted = true;
    } else if (c === "\t") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // A spreadsheet ends its copy with a line break; drop the empty rows it leaves.
  while (rows.length > 0 && rows[rows.length - 1].every((v) => v.trim() === "")) rows.pop();
  return rows.map((r) => r.map((v) => v.trim()));
}

/** More than one cell: a block to spread, not a single value for one field. */
export function isGridPaste(text: string): boolean {
  const grid = parseClipboardGrid(text);
  return grid.length > 1 || (grid[0]?.length ?? 0) > 1;
}
