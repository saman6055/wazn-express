/**
 * The portal's transactions, one line per box.
 *
 * A box receipt charges each parcel inside it on its own ledger row
 * («BOX-… — tracking»), so a box of thirty parcels read as thirty small
 * figures and the customer lost the thread (owner, 2026-11-07). Those rows
 * are gathered into one entry carrying the box total; the parcels stay inside
 * it for whoever opens it. Everything else passes through untouched, in order.
 */
export type TxLike = { id: number; transactionType?: string | null; description?: string | null; amountUsd?: string | number | null; createdAt?: string | Date | null };

export type TxEntry<T extends TxLike> =
  | { kind: "tx"; tx: T }
  | { kind: "box"; key: string; boxCode: string; rows: T[]; totalUsd: number; createdAt: T["createdAt"] };

const BOX_LINE = /^(BOX-[A-Za-z0-9-]+)\s+—\s/;

export function boxCodeOfTx(tx: TxLike): string | null {
  if (String(tx.transactionType ?? "").toUpperCase() !== "DEBIT_PACKAGE") return null;
  const m = BOX_LINE.exec(String(tx.description ?? ""));
  return m ? m[1] : null;
}

export function groupTransactionsByBox<T extends TxLike>(rows: readonly T[] | null | undefined): TxEntry<T>[] {
  const out: TxEntry<T>[] = [];
  const boxes = new Map<string, Extract<TxEntry<T>, { kind: "box" }>>();
  for (const tx of rows ?? []) {
    const code = boxCodeOfTx(tx);
    if (!code) { out.push({ kind: "tx", tx }); continue; }
    let entry = boxes.get(code);
    if (!entry) {
      entry = { kind: "box", key: `box-${code}`, boxCode: code, rows: [], totalUsd: 0, createdAt: tx.createdAt };
      boxes.set(code, entry);
      out.push(entry);
    }
    entry.rows.push(tx);
    entry.totalUsd = Math.round((entry.totalUsd * 100 + Math.round(Number(tx.amountUsd ?? 0) * 100))) / 100;
  }
  // A box with a single parcel is just that row.
  return out.map((e) => (e.kind === "box" && e.rows.length === 1 ? { kind: "tx" as const, tx: e.rows[0] } : e));
}
