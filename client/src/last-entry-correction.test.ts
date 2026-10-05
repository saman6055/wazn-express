import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (...p: string[]) => fs.readFileSync(path.join(__dirname, ...p), "utf8").replace(/\r\n/g, "\n");

/**
 * "The last thing I entered", handed back to be put right (owner, 2026-10-05).
 *
 * «ئەگەر هەڵەت لە کێش یا قیاس یا لە شتێ کرد، خۆشە ڕیتێرنی دوایین ئۆردەری تۆمار
 * کراو هەبێ … ڕیتێرن لە کڕین بە تێچوو، لە پاکێجی تەواویش هەبێ، زۆر گرنگە.»
 * And of Quick Register: «پێکهاتەی تۆماری خێرا زۆر ڕێکە، شکل و شێوەی دەستکاری
 * مەکە» — so the way back lives in the strip that already named the parcel.
 */
describe("Quick Register hands the last registration back", () => {
  const page = read("pages", "QuickRegister.tsx");
  const at = (marker: string): number => {
    const i = page.indexOf(marker);
    expect(i, `marker not found: ${marker}`).toBeGreaterThan(-1);
    return i;
  };

  it("from the banner that already names it — no new frame on the screen", () => {
    const banner = page.slice(at('data-testid="qr-last-registered"'), at("<form onSubmit={handleSubmit}>"));
    expect(banner).toContain('data-testid="qr-correct-last"');
    expect(banner).toContain("onClick={openCorrection}");
    expect(banner).toContain('data-testid="qr-correction-cancel"');
    // The same strip, in another colour, says what is being changed.
    expect(banner).toContain('data-testid="qr-correcting"');
  });

  it("asks the server what is there now, and says why when it cannot be corrected here", () => {
    const open = page.slice(at("const openCorrection = async () => {"), at("const submitCorrection = async () => {"));
    expect(open).toContain("trpcUtils.packages.lastRegisteredByMe.fetch(undefined, { staleTime: 0 })");
    expect(open).toContain("if (last.blocked) {");
    expect(open).toContain("message: last.blocked,");
  });

  it("Enter saves the correction, never a second registration", () => {
    const submit = page.slice(at("const handleSubmit = async (e?: React.FormEvent) => {"), at("// Require tracking number"));
    expect(submit).toContain("if (correcting) {");
    expect(submit).toContain("await submitCorrection();");
    expect(submit.indexOf("await submitCorrection();")).toBeLessThan(submit.indexOf("return;") + 10);
    const send = page.slice(at("const submitCorrection = async () => {"), at("const resetForm = () => {"));
    expect(send).toContain("correctMutation.mutate({");
    expect(send).not.toContain("registerMutation");
  });

  it("the tracking is not for changing, and is not looked up as a duplicate of itself", () => {
    expect(page).toContain("readOnly={!!correcting}");
    const change = page.slice(at("const handleTrackingChange = (value: string) => {"), at("const selectCustomer = (customer: any) => {"));
    expect(change).toContain("if (correcting) return;");
    const search = page.slice(at("const handleTrackingSearch = async (opts?: { silent?: boolean }) => {"), at("const thisSearchVersion = ++searchVersionRef.current;"));
    expect(search).toContain("if (correcting) return;");
  });

  it("the warehouse, the shipping type and the batch belong to the parcel while it is open", () => {
    expect(page).toContain("disabled={!warehouses?.length || !!correcting}");
    expect(page).toContain('setBatchId(""); }} disabled={!!correcting}>');
    const batch = page.slice(at("{/* Batch */}"), at("<SelectValue placeholder={t(\"quickRegister.batchPlaceholder\")} />"));
    expect(batch).toContain("disabled={!!correcting}");
    // And they are put back as they were when it closes.
    const close = page.slice(at("const closeCorrection = (keepCustomer: boolean) => {"), at("const correctMutation = trpc.packages.correctLastRegistration.useMutation({"));
    expect(close).toContain("setBatchId(was.batchId);");
    expect(close).toContain("setShippingType(was.shippingType);");
  });

  it("an order's carton keeps its owner", () => {
    expect(page).toContain("const ownerFollowsOrder = Boolean(correcting?.orderLinked);");
    expect(page).toContain("disabled={isUnclaimed || (foundOrder?.customer != null) || ownerFollowsOrder}");
    expect(page).toContain("disabled={foundOrder?.customer != null || ownerFollowsOrder}");
  });

  it("clearing the form closes the correction instead of emptying a real parcel", () => {
    const clear = page.slice(at("const clearAllForm = () => {"), at("const handleSubmit = async (e?: React.FormEvent) => {"));
    expect(clear).toContain("if (correcting) {");
    expect(clear.indexOf("closeCorrection(false);")).toBeGreaterThan(-1);
    expect(clear.indexOf("closeCorrection(false);")).toBeLessThan(clear.indexOf('setTrackingNumber("");'));
  });

  it("leaving with a correction open asks, and says what would be lost", () => {
    const guard = page.slice(at("const hasParcelInProgress = Boolean("), at("const trackingOrders ="));
    expect(guard).toContain("correcting ||");
    expect(guard).toContain("message: correcting");
  });

  it("the photographs are sent only when they changed", () => {
    expect(page).toContain("...(photosChanged ? { photos } : {}),");
  });

  it("a refusal is shown where four lines can be read, with its cure", () => {
    const mutation = page.slice(at("const correctMutation = trpc.packages.correctLastRegistration.useMutation({"), at("const openCorrection = async () => {"));
    expect(mutation).toContain("systemAlert({");
    expect(mutation).toContain("message: error.message,");
    expect(mutation).toContain("pickLang(language, data.words)");
  });

  it("the banner survives a reload, for a registration from this working day only", () => {
    expect(page).toContain("trpc.packages.lastRegisteredByMe.useQuery(undefined, {");
    expect(page).toContain("isRecentEntry(myLastRegistration.registeredAt)");
  });

  it("the header card cannot be scrolled sideways by the button at its end", () => {
    // Its glow hangs 64px past the end; a box that only hides overflow still
    // scrolls to a focused child, and the whole header slid over its title.
    expect(page).toContain('className="relative overflow-clip rounded-xl bg-gradient-to-br from-amber-500');
    expect(page).not.toContain('className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500');
  });

  it("the prohibited-item shortcut is a link, so the leave guard holds it", () => {
    expect(page).toContain('href="/packages/prohibited-register"');
    expect(page).not.toContain('setLocation("/packages/prohibited-register")');
  });
});

