import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import { hasDb } from "./testEnv";

const createTestContext = (role: "admin" | "employee" | "accountant" | "customer" = "admin") => ({
  user: {
    id: 1,
    openId: "test-user-123",
    name: "Test User",
    email: "test@example.com",
    role: role,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  req: {} as any,
  res: {
    cookie: () => {},
    clearCookie: () => {},
  } as any,
});

describe.skipIf(!hasDb())("Label Templates", () => {
  let adminCtx: any;
  let createdTemplateId: number;

  beforeAll(async () => {
    adminCtx = await createTestContext("admin");
  });

  it("should ensure default label template exists", async () => {
    const caller = appRouter.createCaller(adminCtx);
    const result = await caller.labelTemplates.ensureDefault();
    expect(result).toBeDefined();
    expect(result.isDefault).toBe(true);
  });

  it("should list label templates", async () => {
    const caller = appRouter.createCaller(adminCtx);
    const templates = await caller.labelTemplates.list();
    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThanOrEqual(1);
  });

  it("should get default label template", async () => {
    const caller = appRouter.createCaller(adminCtx);
    const template = await caller.labelTemplates.getDefault();
    expect(template).toBeDefined();
    expect(template?.isDefault).toBe(true);
  });

  it("should create a new label template", async () => {
    const caller = appRouter.createCaller(adminCtx);
    const result = await caller.labelTemplates.create({
      name: "Test Label Template",
      size: "10x10",
      widthMm: 100,
      heightMm: 100,
      showQrCode: true,
      qrCodeSize: 60,
      qrCodePosition: "top-left",
      showTrackingNumber: true,
      showCustomerName: true,
      primaryColor: "#ff5500",
    });
    expect(result).toBeDefined();
    expect(result.name).toBe("Test Label Template");
    expect(result.size).toBe("10x10");
    createdTemplateId = result.id;
  });

  it("should get label template by ID", async () => {
    const caller = appRouter.createCaller(adminCtx);
    const template = await caller.labelTemplates.getById({ id: createdTemplateId });
    expect(template).toBeDefined();
    expect(template?.name).toBe("Test Label Template");
  });

  it("should update a label template", async () => {
    const caller = appRouter.createCaller(adminCtx);
    const result = await caller.labelTemplates.update({
      id: createdTemplateId,
      name: "Updated Label Template",
      primaryColor: "#00ff00",
    });
    expect(result).toBeDefined();
    expect(result.name).toBe("Updated Label Template");
    expect(result.primaryColor).toBe("#00ff00");
  });

  it("should set a template as default", async () => {
    const caller = appRouter.createCaller(adminCtx);
    const result = await caller.labelTemplates.setDefault({ id: createdTemplateId });
    expect(result).toBeDefined();
    expect(result.isDefault).toBe(true);
  });

  it("should delete a label template", async () => {
    const caller = appRouter.createCaller(adminCtx);
    // First create a new template to delete (can't delete default)
    const newTemplate = await caller.labelTemplates.create({
      name: "Template to Delete",
      size: "A6",
    });
    
    const result = await caller.labelTemplates.delete({ id: newTemplate.id });
    expect(result.success).toBe(true);
    
    // Verify it's deleted
    const deleted = await caller.labelTemplates.getById({ id: newTemplate.id });
    expect(deleted).toBeFalsy();
  });
});

describe.skipIf(!hasDb())("Notification Templates", () => {
  let adminCtx: any;

  beforeAll(async () => {
    adminCtx = await createTestContext("admin");
  });

  it("should ensure default notification templates exist", async () => {
    const caller = appRouter.createCaller(adminCtx);
    const result = await caller.notificationTemplates.ensureDefaults();
    expect(result.success).toBe(true);
  });

  it("should list notification templates", async () => {
    const caller = appRouter.createCaller(adminCtx);
    const templates = await caller.notificationTemplates.list();
    expect(Array.isArray(templates)).toBe(true);
  });

  it("should get notification template by event type", async () => {
    const caller = appRouter.createCaller(adminCtx);
    // First ensure defaults exist
    await caller.notificationTemplates.ensureDefaults();
    
    const template = await caller.notificationTemplates.getByEvent({ eventType: "package_received" });
    // May or may not exist depending on defaults
    if (template) {
      expect(template.eventType).toBe("package_received");
    }
  });

  it("should create a notification template", async () => {
    const caller = appRouter.createCaller(adminCtx);
    const result = await caller.notificationTemplates.create({
      eventType: "custom",
      name: "Test Custom Notification",
      isActive: true,
      smsTemplate: "Test SMS: {trackingNumber}",
      smsTemplateKu: "تاقیکردنەوە: {trackingNumber}",
    });
    expect(result).toBeDefined();
    expect(result.name).toBe("Test Custom Notification");
    expect(result.eventType).toBe("custom");
  });

  it("should update a notification template", async () => {
    const caller = appRouter.createCaller(adminCtx);
    const templates = await caller.notificationTemplates.list();
    
    if (templates.length > 0) {
      const result = await caller.notificationTemplates.update({
        id: templates[0].id,
        isActive: false,
      });
      expect(result).toBeDefined();
      expect(result.isActive).toBe(false);
      
      // Restore
      await caller.notificationTemplates.update({
        id: templates[0].id,
        isActive: true,
      });
    }
  });
});
