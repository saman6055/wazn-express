import { describe, it, expect } from "vitest";
import {
  correctionNote, correctionWords, editHoldWords, measuresChanged, moneyFactsChanged, ownerChanged, plainNumber,
  storedMeasure, storedVolumeCbm, typedCbmOf, type ParcelMoneyHold,
} from "./parcelCorrection";
import { isRecentEntry, lastOrderEditHref, orderFormExit, LAST_ENTRY_WINDOW_MS } from "./lastEntry";

/**
 * Correcting the last registration (owner, 2026-10-05): the parts with no
 * database in them. The money itself was proved on a real MySQL through the
 * shipping procedures — see server/parcel-correction.test.ts for the figures.
 */
describe("what a correction stores", () => {
  it("stores an empty box as nothing, the way a registration does", () => {
    expect(storedMeasure("")).toBeNull();
    expect(storedMeasure("  ")).toBeNull();
    expect(storedMeasure(undefined)).toBeNull();
    expect(storedMeasure("0")).toBeNull();
    expect(storedMeasure("-3")).toBeNull();
    expect(storedMeasure("abc")).toBeNull();
    expect(storedMeasure(" 1.5 ")).toBe("1.5");
  });

  it("stores the typed volume, else the three sides, else none — to six places", () => {
    expect(storedVolumeCbm("0.8", "50", "100", "100")).toBe("0.800000");
    expect(storedVolumeCbm("", "50", "100", "100")).toBe("0.500000");
    expect(storedVolumeCbm(undefined, "100", "100", "100")).toBe("1.000000");
    // Two sides are not a volume.
    expect(storedVolumeCbm("", "50", "100", "")).toBeNull();
    expect(storedVolumeCbm("", "", "", "")).toBeNull();
  });
});

describe("what goes back into the form", () => {
  it("leaves the CBM box empty when the sides made the volume", () => {
    // Otherwise a corrected side would be ignored in favour of a volume
    // nobody typed.
    expect(typedCbmOf({ lengthCm: "100.00", widthCm: "100.00", heightCm: "100.00", volumeCbm: "1.000000" })).toBe("");
    expect(typedCbmOf({ lengthCm: "50.00", widthCm: "40.00", heightCm: "30.00", volumeCbm: "0.060000" })).toBe("");
  });

  it("puts a typed volume back as it was typed", () => {
    expect(typedCbmOf({ lengthCm: "50.00", widthCm: "100.00", heightCm: "100.00", volumeCbm: "0.800000" })).toBe("0.8");
    expect(typedCbmOf({ volumeCbm: "1.250000" })).toBe("1.25");
    expect(typedCbmOf({ volumeCbm: null })).toBe("");
  });

  it("shows a weight without the zeros its column pads it with", () => {
    expect(plainNumber("1.500")).toBe("1.5");
    expect(plainNumber("15.000")).toBe("15");
    expect(plainNumber(null)).toBe("");
  });
});

describe("whether the price is touched at all", () => {
  const parcel = { customerId: 7, isUnclaimed: false, weightKg: "1.500", lengthCm: null, widthCm: null, heightCm: null, volumeCbm: null };

  it("a description, a category or a photograph does not reprice a parcel", () => {
    // The same figures, written the way the form sends them back.
    expect(moneyFactsChanged(parcel, { ...parcel, weightKg: "1.5" })).toBe(false);
    expect(measuresChanged(parcel, { ...parcel, weightKg: "1.50" })).toBe(false);
  });

  it("a weight, a side or a volume does", () => {
    expect(moneyFactsChanged(parcel, { ...parcel, weightKg: "15" })).toBe(true);
    expect(moneyFactsChanged(parcel, { ...parcel, lengthCm: "40" })).toBe(true);
    expect(moneyFactsChanged(parcel, { ...parcel, volumeCbm: "0.2" })).toBe(true);
    // Emptying the weight is a change too.
    expect(moneyFactsChanged(parcel, { ...parcel, weightKg: null })).toBe(true);
  });

  it("and so does a different owner, no owner, or an owner at last", () => {
    expect(ownerChanged(parcel, { customerId: 8, isUnclaimed: false })).toBe(true);
    expect(ownerChanged(parcel, { customerId: null, isUnclaimed: true })).toBe(true);
    expect(ownerChanged({ customerId: null, isUnclaimed: true }, { customerId: 7, isUnclaimed: false })).toBe(true);
    expect(ownerChanged(parcel, { customerId: 7, isUnclaimed: false })).toBe(false);
  });
});

