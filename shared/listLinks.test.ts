import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  ACTIVE_BATCH_STATUSES,
  BATCH_STATUSES,
  FILTER_LABEL,
  batchMatchesStatus,
  batchesHref,
  customersHref,
  financeHref,
  packagesHref,
  readBatchesLink,
  readCustomersLink,
  readFinanceLink,
  readPackagesLink,
  withinDaysLabel,
} from "./listLinks";

/**
 * The point of this module is that a link built on the dashboard is
 * understood by the page it opens. So every test here is a round trip: build
 * it, read it back, get the same filter.
 *
 * A link to an unfiltered list is worse than no link — it looks like an
 * answer — so the failure mode being guarded against is a parameter that is
 * written and then silently ignored.
 */

describe("customers", () => {
  it("survives the round trip", () => {
    const link = { status: "active" as const, service: "commission" as const, createdWithin: 7 };
    expect(readCustomersLink(customersHref(link))).toMatchObject(link);
  });

  it("leaves out what is not being filtered", () => {
    expect(customersHref()).toBe("/customers");
    expect(customersHref({ status: "all" })).toBe("/customers");
  });

  it("ignores a value the page has no filter for", () => {
    // A stale or hand-typed URL must open the list, not an empty one.
    expect(readCustomersLink("?status=purple").status).toBeUndefined();
    expect(readCustomersLink("?service=nonsense").service).toBeUndefined();
  });

  it("treats a nonsense day count as no filter at all", () => {
    // Not as a filter that matches nothing, which would read as "you have no
    // customers" rather than "that link was wrong".
    for (const bad of ["abc", "-3", "0", ""]) {
      expect(readCustomersLink(`?createdWithin=${bad}`).createdWithin, bad).toBeUndefined();
    }
    expect(readCustomersLink("?createdWithin=7").createdWithin).toBe(7);
  });

  it("carries a search term through, spaces and all", () => {
    const href = customersHref({ search: "ئاکۆ محمد" });
    expect(readCustomersLink(href).search).toBe("ئاکۆ محمد");
  });
});

describe("parcels", () => {
  it("points at the table, not the summary page", () => {
    // /packages is the dashboard for parcels; the rows are at /packages/all.
    expect(packagesHref({ tab: "delivered" })).toBe("/packages/all?tab=delivered");
  });

  it("survives the round trip", () => {
    const link = { tab: "no_batch" as const, search: "JT12345", batch: "39" };
    expect(readPackagesLink(packagesHref(link))).toMatchObject(link);
  });

  it("only accepts tabs the table actually has", () => {
    expect(readPackagesLink("?tab=delivered").tab).toBe("delivered");
    expect(readPackagesLink("?tab=archived").tab).toBeUndefined();
  });
});

describe("shipments", () => {
  it("survives the round trip", () => {
    expect(readBatchesLink(batchesHref({ status: "active" })).status).toBe("active");
    expect(readBatchesLink(batchesHref({ status: "customs" })).status).toBe("customs");
    expect(readBatchesLink(batchesHref({ type: "sea" })).type).toBe("sea");
  });

  it("knows active means every stage before handover", () => {
    // The dashboard counts them this way; a link that says active has to mean
    // the same set or the count and the list disagree.
    for (const status of ACTIVE_BATCH_STATUSES) {
      expect(batchMatchesStatus(status, "active"), status).toBe(true);
    }
    expect(batchMatchesStatus("delivered", "active")).toBe(false);
    expect(batchMatchesStatus("closed", "active")).toBe(false);
  });

  it("means exactly what the dashboard counts", () => {
    // The figure and the list it opens must agree. This reads the server
    // query rather than trusting a comment: a status added to one side and
    // not the other is a count of 4 opening a list of 7.
    const src = fs
      .readFileSync(path.resolve(__dirname, "../server/db/reports.db.ts"), "utf8")
      .replace(/\r\n/g, "\n");
    const start = src.indexOf("export async function getDashboardActiveBatches");
    expect(start, "getDashboardActiveBatches not found").toBeGreaterThan(-1);
    const fn = src.slice(start, src.indexOf("\n}\n", start));
    expect(fn.length).toBeGreaterThan(200);
    expect(fn).toContain("ACTIVE_BATCH_STATUSES");
  });

  it("does not claim a finished shipment is active", () => {
    for (const finished of ["delivered", "closed"] as const) {
      expect(batchMatchesStatus(finished, "active"), finished).toBe(false);
    }
  });

  it("active and finished together are every status there is", () => {
    // Active means everything before hand-over, so a new status added to
    // neither set would vanish from the figure without anybody noticing —
    // which is how customs and at_depot went uncounted for as long as they
    // did.
    const finished = ["delivered", "closed"];
    expect([...ACTIVE_BATCH_STATUSES, ...finished].sort()).toEqual([...BATCH_STATUSES].sort());
  });

  it("matches a single status exactly", () => {
    expect(batchMatchesStatus("customs", "customs")).toBe(true);
    expect(batchMatchesStatus("arrived", "customs")).toBe(false);
  });

  it("lets everything through when nothing is asked for", () => {
    for (const status of BATCH_STATUSES) {
      expect(batchMatchesStatus(status, "all"), status).toBe(true);
      expect(batchMatchesStatus(status, undefined), status).toBe(true);
    }
    expect(batchMatchesStatus(null, "all")).toBe(true);
  });
});

describe("money", () => {
  it("survives the round trip", () => {
    expect(readFinanceLink(financeHref({ tab: "payments" })).tab).toBe("payments");
  });

  it("only accepts tabs the page has", () => {
    expect(readFinanceLink("?tab=overview").tab).toBe("overview");
    expect(readFinanceLink("?tab=taxes").tab).toBeUndefined();
  });
});

describe("reading a link however it arrives", () => {
  it("accepts a full path, a query string, or neither", () => {
    expect(readBatchesLink("/batches?status=active").status).toBe("active");
    expect(readBatchesLink("?status=active").status).toBe("active");
    expect(readBatchesLink("status=active").status).toBe("active");
    expect(readBatchesLink("").status).toBeUndefined();
  });
});

describe("what the page tells the reader", () => {
  it("names every filter value a link can carry", () => {
    // A list that arrives short with no explanation reads as missing data.
    const named = [
      ...BATCH_STATUSES.filter((s) => s !== "closed" || true),
      "no_batch", "no_tracking", "pending_delivery",
      "air_regular", "air_irregular", "sea",
      "full_package", "commission", "self_order",
      "active", "inactive",
    ];
    for (const value of named) {
      const label = FILTER_LABEL[value];
      expect(label, `no label for ${value}`).toBeTruthy();
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(label[lang]?.trim(), `${value}.${lang}`).toBeTruthy();
      }
    }
  });

  it("says the day count in every language", () => {
    const label = withinDaysLabel(7);
    for (const lang of ["ku", "en", "ar", "zh"] as const) {
      expect(label[lang], lang).toContain("7");
    }
  });
});
