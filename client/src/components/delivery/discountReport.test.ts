import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { DISCOUNT_REASONS } from "@shared/boxSettlement";

/**
 * The report the owner asked for by name: how much have we discounted this
 * month, this year, on this batch, to this customer code, and for what.
 *
 * It is only answerable because a reason is compulsory at the counter and
 * every discount stays attached to a parcel. This guards the reading end of
 * that bargain.
 */

const HERE = __dirname;
const report = fs.readFileSync(path.join(HERE, "DiscountReport.tsx"), "utf8").replace(/\r\n/g, "\n");
const page = fs.readFileSync(
  path.join(HERE, "..", "..", "pages", "CustomerDeliveryScanner.tsx"), "utf8",
).replace(/\r\n/g, "\n");

describe("every cut the owner named is on the screen", () => {
  it("shows the total given away", () => {
    expect(report).toContain("data.totalUsd");
  });

  it("breaks it down by reason, month, customer code and batch", () => {
    for (const cut of ["byReason", "byMonth", "byCustomer", "byBatch"]) {
      expect(report, `${cut} is not rendered`).toContain(`data.${cut}`);
    }
  });

  it("names every reason a discount can carry", () => {
    // A reason with no label renders as a raw enum value, which is how a
    // report starts being ignored.
    for (const reason of DISCOUNT_REASONS) {
      expect(report, `${reason} has no label`).toContain(`${reason}:`);
    }
  });

  it("falls back rather than leaving a hole for an unknown reason", () => {
    expect(report).toContain("?? REASON_LABELS.other");
  });
});

describe("it does not cost anything until somebody wants it", () => {
  it("fetches nothing until it is opened", () => {
    // The delivery screen is open all day to do other things; a report that
    // queries on every visit is a tax on all of them.
    expect(report).toContain("{ enabled: open }");
  });

  it("opens on this month rather than on everything ever", () => {
    expect(report).toContain("function monthStart()");
    expect(report).toContain("useState(monthStart())");
  });

  it("still allows the whole history", () => {
    expect(report).toContain('ku: "هەموو کاتێک"');
  });
});

describe("it reads and never writes", () => {
  it("uses only the query, never a mutation", () => {
    expect(report).toContain("trpc.deliveryBox.discountReport.useQuery");
    expect(report, "a report must not write anything").not.toContain("useMutation");
  });
});

describe("all four languages, and numbers that read correctly", () => {
  it("gives every label all four", () => {
    const starts = [...report.matchAll(/\bku:\s/g)].map((m) => m.index!);
    expect(starts.length, "no translated labels found").toBeGreaterThan(8);
    for (let i = 0; i < starts.length; i++) {
      const next = i + 1 < starts.length ? starts[i + 1]! : report.length;
      const text = report.slice(starts[i]!, next);
      for (const lang of ["en:", "ar:", "zh:"]) {
        expect(text.includes(lang), `a label is missing ${lang} — ${text.slice(0, 60)}`).toBe(true);
      }
    }
  });

  it("prints codes and months left to right", () => {
    // AZ047 and 2026-08 are not words; RTL would reorder them.
    expect(report).toContain('dir={ltr ? "ltr" : undefined}');
  });

  it("lines its figures up in a column", () => {
    expect(report).toContain("tabular-nums");
  });
});

describe("it sits on the delivery screen, where the money left", () => {
  it("is mounted there", () => {
    expect(page).toContain("import { DiscountReport }");
    expect(page).toContain("<DiscountReport />");
  });
});