describe("the line on the customer's statement", () => {
  it("says what was and what is", () => {
    expect(correctionNote("ZZT-1", { weightKg: "15.000" }, { weightKg: "1.5" }))
      .toBe("چاککردنەوەی تۆماری پاکەت ZZT-1 — کێش لە 15 بۆ 1.5 kg");
  });

  it("in words, never with an arrow", () => {
    // In a right-to-left line the two numbers change places and the arrow
    // does not turn round: "15 → 1.5" reads as the weight going from 1.5 to
    // 15, the opposite of what happened.
    const note = correctionNote(
      "ZZT-1",
      { weightKg: "15", lengthCm: "50", widthCm: "40", heightCm: "30", volumeCbm: "0.06" },
      { weightKg: "1.5", lengthCm: "30", widthCm: "20", heightCm: "10", volumeCbm: "0.006" },
      { before: "AZ001", after: "AZ002" },
    );
    expect(note).not.toMatch(/[→←]/);
    expect(note).toContain("کێش لە 15 بۆ 1.5 kg");
    expect(note).toContain("قیاس لە 50×40×30 بۆ 30×20×10 cm");
    expect(note).toContain("قەبارە لە 0.06 بۆ 0.006 m³");
    expect(note).toContain("خاوەن لە AZ001 بۆ AZ002");
  });

  it("names an owner that is missing, and says nothing when nothing moved", () => {
    expect(correctionNote("X", {}, {}, { before: null, after: "AZ002" })).toContain("خاوەن لە بێ خاوەن بۆ AZ002");
    expect(correctionNote("X", { weightKg: "2" }, { weightKg: "2.000" })).toBe("چاککردنەوەی تۆماری پاکەت X");
  });
});

