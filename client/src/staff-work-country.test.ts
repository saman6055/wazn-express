import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/** Owner, 2026-10-24: an existing member of staff's country can be set (Ako, in China). */
describe("a member of staff's country, after they were created", () => {
  it("admins set it, audited; only the main admin touches the main admin", () => {
    const src = read("server/routers/auth.router.ts");
    expect(src).toContain("setStaffWorkCountry: adminProcedure");
    expect(src).toContain('action: "set_staff_work_country"');
    expect(src).toContain('if (target.role === "super_admin" && ctx.user.role !== "super_admin") {');
  });

  it("the staff list shows and changes it", () => {
    expect(read("server/db/admin.db.ts")).toContain("workCountryId: users.workCountryId,");
    expect(read("client/src/pages/StaffManagement.tsx")).toContain("setCountryMutation.mutate({ userId: staff.id, countryId: v === \"none\" ? null : Number(v) })");
  });
});
