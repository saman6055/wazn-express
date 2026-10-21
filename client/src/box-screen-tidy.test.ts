import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-21: «بەشی بۆکسی زۆر قەربالغ و ئالۆز کردووە» - the customer's
 * boxes behind one button, the way it reaches the customer in one line once
 * chosen, and the driver or company chosen while the box is made.
 */
describe("the box screen is tidy", () => {
  it("the customer's boxes are one button until it is pressed", () => {
    const panel = read("client/src/components/delivery/CustomerBoxesPanel.tsx");
    expect(panel).toContain("const [shown, setShown] = useState(false);");
    expect(panel).toContain('data-testid="customer-boxes-button"');
  });

  it("a chosen handover is one line with «گۆڕین»", () => {
    const card = read("client/src/components/delivery/BoxHandoverCard.tsx");
    expect(card).toContain("if (!problem && !editing && mode) {");
    expect(card).toContain('data-testid="handover-change"');
  });
});

describe("the driver or company is chosen while the box is made", () => {
  const dialog = read("client/src/components/delivery/CreateBoxDialog.tsx");
  const router = read("server/routers/scanning.router.ts");

  it("home delivery names a driver, a city transfer a company, from the same list", () => {
    expect(dialog).toContain('home_delivery: "driver",');
    expect(dialog).toContain('city_transfer: "courier",');
    expect(dialog).toContain("trpc.deliveryBox.carriers.useQuery({ kind: carrierKind");
    expect(dialog).toContain("trpc.deliveryBox.addCarrier.useMutation(");
    expect(dialog).toContain("if (carrierKind && !carrierId) {");
  });

  it("the box is made with it, through the box card's own rule", () => {
    expect(dialog).toContain("handover: { mode: HANDOVER_OF[deliveryMethod], carrierId: carrierKind ? carrierId : null },");
    expect(router).toContain("await db.setBoxHandover({ boxId: box.id, mode: handover.mode, carrierId: handover.carrierId ?? null, trackings: [] }, ctx.user.id);");
  });
});
