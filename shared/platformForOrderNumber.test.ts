import { describe, expect, it } from "vitest";
import { platformForOrderNumber } from "./orderNumberPlatform";

/**
 * Owner, 2026-10-22: a Pinduoduo number fills the platform itself; any other
 * number and the system says «پلاتفۆرم دیاری بکە» - the remembered platform
 * is not kept. His three examples.
 */
describe("the platform once the order number is in", () => {
  it("Pinduoduo by its dash, whatever was there", () => {
    expect(platformForOrderNumber("260930-434834019861958", "Taobao", true)).toBe("Pinduoduo");
    expect(platformForOrderNumber("260930-434834019861958", "", false)).toBe("Pinduoduo");
  });

  it("1688 and Taobao numbers: the remembered platform is cleared, so the form asks", () => {
    expect(platformForOrderNumber("5127443390032005232", "Pinduoduo", false)).toBe("");
    expect(platformForOrderNumber("5127543866003014414", "Taobao", false)).toBe("");
    expect(platformForOrderNumber("5127543866003014414", "Pinduoduo", true)).toBe("");
  });

  it("but Taobao or 1688 picked by hand for this order stays", () => {
    expect(platformForOrderNumber("5127443390032005232", "1688", true)).toBe("1688");
    expect(platformForOrderNumber("5127543866003014414", "Taobao", true)).toBe("Taobao");
  });

  it("a number of no known shape leaves the platform alone", () => {
    expect(platformForOrderNumber("ABC123", "Shein", false)).toBe("Shein");
    expect(platformForOrderNumber("", "Taobao", false)).toBe("Taobao");
  });
});
