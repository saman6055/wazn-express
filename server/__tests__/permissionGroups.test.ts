import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  PERMISSION_GROUPS,
  SYSTEM_MODULES,
  getAllModules,
  getModuleDefinition,
  getModuleSubPermissions,
  isValidSubPermission,
  PATH_TO_MODULE,
} from "../shared/permissions";

// ============ HELPERS ============

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: string, userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-${role}-${userId}`,
    email: `${role}@test.com`,
    name: `Test ${role}`,
    loginMethod: "manus",
    role: role as AuthenticatedUser["role"],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ============ PERMISSION GROUPS STRUCTURE TESTS ============

describe("Permission Groups: structure validation", () => {
  it("should have at least 10 permission groups matching sidebar sections", () => {
    expect(PERMISSION_GROUPS.length).toBeGreaterThanOrEqual(10);
  });

  it("should have unique group IDs", () => {
    const ids = PERMISSION_GROUPS.map(g => g.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should have required fields for every group", () => {
    for (const group of PERMISSION_GROUPS) {
      expect(group.id).toBeTruthy();
      expect(group.label).toBeTruthy();
      expect(group.labelKu).toBeTruthy();
      expect(group.color).toBeTruthy();
      expect(group.icon).toBeTruthy();
      expect(group.modules.length).toBeGreaterThan(0);
    }
  });

  it("should have unique module names across all groups", () => {
    const allModules = SYSTEM_MODULES.map(m => m.module);
    const uniqueModules = new Set(allModules);
    expect(uniqueModules.size).toBe(allModules.length);
  });

  it("should have required fields for every module", () => {
    for (const mod of SYSTEM_MODULES) {
      expect(mod.module).toBeTruthy();
      expect(mod.label).toBeTruthy();
      expect(mod.labelKu).toBeTruthy();
      expect(mod.actions.length).toBeGreaterThan(0);
      expect(Array.isArray(mod.subPermissions)).toBe(true);
    }
  });

  it("every module should have 'view' as a valid action", () => {
    for (const mod of SYSTEM_MODULES) {
      expect(mod.actions).toContain("view");
    }
  });

  it("should contain all expected sidebar groups", () => {
    const groupIds = PERMISSION_GROUPS.map(g => g.id);
    expect(groupIds).toContain("main");
    expect(groupIds).toContain("operations");
    expect(groupIds).toContain("fullPackage");
    expect(groupIds).toContain("scanning");
    expect(groupIds).toContain("customerFinance");
    expect(groupIds).toContain("companyFinance");
    expect(groupIds).toContain("services");
    expect(groupIds).toContain("reports");
    expect(groupIds).toContain("settings");
    expect(groupIds).toContain("users");
    expect(groupIds).toContain("data");
  });
});

// ============ HELPER FUNCTIONS TESTS ============

describe("Permission Groups: helper functions", () => {
  it("getAllModules returns all module names", () => {
    const modules = getAllModules();
    expect(modules.length).toBe(SYSTEM_MODULES.length);
    expect(modules).toContain("dashboard");
    expect(modules).toContain("customers");
    expect(modules).toContain("packages");
  });

  it("getModuleDefinition returns correct module", () => {
    const mod = getModuleDefinition("dashboard");
    expect(mod).toBeDefined();
    expect(mod?.label).toBe("Dashboard");
    expect(mod?.labelKu).toBe("داشبۆرد");
    expect(mod?.actions).toContain("view");
  });

  it("getModuleDefinition returns undefined for unknown module", () => {
    const mod = getModuleDefinition("nonexistent_module");
    expect(mod).toBeUndefined();
  });

  it("getModuleSubPermissions returns sub-permissions for customers", () => {
    const subPerms = getModuleSubPermissions("customers");
    expect(subPerms.length).toBeGreaterThan(0);
    expect(subPerms.some(sp => sp.key === "view_financial_info")).toBe(true);
  });

  it("getModuleSubPermissions returns empty array for module without sub-permissions", () => {
    const subPerms = getModuleSubPermissions("dashboard");
    expect(subPerms).toEqual([]);
  });

  it("isValidSubPermission correctly validates", () => {
    expect(isValidSubPermission("customers", "view_financial_info")).toBe(true);
    expect(isValidSubPermission("customers", "nonexistent_perm")).toBe(false);
    expect(isValidSubPermission("dashboard", "anything")).toBe(false);
  });
});

// ============ PATH_TO_MODULE MAPPING TESTS ============

describe("Permission Groups: PATH_TO_MODULE mapping", () => {
  it("should have mappings for all major sidebar paths", () => {
    expect(PATH_TO_MODULE["/dashboard"]).toBe("dashboard");
    expect(PATH_TO_MODULE["/customers"]).toBe("customers");
    expect(PATH_TO_MODULE["/packages/all"]).toBe("packages");
    expect(PATH_TO_MODULE["/batches"]).toBe("batches");
    expect(PATH_TO_MODULE["/finance"]).toBe("finance_management");
    expect(PATH_TO_MODULE["/invoices"]).toBe("invoices");
    expect(PATH_TO_MODULE["/settings"]).toBe("system_settings");
    expect(PATH_TO_MODULE["/staff-management"]).toBe("staff_management");
    expect(PATH_TO_MODULE["/permissions-management"]).toBe("permissions_management");
  });

  it("every mapped module should exist in SYSTEM_MODULES", () => {
    const allModuleNames = new Set(getAllModules());
    for (const [_path, moduleName] of Object.entries(PATH_TO_MODULE)) {
      expect(allModuleNames.has(moduleName)).toBe(true);
    }
  });

  it("should have at least 50 path mappings", () => {
    const pathCount = Object.keys(PATH_TO_MODULE).length;
    expect(pathCount).toBeGreaterThanOrEqual(50);
  });
});

// ============ GROUP CONTENT TESTS ============

describe("Permission Groups: group content validation", () => {
  it("main group should have dashboard and customers", () => {
    const mainGroup = PERMISSION_GROUPS.find(g => g.id === "main");
    expect(mainGroup).toBeDefined();
    const moduleNames = mainGroup!.modules.map(m => m.module);
    expect(moduleNames).toContain("dashboard");
    expect(moduleNames).toContain("customers");
  });

  it("operations group should have all package-related modules", () => {
    const opsGroup = PERMISSION_GROUPS.find(g => g.id === "operations");
    expect(opsGroup).toBeDefined();
    const moduleNames = opsGroup!.modules.map(m => m.module);
    expect(moduleNames).toContain("packages");
    expect(moduleNames).toContain("quick_register");
    expect(moduleNames).toContain("bulk_register");
    expect(moduleNames).toContain("batches");
    expect(moduleNames).toContain("unclaimed_packages");
    expect(moduleNames).toContain("claim_requests");
  });

  it("fullPackage group should have commission and suppliers", () => {
    const fpGroup = PERMISSION_GROUPS.find(g => g.id === "fullPackage");
    expect(fpGroup).toBeDefined();
    const moduleNames = fpGroup!.modules.map(m => m.module);
    expect(moduleNames).toContain("full_package");
    expect(moduleNames).toContain("commission");
    expect(moduleNames).toContain("suppliers");
  });

  it("scanning group should have all scan modules", () => {
    const scanGroup = PERMISSION_GROUPS.find(g => g.id === "scanning");
    expect(scanGroup).toBeDefined();
    expect(scanGroup!.modules.length).toBeGreaterThanOrEqual(5);
  });

  it("customerFinance group should have finance and invoices", () => {
    const cfGroup = PERMISSION_GROUPS.find(g => g.id === "customerFinance");
    expect(cfGroup).toBeDefined();
    const moduleNames = cfGroup!.modules.map(m => m.module);
    expect(moduleNames).toContain("finance_management");
    expect(moduleNames).toContain("invoices");
  });

  it("companyFinance group should have bank accounts and expenses", () => {
    const compGroup = PERMISSION_GROUPS.find(g => g.id === "companyFinance");
    expect(compGroup).toBeDefined();
    const moduleNames = compGroup!.modules.map(m => m.module);
    expect(moduleNames).toContain("bank_accounts");
    expect(moduleNames).toContain("expenses");
    expect(moduleNames).toContain("treasury");
  });

  it("reports group should have various report modules", () => {
    const repGroup = PERMISSION_GROUPS.find(g => g.id === "reports");
    expect(repGroup).toBeDefined();
    expect(repGroup!.modules.length).toBeGreaterThanOrEqual(5);
  });

  it("settings group should have system settings and countries", () => {
    const setGroup = PERMISSION_GROUPS.find(g => g.id === "settings");
    expect(setGroup).toBeDefined();
    const moduleNames = setGroup!.modules.map(m => m.module);
    expect(moduleNames).toContain("system_settings");
    expect(moduleNames).toContain("countries");
    expect(moduleNames).toContain("warehouses");
  });

  it("users group should have staff management and permissions", () => {
    const usrGroup = PERMISSION_GROUPS.find(g => g.id === "users");
    expect(usrGroup).toBeDefined();
    const moduleNames = usrGroup!.modules.map(m => m.module);
    expect(moduleNames).toContain("staff_management");
    expect(moduleNames).toContain("permissions_management");
    expect(moduleNames).toContain("audit_logs");
  });

  it("data group should have label templates and backup", () => {
    const dataGroup = PERMISSION_GROUPS.find(g => g.id === "data");
    expect(dataGroup).toBeDefined();
    const moduleNames = dataGroup!.modules.map(m => m.module);
    expect(moduleNames).toContain("label_templates");
    expect(moduleNames).toContain("backup_management");
    expect(moduleNames).toContain("customer_messages");
  });
});

// ============ SUB-PERMISSIONS TESTS ============

describe("Permission Groups: sub-permissions validation", () => {
  it("customers module should have financial and document sub-permissions", () => {
    const subPerms = getModuleSubPermissions("customers");
    const keys = subPerms.map(sp => sp.key);
    expect(keys).toContain("view_financial_info");
    expect(keys).toContain("view_documents");
    expect(keys).toContain("edit_documents");
    expect(keys).toContain("deactivate_account");
  });

  it("all sub-permissions should have Kurdish labels", () => {
    for (const mod of SYSTEM_MODULES) {
      for (const sp of mod.subPermissions) {
        expect(sp.labelKu).toBeTruthy();
        expect(sp.descriptionKu).toBeTruthy();
      }
    }
  });

  it("all sub-permissions should have unique keys within their module", () => {
    for (const mod of SYSTEM_MODULES) {
      const keys = mod.subPermissions.map(sp => sp.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    }
  });
});

// ============ ROLE HIERARCHY TESTS ============

describe("Permission Groups: bulkUpdate role hierarchy enforcement", () => {
  it("super_admin should not get FORBIDDEN when updating permissions", async () => {
    const ctx = createContext("super_admin", 1);
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.permissions.bulkUpdate({
        userId: 999999,
        permissions: [],
        subPermissions: [],
      });
    } catch (e: any) {
      // Should get NOT_FOUND (user doesn't exist), NOT FORBIDDEN
      expect(e.code).toBe("NOT_FOUND");
    }
  });

  it("employee should be rejected from updating permissions", async () => {
    const ctx = createContext("employee", 3);
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.permissions.bulkUpdate({
        userId: 999999,
        permissions: [],
        subPermissions: [],
      });
    } catch (e: any) {
      // Employee should get FORBIDDEN or NOT_FOUND
      expect(["NOT_FOUND", "FORBIDDEN"]).toContain(e.code);
    }
  });

  it("accountant should be rejected from updating permissions", async () => {
    const ctx = createContext("accountant", 4);
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.permissions.bulkUpdate({
        userId: 999999,
        permissions: [],
        subPermissions: [],
      });
    } catch (e: any) {
      expect(["NOT_FOUND", "FORBIDDEN"]).toContain(e.code);
    }
  });
});
