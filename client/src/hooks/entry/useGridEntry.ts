import { useCallback, type ClipboardEvent, type KeyboardEvent } from "react";
import { cellAttr, nextCell, parseCell, type ArrowKey, type Cell } from "@/lib/entry/gridNavigation";
import { isGridPaste, parseClipboardGrid } from "@/lib/entry/clipboardGrid";

const ARROWS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

/**
 * Spreadsheet keys for a table of fields.
 *
 * Put `onKeyDown` and `onPaste` on the table (or any element around the
 * fields) and `data-cell={cellAttr(row, col)}` on each field:
 *
 *   - the arrow keys move between fields (lib/entry/gridNavigation.ts);
 *   - a block pasted from Excel is handed to `onGrid` with the cell it starts
 *     at, and the table decides what to do with it. A single value is left
 *     to the field, as before.
 */
export function useGridEntry(
  size: { rows: number; cols: number },
  onGrid?: (rows: string[][], start: Cell) => void,
) {
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (!ARROWS.has(e.key) || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const field = e.target as HTMLInputElement;
      const at = parseCell(field.getAttribute?.("data-cell"));
      if (!at) return;
      // Up and down on a number box would change its value; in a table they change row.
      if (field.type === "number" && (e.key === "ArrowUp" || e.key === "ArrowDown")) e.preventDefault();

      const value = typeof field.value === "string" ? field.value : "";
      let start: number | null = null;
      let end: number | null = null;
      try {
        start = field.selectionStart;
        end = field.selectionEnd;
      } catch {
        // A number box has no caret to ask about: it may be left.
      }
      const canLeave = value === "" || start === null || (start === 0 && end === value.length);
      const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
      const target = nextCell(at, e.key as ArrowKey, size, { rtl, canLeave });
      if (!target) return;
      const next = e.currentTarget.querySelector<HTMLElement>(`[data-cell="${cellAttr(target.row, target.col)}"]`);
      if (!next) return;
      e.preventDefault();
      next.focus();
      if (next instanceof HTMLInputElement) {
        try {
          next.select();
        } catch {
          /* not selectable */
        }
      }
    },
    [size.rows, size.cols],
  );

  const onPaste = useCallback(
    (e: ClipboardEvent<HTMLElement>) => {
      if (!onGrid) return;
      const text = e.clipboardData.getData("text/plain");
      if (!isGridPaste(text)) return;
      const at = parseCell((e.target as HTMLElement).getAttribute?.("data-cell"));
      if (!at) return;
      e.preventDefault();
      onGrid(parseClipboardGrid(text), at);
    },
    [onGrid],
  );

  return { onKeyDown, onPaste };
}
