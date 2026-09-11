export type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

export interface Cell {
  row: number;
  col: number;
}

/** The `data-cell` value a field in a table of fields carries: "row:col". */
export const cellAttr = (row: number, col: number): string => `${row}:${col}`;

export function parseCell(attr: string | null | undefined): Cell | null {
  const m = /^(\d+):(\d+)$/.exec(attr ?? "");
  return m ? { row: Number(m[1]), col: Number(m[2]) } : null;
}

/**
 * Where an arrow key goes in a table of fields.
 *
 * Up and down change row. Left and right change column only when the field
 * may be left — it is empty, or its whole value is selected (FastEntry
 * selects a number box's value on entry) — so the arrows still move the caret
 * inside a value being corrected. In Kurdish and Arabic the columns run right
 * to left, so there "left" is the next column. Null means stay put.
 */
export function nextCell(
  at: Cell,
  key: ArrowKey,
  size: { rows: number; cols: number },
  options: { rtl: boolean; canLeave: boolean },
): Cell | null {
  if (key === "ArrowUp") return at.row > 0 ? { row: at.row - 1, col: at.col } : null;
  if (key === "ArrowDown") return at.row < size.rows - 1 ? { row: at.row + 1, col: at.col } : null;
  if (!options.canLeave) return null;
  const forward = (key === "ArrowRight") !== options.rtl;
  const col = forward ? at.col + 1 : at.col - 1;
  return col >= 0 && col < size.cols ? { row: at.row, col } : null;
}
