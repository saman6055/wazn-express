import { useEffect, useMemo, useState } from "react";

/** Where page `page` of `total` rows starts and ends, kept inside the list. */
export function pageOf(total: number, pageSize: number, page: number) {
  const pageCount = Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  return {
    page: current,
    pageCount,
    from: total > 0 ? (current - 1) * pageSize + 1 : 0,
    to: Math.min(current * pageSize, Math.max(0, total)),
  };
}

/**
 * One page of a long list that is already in the browser.
 *
 * Customers, balances and orders arrive whole, and drawing every row at once
 * made a list of a few thousand slow to appear and slow to scroll. This draws
 * `pageSize` rows and leaves the rest where they are: search, filters and the
 * totals above a list still see every row.
 *
 * The page goes back to 1 when `resetKey` changes — pass the search and the
 * filters, joined into one string — and never points past the end when the
 * list gets shorter.
 */
export function useClientPagination<T>(
  rows: readonly T[] | null | undefined,
  pageSize = 50,
  resetKey?: string | number,
) {
  const [page, setPage] = useState(1);
  const list = rows ?? [];
  const where = pageOf(list.length, pageSize, page);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const pageRows = useMemo(
    () => list.slice((where.page - 1) * pageSize, where.page * pageSize),
    [list, where.page, pageSize],
  );

  return {
    ...where,
    total: list.length,
    pageRows,
    setPage: (next: number) => setPage(pageOf(list.length, pageSize, next).page),
  };
}
