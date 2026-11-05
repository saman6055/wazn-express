import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { cleanTraits, gpuCore, gpuName, isPrint, plateOf, printFrom } from "@shared/devicePlate";
import {
  acceptPrint,
  approveDevice,
  deviceAllowed,
  emptyOfficeDevices,
  liveMismatches,
  noteMismatch,
  noteSeen,
  parseOfficeDevices,
  printMismatch,
  recordDetails,
} from "@shared/officeDevices";
import { riskVisibleTo } from "@shared/riskBell";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * The device's plate (owner, 2026-11-05: «وەکو ژمارەی پلێتی ئۆتۆمبێل»):
 * one per device, with the machine's details, and a mark copied to another
 * machine is caught.
 */
const A = "a1b2c3d4".repeat(8);
const B = "ff00ee11".repeat(8);
const now = new Date("2026-11-05T10:00:00Z");
const laptop = { os: "Windows", gpu: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x000046A6) Direct3D11 vs_5_0 ps_5_0, D3D11)", cores: 8, memoryGb: 8, touch: 0 };

describe("the plate and the print", () => {
  it("one plate per device, read off its mark", () => {
    expect(plateOf(A)).toBe("WZN·A1B2·C3D4");
    expect(plateOf(B)).not.toBe(plateOf(A));
  });

  it("the same machine gives the same print, whatever the browser update changed in the chip's name", () => {
    const p = printFrom(laptop)!;
    expect(isPrint(p)).toBe(true);
    expect(printFrom({ ...laptop, gpu: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)" })).toBe(p);
    expect(gpuCore(laptop.gpu)).toBe("intel iris xe");
  });

  it("the chip's name is shown the way a person says it", () => {
    expect(gpuName("ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)")).toBe("AMD Radeon(TM) Graphics");
    expect(gpuName(laptop.gpu)).toBe("Intel(R) Iris(R) Xe Graphics");
    expect(gpuName("Apple GPU")).toBe("Apple GPU");
  });

  it("another machine gives another print", () => {
    const p = printFrom(laptop)!;
    expect(printFrom({ ...laptop, gpu: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)" })).not.toBe(p);
    expect(printFrom({ ...laptop, cores: 4 })).not.toBe(p);
    expect(printFrom({ ...laptop, os: "Mac" })).not.toBe(p);
  });

  it("no chip, or the browser's software stand-in: no print, so nothing is compared", () => {
    expect(printFrom({ ...laptop, gpu: undefined })).toBeNull();
    expect(printFrom({ ...laptop, gpu: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)" })).toBeNull();
  });

  it("what a page says about itself is cut to size and never more", () => {
    const t = cleanTraits({ os: "x".repeat(500), cores: 99999, evil: "<script>", gpu: "a\u0000b" })!;
    expect(t.os!.length).toBe(40);
    expect(t.cores).toBeUndefined();
    expect((t as Record<string, unknown>).evil).toBeUndefined();
    expect(t.gpu).toBe("ab");
    expect(cleanTraits("nope")).toBeUndefined();
  });
});

describe("a mark copied to another machine", () => {
  const p1 = printFrom(laptop)!;
  const p2 = printFrom({ ...laptop, cores: 16 })!;
  const seenOnce = recordDetails(
    noteSeen(emptyOfficeDevices(), { id: A, user: "Saman", userId: 1, ip: "1.2.3.4", agent: "Windows Chrome/130" }, now),
    A,
    { print: p1, traits: { os: "Windows" }, ip: "1.2.3.4" },
  );

  it("the first print is kept; a later one never overwrites it on its own", () => {
    expect(recordDetails(seenOnce, A, { print: p2 }).seen[0].print).toBe(p1);
  });

  it("the same machine is fine; another one is a mismatch; no print is no question", () => {
    expect(printMismatch(seenOnce, A, p1)).toBe(false);
    expect(printMismatch(seenOnce, A, p2)).toBe(true);
    expect(printMismatch(seenOnce, A, null)).toBe(false);
    expect(printMismatch(seenOnce, B, p2)).toBe(false);
  });

  it("noted, counted for the bell, and the owner's yes keeps the new print", () => {
    const approved = approveDevice(seenOnce, A, "لاپتۆپی خاوەن", 1, now);
    expect(approved.approved[0].print).toBe(p1);
    const flagged = noteMismatch(approved, A, { at: now.toISOString(), print: p2, ip: "9.9.9.9", agent: "Mac Chrome", user: "?" });
    expect(liveMismatches(flagged)).toBe(1);
    const same = acceptPrint(flagged, A);
    expect(liveMismatches(same)).toBe(0);
    // Both machines pass now: a wrong yes never shuts the real one out.
    expect(printMismatch(same, A, p2)).toBe(false);
    expect(printMismatch(same, A, p1)).toBe(false);
    expect(printMismatch(same, A, printFrom({ ...laptop, cores: 2 }))).toBe(true);
    // And the whole of it survives the setting round trip.
    expect(parseOfficeDevices(JSON.stringify(flagged)).approved[0].mismatch?.print).toBe(p2);
  });

  it("approving a device that came from another machine keeps that machine's print", () => {
    const flagged = noteMismatch(seenOnce, A, { at: now.toISOString(), print: p2, ip: "9.9.9.9", agent: "x" });
    const yes = approveDevice(flagged, A, "x", 1, now);
    expect(yes.approved[0].print).toBe(p1);
    expect(yes.approved[0].alsoPrints).toEqual([p2]);
    expect(printMismatch(yes, A, p2)).toBe(false);
    expect(yes.seen[0].mismatch).toBeUndefined();
  });

  it("the bell tells only the main admin", () => {
    expect(riskVisibleTo("admin", new Set(["/office-security"]), "device-mismatch")).toBe(false);
    expect(riskVisibleTo("super_admin", new Set(), "device-mismatch")).toBe(true);
  });

  it("the rule decides the sign-in as before; the print is compared beside it", () => {
    const on = { ...approveDevice(seenOnce, A, "x", 1, now), enforced: true, enforcedAt: now.toISOString() };
    expect(deviceAllowed(on, A, false)).toBe(true);
    expect(deviceAllowed(on, B, false)).toBe(false);
  });
});

describe("where it is wired", () => {
  it("every office request is compared; while the rule is on another machine is stopped", () => {
    const sdk = read("server/_core/sdk.ts");
    const staff = sdk.slice(sdk.indexOf("Handle staff login sessions"), sdk.indexOf("Regular OAuth user flow"));
    expect(staff).toContain("if (deviceId && print && printMismatch(devices, deviceId, print)) {");
    expect(staff).toContain("if (devices.enforced && !officeDevicesKillSwitch()) {");
    const customer = sdk.slice(sdk.indexOf("session.customerId && session.isCustomer"), sdk.indexOf("Handle staff login sessions"));
    expect(customer).not.toContain("printMismatch");
  });

  it("the sign-in from another machine waits for the yes while the rule is on", () => {
    const auth = read("server/routers/auth.router.ts");
    expect(auth).toContain("const moved = printMismatch(before, deviceId, print);");
    expect(auth).toContain("&& !(moved && devices.enforced && !officeDevicesKillSwitch())");
  });

  it("a session from before the rule approves its device; the step never stands in the way", () => {
    const step = read("server/lib/officeDeviceStep.ts");
    expect(step).toContain("openBeforeRule(state, sessionIssuedAt)");
    expect(step).toContain("approveDevice(next, deviceId, label, user.id, now)");
    const ctx = read("server/_core/context.ts");
    expect(ctx).toContain("if (user && !user.isCustomer) {");
  });

  it("a copied mark cannot rewrite the real machine's details", () => {
    const step = read("server/lib/officeDeviceStep.ts");
    const report = step.slice(step.indexOf("export async function reportDetails"));
    expect(report.indexOf("if (printMismatch(s, deviceId, print)) return null;")).toBeLessThan(report.indexOf("recordDetails("));
  });

  it("the page sits in the staff frame", () => {
    expect(read("client/src/App.tsx")).toContain('const OfficeSecurity = staffPage(() => import("./pages/admin/OfficeSecurity"));');
  });
});
