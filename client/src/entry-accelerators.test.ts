import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { cleanNumberPaste, cleanTrackingPaste, splitTrackingPaste, toPlainDigits } from "./lib/entry/cleanPaste";
import {
  SEARCH_HISTORY_KEY,
  forgetSearchHistory,
  readSearchHistory,
  rememberSearch,
  suggestFromHistory,
  type KeyValueStore,
} from "./lib/entry/searchHistory";
import { displayDateValue, parseDateShortcut, toDateInputValue } from "./lib/entry/dateShortcuts";
import { evaluateSum, measureDimensions, parseDimensions } from "./lib/entry/fieldMath";
import { isGridPaste, parseClipboardGrid } from "./lib/entry/clipboardGrid";
import { nextCell, parseCell } from "./lib/entry/gridNavigation";
import { arrivalMessage, waybillSummary, whatsappLink, whatsappNumber } from "./lib/entry/messages";
import { createShield, duplicateEntry, matchesFilters, toggleFilter } from "./lib/entry/small";
import { USER_DATA_KEYS } from "./lib/signOut";

/**
 * The owner's workflow brief (2026-09-11): faster entry, fewer clicks, fewer
 * mistakes — without changing what is saved or how it is worked out. These
 * pin the helpers every such screen will lean on.
 */
const EASTERN = /[٠-٩۰-۹]/;

describe("a paste keeps only what the number is made of", () => {
  it("drops a chat's label, spaces, invisible marks and full-width forms", () => {
    expect(cleanTrackingPaste("运单号：YT 1234 5678 90‏")).toBe("YT1234567890");
    expect(cleanTrackingPaste("ＳＦ１２３４")).toBe("SF1234");
    expect(cleanTrackingPaste("  yt-778-  ")).toBe("YT-778");
  });

  it("splits several numbers on lines and commas, never on spaces", () => {
    expect(splitTrackingPaste("SF 123\nYT456，ZT789،AB1")).toEqual(["SF123", "YT456", "ZT789", "AB1"]);
  });

  it("reads Eastern digits and the Arabic decimal comma as 0-9", () => {
    expect(toPlainDigits("۱۲")).toBe("12");
    expect(cleanNumberPaste("١٢٫٥")).toBe("12.5");
    expect(cleanNumberPaste("1,250")).toBe("1250");
  });
});

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe("recent searches", () => {
  it("keep the last eight, newest first, each once", () => {
    const store = memoryStore();
    for (let i = 1; i <= 10; i++) rememberSearch("tracking", `YT${i}`, store);
    rememberSearch("tracking", "yt5", store);
    const list = readSearchHistory("tracking", store);
    expect(list).toHaveLength(8);
    expect(list[0]).toBe("yt5");
    expect(list.filter((t) => t.toLowerCase() === "yt5")).toHaveLength(1);
  });

  it("belong to their own box, and can be forgotten", () => {
    const store = memoryStore();
    rememberSearch("tracking", "YT1", store);
    rememberSearch("customer", "WZ-1", store);
    expect(readSearchHistory("customer", store)).toEqual(["WZ-1"]);
    forgetSearchHistory("tracking", store);
    expect(readSearchHistory("tracking", store)).toEqual([]);
    expect(readSearchHistory("customer", store)).toEqual(["WZ-1"]);
  });

  it("survive a damaged value by starting again", () => {
    const store = memoryStore();
    store.setItem(SEARCH_HISTORY_KEY, "{not json");
    expect(readSearchHistory("tracking", store)).toEqual([]);
  });

  it("offer an earlier search that starts the same way", () => {
    expect(suggestFromHistory("yt", ["WZ-1", "YT123"])).toBe("YT123");
    expect(suggestFromHistory("y", ["YT123"])).toBeNull();
    expect(suggestFromHistory("YT123", ["YT123"])).toBeNull();
  });

  it("leave the browser when somebody signs out", () => {
    expect((USER_DATA_KEYS as readonly string[]).includes(SEARCH_HISTORY_KEY)).toBe(true);
  });
});

