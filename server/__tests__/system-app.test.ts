import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { SYSTEM_APP_NAME, isSystemHost } from "@shared/appVariant";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * The owner, 2026-09-27: the office system installs on a phone as its own
 * app, named only «سیستەم».
 */
describe("the office as an app of its own", () => {
  it("knows the staff host", () => {
    expect(isSystemHost("admin.waznexpress.com")).toBe(true);
    expect(isSystemHost("staff.waznexpress.com")).toBe(true);
    expect(isSystemHost("admin.waznexpress.com:443")).toBe(true);
    expect(isSystemHost("waznexpress.com")).toBe(false);
    expect(isSystemHost("www.waznexpress.com")).toBe(false);
    expect(isSystemHost(undefined)).toBe(false);
    expect(SYSTEM_APP_NAME).toBe("Wazn System");
  });

  it("the manifest is named Wazn System on that host, with its own identity and dark icon", () => {
    const src = read("server/services/appIcons.service.ts");
    expect(src).toContain("const name = system ? SYSTEM_APP_NAME");
    expect(src).toContain("const shortName = system ? SYSTEM_APP_NAME");
    expect(src).toContain('id: system ? "/?app=system" : "/"');
    expect(src).toContain("src: systemIconUrl(size),");
    expect(src).toContain('req.headers["x-forwarded-host"]');
    expect(src).toContain('res.setHeader("Vary", "Host, X-Forwarded-Host")');
  });

  it("iPhone's home-screen name follows too", () => {
    const main = read("client/src/main.tsx");
    expect(main).toContain("if (isSystemHost(window.location.hostname))");
    expect(main).toContain('"apple-mobile-web-app-title"');
  });
});
