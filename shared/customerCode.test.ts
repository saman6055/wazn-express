import { describe, expect, it } from "vitest";
import { splitCustomerCode, customerCodeOnly } from "./customerCode";

/**
 * A grid of customer codes truncated to "AZ08…", "AZ19…", "AZ21…" — a list of
 * codes that cannot be told apart, on a screen whose only job is telling them
 * apart. The name is folded into the stored code and has to come out again.
 */
describe("a customer code splits into what identifies and what explains", () => {
  it("takes the code and the name apart", () => {
    expect(splitCustomerCode("AZ047(Lubna Hikmat Dawood)")).toEqual({
      code: "AZ047", name: "Lubna Hikmat Dawood",
    });
  });

  it("handles a name with brackets of its own", () => {
    // lastIndexOf, not indexOf: the closing bracket is the last one.
    expect(splitCustomerCode("AZ001(Zainab (Sara) Saeed)")).toEqual({
      code: "AZ001", name: "Zainab (Sara) Saeed",
    });
  });

  it("returns a bare code whole rather than emptying it", () => {
    expect(splitCustomerCode("AZ047")).toEqual({ code: "AZ047", name: "" });
  });

  it("keeps a truncated name rather than dropping it", () => {
    // A row that lost its closing bracket is still worth reading.
    expect(splitCustomerCode("AZ047(Lubna Hikmat")).toEqual({
      code: "AZ047", name: "Lubna Hikmat",
    });
  });

  it("does not invent a code out of a bracket alone", () => {
    expect(splitCustomerCode("(Lubna)")).toEqual({ code: "(Lubna)", name: "" });
  });

  it("survives nothing at all", () => {
    for (const input of [null, undefined, "", "   "]) {
      expect(splitCustomerCode(input)).toEqual({ code: "", name: "" });
    }
  });

  it("trims the space some codes carry inside the bracket", () => {
    // Seen in the real data: "AZ195( Hassanain Hadi)".
    expect(splitCustomerCode("AZ195( Hassanain Hadi)").name).toBe("Hassanain Hadi");
  });

  it("gives the short form on its own for a one-line space", () => {
    expect(customerCodeOnly("AZ047(Lubna Hikmat Dawood)")).toBe("AZ047");
    expect(customerCodeOnly(null)).toBe("");
  });
});
