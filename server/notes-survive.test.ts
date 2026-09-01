import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A note is written once and needed later, by somebody else.
 *
 * Two faults, reported together, and they are the same fault twice: a note
 * that reaches nobody is a note nobody will bother writing again.
 *
 *   Written on a batch and gone. The edit dialog is filled from a row of the
 *   list query, and that query never selected `notes` — so the field opened
 *   empty, and an operator who had typed something careful found it missing
 *   the next time they looked.
 *
 *   Written on an order and never seen. It reached the scanning screens in
 *   the payload and not one of them drew it, so the only person who ever read
 *   a note was the person who wrote it.
 */

const ROOT = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

describe("a note written on a batch comes back", () => {
  const batchesDb = read("server/db/batches.db.ts");

  it("is returned by the query the edit dialog is filled from", () => {
    const list = batchesDb.slice(
      batchesDb.indexOf("export async function getAllBatches"),
      batchesDb.indexOf("export async function getBatchById"),
    );
    expect(list).toContain("notes: batches.notes");
  });

  it("and so is everything else that dialog writes back", () => {
    // Three more went the same way and nobody had noticed yet.
    const list = batchesDb.slice(
      batchesDb.indexOf("export async function getAllBatches"),
      batchesDb.indexOf("export async function getBatchById"),
    );
    for (const field of ["shippingCost", "chargedWeightKg", "chargedCbm"]) {
      expect(list, `${field} is written back by the form and not returned`)
        .toContain(`${field}: batches.${field}`);
    }
  });
});

describe("a note written on an order follows it", () => {
  it("travels on the arrival manifest, by both routes to an order", () => {
    // Which route a parcel happens to be linked by must not decide whether
    // the note is seen.
    const packagesDb = read("server/db/packages.db.ts");
    const manifest = packagesDb.slice(
      packagesDb.indexOf("export async function getBatchManifest"),
      packagesDb.indexOf("export async function getBatchManifest") + 4000,
    );
    expect(manifest.match(/notes: fullPackageOrders\.notes/g)?.length,
      "both the link table and the tracking lookup must carry it").toBe(2);
    expect(manifest).toContain("note: (order as any)?.notes ?? null");
  });

  it("travels onto the items of a box", () => {
    const boxesDb = read("server/db/deliveryBoxes.db.ts");
    expect(boxesDb).toContain("const orderNote =");
    expect(boxesDb).toContain("orderNote: string | null;");
    // Every return path of the mapper, or which kind of item it is decides
    // whether the note survives.
    const mapper = boxesDb.slice(boxesDb.indexOf("return items.map((item): BoxItemWithAdvance"));
    expect(mapper.match(/orderNote \}/g)?.length, "a return path drops it").toBe(3);
  });
});

describe("and it is drawn on every screen that meets the parcel", () => {
  const NOTE = "@/components/scanner/OrderNote";

  it("quick register", () => {
    const src = read("client/src/pages/QuickRegister.tsx");
    expect(src).toContain(NOTE);
    expect(src).toContain("<OrderNote note={(foundOrder as any)?.order?.notes}");
  });

  it("adding to a box", () => {
    const src = read("client/src/components/delivery/BoxDetailPanel.tsx");
    expect(src).toContain(NOTE);
    expect(src).toContain("<OrderNote note={(item as any).orderNote}");
  });

  it("arrival verification, where the missing parcels are listed", () => {
    // These are the boxes somebody has to go and find; a note matters more
    // here than anywhere else.
    const src = read("client/src/pages/ArrivalVerificationScanner.tsx");
    expect(src).toContain(NOTE);
    expect(src).toContain("<OrderNote note={(pkg as any).note}");
  });

  it("carries it through the scan session, not only the manifest", () => {
    const src = read("client/src/pages/ArrivalVerificationScanner.tsx");
    expect(src).toContain("note: (pkg as any).note ?? null,");
  });
});

describe("what the note looks like", () => {
  const note = read("client/src/components/scanner/OrderNote.tsx");

  it("takes no space when there is no note", () => {
    expect(note).toContain('if (!text) return null;');
  });

  it("ignores a note that is only whitespace", () => {
    expect(note).toContain('const text = (note ?? "").trim();');
  });

  it("wraps rather than truncating", () => {
    // A note cut in half is worse than none: the half that matters is as
    // likely to be the second one.
    expect(note).toContain("whitespace-pre-wrap break-words");
    // The class, not the word — the comment above says "truncated" too.
    const classes = [...note.matchAll(/"([^"]*)"/g)].map((m) => m[1]).join(" ");
    expect(classes, "a note must never be truncated").not.toMatch(/truncate|line-clamp/);
  });

  it("cannot be dismissed — it is an instruction, not a status", () => {
    expect(note).not.toContain("onClose");
    expect(note).not.toContain("setDismissed");
  });

  it("pairs its colours for dark mode", () => {
    for (const light of ["bg-amber-50", "border-amber-300", "text-amber-900"]) {
      const line = note.split("\n").find((l) => l.includes(light));
      expect(line, `${light} not found`).toBeTruthy();
      expect(line, `${light} has no dark counterpart`).toMatch(/dark:/);
    }
  });

  it("says the word in all four languages", () => {
    for (const lang of ["ku:", "en:", "ar:", "zh:"]) {
      expect(note, `the label is missing ${lang}`).toContain(lang);
    }
  });
});
