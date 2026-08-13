import { describe, expect, it } from "vitest";
import { TRASH_ENTITIES, canSeeTrashItem, trashEntity } from "./trash";

/**
 * Who sees what in the recycle bin.
 *
 * The bin exists so somebody can undo their own mistake, so an admin gets
 * their own deletions back. Seeing the whole company's is a supervisory view
 * and belongs to the super admin. The rule lives in one place because the
 * list, the restore and the purge each ask it, and three copies would
 * eventually give three answers — the dangerous one being a restore that
 * reaches past what the list would show.
 */

const ako = { id: 7, role: "admin" };
const rebwar = { id: 9, role: "admin" };
const owner = { id: 1, role: "super_admin" };

describe("whose deletions a person sees", () => {
  it("gives an admin their own back", () => {
    expect(canSeeTrashItem({ deletedById: 7 }, ako)).toBe(true);
  });

  it("keeps one admin out of another's", () => {
    expect(canSeeTrashItem({ deletedById: 9 }, ako)).toBe(false);
    expect(canSeeTrashItem({ deletedById: 7 }, rebwar)).toBe(false);
  });

  it("shows a super admin everything, including their own", () => {
    expect(canSeeTrashItem({ deletedById: 7 }, owner)).toBe(true);
    expect(canSeeTrashItem({ deletedById: 9 }, owner)).toBe(true);
    expect(canSeeTrashItem({ deletedById: 1 }, owner)).toBe(true);
  });

  it("hides a record with no deleter from everyone but the super admin", () => {
    // Legacy rows, or a deletion recorded before this was tracked. Defaulting
    // to visible would hand them to whoever asked first.
    expect(canSeeTrashItem({ deletedById: null }, ako)).toBe(false);
    expect(canSeeTrashItem({}, ako)).toBe(false);
    expect(canSeeTrashItem({ deletedById: null }, owner)).toBe(true);
  });

  it("does not treat any other role as privileged", () => {
    for (const role of ["employee", "accountant", "customer", "", undefined]) {
      expect(canSeeTrashItem({ deletedById: 99 }, { id: 7, role: role as string }), String(role)).toBe(false);
    }
  });

  it("matches on the id, not on anything coercible to it", () => {
    // "7" is not user 7. A loose comparison here would leak across accounts.
    expect(canSeeTrashItem({ deletedById: "7" as never }, ako)).toBe(false);
  });
});

describe("the types the bin knows about", () => {
  it("covers the three things that can be deleted", () => {
    expect(TRASH_ENTITIES.map((e) => e.type).sort()).toEqual([
      "batch", "delivery_box", "full_package_order",
    ]);
  });

  it("records how each one is stored while deleted", () => {
    // A snapshot for things nothing references; a marker on the row itself
    // for things that are referenced and whose history has to survive.
    expect(trashEntity("batch")?.storage).toBe("snapshot");
    expect(trashEntity("delivery_box")?.storage).toBe("snapshot");
    expect(trashEntity("full_package_order")?.storage).toBe("marker");
  });

  it("names every type in all four languages", () => {
    for (const entity of TRASH_ENTITIES) {
      for (const key of ["label", "labelKu", "labelAr", "labelZh"] as const) {
        expect(entity[key]?.trim(), `${entity.type}.${key}`).toBeTruthy();
      }
    }
  });

  it("returns nothing for a type it does not know", () => {
    expect(trashEntity("customer")).toBeUndefined();
    expect(trashEntity("")).toBeUndefined();
  });
});
