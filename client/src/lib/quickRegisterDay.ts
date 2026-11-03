/**
 * Quick Register's warehouse, transport and batch hold for the whole day
 * (owner, 2026-11-03: «بە ڕۆیشتن و دەرچوونەکانی هەمان ڕۆژ نەڕوات، تەنها لە
 * ڕۆژێکی نوێ بەتاڵ ببێتەوە»). Leaving the page, a reload or a cleared form
 * keeps them; the next day starts empty. One device, one browser - a
 * convenience, so a failed read is simply an empty day.
 */
export type QuickRegisterShipping = "air_regular" | "air_irregular" | "sea";

export interface QuickRegisterDay {
  originWarehouseId: number | null;
  shippingType: QuickRegisterShipping;
  batchId: string;
}

const PREFIX = "wazn-qr-day-";

export function quickRegisterDayKey(now: Date = new Date()): string {
  return `${PREFIX}${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

const SHIPPING: readonly string[] = ["air_regular", "air_irregular", "sea"];

/** Today's choices on this device, or null on a new day. */
export function readQuickRegisterDay(now: Date = new Date()): QuickRegisterDay | null {
  try {
    const raw = localStorage.getItem(quickRegisterDayKey(now));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<QuickRegisterDay>;
    return {
      originWarehouseId: typeof v.originWarehouseId === "number" ? v.originWarehouseId : null,
      shippingType: SHIPPING.includes(String(v.shippingType)) ? (v.shippingType as QuickRegisterShipping) : "air_regular",
      batchId: typeof v.batchId === "string" ? v.batchId : "",
    };
  } catch {
    return null;
  }
}

/** Keep today's choices; yesterday's are dropped so storage does not grow. */
export function saveQuickRegisterDay(day: QuickRegisterDay, now: Date = new Date()): void {
  try {
    const key = quickRegisterDayKey(now);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX) && k !== key) localStorage.removeItem(k);
    }
    localStorage.setItem(key, JSON.stringify(day));
  } catch {
    /* a convenience; the form still works */
  }
}
