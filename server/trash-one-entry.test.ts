import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Restoring or purging touches the one entry in front of the reader.
 *
 * The bin keeps an entry per deletion, not per thing: a box deleted, brought
 * back and deleted again has two. Until 2026-09-17 a box came back from the
 * bin without its parcels, so for such a box the older entry is the only
 * place its parcels still exist — and restore and purge each removed every
 * entry the box had, parcels and all.
 */

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");
const db = read("server/db/trash.db.ts");
const router = read("server/routers/trash.router.ts");
const page = read("client/src/pages/Trash.tsx");

describe("an entry of the bin has its own identity", () => {
  it("the list gives each entry its own key and id", () => {
    expect(db).toContain("key: `${r.entityType}:${r.entityId}:${r.id}`,");
    expect(db).toContain("recordId: r.id,");
  });

  it("one entry can be read and dropped by that id", () => {
    expect(db).toContain("export async function getDeletedRecordById(id: number)");
    expect(db).toContain("export async function removeDeletedRecordById(id: number)");
    expect(db).toContain("await db.delete(deletedRecords).where(eq(deletedRecords.id, id));");
  });

  it("no one can drop every entry a box has any more", () => {
    expect(db).not.toContain("export async function removeDeletedRecord(");
    expect(router).not.toMatch(/removeDeletedRecord\(/);
  });

  it("without an id, the entry meant is the newest", () => {
    const start = db.indexOf("export async function getDeletedRecord(");
    expect(start).toBeGreaterThan(-1);
    expect(db.slice(start, db.indexOf("\n}\n", start))).toContain("orderBy(desc(deletedRecords.deletedAt), desc(deletedRecords.id))");
  });
});

describe("restore and purge act on it", () => {
  it("both take the entry's id, and check it is an entry of that very thing", () => {
    expect(router.split("recordId: idSchema.optional()").length - 1).toBe(2);
    expect(router).toContain("if (entry.entityType !== entityType || entry.entityId !== entityId) return null;");
    expect(router.split("entryFor(").length - 1).toBe(4); // the helper, and three uses
  });

  it("and drop that entry alone", () => {
    expect(router.split("removeDeletedRecordById(").length - 1).toBe(3);
  });

  it("without an id, the entry acted on is the one the reader's list shows", () => {
    expect(router.split("visible!.recordId ?? undefined").length - 1).toBe(2);
    expect(router.split("visible.recordId ?? undefined").length - 1).toBe(1);
  });

  it("a reader may only act on an entry their own list shows", () => {
    expect(router.split("(input.recordId == null || item.recordId === input.recordId)").length - 1).toBe(2);
    expect(router.split("canSeeTrashItem(visible, ctx.user)").length - 1).toBe(2);
  });

  it("the page points at the card it drew", () => {
    expect(page).toContain("recordId: item.recordId ?? undefined");
    expect(page).toContain("recordId: purging.recordId ?? undefined");
  });
});
