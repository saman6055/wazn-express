import { describe, expect, it } from "vitest";
import { carrierAskMessage, customerAskMessage, parseCarrierContacts } from "./carrierContacts";

describe("the carriers' people, from one setting (owner, 2026-11-01)", () => {
  it("reads a name and number a line, Iraqi and Chinese, and skips the rest", () => {
    const rows = parseCarrierContacts("ANC air: +964 750 000 0001\nOwner: +86 150 0000 0002\n\nno number\n");
    expect(rows).toEqual([
      { name: "ANC air", number: "9647500000001" },
      { name: "Owner", number: "8615000000002" },
    ]);
  });

  it("a name may hold a colon; the number is after the last", () => {
    expect(parseCarrierContacts("ANC: air: 0750 000 0001")[0]).toEqual({ name: "ANC: air", number: "9647500000001" });
  });

  it("the messages name the parcel", () => {
    expect(customerAskMessage("SF1")).toContain("SF1");
    expect(carrierAskMessage("SF1", "0.75")).toContain("SF1 (0.75 kg)");
    expect(carrierAskMessage("SF1", null)).not.toContain("kg");
  });
});