describe("dates typed the quick way", () => {
  const today = new Date(2026, 6, 28);

  it("t, y, +n and -n count calendar days", () => {
    expect(parseDateShortcut("t", today)).toBe("2026-07-28");
    expect(parseDateShortcut("ئەمڕۆ", today)).toBe("2026-07-28");
    expect(parseDateShortcut("y", today)).toBe("2026-07-27");
    expect(parseDateShortcut("+2", today)).toBe("2026-07-30");
    expect(parseDateShortcut("+5", today)).toBe("2026-08-02");
    expect(parseDateShortcut("-7", today)).toBe("2026-07-21");
  });

  it("read a written date, in any digits, and refuse one that does not exist", () => {
    expect(parseDateShortcut("31/07/2026", today)).toBe("2026-07-31");
    expect(parseDateShortcut("2026-7-5", today)).toBe("2026-07-05");
    expect(parseDateShortcut("٢٨/٠٧/٢٠٢٦", today)).toBe("2026-07-28");
    expect(parseDateShortcut("31/02/2026", today)).toBeNull();
    expect(parseDateShortcut("soon", today)).toBeNull();
  });

  it("are shown the way the app writes dates", () => {
    expect(displayDateValue("2026-07-28")).toBe("28/07/2026");
    expect(toDateInputValue(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("sums typed into a field", () => {
  it("add up, without the floating-point crumbs", () => {
    expect(evaluateSum("4.5 + 3.2")).toBe(7.7);
    expect(evaluateSum("0.1+0.2")).toBe(0.3);
    expect(evaluateSum("2*(3+4)")).toBe(14);
    expect(evaluateSum("10 − 2 × 3")).toBe(4);
    expect(evaluateSum("١٠ + ٥")).toBe(15);
  });

  it("leave anything that is not a sum alone", () => {
    for (const text of ["12", "-5", "5+", "1/0", "alert(1)", "2 +* 3", ""]) {
      expect(evaluateSum(text), text).toBeNull();
    }
  });

  it("measure a carton from its three sides with the shared formula", () => {
    expect(parseDimensions("40 × 50 × 60")).toEqual({ lengthCm: 40, widthCm: 50, heightCm: 60 });
    expect(parseDimensions("40x50")).toBeNull();
    expect(parseDimensions("0x10x10")).toBeNull();
    const m = measureDimensions("40x50x60");
    expect(m?.cbm).toBeCloseTo(0.12, 6);
    expect(m?.volumetricKg).toBeCloseTo(20, 6);
  });
});

describe("a block pasted from a spreadsheet", () => {
  it("comes back as rows of cells", () => {
    expect(parseClipboardGrid("a\tb\r\nc\td\r\n")).toEqual([["a", "b"], ["c", "d"]]);
    expect(parseClipboardGrid('"two\nlines"\tz')).toEqual([["two\nlines", "z"]]);
  });

  it("is told apart from a single value", () => {
    expect(isGridPaste("SF123")).toBe(false);
    expect(isGridPaste("1\n2")).toBe(true);
  });
});

describe("arrow keys in a table of fields", () => {
  const size = { rows: 3, cols: 3 };

  it("change row, and change column only when the field may be left", () => {
    expect(nextCell({ row: 0, col: 0 }, "ArrowDown", size, { rtl: false, canLeave: false })).toEqual({ row: 1, col: 0 });
    expect(nextCell({ row: 0, col: 0 }, "ArrowRight", size, { rtl: false, canLeave: true })).toEqual({ row: 0, col: 1 });
    expect(nextCell({ row: 0, col: 0 }, "ArrowRight", size, { rtl: false, canLeave: false })).toBeNull();
    expect(nextCell({ row: 2, col: 1 }, "ArrowDown", size, { rtl: false, canLeave: true })).toBeNull();
  });

  it("follow the reading direction: in Kurdish, left is the next column", () => {
    expect(nextCell({ row: 0, col: 0 }, "ArrowLeft", size, { rtl: true, canLeave: true })).toEqual({ row: 0, col: 1 });
    expect(nextCell({ row: 0, col: 0 }, "ArrowRight", size, { rtl: true, canLeave: true })).toBeNull();
  });

  it("read the cell a field sits in", () => {
    expect(parseCell("2:3")).toEqual({ row: 2, col: 3 });
    expect(parseCell("x")).toBeNull();
  });
});

describe("messages about a parcel", () => {
  it("find the WhatsApp number in the ways a mobile is written", () => {
    expect(whatsappNumber("0750 123 4567")).toBe("9647501234567");
    expect(whatsappNumber("+964 750 123 4567")).toBe("9647501234567");
    expect(whatsappNumber("00964 750 123 4567")).toBe("9647501234567");
    expect(whatsappNumber("٠٧٥٠١٢٣٤٥٦٧")).toBe("9647501234567");
    expect(whatsappNumber("123")).toBeNull();
    expect(whatsappLink(null, "x")).toBeNull();
    expect(whatsappLink("07501234567", "سڵاو 1")).toBe(`https://wa.me/9647501234567?text=${encodeURIComponent("سڵاو 1")}`);
  });

  it("write the arrival note with the screen's own figures, in 0-9", () => {
    const text = arrivalMessage({ customerName: "Sara", customerCode: "WZ-12", parcels: 3, weightKg: 12.5, amountUsd: 1250 });
    expect(text).toContain("WZ-12");
    expect(text).toContain("3 بارت");
    expect(text).toContain("12.5 kg");
    expect(text).toContain("$1,250.00");
    expect(EASTERN.test(text)).toBe(false);
  });

  it("summarise one parcel and leave out what is empty", () => {
    expect(waybillSummary({ trackingNumber: "YT1", customerCode: "WZ-1", weightKg: "2.5", volumeCbm: 0 })).toBe(
      "تراکینگ: YT1\nکڕیار: WZ-1\nکێش: 2.5 kg",
    );
  });
});

describe("guards and small helpers", () => {
  it("a duplicate entry empties only the fields named", () => {
    const last = { customerCode: "WZ-1", trackingNumber: "YT1", weight: 2, photos: ["a"] };
    expect(duplicateEntry(last, ["trackingNumber", "photos"])).toEqual({ customerCode: "WZ-1", trackingNumber: "", weight: 2, photos: [] });
    expect(last.trackingNumber).toBe("YT1");
  });

  it("one press, one save: a second press while the first is running is ignored", async () => {
    const shield = createShield();
    let release!: () => void;
    const first = shield.run(() => new Promise<string>((resolve) => { release = () => resolve("saved"); }));
    expect(shield.busy).toBe(true);
    expect(await shield.run(() => "again")).toBeUndefined();
    release();
    expect(await first).toBe("saved");
    expect(shield.busy).toBe(false);
    await expect(shield.run(() => Promise.reject(new Error("offline")))).rejects.toThrow("offline");
    expect(await shield.run(() => "after a failure")).toBe("after a failure");
  });

  it("click-to-filter keeps rows like the one clicked, and a second click clears", () => {
    const rows = [{ c: "WZ-1", s: "arrived" }, { c: "WZ-2", s: "arrived" }];
    const read = (row: { c: string; s: string }, field: string) => (field === "customer" ? row.c : row.s);
    const filters = toggleFilter({}, "customer", "WZ-1");
    expect(rows.filter((r) => matchesFilters(r, filters, read))).toHaveLength(1);
    expect(toggleFilter(filters, "customer", "WZ-1")).toEqual({});
  });

  it("privacy mode has its style, and it never blurs a printout", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "index.css"), "utf8");
    expect(css).toContain(":root[data-privacy] [data-private]");
    expect(css).toMatch(/@media print\s*\{\s*:root\[data-privacy\] \[data-private\]\s*\{\s*filter: none;/);
  });
});
