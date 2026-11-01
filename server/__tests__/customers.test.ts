import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { hasDb } from "./testEnv";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

function createEmployeeContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "employee-user",
    email: "employee@example.com",
    name: "Employee User",
    loginMethod: "manus",
    role: "employee",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

function createRegularUserContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 3,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe.skipIf(!hasDb())("customers router", () => {
  it("admin can list customers", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    // This should not throw - admin has access
    const result = await caller.customers.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("employee can list customers", async () => {
    const { ctx } = createEmployeeContext();
    const caller = appRouter.createCaller(ctx);
    
    // This should not throw - employee has access
    const result = await caller.customers.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("regular user cannot list customers", async () => {
    const { ctx } = createRegularUserContext();
    const caller = appRouter.createCaller(ctx);
    
    // This should throw - regular user does not have staff access
    await expect(caller.customers.list()).rejects.toThrow();
  });

  it("employee can create customer with proper code format", async () => {
    const { ctx } = createEmployeeContext();
    const caller = appRouter.createCaller(ctx);
    
    // Test customer creation - should generate AZ{number}(Name) format
    // Note: This test will interact with the database
    const uniqueMobile = `+964750${Date.now().toString().slice(-7)}`;
    try {
      const result = await caller.customers.create({
        fullName: "Test Customer",
        mobileNumber: uniqueMobile,
        password: "testpassword123",
      });
      
      // Verify customer code format: AZ{number}(Name)
      expect(result.customerCode).toMatch(/^AZ\d+\(Test Customer\)$/);
      expect(result.fullName).toBe("Test Customer");
      expect(result.mobileNumber).toBe(uniqueMobile);
    } catch (error: any) {
      // If customer already exists with this mobile, that's expected in repeated test runs
      if (!error.message?.includes("already") && !error.message?.includes("registered")) {
        throw error;
      }
    }
  });
});

describe.skipIf(!hasDb())("auth router", () => {
  it("returns current user from me query", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Admin User");
    expect(result?.role).toBe("admin");
  });

  it("logout clears session and returns success", async () => {
    const clearedCookies: CookieCall[] = [];
    const user: AuthenticatedUser = {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    const ctx: TrpcContext = {
      user,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        clearCookie: (name: string, options: Record<string, unknown>) => {
          clearedCookies.push({ name, options });
        },
      } as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    
    expect(result).toEqual({ success: true });
    expect(clearedCookies.length).toBe(1);
  });
});

describe.skipIf(!hasDb())("role-based access control", () => {
  it("admin can access admin procedures", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    // Admin should be able to list users
    const result = await caller.users.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("employee cannot access admin procedures", async () => {
    const { ctx } = createEmployeeContext();
    const caller = appRouter.createCaller(ctx);
    
    // Employee should not be able to list users (admin only)
    await expect(caller.users.list()).rejects.toThrow();
  });

  it("accountant can access accounting procedures", async () => {
    const user: AuthenticatedUser = {
      id: 4,
      openId: "accountant-user",
      email: "accountant@example.com",
      name: "Accountant User",
      loginMethod: "manus",
      role: "accountant",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    const ctx: TrpcContext = {
      user,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        clearCookie: () => {},
      } as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);
    
    // Accountant should be able to list invoices (accountant access)
    const result = await caller.invoices.list();
    expect(Array.isArray(result)).toBe(true);
  });
});
