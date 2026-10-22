import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/** Owner, 2026-10-22: a customer's first box needs its details before it is made. */
describe("«بۆکس دروست بکە بۆی» for a customer with no box before", () => {
  const button = read("client/src/components/delivery/BoxForParcel.tsx");
  const dialog = read("client/src/components/delivery/CreateBoxDialog.tsx");

  it("opens the full create window with the customer chosen", () => {
    expect(button).toContain("if (open && data && !data.open && !data.last) { setOpen(false); setFilling(true); }");
    expect(button).toContain("customer={{ id: customerId, name: customerName }}");
    expect(dialog).toContain("setSelectedCustomerId(customer.id);");
  });

  it("then the parcel goes in and the box opens, the same as the other path", () => {
    expect(button).toContain("onBoxCreated={(boxId) => { void putInAndOpen(boxId); }}");
    expect(button).toContain("await putInAndOpen(boxId);");
  });
});