describe("buy-at-cost and full package offer the last order back", () => {
  const strip = read("components", "forms", "LastOrderStrip.tsx");

  it("one strip, used by both forms, only on the entry form", () => {
    const commission = read("pages", "CommissionForm.tsx");
    const fullPackage = read("pages", "FullPackageForm.tsx");
    expect(commission).toContain('{!isEditMode && <LastOrderStrip orderType="commission" />}');
    expect(fullPackage).toContain('{!isEditMode && <LastOrderStrip orderType="full_package" />}');
  });

  it("is a real link to the ordinary edit form — the leave guard asks first", () => {
    expect(strip).toContain("<Link");
    expect(strip).toContain("href={lastOrderEditHref(orderType, last.id)}");
    expect(strip).not.toContain("setLocation(");
    expect(strip).toContain("if (!last || !isRecentEntry(last.createdAt)) return null;");
  });

  it.each([
    ["CommissionForm.tsx", "CommissionFormScreen", 'setLocation("/commission")', "setLocation(exitPath)"],
    ["FullPackageForm.tsx", "FullPackageFormScreen", 'navigate("/full-package")', "navigate(exitPath)"],
  ])("%s starts clean for every order and leaves by one rule", (file, screen, oldExit, newExit) => {
    const form = read("pages", file);
    // The router reuses one instance for "new" and ":id/edit"; without the
    // key an edit's fields would sit in the form for the next NEW order.
    expect(form).toContain(`return <${screen} key={id ?? "new"} />;`);
    expect(form).toContain("const exitPath = orderFormExit(");
    expect(form).not.toContain(oldExit);
    expect(form.split(newExit).length - 1).toBe(5);
    expect(form).toContain("utils.fullPackage.lastCreatedByMe.invalidate();");
  });
});
