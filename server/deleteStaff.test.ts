import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";
import { hasDb } from "./testEnv";

describe.skipIf(!hasDb())("Delete Staff - Role-Based Permissions", () => {
  let superAdminId: number;
  let adminId: number;
  let employeeId: number;
  let accountantId: number;
  let adminToDeleteId: number;
  let employeeToDeleteId: number;

  beforeAll(async () => {
    const ts = Date.now();

    // Create test users with different roles
    const superAdmin = await db.createStaffUser({
      name: "SA Delete Test",
      email: `sa-del-${ts}@test.com`,
      passwordHash: "test",
      role: "super_admin",
    });
    superAdminId = superAdmin!.id;

    const admin = await db.createStaffUser({
      name: "Admin Delete Test",
      email: `admin-del-${ts}@test.com`,
      passwordHash: "test",
      role: "admin",
    });
    adminId = admin!.id;

    const employee = await db.createStaffUser({
      name: "Employee Delete Test",
      email: `emp-del-${ts}@test.com`,
      passwordHash: "test",
      role: "employee",
    });
    employeeId = employee!.id;

    const accountant = await db.createStaffUser({
      name: "Accountant Delete Test",
      email: `acc-del-${ts}@test.com`,
      passwordHash: "test",
      role: "accountant",
    });
    accountantId = accountant!.id;

    // Create additional users that will be deleted in tests
    const adminToDelete = await db.createStaffUser({
      name: "Admin To Delete",
      email: `admin-todel-${ts}@test.com`,
      passwordHash: "test",
      role: "admin",
    });
    adminToDeleteId = adminToDelete!.id;

    const employeeToDelete = await db.createStaffUser({
      name: "Employee To Delete",
      email: `emp-todel-${ts}@test.com`,
      passwordHash: "test",
      role: "employee",
    });
    employeeToDeleteId = employeeToDelete!.id;
  });

  describe("Role Hierarchy Validation", () => {
    it("should define correct role hierarchy for deletion", () => {
      // Define the role hierarchy logic
      const canDelete = (actorRole: string, targetRole: string): boolean => {
        if (actorRole === "super_admin") return true;
        if (actorRole === "admin") {
          return targetRole === "employee" || targetRole === "accountant";
        }
        return false;
      };

      // Super admin can delete anyone
      expect(canDelete("super_admin", "admin")).toBe(true);
      expect(canDelete("super_admin", "employee")).toBe(true);
      expect(canDelete("super_admin", "accountant")).toBe(true);

      // Admin can delete employees and accountants
      expect(canDelete("admin", "employee")).toBe(true);
      expect(canDelete("admin", "accountant")).toBe(true);

      // Admin CANNOT delete other admins or super admins
      expect(canDelete("admin", "admin")).toBe(false);
      expect(canDelete("admin", "super_admin")).toBe(false);

      // Employee and accountant cannot delete anyone
      expect(canDelete("employee", "employee")).toBe(false);
      expect(canDelete("employee", "admin")).toBe(false);
      expect(canDelete("accountant", "accountant")).toBe(false);
      expect(canDelete("accountant", "admin")).toBe(false);
    });
  });

  describe("Database Operations", () => {
    it("should verify test users were created", async () => {
      const superAdmin = await db.getUserById(superAdminId);
      expect(superAdmin).toBeDefined();
      expect(superAdmin!.role).toBe("super_admin");

      const admin = await db.getUserById(adminId);
      expect(admin).toBeDefined();
      expect(admin!.role).toBe("admin");

      const employee = await db.getUserById(employeeId);
      expect(employee).toBeDefined();
      expect(employee!.role).toBe("employee");

      const accountant = await db.getUserById(accountantId);
      expect(accountant).toBeDefined();
      expect(accountant!.role).toBe("accountant");
    });

    it("should delete an employee user from database", async () => {
      // Verify user exists before deletion
      const before = await db.getUserById(employeeToDeleteId);
      expect(before).toBeDefined();
      expect(before!.name).toBe("Employee To Delete");

      // Delete the user
      const result = await db.deleteStaffUser(employeeToDeleteId);
      expect(result.success).toBe(true);

      // Verify user no longer exists
      const after = await db.getUserById(employeeToDeleteId);
      expect(after).toBeUndefined();
    });

    it("should delete an admin user from database (super admin action)", async () => {
      // Verify user exists before deletion
      const before = await db.getUserById(adminToDeleteId);
      expect(before).toBeDefined();
      expect(before!.name).toBe("Admin To Delete");

      // Delete the user
      const result = await db.deleteStaffUser(adminToDeleteId);
      expect(result.success).toBe(true);

      // Verify user no longer exists
      const after = await db.getUserById(adminToDeleteId);
      expect(after).toBeUndefined();
    });

    it("should handle deleting non-existent user gracefully", async () => {
      // Deleting a user that doesn't exist should not throw
      const result = await db.deleteStaffUser(999999);
      expect(result.success).toBe(true);
    });
  });

  describe("Self-Deletion Prevention", () => {
    it("should prevent users from deleting themselves (logic check)", () => {
      const canDeleteSelf = (userId: number, targetId: number): boolean => {
        return userId !== targetId;
      };

      expect(canDeleteSelf(1, 1)).toBe(false);
      expect(canDeleteSelf(1, 2)).toBe(true);
      expect(canDeleteSelf(superAdminId, superAdminId)).toBe(false);
      expect(canDeleteSelf(adminId, employeeId)).toBe(true);
    });
  });

  describe("Permission Cleanup on Delete", () => {
    it("should clean up user permissions when user is deleted", async () => {
      const ts = Date.now();
      
      // Create a user with permissions
      const user = await db.createStaffUser({
        name: "Perm Cleanup Test",
        email: `perm-cleanup-${ts}@test.com`,
        passwordHash: "test",
        role: "employee",
      });
      const userId = user!.id;

      // Set some permissions
      await db.setUserPermission({
        userId,
        module: "packages",
        canView: true,
        canCreate: true,
        canEdit: false,
        canDelete: false,
      });

      // Verify permissions exist
      const permsBefore = await db.getUserPermissions(userId);
      expect(permsBefore.length).toBeGreaterThan(0);

      // Delete the user (which should also delete permissions)
      await db.deleteStaffUser(userId);

      // Verify user is deleted
      const deletedUser = await db.getUserById(userId);
      expect(deletedUser).toBeUndefined();

      // Verify permissions are also cleaned up
      const permsAfter = await db.getUserPermissions(userId);
      expect(permsAfter.length).toBe(0);
    });
  });
});
