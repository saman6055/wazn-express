import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The owner's rule: every number in every language — money, weight, dates,
 * phones, codes, counts — is written with 0-9. Never ٠-٩, never ۰-۹.
 *
 * Three ways it broke, each pinned here:
 *   1. digits typed straight into text (step numbers, "٢٤ سەعاتی", "م٣");
 *   2. toLocaleString() with no locale, which follows the phone — an
 *      Arabic-locale phone printed ١٬٢٥٠ beside Latin figures elsewhere;
 *   3. a locale that writes Eastern digits (ar-IQ, ckb) asked for by name —
 *      the staff header clock on every page was one.
 */
const ROOT = path.resolve(__dirname, "../..");
const EASTERN = /[٠-٩۰-۹]/;

// They accept Eastern digits on purpose: a customer typing ٠٧٥٠ becomes 0750.
const CONVERTERS = new Set(["shared/phone.ts", "server/routers/schemas.ts", "client/src/pages/CustomerLogin.tsx"]);
// Being worked on by another session; named so the rule does not skip them silently.
const OTHER_SESSION = new Set([
  "client/src/pages/Finance.tsx",
  "client/src/pages/CustomerFinance.tsx",
  "client/src/components/delivery/BoxSettlementPanel.tsx",
  "client/src/components/delivery/BoxDetailPanel.tsx",
  "client/src/components/delivery/BoxTable.tsx",
  "client/src/components/delivery/QuickSettleDialog.tsx",
  "client/src/components/delivery/SettlementStates.tsx",
  "client/src/components/delivery/BoxSegmentBar.tsx",
  "client/src/components/delivery/CustomerDeliveryScanner.tsx",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") walk(p, out);
    } else if (/\.(ts|tsx|json)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

const FILES = ["client/src", "server", "shared"]
  .flatMap((root) => walk(path.join(ROOT, root)))
  .map((file) => ({ rel: path.relative(ROOT, file).replace(/\\/g, "/"), file }))
  .filter(({ rel }) => !OTHER_SESSION.has(rel));

function offending(test: (line: string) => boolean, files = FILES, skipComments = false): string[] {
  const out: string[] = [];
  for (const { rel, file } of files) {
    fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      // A comment that records what the code used to do is history, not a call.
      if (skipComments && /^\s*(\*|\/\/|\/\*)/.test(line)) return;
      if (test(line)) out.push(`${rel}:${i + 1}`);
    });
  }
  return out;
}

describe("every number is written with 0-9", () => {
  it("no source or translation text carries Eastern Arabic or Persian digits", () => {
    const files = FILES.filter(({ rel }) => !CONVERTERS.has(rel));
    expect(offending((line) => EASTERN.test(line), files)).toEqual([]);
  });

  it("no number or date is formatted in the device's own locale", () => {
    const code = FILES.filter(({ rel }) => /\.(ts|tsx)$/.test(rel));
    expect(offending((line) => /\.toLocale(Date|Time)?String\((undefined)?[,)]/.test(line), code, true)).toEqual([]);
  });

  it("a locale that writes Eastern digits always asks for Latin ones", () => {
    const code = FILES.filter(({ rel }) => /\.(ts|tsx)$/.test(rel));
    expect(
      offending(
        (line) =>
          /["'](ar-IQ|ar-SA|ar-EG|ckb|ckb-IQ|fa-IR|ku-IQ|ku)["']/.test(line) &&
          /toLocale|Intl\.|locale|LOCALE/.test(line) &&
          !line.includes("u-nu-latn"),
        code,
        true,
      ),
    ).toEqual([]);
  });
});

describe("the locales the app uses really give Latin digits", () => {
  const date = new Date(Date.UTC(2026, 6, 28, 14, 5, 9));

  it("plain calls: en-GB is 1,234.5 and 28/07/2026", () => {
    expect((1234.5).toLocaleString("en-GB")).toBe("1,234.5");
    expect(date.toLocaleDateString("en-GB", { timeZone: "UTC" })).toBe("28/07/2026");
  });

  it("Kurdish and Arabic keep their words and lose their digits", () => {
    for (const locale of ["ckb-IQ-u-nu-latn", "ckb-u-nu-latn", "ar-IQ-u-nu-latn", "ar-u-nu-latn"]) {
      const number = new Intl.NumberFormat(locale).format(1234567.5);
      const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
      expect(EASTERN.test(number), `${locale} number ${number}`).toBe(false);
      expect(EASTERN.test(day), `${locale} date ${day}`).toBe(false);
      expect(day, locale).toContain("2026");
    }
  });
});
