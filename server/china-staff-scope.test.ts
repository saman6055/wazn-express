import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { CHINA_STAFF_PRESET } from "@shared/permissions";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-25: staff working in China see the parcels registered in
 * China and put them right - weight, size, batch, status - and nothing of
 * money. Proven on real MySQL (zz-probe-chinascope, 12 checks).
 */
describe("staff working in China", () => {
  const router = read("server/routers/packages.router.ts");

  it("the list is the parcels registered in China, without prices unless given", () => {
    expect(router).toContain("registeredIn: scope ?? undefined,");
    expect(router).toContain('if (scope && !(await db.checkUserSubPermission(ctx.user.id, "packages", "view_prices"))) {');
    expect(read("server/db/packages.db.ts")).toContain("conditions.push(or(eq(packages.registeredInCountryId, registeredIn.countryId), eq(packages.registeredById, registeredIn.userId))!);");
  });

  it("edits and status changes only inside it; no owner change, no discount", () => {
    expect(router).toContain("const chinaScope = await assertChinaScope({ id: ctx.user.id, role: ctx.user.role }, id);");
    expect(router).toContain("await assertChinaScope({ id: ctx.user.id, role: ctx.user.role }, id);");
    expect(router).toContain("گۆڕینی خاوەنی پاکەت کاری ئۆفیسی هەولێرە.");
    expect(router).toContain("داشکانی قەبارە کاری ئۆفیسی هەولێرە.");
  });

  it("admins are never scoped", () => {
    expect(read("server/db/dispatch.db.ts")).toContain('if (user.role === "super_admin" || user.role === "admin") return null;');
  });

  it("the preset: the work, and nothing of money", () => {
    const allowed = CHINA_STAFF_PRESET.subPermissions.filter((s) => s.isAllowed).map((s) => s.permissionKey);
    expect(allowed).toContain("finish_dispatch_short");
    expect(allowed).not.toContain("view_prices");
    expect(allowed).not.toContain("edit_prices");
    const modules = CHINA_STAFF_PRESET.permissions.map((p) => p.module);
    for (const m of ["quick_register", "batch_assignment_scanner", "packages", "batches"]) expect(modules).toContain(m);
    for (const m of modules) expect(m).not.toMatch(/finance|invoice|debt|expense|profit|treasury/);
  });

  it("the permissions page fills it in with one click or a link, and Save stays a click", () => {
    const page = read("client/src/pages/PermissionsManagement.tsx");
    expect(page).toContain('data-testid="china-staff-preset"');
    expect(page).toContain('const pendingPreset = React.useRef(linkParams.get("preset") === "china");');
  });
});
