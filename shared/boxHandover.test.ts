import { describe, it, expect } from "vitest";
import { handoverProblem, parseCarrierTrackings, cleanTrackings, cleanCarrierName } from "./boxHandover";

describe("nothing is printed until it is said how the box reaches the customer", () => {
  it("asks for a way first", () => {
    expect(handoverProblem({})?.ku).toContain("سەرەتا دیاری بکە");
    expect(handoverProblem(null)?.en).toContain("First say how");
  });
  it("a driver or a company needs its name; collecting does not", () => {
    expect(handoverProblem({ handoverMode: "driver" })?.ku).toBe("شۆفێرەکە هەڵبژێرە.");
    expect(handoverProblem({ handoverMode: "courier", carrierName: "  " })?.ku).toBe("کۆمپانیای گواستنەوەکە هەڵبژێرە.");
    expect(handoverProblem({ handoverMode: "courier", carrierName: "هایپەر پۆست" })).toBeNull();
    expect(handoverProblem({ handoverMode: "pickup" })).toBeNull();
  });
});

describe("the company's tracking numbers never hold the paper up, and a box can have several", () => {
  it("reads what is stored, and old plain text too", () => {
    expect(parseCarrierTrackings('["HP-1"," HP-2 ","HP-1",""]')).toEqual(["HP-1", "HP-2"]);
    expect(parseCarrierTrackings("HP-1, HP-2\nHP-3")).toEqual(["HP-1", "HP-2", "HP-3"]);
    expect(parseCarrierTrackings(null)).toEqual([]);
    expect(handoverProblem({ handoverMode: "courier", carrierName: "واسط" })).toBeNull();
  });
  it("cleans names and lists", () => {
    expect(cleanTrackings(["a", "a", " b "])).toEqual(["a", "b"]);
    expect(cleanCarrierName("  هایپەر   پۆست ")).toBe("هایپەر پۆست");
  });
});
