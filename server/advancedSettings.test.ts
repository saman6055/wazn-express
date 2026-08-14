import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { hasDb } from "./testEnv";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-test",
      email: "admin@test.com",
      name: "Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as any,
    res: {} as any,
  };
}

describe.skipIf(!hasDb())("Advanced Settings System", () => {
  let adminCaller: ReturnType<typeof appRouter.createCaller>;
  let testCurrencyId: number;
  let testTaxRateId: number;
  let testEmailTemplateId: number;
  let testIpWhitelistId: number;

  beforeAll(() => {
    adminCaller = appRouter.createCaller(createAdminContext());
  });

  describe("Currency Management", () => {
    it("should create a new currency", async () => {
      const result = await adminCaller.advancedSettings.createCurrency({
        code: "EUR",
        name: "Euro",
        symbol: "€",
        exchangeRate: "0.85",
        isBaseCurrency: false,
      });

      expect(result.success).toBe(true);
      expect(result.currency).toBeDefined();
      expect(result.currency?.code).toBe("EUR");
      if (result.currency?.id) {
        testCurrencyId = result.currency.id;
      }
    });

    it("should get all currencies", async () => {
      const currencies = await adminCaller.advancedSettings.getAllCurrencies();
      expect(currencies.length).toBeGreaterThan(0);
      expect(currencies.some(c => c.code === "EUR")).toBe(true);
    });

    it("should update a currency", async () => {
      const result = await adminCaller.advancedSettings.updateCurrency({
        id: testCurrencyId,
        name: "European Euro",
        symbol: "€",
        exchangeRate: "0.90",
      });

      expect(result.success).toBe(true);
      expect(result.currency?.name).toBe("European Euro");
    });

    it("should delete a currency", async () => {
      if (!testCurrencyId) {
        console.log("Skipping delete test - no currency ID");
        return;
      }
      const result = await adminCaller.advancedSettings.deleteCurrency({
        id: testCurrencyId,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Tax Rates Management", () => {
    it("should create a new tax rate", async () => {
      const result = await adminCaller.advancedSettings.createTaxRate({
        name: "VAT Standard",
        rate: "20.00",
        description: "Standard VAT rate",
        region: "EU",
        isDefault: false,
      });

      expect(result.success).toBe(true);
      expect(result.taxRate).toBeDefined();
      expect(result.taxRate?.name).toBe("VAT Standard");
      if (result.taxRate?.id) {
        testTaxRateId = result.taxRate.id;
      }
    });

    it("should get all tax rates", async () => {
      const taxRates = await adminCaller.advancedSettings.getAllTaxRates();
      expect(taxRates.length).toBeGreaterThan(0);
      expect(taxRates.some(t => t.name === "VAT Standard")).toBe(true);
    });

    it("should update a tax rate", async () => {
      const result = await adminCaller.advancedSettings.updateTaxRate({
        id: testTaxRateId,
        rate: "21.00",
        description: "Updated VAT rate",
      });

      expect(result.success).toBe(true);
      expect(result.taxRate?.rate).toBe("21.00");
    });

    it("should delete a tax rate", async () => {
      if (!testTaxRateId) {
        console.log("Skipping delete test - no tax rate ID");
        return;
      }
      const result = await adminCaller.advancedSettings.deleteTaxRate({
        id: testTaxRateId,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Email Templates Management", () => {
    it("should create a new email template", async () => {
      const result = await adminCaller.advancedSettings.createEmailTemplate({
        name: "welcome_email",
        subject: "Welcome {{customerName}}!",
        body: "<p>Hello {{customerName}}, welcome to our service!</p>",
        variables: '["customerName"]',
        category: "notification",
        isActive: true,
      });

      expect(result.success).toBe(true);
      expect(result.template).toBeDefined();
      expect(result.template?.name).toBe("welcome_email");
      if (result.template?.id) {
        testEmailTemplateId = result.template.id;
      }
    });

    it("should get all email templates", async () => {
      const templates = await adminCaller.advancedSettings.getAllEmailTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.name === "welcome_email")).toBe(true);
    });

    it("should get email template by name", async () => {
      const template = await adminCaller.advancedSettings.getEmailTemplateByName({
        name: "welcome_email",
      });

      expect(template).toBeDefined();
      expect(template?.name).toBe("welcome_email");
    });

    it("should update an email template", async () => {
      const result = await adminCaller.advancedSettings.updateEmailTemplate({
        id: testEmailTemplateId,
        subject: "Welcome {{customerName}} to Wazn Express!",
        body: "<p>Hello {{customerName}}, thank you for joining us!</p>",
        isActive: true,
      });

      expect(result.success).toBe(true);
    });

    it("should delete an email template", async () => {
      if (!testEmailTemplateId) {
        console.log("Skipping delete test - no template ID");
        return;
      }
      const result = await adminCaller.advancedSettings.deleteEmailTemplate({
        id: testEmailTemplateId,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("IP Whitelist Management", () => {
    it("should add IP to whitelist", async () => {
      const result = await adminCaller.advancedSettings.addIpToWhitelist({
        ipAddress: "192.168.1.100",
        description: "Office network",
      });

      expect(result.success).toBe(true);
      expect(result.entry).toBeDefined();
      expect(result.entry?.ipAddress).toBe("192.168.1.100");
      if (result.entry?.id) {
        testIpWhitelistId = result.entry.id;
      }
    });

    it("should get all IP whitelist entries", async () => {
      const entries = await adminCaller.advancedSettings.getAllIpWhitelist();
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.some(e => e.ipAddress === "192.168.1.100")).toBe(true);
    });

    it("should check if IP is whitelisted", async () => {
      const isWhitelisted = await adminCaller.advancedSettings.isIpWhitelisted({
        ipAddress: "192.168.1.100",
      });

      expect(isWhitelisted).toBe(true);
    });

    it("should remove IP from whitelist", async () => {
      if (!testIpWhitelistId) {
        console.log("Skipping delete test - no IP whitelist ID");
        return;
      }
      const result = await adminCaller.advancedSettings.removeIpFromWhitelist({
        id: testIpWhitelistId,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("System Settings Management", () => {
    it("should set a system setting", async () => {
      const result = await adminCaller.advancedSettings.setSetting({
        key: "test_setting",
        value: "test_value",
        type: "string",
      });

      expect(result).toBeDefined();
      expect(result?.settingKey).toBe("test_setting");
    });

    it("should get a system setting", async () => {
      const setting = await adminCaller.advancedSettings.getSetting({
        key: "test_setting",
      });

      expect(setting).toBeDefined();
      expect(setting?.settingValue).toBe("test_value");
    });

    it("should get all system settings", async () => {
      const settings = await adminCaller.advancedSettings.getAllSettings();
      expect(settings.length).toBeGreaterThan(0);
      expect(settings.some(s => s.settingKey === "test_setting")).toBe(true);
    });

    it("should update a system setting", async () => {
      const result = await adminCaller.advancedSettings.setSetting({
        key: "test_setting",
        value: "updated_value",
        type: "string",
      });

      expect(result).toBeDefined();

      const setting = await adminCaller.advancedSettings.getSetting({
        key: "test_setting",
      });

      expect(setting?.settingValue).toBe("updated_value");
    });

    // Note: deleteSetting procedure not implemented - settings are updated, not deleted
  });

  describe("Business Configuration Settings", () => {
    it("should set business configuration settings", async () => {
      const settings = [
        { key: "fiscal_year_start", value: "01-01", type: "string" as const },
        { key: "business_hours_start", value: "09:00", type: "string" as const },
        { key: "business_hours_end", value: "17:00", type: "string" as const },
        { key: "default_tax_rate", value: "15", type: "number" as const },
        { key: "auto_numbering_format", value: "INV-{YYYY}-{####}", type: "string" as const },
        { key: "low_stock_threshold", value: "10", type: "number" as const },
      ];

      for (const setting of settings) {
        const result = await adminCaller.advancedSettings.setSetting(setting);
        expect(result).toBeDefined();
      }

      const allSettings = await adminCaller.advancedSettings.getAllSettings();
      expect(allSettings.some(s => s.settingKey === "fiscal_year_start")).toBe(true);
      expect(allSettings.some(s => s.settingKey === "business_hours_start")).toBe(true);
    });
  });

  describe("Security Configuration Settings", () => {
    it("should set security configuration settings", async () => {
      const settings = [
        { key: "enable_2fa", value: "true", type: "boolean" as const },
        { key: "session_timeout", value: "60", type: "number" as const },
        { key: "audit_retention_days", value: "365", type: "number" as const },
        { key: "password_min_length", value: "8", type: "number" as const },
        { key: "require_password_change", value: "false", type: "boolean" as const },
      ];

      for (const setting of settings) {
        const result = await adminCaller.advancedSettings.setSetting(setting);
        expect(result).toBeDefined();
      }

      const allSettings = await adminCaller.advancedSettings.getAllSettings();
      expect(allSettings.some(s => s.settingKey === "enable_2fa")).toBe(true);
      expect(allSettings.some(s => s.settingKey === "session_timeout")).toBe(true);
    });
  });

  describe("User Experience Configuration Settings", () => {
    it("should set UX configuration settings", async () => {
      const settings = [
        { key: "default_language", value: "ku", type: "string" as const },
        { key: "date_format", value: "YYYY-MM-DD", type: "string" as const },
        { key: "time_format", value: "24h", type: "string" as const },
        { key: "theme", value: "light", type: "string" as const },
        { key: "items_per_page", value: "20", type: "number" as const },
      ];

      for (const setting of settings) {
        const result = await adminCaller.advancedSettings.setSetting(setting);
        expect(result).toBeDefined();
      }

      const allSettings = await adminCaller.advancedSettings.getAllSettings();
      expect(allSettings.some(s => s.settingKey === "default_language")).toBe(true);
      expect(allSettings.some(s => s.settingKey === "date_format")).toBe(true);
    });
  });
});
