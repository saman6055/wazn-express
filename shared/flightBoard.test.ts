import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { parseFlightBoard } from "./flightBoard";
import { findLanded } from "./flightWatch";

/**
 * Tested against a saved copy of the real response, taken from the airport on
 * 16 August 2026. A parser written against an imagined shape is a parser that
 * works until the first day it matters.
 *
 * If the airport changes its markup, this test keeps passing — the fixture is
 * frozen. That is deliberate: this proves the parser reads *this* shape. The
 * watcher itself reports silence as a fault, which is what catches a change on
 * the day it happens.
 */

const FIXTURE = fs.readFileSync(
  path.resolve(__dirname, "__fixtures__/eia-flights.html"),
  "utf8",
);

describe("the saved response", () => {
  it("is the real thing", () => {
    expect(FIXTURE.length).toBeGreaterThan(5000);
    expect(FIXTURE).toContain("tabContent Arrivals");
    expect(FIXTURE).toContain("tabContent Departures");
  });
});

describe("reading the board", () => {
  const board = parseFlightBoard(FIXTURE);

  it("finds the arrivals", () => {
    expect(board.arrivals.map((r) => r.flight)).toEqual(["TK 6896", "TK 6898", "TK 6894"]);
  });

  it("keeps departures out of the arrivals", () => {
    // The whole point of splitting: a departing TK 6895 must never be read as
    // a landing.
    expect(board.departures.map((r) => r.flight)).toEqual(["TK 6897", "TK 6899", "TK 6895"]);
    for (const row of board.arrivals) {
      expect(row.status.toLowerCase(), row.flight).not.toBe("departed");
    }
  });

  it("drops the header row rather than reading it as a flight", () => {
    // The first block in each section is the column headings.
    for (const row of [...board.arrivals, ...board.departures]) {
      expect(row.flight).not.toMatch(/^(Flight|Scheduled|Estimated)$/i);
    }
  });

  it("reads every field off a row", () => {
    const first = board.arrivals[0];
    expect(first).toMatchObject({
      flight: "TK 6896",
      status: "Arrived",
      scheduled: "10:30",
      estimated: "10:32",
      airline: "Turkish Airlines",
    });
    expect(first.from).toContain("Istanbul");
  });

  it("hands the watcher something it can match", () => {
    // The two halves meeting: the parser's rows, the watcher's rule.
    expect(findLanded(board.arrivals, "TK6896")?.flight).toBe("TK 6896");
    expect(findLanded(board.arrivals, "tk 6894")?.flight).toBe("TK 6894");
    // A departure is not an arrival, whatever its status word says.
    expect(findLanded(board.arrivals, "TK6895")).toBeNull();
  });
});

describe("when the page is not what we expect", () => {
  it("returns nothing rather than throwing", () => {
    // Empty is a fault the caller must report — but a crashed background job
    // reports nothing at all, so it must not crash.
    for (const junk of ["", "<html><body>Down for maintenance</body></html>", "<!-- -->"]) {
      expect(parseFlightBoard(junk)).toEqual({ arrivals: [], departures: [] });
    }
  });

  it("survives an error page where the flights should be", () => {
    const errorPage = "<HTML><HEAD><TITLE>Error</TITLE></HEAD><BODY>An error has occured</BODY></HTML>";
    expect(parseFlightBoard(errorPage).arrivals).toEqual([]);
  });

  it("reads arrivals even if only that section came back", () => {
    const half = FIXTURE.slice(0, FIXTURE.search(/tabContent\s+Departures/i));
    const board = parseFlightBoard(half);
    expect(board.arrivals.length).toBe(3);
    expect(board.departures).toEqual([]);
  });
});
