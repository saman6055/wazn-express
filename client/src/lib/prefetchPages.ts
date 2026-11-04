/**
 * The office's daily screens, fetched while nobody is waiting.
 *
 * Each page is its own file, so the first visit to it costs a round trip
 * before anything can draw. Once the first screen is up and the browser is
 * idle, these arrive one at a time; the first click on them is then instant.
 * They are cached for a year under their hashed names, so this costs a phone
 * once per deploy. Skipped on a data-saver or a slow line.
 */
const DAILY_PAGES: Array<() => Promise<unknown>> = [
  () => import("@/pages/packages/Packages"),
  () => import("@/pages/packages/QuickRegister"),
  () => import("@/pages/customers/Customers"),
  () => import("@/pages/scanning/CustomerDeliveryScanner"),
  () => import("@/pages/batches/Batches"),
  () => import("@/pages/finance/Finance"),
];

let started = false;

function whenIdle(work: () => void) {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void };
  if (w.requestIdleCallback) w.requestIdleCallback(work, { timeout: 2500 });
  else window.setTimeout(work, 1200);
}

export function prefetchDailyPages(): void {
  if (started) return;
  started = true;
  const line = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (line?.saveData || /(^|-)2g$/.test(line?.effectiveType ?? "")) return;
  const next = (i: number) => {
    if (i >= DAILY_PAGES.length) return;
    // A page that fails to arrive here is fetched again when it is opened.
    whenIdle(() => void DAILY_PAGES[i]().catch(() => undefined).finally(() => next(i + 1)));
  };
  next(0);
}
