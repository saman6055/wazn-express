import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), "utf8");

/**
 * A photo is taken of every parcel arriving at the China depot, and of parcels
 * scanned along the road. It was written to `packageScans.photoUrl` and
 * nowhere else — and nothing outside the scan log reads that column.
 *
 * So the picture existed, in the database, for months, and never reached the
 * portal card, the parcel page, the delivery box or the rating card. All four
 * read `packages.photos`, which stayed empty.
 */
describe("a photo taken of a parcel reaches the parcel", () => {
  const router = read("routers/scanning.router.ts");

  it("quick-register puts the photo on the parcel it creates", () => {
    const proc = router.slice(
      router.indexOf("quickRegisterPackage"),
      router.indexOf("createPackageScan", router.indexOf("quickRegisterPackage")),
    );
    expect(proc).toMatch(/photos: input\.photoUrl \? \[input\.photoUrl\] : undefined/);
  });

  it("a later scan appends its photo to the parcel", () => {
    expect(router).toContain("db.addPackagePhoto(input.packageId, input.photoUrl)");
  });

  /**
   * Never at the cost of the scan itself. A warehouse scanning a hundred
   * parcels cannot have one fail because a picture would not save.
   */
  it("a failed photo does not fail the scan", () => {
    const at = router.indexOf("db.addPackagePhoto");
    expect(router.slice(at - 60, at + 200)).toMatch(/void |\.catch\(/);
  });

  it("appends rather than replaces, and does not duplicate", () => {
    const fn = read("db/packages.db.ts");
    const body = fn.slice(fn.indexOf("export async function addPackagePhoto"));
    expect(body.slice(0, 1200), "a parcel scanned three times keeps three pictures")
      .toContain("[...existing, photoUrl]");
    expect(body.slice(0, 1200), "and not three copies of the first")
      .toContain("existing.includes(photoUrl)");
  });

  /**
   * The scan keeps its own copy. That row is the record of what that
   * particular scan saw, and moving it would lose that.
   */
  it("the scan record keeps its own photo", () => {
    expect(router).toContain("photoUrl: input.photoUrl");
  });
});
