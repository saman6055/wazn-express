import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Which shipments were handled in China, and which in Erbil.
 *
 * Some customers' goods never reach the China warehouse: they arrive in
 * Erbil, and are registered, batched and boxed there inside two days. The
 * system handles both paths identically — which is right — but afterwards
 * nothing said which was which.
 *
 * The location lives on the staff account and is STAMPED onto whatever they
 * create. That word is the whole design. Looking it up from the user when a
 * report is run would be simpler and wrong: move somebody from Guangzhou to
 * Erbil next year and every batch they ever made would silently change its
 * story. These tests exist because that shortcut is the obvious one to take.
 *
 * Note the deliberate contrast with archiving, which is derived rather than
 * stored: a batch's status already records that it finished, so a second
 * column would be a second copy of the same fact. Nothing else records where
 * a person was standing, and the source of that answer changes over time —
 * so this one has to be written down.
 */

const ROOT = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

function slice(src: string, startMarker: string, endMarker: string, label: string): string {
  const start = src.indexOf(startMarker);
  expect(start, `${label}: start marker "${startMarker}" not found`).toBeGreaterThan(-1);
  const end = src.indexOf(endMarker, start + startMarker.length);
  expect(end, `${label}: end marker "${endMarker}" not found after start`).toBeGreaterThan(start);
  const body = src.slice(start, end);
  expect(body.length, `${label}: slice is empty`).toBeGreaterThan(50);
  return body;
}

const migrations = read("server/_core/migrations.ts");
const batchRouter = read("server/routers/batches.router.ts");

describe("a staff account carries where its owner works", () => {
  it("has somewhere to record it", () => {
    for (const column of ["users.workCountryId", "users.workCity"]) {
      expect(migrations, `${column} must be added`).toContain(column);
    }
  });

  it("is asked for when the account is made", () => {
    // The marker is the role enum, which grows whenever a role is added — it
    // did when "auditor" arrived. Anchor on the stable head of the line so the
    // next role does not break a test about work locations.
    const create = slice(
      read("server/routers/auth.router.ts"),
      "role: z.enum([\"admin\", \"employee\", \"accountant\"",
      ".mutation(",
      "registerStaff input"
    );
    expect(create).toContain("workCountryId");
    expect(create).toContain("workCity");
  });

  it("can be changed later without touching what was already stamped", () => {
    const admin = read("server/db/admin.db.ts");
    expect(admin).toContain("setUserWorkLocation");
    const setter = slice(
      admin,
      "export async function setUserWorkLocation",
      "\n}\n",
      "setUserWorkLocation"
    );
    // It updates the person, and nothing else. Rewriting old batches to match
    // is exactly what must never happen.
    expect(setter).toContain("update(users)");
    expect(setter).not.toContain("batches");
    expect(setter).not.toContain("packages");
  });
});

describe("the location is stamped, not looked up later", () => {
  it("is copied onto a batch when it is created", () => {
    const create = slice(batchRouter, "create: staffProcedure", "delete: adminProcedure", "batches.create");
    expect(create, "the creator's location must be read").toContain("getUserWorkLocation");
    expect(create, "and written onto the batch").toContain("createdInCountryId");
    expect(create).toContain("createdInCity");
  });

  it("is copied onto a parcel however it was registered", () => {
    // Two ways in — the register form and the counter scanner — and both
    // have to stamp, or half the parcels have no location.
    for (const file of ["server/routers/packages.router.ts", "server/routers/scanning.router.ts"]) {
      const src = read(file);
      expect(src, `${file} must read the registrar's location`).toContain("getUserWorkLocation");
      expect(src, `${file} must stamp it`).toContain("registeredInCountryId");
    }
  });

  it("stores the city as text beside the country id", () => {
    // The id is for grouping a report; the text is what the row shows, and it
    // survives the country row being renamed years later.
    for (const column of [
      "batches.createdInCountryId",
      "batches.createdInCity",
      "packages.registeredInCountryId",
      "packages.registeredInCity",
    ]) {
      expect(migrations, `${column} must be added`).toContain(column);
    }
  });

  it("carries the location out to the list that displays it", () => {
    const listQuery = slice(
      read("server/db/batches.db.ts"),
      "export async function getAllBatches",
      "export async function getBatchById",
      "getAllBatches"
    );
    expect(listQuery).toContain("createdInCity: batches.createdInCity");
    expect(read("client/src/pages/Batches.tsx")).toContain("batch.createdInCity");
  });
});

describe("what happens to everything created before this existed", () => {
  it("is filled in once, from where its creator works", () => {
    // The only honest source for a record that predates the stamp — and the
    // rule the office was going to apply by hand anyway.
    for (const backfill of [
      "backfill.batches.createdInLocation",
      "backfill.packages.registeredInLocation",
    ]) {
      expect(migrations, `${backfill} must run`).toContain(backfill);
    }
  });

  it("never overwrites a location that was really stamped", () => {
    // Migrations run on every deploy. A backfill without this guard would
    // rewrite genuine history each time somebody changed office.
    const backfill = slice(
      migrations,
      "backfill.batches.createdInLocation",
      "backfill.packages.registeredInLocation",
      "batch backfill"
    );
    expect(backfill).toContain("createdInCountryId IS NULL");
  });
});
