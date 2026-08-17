import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  CHECKS,
  checkDefinition,
  headline,
  rankResults,
  summarise,
  type CheckId,
  type CheckResult,
} from "./auditSweep";

const result = (id: CheckId, status: CheckResult["status"], count = 0): CheckResult => ({ id, status, count });

describe("the catalogue", () => {
  it("has no duplicate ids", () => {
    const ids = CHECKS.map((c) => c.id);
    expect(new Set(ids).size, "two checks share an id, so one overwrites the other").toBe(ids.length);
  });

  it("says what every check means, in every language", () => {
    // A blank meaning turns a count into a number with no story. The reader
    // then has to guess whether 14 is a crisis or a Tuesday.
    for (const check of CHECKS) {
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(check.title[lang], `${check.id} has no ${lang} title`).toBeTruthy();
        expect(check.meaning[lang], `${check.id} has no ${lang} meaning`).toBeTruthy();
      }
    }
  });

  it("keeps critical for money that contradicts itself", () => {
    // Severity is the only thing telling the reader what to open first. If
    // everything were critical, nothing would be.
    const critical = CHECKS.filter((c) => c.severity === "critical").map((c) => c.id);
    expect(critical).toContain("account_balance_drift");
    expect(critical).toContain("invoice_total_mismatch");
    expect(critical).not.toContain("batch_overdue");
  });

  it("can be looked up by id", () => {
    expect(checkDefinition("batch_overdue")?.severity).toBe("warning");
    expect(checkDefinition("nonsense" as CheckId)).toBeUndefined();
  });
});

describe("ranking what came back", () => {
  it("puts a broken check above everything", () => {
    // Not knowing whether the books balance is not a mild state — the reader
    // cannot tell what it is hiding, so it outranks the things that are known.
    const ranked = rankResults([
      result("batch_overdue", "found", 9),
      result("account_balance_drift", "failed"),
      result("invoice_total_mismatch", "found", 2),
    ]);
    expect(ranked[0].id).toBe("account_balance_drift");
  });

  it("orders the rest by how much they matter, then by size", () => {
    const ranked = rankResults([
      result("unclaimed_no_request", "found", 40),
      result("batch_overdue", "found", 3),
      result("invoice_total_mismatch", "found", 1),
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["invoice_total_mismatch", "batch_overdue", "unclaimed_no_request"]);
  });

  it("puts the clean ones last", () => {
    const ranked = rankResults([
      result("invoice_total_mismatch", "clean"),
      result("unclaimed_no_request", "found", 2),
    ]);
    expect(ranked[0].id).toBe("unclaimed_no_request");
  });

  it("does not disturb the caller's array", () => {
    const input = [result("batch_overdue", "found", 1), result("invoice_total_mismatch", "found", 1)];
    rankResults(input);
    expect(input[0].id).toBe("batch_overdue");
  });
});

describe("the summary", () => {
  it("counts each severity only when something was found", () => {
    const summary = summarise([
      result("invoice_total_mismatch", "found", 2),
      result("account_balance_drift", "clean"),
      result("batch_overdue", "found", 5),
      result("unclaimed_no_request", "found", 30),
      result("cash_account_drift", "failed"),
    ]);

    expect(summary.critical).toBe(1);
    expect(summary.warning).toBe(1);
    expect(summary.info).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.clean).toBe(1);
  });

  it("is only all-clear when every single check ran and passed", () => {
    expect(summarise([result("invoice_total_mismatch", "clean")]).allClear).toBe(true);
    expect(
      summarise([result("invoice_total_mismatch", "clean"), result("batch_overdue", "failed")]).allClear,
    ).toBe(false);
    expect(
      summarise([result("invoice_total_mismatch", "clean"), result("batch_overdue", "found", 1)]).allClear,
    ).toBe(false);
  });

  it("is not all-clear when nothing ran at all", () => {
    // An empty sweep is a sweep that did not happen. Saying "all clear"
    // would be the most confident possible way to report nothing.
    expect(summarise([]).allClear).toBe(false);
  });
});

