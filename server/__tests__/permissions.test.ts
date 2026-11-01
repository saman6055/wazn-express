import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import { hasDb } from "./testEnv";

describe.skipIf(!hasDb())("Permissions System", () => {
  let testUserId: number;
  let testAdminId: number;

  beforeAll(async () => {
    // Create a test employee user
    const employee = await db.createStaffUser({
      name: "Test Employee",
      email: `test-employee-${Date.now()}@test.com`,
      role: "employee",
      password: "testpass123",
    });
    testUserId = employee.id;

    // Create a test admin user
    const admin = await db.createStaffUser({
      name: "Test Admin",
      email: `test-admin-${Date.now()}@test.com`,
      role: "admin",
      password: "testpass123",
    });
    testAdminId = admin.id;
  });

  afterAll(async () => {
    // Clean up test users and their permissions
    if (testUserId) {
      await db.deleteUserPermissions(testUserId);
    }
    if (testAdminId) {
      await db.deleteUserPermissions(testAdminId);
    }
  });

  it("should create and retrieve user permissions", async () => {
    // Set permissions for packages module
    const permission = await db.setUserPermission({
      userId: testUserId,
      module: "packages",
      canView: true,
      canCreate: true,
      canEdit: false,
      canDelete: false,
    });

    expect(permission).toBeDefined();
    expect(permission?.module).toBe("packages");
    expect(permission?.canView).toBe(true);
    expect(permission?.canCreate).toBe(true);
    expect(permission?.canEdit).toBe(false);
    expect(permission?.canDelete).toBe(false);

    // Retrieve permissions
    const permissions = await db.getUserPermissions(testUserId);
    expect(permissions.length).toBeGreaterThan(0);
    expect(permissions.some(p => p.module === "packages")).toBe(true);
  });

  it("should check user permissions correctly", async () => {
    // Set permissions
    await db.setUserPermission({
      userId: testUserId,
      module: "customers",
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    });

    // Check permissions
    const canView = await db.checkUserPermission(testUserId, "customers", "view");
    const canCreate = await db.checkUserPermission(testUserId, "customers", "create");
    const canEdit = await db.checkUserPermission(testUserId, "customers", "edit");
    const canDelete = await db.checkUserPermission(testUserId, "customers", "delete");

    expect(canView).toBe(true);
    expect(canCreate).toBe(false);
    expect(canEdit).toBe(false);
    expect(canDelete).toBe(false);
  });

  it("should create and check sub-permissions", async () => {
    // Set sub-permission
    const subPerm = await db.setUserSubPermission({
      userId: testUserId,
      module: "packages",
      permissionKey: "view_prices",
      isAllowed: true,
    });

    expect(subPerm).toBeDefined();
    expect(subPerm?.isAllowed).toBe(true);

    // Check sub-permission
    const hasSubPerm = await db.checkUserSubPermission(
      testUserId,
      "packages",
      "view_prices"
    );
    expect(hasSubPerm).toBe(true);

    // Check non-existent sub-permission
    const hasOtherSubPerm = await db.checkUserSubPermission(
      testUserId,
      "packages",
      "edit_prices"
    );
    expect(hasOtherSubPerm).toBe(false);
  });

  it("should update existing permissions", async () => {
    // Create initial permission
    await db.setUserPermission({
      userId: testUserId,
      module: "invoices",
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    });

    // Update permission
    const updated = await db.setUserPermission({
      userId: testUserId,
      module: "invoices",
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: false,
    });

    expect(updated?.canCreate).toBe(true);
    expect(updated?.canEdit).toBe(true);

    // Verify update
    const canCreate = await db.checkUserPermission(testUserId, "invoices", "create");
    const canEdit = await db.checkUserPermission(testUserId, "invoices", "edit");
    expect(canCreate).toBe(true);
    expect(canEdit).toBe(true);
  });

  it("should bulk update permissions", async () => {
    await db.bulkUpdateUserPermissions({
      userId: testUserId,
      permissions: [
        {
          module: "batches",
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: false,
        },
        {
          module: "reports",
          canView: true,
          canCreate: false,
          canEdit: false,
          canDelete: false,
        },
      ],
      subPermissions: [
        {
          module: "batches",
          permissionKey: "finalize_batch",
          isAllowed: true,
        },
        {
          module: "reports",
          permissionKey: "export_reports",
          isAllowed: true,
        },
      ],
    });

    // Verify bulk update
    const permissions = await db.getUserPermissions(testUserId);
    const subPermissions = await db.getUserSubPermissions(testUserId);

    expect(permissions.some(p => p.module === "batches")).toBe(true);
    expect(permissions.some(p => p.module === "reports")).toBe(true);
    expect(subPermissions.some(sp => sp.permissionKey === "finalize_batch")).toBe(true);
    expect(subPermissions.some(sp => sp.permissionKey === "export_reports")).toBe(true);
  });

  it("should grant all permissions to super_admin", async () => {
    // Create super admin
    const superAdmin = await db.createStaffUser({
      name: "Super Admin Test",
      email: `super-admin-${Date.now()}@test.com`,
      role: "super_admin",
      password: "testpass123",
    });

    // Super admin should have all permissions without explicit grants
    const canView = await db.checkUserPermission(superAdmin!.id, "packages", "view");
    const canCreate = await db.checkUserPermission(superAdmin!.id, "packages", "create");
    const canEdit = await db.checkUserPermission(superAdmin!.id, "packages", "edit");
    const canDelete = await db.checkUserPermission(superAdmin!.id, "packages", "delete");

    expect(canView).toBe(true);
    expect(canCreate).toBe(true);
    expect(canEdit).toBe(true);
    expect(canDelete).toBe(true);

    // Check sub-permissions
    const hasSubPerm = await db.checkUserSubPermission(
      superAdmin!.id,
      "packages",
      "view_prices"
    );
    expect(hasSubPerm).toBe(true);
  });

  it("should delete all user permissions", async () => {
    // Set some permissions
    await db.setUserPermission({
      userId: testUserId,
      module: "warehouse",
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
    });

    await db.setUserSubPermission({
      userId: testUserId,
      module: "warehouse",
      permissionKey: "receive_packages",
      isAllowed: true,
    });

    // Delete all permissions
    await db.deleteUserPermissions(testUserId);

    // Verify deletion
    const permissions = await db.getUserPermissions(testUserId);
    const subPermissions = await db.getUserSubPermissions(testUserId);

    expect(permissions.length).toBe(0);
    expect(subPermissions.length).toBe(0);
  });
});
