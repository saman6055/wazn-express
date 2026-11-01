import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";
import { hasDb } from "./testEnv";

describe.skipIf(!hasDb())("Role Hierarchy Tests", () => {
  let superAdminId: number;
  let adminId: number;
  let employeeId: number;
  let accountantId: number;

  beforeAll(async () => {
    // Create test users with different roles
    const superAdmin = await db.createStaffUser({
      name: "Super Admin Test",
      email: `super-admin-${Date.now()}@test.com`,
      passwordHash: "test",
      role: "super_admin",
    });
    superAdminId = superAdmin!.id;

    const admin = await db.createStaffUser({
      name: "Test Admin",
      email: `test-admin-${Date.now()}@test.com`,
      passwordHash: "test",
      role: "admin",
    });
    adminId = admin!.id;

    const employee = await db.createStaffUser({
      name: "Test Employee",
      email: `test-employee-${Date.now()}@test.com`,
      passwordHash: "test",
      role: "employee",
    });
    employeeId = employee!.id;

    const accountant = await db.createStaffUser({
      name: "Test Accountant",
      email: `test-accountant-${Date.now()}@test.com`,
      passwordHash: "test",
      role: "accountant",
    });
    accountantId = accountant!.id;
  });

  it("should create users with correct roles", () => {
    expect(superAdminId).toBeGreaterThan(0);
    expect(adminId).toBeGreaterThan(0);
    expect(employeeId).toBeGreaterThan(0);
    expect(accountantId).toBeGreaterThan(0);
  });

  it("should verify Super Admin can set permissions for all roles", async () => {
    // Super Admin can set permissions for Admin
    const adminPerm = await db.setUserPermission({
      userId: adminId,
      module: "packages",
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: false,
    });
    expect(adminPerm).toBeDefined();
    expect(adminPerm?.module).toBe("packages");

    // Super Admin can set permissions for Employee
    const employeePerm = await db.setUserPermission({
      userId: employeeId,
      module: "customers",
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    });
    expect(employeePerm).toBeDefined();
    expect(employeePerm?.module).toBe("customers");

    // Super Admin can set permissions for Accountant
    const accountantPerm = await db.setUserPermission({
      userId: accountantId,
      module: "accounting",
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
    });
    expect(accountantPerm).toBeDefined();
    expect(accountantPerm?.module).toBe("accounting");
  });

  it("should verify permissions are correctly stored", async () => {
    const adminPerms = await db.getUserPermissions(adminId);
    expect(adminPerms.length).toBeGreaterThan(0);
    expect(adminPerms.some(p => p.module === "packages")).toBe(true);

    const employeePerms = await db.getUserPermissions(employeeId);
    expect(employeePerms.length).toBeGreaterThan(0);
    expect(employeePerms.some(p => p.module === "customers")).toBe(true);

    const accountantPerms = await db.getUserPermissions(accountantId);
    expect(accountantPerms.length).toBeGreaterThan(0);
    expect(accountantPerms.some(p => p.module === "accounting")).toBe(true);
  });

  it("should verify checkUserPermission works correctly", async () => {
    const hasPermission = await db.checkUserPermission(
      adminId,
      "packages",
      "view"
    );
    expect(hasPermission).toBe(true);

    const noPermission = await db.checkUserPermission(
      adminId,
      "packages",
      "delete"
    );
    expect(noPermission).toBe(false);
  });

  it("should verify sub-permissions work correctly", async () => {
    const subPerm = await db.setUserSubPermission({
      userId: employeeId,
      module: "packages",
      permissionKey: "view_all_packages",
      isAllowed: true,
    });
    expect(subPerm).toBeDefined();

    const hasSubPerm = await db.checkUserSubPermission(
      employeeId,
      "packages",
      "view_all_packages"
    );
    expect(hasSubPerm).toBe(true);
  });
});