describe("the sentence on the screen", () => {
  it("the owner's own example: $165 was written for a parcel worth $16.50", () => {
    const words = correctionWords({ money: "adjusted", wasUsd: 165, nowUsd: 16.5, chargedUsd: 0, priceUsd: 16.5 });
    expect(words.en).toBe("Corrected. The account said $165.00 for it and now says $16.50 — only the difference was written: $148.50 less.");
    expect(words.ku).toContain("تەنها جیاوازییەکە نووسرا");
    expect(words.ku).toContain("کەم کرایەوە");
  });

  it("says more when the correction raised it", () => {
    const words = correctionWords({ money: "adjusted", wasUsd: 16.5, nowUsd: 22, chargedUsd: 0, priceUsd: 22 });
    expect(words.en).toContain("$5.50 more");
    expect(words.ku).toContain("زیاد کرا");
  });

  it("keeps a dollar figure reading left to right inside a Kurdish or Arabic sentence", () => {
    // Without the isolate "$165.00" is drawn as "165.00$".
    const words = correctionWords({ money: "adjusted", wasUsd: 165, nowUsd: 16.5, chargedUsd: 0, priceUsd: 16.5 });
    expect(words.ku).toContain("\u2066$165.00\u2069");
    expect(words.ar).toContain("\u2066$16.50\u2069");
    expect(words.en).not.toContain("\u2066");
    expect(words.zh).not.toContain("\u2066");
  });

  it("a wrong owner: off one account, onto the other", () => {
    const moved = correctionWords({ money: "moved", wasUsd: 22, nowUsd: 0, chargedUsd: 22, priceUsd: 22 });
    expect(moved.en).toBe("Corrected. $22.00 came off the wrong owner's account, and $22.00 went onto the right one's.");
    const ownerless = correctionWords({ money: "moved", wasUsd: 22, nowUsd: 0, chargedUsd: 0, priceUsd: null });
    expect(ownerless.en).toContain("Nothing was put on anybody else's");
  });

  it("never claims money moved when none did", () => {
    const quiet = correctionWords({ money: "none", wasUsd: 0, nowUsd: 0, chargedUsd: 0, priceUsd: 16.5 });
    expect(quiet.en).toBe("Corrected. The parcel's price: $16.50. No money moved on any account.");
    const bare = correctionWords({ money: "none", wasUsd: 0, nowUsd: 0, chargedUsd: 0, priceUsd: null });
    expect(bare.en).toBe("Corrected. No money moved on any account.");
  });

  it("a parcel charged for the first time by the correction says so", () => {
    const first = correctionWords({ money: "none", wasUsd: 0, nowUsd: 0, chargedUsd: 44, priceUsd: 44 });
    expect(first.en).toBe("Corrected. $44.00 went onto the customer's account.");
  });

  it("every outcome speaks all four languages", () => {
    const outcomes = [
      { money: "restated", wasUsd: 10, nowUsd: 5, chargedUsd: 0, priceUsd: 5 },
      { money: "adjusted", wasUsd: 10, nowUsd: 5, chargedUsd: 0, priceUsd: 5 },
      { money: "moved", wasUsd: 10, nowUsd: 0, chargedUsd: 10, priceUsd: 10 },
      { money: "moved", wasUsd: 10, nowUsd: 0, chargedUsd: 0, priceUsd: null },
      { money: "reversed", wasUsd: 10, nowUsd: 0, chargedUsd: 0, priceUsd: null },
      { money: "reversed", wasUsd: 10, nowUsd: 0, chargedUsd: 4, priceUsd: 4 },
      { money: "none", wasUsd: 0, nowUsd: 0, chargedUsd: 4, priceUsd: 4 },
      { money: "none", wasUsd: 0, nowUsd: 0, chargedUsd: 0, priceUsd: null },
    ] as const;
    for (const outcome of outcomes) {
      const words = correctionWords(outcome);
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(words[lang].length, `${outcome.money} ${lang}`).toBeGreaterThan(10);
        // English digits everywhere: no Eastern Arabic numerals.
        expect(words[lang], `${outcome.money} ${lang}`).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
      }
    }
  });
});

describe("the last thing I entered", () => {
  const now = Date.UTC(2026, 9, 5, 12, 0, 0);

  it("is offered only from this working day", () => {
    expect(isRecentEntry(new Date(now - 60 * 1000), now)).toBe(true);
    expect(isRecentEntry(new Date(now - LAST_ENTRY_WINDOW_MS + 1000), now)).toBe(true);
    expect(isRecentEntry(new Date(now - LAST_ENTRY_WINDOW_MS - 1000), now)).toBe(false);
    expect(isRecentEntry(new Date(now - 7 * 24 * 60 * 60 * 1000), now)).toBe(false);
  });

  it("is not offered for a date that cannot be read", () => {
    expect(isRecentEntry(null, now)).toBe(false);
    expect(isRecentEntry(undefined, now)).toBe(false);
    expect(isRecentEntry("not a date", now)).toBe(false);
    expect(isRecentEntry(new Date(now - 5000).toISOString(), now)).toBe(true);
  });

  it("an order opened from the entry form comes back to the entry form", () => {
    expect(lastOrderEditHref("commission", 41)).toBe("/commission/41/edit?then=new");
    expect(lastOrderEditHref("full_package", 9)).toBe("/full-package/9/edit?then=new");
    expect(orderFormExit("commission", true, "?then=new")).toBe("/commission/new");
    expect(orderFormExit("full_package", true, "?then=new")).toBe("/full-package/new");
  });

  it("every other edit, and every new order, still leaves to the list", () => {
    expect(orderFormExit("commission", true, "")).toBe("/commission");
    expect(orderFormExit("full_package", true, "?then=list")).toBe("/full-package");
    // The mark means nothing on the entry form itself.
    expect(orderFormExit("commission", false, "?then=new")).toBe("/commission");
  });
});

