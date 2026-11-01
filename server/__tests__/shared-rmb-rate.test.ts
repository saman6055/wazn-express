import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";

vi.mock("./db", () => ({
  getCurrentExchangeRate: vi.fn(),
  getYuanExchangeSettings: vi.fn(),
  createExchangeRate: vi.fn(),
  createAuditLog: vi.fn(),
}));
vi.mock("./db/cache", () => ({ cacheInvalidate: vi.fn() }));

import * as db from "./db";
import { cacheInvalidate } from "./db/cache";
import { currentRmbRate, recordRmbRateFromPortalCenter, yuanSettingsWithSharedRate } from "./lib/sharedRmbRate";

/**
 * One yuan rate for the whole business (owner, 2026-09-19): the office's RMB
 * rate (Settings → Currency) and the Portal Center's yuan-buying rate are the
 * same number, edited from either place. A customer read ¥6.85 on the home
 * screen and another figure on the page where they buy yuan.
 */

const stored = {
  enabled: true,
  rate: 6.4,
  minUsd: null,
  maxUsd: null,
  noteKu: "",
  noteEn: "",
  noteAr: "",
  noteZh: "",
};

const mocked = <T extends (...args: any[]) => any>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mocked(db.getYuanExchangeSettings).mockResolvedValue({ ...stored });
  mocked(db.createExchangeRate).mockResolvedValue({ id: 91 });
});

describe("the yuan page reads the office's rate", () => {
  it("uses the current RMB exchange rate over the Portal Center's old copy", async () => {
    mocked(db.getCurrentExchangeRate).mockResolvedValue({ rate: "6.850000" });
    const s = await yuanSettingsWithSharedRate();
    expect(s.rate).toBe(6.85);
    expect(s.enabled).toBe(true);
    expect(db.getCurrentExchangeRate).toHaveBeenCalledWith("RMB");
  });

  it("falls back to the stored rate only when no RMB rate was ever set", async () => {
    mocked(db.getCurrentExchangeRate).mockResolvedValue(undefined);
    expect((await yuanSettingsWithSharedRate()).rate).toBe(6.4);
    mocked(db.getCurrentExchangeRate).mockResolvedValue({ rate: "0" });
    expect(await currentRmbRate()).toBeNull();
  });
});

describe("the Portal Center edits the office's rate", () => {
  const admin = { id: 7, role: "admin" as const };

  it("a new rate is a new entry in the office's list, audited, and seen at once", async () => {
    mocked(db.getCurrentExchangeRate).mockResolvedValue({ rate: "6.850000" });
    expect(await recordRmbRateFromPortalCenter(7.1, admin)).toBe(true);
    expect(db.createExchangeRate).toHaveBeenCalledWith({
      targetCurrency: "RMB",
      rate: "7.1",
      isManualOverride: true,
      source: "manual",
      createdById: 7,
    });
    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create_exchange_rate", entityType: "exchange_rate", entityId: 91, userId: 7 }),
    );
    expect(cacheInvalidate).toHaveBeenCalledWith(["exchangeRates:all", "exchangeRate:RMB"]);
  });

  it("saving the page's other settings adds nothing to the rate's history", async () => {
    mocked(db.getCurrentExchangeRate).mockResolvedValue({ rate: "6.850000" });
    expect(await recordRmbRateFromPortalCenter(6.85, admin)).toBe(false);
    expect(db.createExchangeRate).not.toHaveBeenCalled();
    expect(db.createAuditLog).not.toHaveBeenCalled();
  });

  it("the first rate an installation ever gets is recorded too", async () => {
    mocked(db.getCurrentExchangeRate).mockResolvedValue(undefined);
    expect(await recordRmbRateFromPortalCenter(6.9, admin)).toBe(true);
    expect(db.createExchangeRate).toHaveBeenCalledTimes(1);
  });
});

describe("every door uses the one rate", () => {
  const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf8").replace(/\r\n/g, "\n");

  it("the customer's yuan page and a yuan order are priced at it", () => {
    const portal = read("routers/portal.router.ts");
    const info = portal.slice(portal.indexOf("getYuanExchangeInfo:"), portal.indexOf("getMyYuanOrders:"));
    expect(info.length).toBeGreaterThan(50);
    expect(info).toContain("await yuanSettingsWithSharedRate()");
    const order = portal.slice(portal.indexOf("createYuanOrder:"), portal.indexOf("logPortal(ctx, customerId, \"yuan_order\""));
    expect(order.length).toBeGreaterThan(50);
    expect(order).toContain("const settings = await yuanSettingsWithSharedRate();");
    expect(order).not.toContain("db.getYuanExchangeSettings()");
  });

  it("the Portal Center shows it and writes it into the office's list before saving the rest", () => {
    const center = read("routers/portalCenter.router.ts");
    expect(center).toContain("return yuanSettingsWithSharedRate();");
    const save = center.slice(center.indexOf("setYuanSettings:"), center.indexOf("listYuanOrders:"));
    expect(save.length).toBeGreaterThan(50);
    const record = save.indexOf("await recordRmbRateFromPortalCenter(input.rate, ctx.user);");
    const keep = save.indexOf("await db.setYuanExchangeSettings(input, ctx.user.id);");
    expect(record).toBeGreaterThan(-1);
    expect(keep).toBeGreaterThan(record);
  });

  it("a rate set in Settings reaches the order forms at once, not after the cache's five minutes", () => {
    const finance = read("routers/finance.router.ts");
    expect(finance).toContain('cacheInvalidate(["exchangeRates:all", `exchangeRate:${input.targetCurrency}`]);');
  });
});
