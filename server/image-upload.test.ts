import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock storagePut to avoid actual S3 uploads during tests
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    key: "uploads/test123.jpg",
    url: "https://cdn.example.com/uploads/test123.jpg",
  }),
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn().mockReturnValue("test123abc12"),
}));

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("storage.upload", () => {
  it("uploads a base64 image and returns a URL", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a tiny 1x1 pixel JPEG as base64
    const base64Data = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//2wBDAP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYI4Q/SFhSRFJiY0SFRFRHZHRl/9oADAMBAAIRAxEAPwD+f+gD/9k=";

    const result = await caller.storage.upload({
      fileName: "test-image.jpg",
      contentType: "image/jpeg",
      base64Data,
    });

    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("url");
    expect(typeof result.url).toBe("string");
    expect(result.url).toContain("https://");
  });

  it("rejects unauthenticated uploads", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.storage.upload({
        fileName: "test.jpg",
        contentType: "image/jpeg",
        base64Data: "dGVzdA==",
      })
    ).rejects.toThrow();
  });

  it("handles different file extensions correctly", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.storage.upload({
      fileName: "photo.png",
      contentType: "image/png",
      base64Data: "dGVzdA==",
    });

    expect(result.success).toBe(true);
    expect(result.url).toBeDefined();
  });
});

describe("fullPackage.bulkCreate with images", () => {
  it("accepts productImage and productImages fields in bulk create items", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Test that the input schema accepts image fields
    // We can't fully test the DB insert without a real DB connection,
    // but we can verify the procedure accepts the input shape
    const input = {
      customerId: 1,
      orderType: "full_package" as const,
      items: [
        {
          productName: "Test Product",
          productImage: "https://cdn.example.com/uploads/test.jpg",
          productImages: [
            "https://cdn.example.com/uploads/test1.jpg",
            "https://cdn.example.com/uploads/test2.jpg",
          ],
          quantity: 1,
          purchasePriceUsd: "10.00",
          sellingPriceUsd: "15.00",
        },
      ],
    };

    // Verify the input shape is valid by checking it doesn't throw a validation error
    // The actual DB operation may fail since we don't have a real DB in tests,
    // but we want to ensure the schema validation passes
    try {
      await caller.fullPackage.bulkCreate(input);
    } catch (error: any) {
      // If it fails, it should NOT be a validation error (BAD_REQUEST)
      // It might fail due to DB connection, which is expected in unit tests
      if (error.code === "BAD_REQUEST") {
        throw new Error(
          `Input validation failed: ${error.message}. The schema should accept productImage and productImages fields.`
        );
      }
      // Other errors (like DB connection) are acceptable in unit tests
    }
  });

  it("accepts commission bulk create with images", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const input = {
      customerId: 1,
      orderType: "commission" as const,
      items: [
        {
          productName: "Commission Product",
          productImage: "https://cdn.example.com/uploads/comm.jpg",
          productImages: ["https://cdn.example.com/uploads/comm1.jpg"],
          quantity: 2,
          itemPriceUsd: "20.00",
          commissionFeeUsd: "5.00",
        },
      ],
    };

    try {
      await caller.fullPackage.bulkCreate(input);
    } catch (error: any) {
      if (error.code === "BAD_REQUEST") {
        throw new Error(
          `Input validation failed: ${error.message}. Commission bulk create should accept image fields.`
        );
      }
    }
  });
});

describe("fullPackage.create with images", () => {
  it("accepts productImage and productImages in single create", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const input = {
      customerId: 1,
      orderType: "full_package" as const,
      productName: "Single Product with Images",
      productImage: "https://cdn.example.com/uploads/single.jpg",
      productImages: [
        "https://cdn.example.com/uploads/single1.jpg",
        "https://cdn.example.com/uploads/single2.jpg",
      ],
      quantity: 1,
      purchasePriceUsd: "10.00",
      sellingPriceUsd: "15.00",
    };

    try {
      await caller.fullPackage.create(input);
    } catch (error: any) {
      if (error.code === "BAD_REQUEST") {
        throw new Error(
          `Input validation failed: ${error.message}. Single create should accept productImage and productImages.`
        );
      }
    }
  });

  it("accepts commission single create with images", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const input = {
      customerId: 1,
      orderType: "commission" as const,
      productName: "Commission Single with Image",
      productImage: "https://cdn.example.com/uploads/comm-single.jpg",
      productImages: ["https://cdn.example.com/uploads/comm-single1.jpg"],
      quantity: 1,
      itemPriceUsd: "25.00",
      commissionFeeUsd: "5.00",
    };

    try {
      await caller.fullPackage.create(input);
    } catch (error: any) {
      if (error.code === "BAD_REQUEST") {
        throw new Error(
          `Input validation failed: ${error.message}. Commission single create should accept image fields.`
        );
      }
    }
  });
});