/*
 * Owner, 2026-10-05, shown "$165.00, and under it -$148.50": «نرخی پێشوو لەگەڵ
 * ئیزافەی نوێ بە جیا بچنە ناو بەشی ژمێریاری، ئەوە قەبوڵ کراو نییە».
 */
describe("one parcel, one line", () => {
  it("says what the account said and what it says now - and nothing about a difference", () => {
    const words = correctionWords({ money: "restated", wasUsd: 165, nowUsd: 16.5, chargedUsd: 0, priceUsd: 16.5 });
    expect(words.en).toBe("Corrected. The account said $165.00 for this parcel and now says $16.50.");
    expect(words.ku).toContain("\u2066$165.00\u2069");
    expect(words.ku).toContain("\u2066$16.50\u2069");
    expect(words.ar).toContain("\u2066$16.50\u2069");
    for (const lang of ["ku", "en", "ar", "zh"] as const) {
      expect(words[lang], lang).not.toMatch(/difference|جیاوازی|الفرق|差额/);
      expect(words[lang], lang).not.toContain("148.50");
    }
  });
});

describe("what the parcel list says when the debt could not follow", () => {
  const holds: ParcelMoneyHold[] = [
    { kind: "receipt", settlementNumber: "RCP-20261005-0001", boxCode: "BOX-20261005-001" },
    { kind: "box", boxCode: "BOX-20261005-001" },
    { kind: "order", orderCodes: ["CM-AAAA", "CM-BBBB"] },
    { kind: "batch" },
    { kind: "account", said: "the server's own words" },
  ];

  it("always starts by saying the edit was saved", () => {
    for (const hold of holds) {
      const words = editHoldWords(hold);
      expect(words.ku.startsWith("پاشەکەوت کرا"), hold.kind).toBe(true);
      expect(words.en.startsWith("Saved"), hold.kind).toBe(true);
      expect(words.ar.startsWith("تم الحفظ"), hold.kind).toBe(true);
      expect(words.zh.startsWith("已保存"), hold.kind).toBe(true);
    }
  });

  it("names the receipt, the box and the order", () => {
    const receipt = editHoldWords(holds[0]);
    const box = editHoldWords(holds[1]);
    const order = editHoldWords(holds[2]);
    for (const lang of ["ku", "en", "ar", "zh"] as const) {
      expect(receipt[lang], lang).toContain("RCP-20261005-0001");
      expect(receipt[lang], lang).toContain("BOX-20261005-001");
      expect(box[lang], lang).toContain("BOX-20261005-001");
      expect(order[lang], lang).toContain("CM-AAAA, CM-BBBB");
    }
  });

  it("gives the steps, numbered, in the reader's own language", () => {
    const box = editHoldWords(holds[1]);
    expect(box.ku).toContain("چۆن چارەسەری بکەیت:");
    expect(box.en).toContain("How to fix it:");
    for (const lang of ["ku", "en", "ar", "zh"] as const) expect(box[lang], lang).toContain("\n1. ");
    // The till's own button, by the name it has on the screen.
    expect(box.ku).toContain("«ڕاستکردنەوە»");
  });

  it("passes the server's own words on when the account is not right", () => {
    const words = editHoldWords(holds[4]);
    for (const lang of ["ku", "en", "ar", "zh"] as const) expect(words[lang], lang).toContain("the server's own words");
  });

  it("keeps digits 0-9 in every language", () => {
    for (const hold of holds) {
      const words = editHoldWords(hold);
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(words[lang], `${hold.kind} ${lang}`).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
      }
    }
  });
});
