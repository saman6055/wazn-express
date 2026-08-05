import { describe, it, expect } from "vitest";
import { dedupePhotos } from "./photoList";

describe("dedupePhotos", () => {
  it("keeps the order the sources were given in", () => {
    // Warehouse shots first is deliberate: they are proof of the real parcel,
    // so the one on the thumbnail should be ours, not the shop's.
    expect(dedupePhotos(["/a.jpg", "/b.jpg"], "/c.jpg")).toEqual(["/a.jpg", "/b.jpg", "/c.jpg"]);
  });

  it("counts a picture once when two fields carry it", () => {
    // productImage is usually productImages[0]. A badge reading "2" for one
    // photo is worse than no badge.
    expect(dedupePhotos("/a.jpg", ["/a.jpg", "/b.jpg"])).toEqual(["/a.jpg", "/b.jpg"]);
  });

  it("ignores empties, blanks and non-strings", () => {
    // These columns are nullable, and a blank string still renders as a broken
    // image if it reaches an <img>.
    expect(dedupePhotos(null, undefined, "", "   ", 7, {}, ["/a.jpg"])).toEqual(["/a.jpg"]);
  });

  it("returns nothing when there is nothing", () => {
    expect(dedupePhotos(null, [], undefined)).toEqual([]);
  });
});