describe("the headline", () => {
  it("admits an incomplete sweep before anything else", () => {
    // Even with criticals present, "some checks did not run" comes first: a
    // sweep that could not see everything must not rank what it did see.
    const line = headline(summarise([result("invoice_total_mismatch", "found", 3), result("batch_overdue", "failed")]));
    expect(line.en).toContain("incomplete");
  });

  it("leads with the criticals when everything ran", () => {
    // Counted in checks, not rows: two kinds of thing are wrong here, across
    // five records. The list below the headline carries the record counts.
    const line = headline(
      summarise([
        result("invoice_total_mismatch", "found", 3),
        result("account_balance_drift", "found", 2),
        result("batch_overdue", "found", 1),
      ]),
    );
    expect(line.en).toBe("2 things need looking at today");
  });

  it("does not say '1 things'", () => {
    const line = headline(summarise([result("invoice_total_mismatch", "found", 3)]));
    expect(line.en).toBe("1 thing needs looking at today");
  });

  it("says nothing is broken when only work is stuck", () => {
    const line = headline(summarise([result("batch_overdue", "found", 4)]));
    expect(line.en).toContain("Nothing is broken");
  });

  it("says so plainly when everything passed", () => {
    const line = headline(summarise([result("invoice_total_mismatch", "clean"), result("batch_overdue", "clean")]));
    expect(line.en).toContain("clean");
  });

  it("has every language filled in, whatever the state", () => {
    const states = [
      [result("batch_overdue", "failed")],
      [result("invoice_total_mismatch", "found", 1)],
      [result("batch_overdue", "found", 1)],
      [result("unclaimed_no_request", "found", 1)],
      [result("invoice_total_mismatch", "clean")],
      [] as CheckResult[],
    ];

    for (const state of states) {
      const line = headline(summarise(state));
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(line[lang], `${JSON.stringify(state)} has no ${lang}`).toBeTruthy();
      }
    }
  });
});

describe("the catalogue and the queries stay in step", () => {
  // The catalogue says what is checked; the service holds the SQL. They are
  // separate files on purpose — one is read by the report, the other by the
  // database — but a check declared with no query would appear in every
  // report as permanently clean, having never run at all. That is the exact
  // failure this whole design is meant to make impossible.
  const service = fs
    .readFileSync(path.join(__dirname, "..", "server/services/auditSweep.service.ts"), "utf8")
    .replace(/\r\n/g, "\n");

  it("gives every declared check a query", () => {
    const missing = CHECKS.filter((check) => !new RegExp(`\n  ${check.id}: \``).test(service)).map((c) => c.id);

    expect(missing, "declared in the catalogue, never actually queried").toEqual([]);
  });

  it("never lets a query write", () => {
    // The auditor reports; somebody else decides. A sweep that corrected what
    // it found would be changing the books with nobody's name on it.
    const body = service.slice(service.indexOf("const QUERIES"), service.indexOf("async function runCheck"));

    for (const forbidden of ["INSERT", "UPDATE ", "DELETE", "DROP", "ALTER", "TRUNCATE", "REPLACE INTO"]) {
      expect(body.toUpperCase(), `a sweep query contains ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("caps every row-returning query", () => {
    // An unbounded audit query on a busy table is how a read-only account
    // takes the system down at eight in the morning.
    const body = service.slice(service.indexOf("const QUERIES"), service.indexOf("async function runCheck"));
    const uncapped = body
      .split(/\n  (?=[a-z_]+: `)/)
      .slice(1)
      .filter((block) => !block.includes("LIMIT") && !block.includes("HAVING"));

    expect(uncapped.map((b) => b.slice(0, b.indexOf(":"))), "no LIMIT on this query").toEqual([]);
  });
});
