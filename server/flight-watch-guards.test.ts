import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The watcher writes to twenty-three customers at a time. What has to hold is
 * less about the happy path than about the ways it could go wrong quietly:
 * announcing twice, announcing a departure, or reading nothing for a week and
 * calling that "no flights".
 *
 * Source-text checks, because the service needs a database and a live website
 * to run — and both are absent here.
 */

const ROOT = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

const WATCH = read("server/services/flightWatch.service.ts");
const BOARD = read("server/services/flightBoard.service.ts");

describe("the files this is checking", () => {
  it("found them", () => {
    expect(WATCH.length).toBeGreaterThan(2000);
    expect(BOARD.length).toBeGreaterThan(1000);
  });
});

describe("nobody is told twice", () => {
  it("writes the landing down before announcing it", () => {
    // If the order were reversed, a crash between the messages and the write
    // would send the whole batch's customers the same message again on the
    // next pass.
    const record = WATCH.indexOf("recordBatchFlightArrival");
    const notifyStaff = WATCH.indexOf("notifyStaffAlert", record);
    const notifyCustomer = WATCH.indexOf("createCustomerNotification", record);
    expect(record).toBeGreaterThan(-1);
    expect(notifyStaff).toBeGreaterThan(record);
    expect(notifyCustomer).toBeGreaterThan(record);
  });

  it("stops watching a batch once it has landed", () => {
    // The rule lives in shared/flightWatch.ts; this is the wiring that uses it.
    expect(WATCH).toContain("watchDecision");
    const rule = read("shared/flightWatch.ts");
    expect(rule).toContain('reason: "already-arrived"');
  });

  it("sends one message per customer, not per parcel", () => {
    // A customer with four parcels in a batch gets one message about the
    // shipment, not four about the same plane.
    expect(WATCH).toContain("byCustomer");
    expect(WATCH).toMatch(/byCustomer\.set\(/);
  });
});

describe("a departure is not an arrival", () => {
  it("only ever looks at the arrivals half of the board", () => {
    expect(WATCH).toContain("result.board.arrivals");
    expect(WATCH).not.toContain("board.departures");
  });
});

describe("silence is reported, not believed", () => {
  it("treats an empty parse as a failure rather than as no flights", () => {
    // The airport's page is HTML nobody promised us. If it changes, every
    // batch looks like it has not landed — which is indistinguishable from
    // the watcher being switched off, unless it says so.
    expect(BOARD).toContain("no rows parsed");
    expect(BOARD).toMatch(/ok:\s*false/);
  });

  it("alarms the office after repeated failures", () => {
    expect(WATCH).toContain("FAILURES_BEFORE_ALARM");
    expect(WATCH).toContain("flight_watch_broken");
  });
});

describe("the shipment moves to customs the next morning", () => {
  it("is a separate step from the landing", () => {
    // A plane landing at 23:10 must not put the batch in customs at 23:30.
    expect(WATCH).toContain("customsShouldStart");
    expect(WATCH).toContain("moveLandedBatchesToCustoms");
  });

  it("never drags a shipment backwards", () => {
    // A batch already at the depot or delivered is left where it is.
    expect(WATCH).toMatch(/BEFORE_CUSTOMS\s*=\s*\[/);
    expect(WATCH).toContain('BEFORE_CUSTOMS.includes(String(batch.status))');
  });
});

describe("the airport is asked politely", () => {
  it("names us in the User-Agent", () => {
    // Anyone reading their logs can see who this is and why. A scraper that
    // hides is a scraper nobody can ask to stop.
    expect(BOARD).toContain("WaznExpress");
  });

  it("asks a few times a day, not constantly", () => {
    expect(WATCH).toMatch(/EVERY_MS\s*=\s*6 \* 60 \* 60 \* 1000/);
  });

  it("asks once per airline rather than once per shipment", () => {
    expect(WATCH).toContain("new Set(watching.map");
  });

  it("gives up rather than hanging a background job", () => {
    expect(BOARD).toContain("AbortController");
    expect(BOARD).toContain("TIMEOUT_MS");
  });
});
