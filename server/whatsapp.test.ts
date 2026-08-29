import { describe, expect, it, vi, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  toWhatsAppNumber,
  sendWhatsAppTemplate,
  whatsappLanguageCode,
  WHATSAPP_EVENTS,
} from "./services/whatsapp.service";

/**
 * Every message here costs money and lands on somebody's personal phone.
 * Most of what is guarded is the not-sending: to a malformed number, without
 * consent, or when nobody configured it.
 */

const config = { enabled: true, apiKey: "tok", phoneNumberId: "123" };

afterEach(() => vi.unstubAllGlobals());

describe("Iraqi numbers, as people actually write them", () => {
  it("accepts every shape of the same number", () => {
    // All of these are one phone. A message to a malformed one is money
    // spent on nothing.
    for (const written of ["07501234567", "+9647501234567", "009647501234567", "0750 123 4567", "0750-123-4567"]) {
      expect(toWhatsAppNumber(written), written).toBe("9647501234567");
    }
  });

  it("takes a bare local mobile", () => {
    expect(toWhatsAppNumber("7501234567")).toBe("9647501234567");
  });

  it("leaves an already-correct number alone", () => {
    expect(toWhatsAppNumber("9647501234567")).toBe("9647501234567");
  });

  it("refuses what cannot be a number", () => {
    for (const bad of [null, undefined, "", "   ", "abc", "0750", "123", "07501234567890123456"]) {
      expect(toWhatsAppNumber(bad), String(bad)).toBeNull();
    }
  });
});

describe("nothing is sent unless everything is in order", () => {
  it("does not send when the company has it switched off", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await sendWhatsAppTemplate({ ...config, enabled: false }, {
      to: "07501234567", template: "t", language: "ar",
    });
    expect(r).toEqual({ sent: false, reason: "disabled" });
    expect(fetchSpy, "a disabled channel must not reach the network").not.toHaveBeenCalled();
  });

  it("does not send when nobody has configured it", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    for (const partial of [{ apiKey: null }, { phoneNumberId: null }]) {
      const r = await sendWhatsAppTemplate({ ...config, ...partial } as any, {
        to: "07501234567", template: "t", language: "ar",
      });
      expect(r).toEqual({ sent: false, reason: "unconfigured" });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not send to a number it could not make sense of", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await sendWhatsAppTemplate(config, { to: "abc", template: "t", language: "ar" });
    expect(r).toEqual({ sent: false, reason: "bad_number" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("what actually goes over the wire", () => {
  it("sends a template, never a sentence", async () => {
    // Outside the twenty-four hour window Meta silently refuses free text.
    // Nothing here composes wording; it fills in an approved template.
    let captured: any = null;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: any) => {
      captured = JSON.parse(init.body);
      return { ok: true, json: async () => ({ messages: [{ id: "wamid.X" }] }) };
    }));

    const r = await sendWhatsAppTemplate(config, {
      to: "07501234567",
      template: WHATSAPP_EVENTS.readyForCollection,
      language: "ar",
      parameters: ["AZ047", "3"],
    });

    expect(r).toEqual({ sent: true, messageId: "wamid.X" });
    expect(captured.type).toBe("template");
    expect(captured.template.name).toBe("wazn_ready_for_collection");
    expect(captured.to).toBe("9647501234567");
    expect(captured.template.components[0].parameters.map((p: any) => p.text)).toEqual(["AZ047", "3"]);
    // "body" appears legitimately as the component's name in the template
    // format. What must never appear is a free-text message, which Meta
    // silently refuses outside the twenty-four hour window.
    expect(captured.text, "a free-text message would be silently dropped").toBeUndefined();
    expect(captured.type).not.toBe("text");
  });

  it("omits the parameter block when there is nothing to fill in", async () => {
    let captured: any = null;
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: any) => {
      captured = JSON.parse(init.body);
      return { ok: true, json: async () => ({}) };
    }));
    await sendWhatsAppTemplate(config, { to: "07501234567", template: "t", language: "ar" });
    expect(captured.template.components).toBeUndefined();
  });

  it("carries the token in a header, never in the address", async () => {
    let url = ""; let init: any = null;
    vi.stubGlobal("fetch", vi.fn(async (u: string, i: any) => {
      url = u; init = i;
      return { ok: true, json: async () => ({}) };
    }));
    await sendWhatsAppTemplate(config, { to: "07501234567", template: "t", language: "ar" });
    expect(url, "a token in a URL ends up in every log it passes").not.toContain("tok");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });
});

describe("a failure is never anybody else's problem", () => {
  it("returns rather than throwing when the network is gone", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ENOTFOUND"); }));
    const r = await sendWhatsAppTemplate(config, { to: "07501234567", template: "t", language: "ar" });
    expect(r).toEqual({ sent: false, reason: "unreachable" });
  });

  it("returns rather than throwing when Meta refuses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 400, text: async () => "bad template" })));
    const r = await sendWhatsAppTemplate(config, { to: "07501234567", template: "t", language: "ar" });
    expect(r).toEqual({ sent: false, reason: "rejected" });
  });

  it("never lets a refusal's wording reach a screen", () => {
    // The reply is written by Meta. Error text from outside has no business
    // being shown to a customer or an operator.
    const src = fs.readFileSync(path.join(__dirname, "services", "whatsapp.service.ts"), "utf8");
    const fn = src.slice(src.indexOf("export async function sendWhatsAppTemplate"));
    expect(fn).toContain('return { sent: false, reason: "rejected" };');
    expect(fn, "the reply text may be logged, never returned").not.toContain("reason: detail");
  });
});

describe("the events chosen, and the languages", () => {
  it("is a short list of things somebody would otherwise telephone about", () => {
    const events = Object.values(WHATSAPP_EVENTS);
    expect(events).toContain("wazn_ready_for_collection");
    expect(events.length, "every message costs money; this list must stay short")
      .toBeLessThanOrEqual(5);
  });

  it("falls back to Arabic, which Meta has and Kurdish is not", () => {
    expect(whatsappLanguageCode("ar")).toBe("ar");
    expect(whatsappLanguageCode("en")).toBe("en");
    expect(whatsappLanguageCode("zh")).toBe("zh_CN");
    expect(whatsappLanguageCode("ku")).toBe("ar");
    expect(whatsappLanguageCode(null)).toBe("ar");
  });
});

describe("consent is the default position", () => {
  it("a customer is off until they say otherwise", () => {
    const schema = fs.readFileSync(
      path.join(__dirname, "..", "drizzle", "schema", "notifications.schema.ts"), "utf8",
    );
    expect(schema).toContain('whatsappEnabled: boolean("whatsappEnabled").default(false)');
  });
});

/**
 * Where it is wired, and how carefully.
 */
describe("the sending layer checks consent itself", () => {
  const ROOT = path.join(__dirname, "..");
  const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");
  const layer = read("server/services/customerWhatsApp.service.ts");
  const scanner = read("server/routers/scanning.router.ts");

  it("treats a missing preference row as consent withheld", () => {
    // Somebody who has never opened the settings has never opted in, and
    // this channel costs money and lands on a personal phone.
    expect(layer).toContain("if (!prefs || (prefs as any).whatsappEnabled !== true) return null;");
  });

  it("checks consent in one place rather than trusting the caller", () => {
    // A customer must stay unreachable by this channel even when somebody
    // adds a new call site in a hurry.
    const recipient = layer.slice(layer.indexOf("async function recipientFor"), layer.indexOf("async function companyConfig"));
    expect(recipient).toContain("getCustomerNotificationPrefs");
  });

  it("reads the company switch per event, not globally", () => {
    expect(layer).toContain('companyConfig("ready_for_collection")');
    expect(layer).toContain('companyConfig("payment_received")');
  });

  it("sends nothing when there is no number", () => {
    expect(layer).toContain("if (!number) return null;");
  });

  it("never throws at any of its callers", () => {
    for (const fn of ["notifyReadyForCollection", "notifyPaymentReceived"]) {
      const body = layer.slice(layer.indexOf(`export async function ${fn}`));
      expect(body.slice(0, 1200), `${fn} must not throw`).toContain("catch (err)");
    }
  });
});

describe("the depot scan tells the customer without waiting for Meta", () => {
  const scanner = fs.readFileSync(
    path.join(__dirname, "routers", "scanning.router.ts"), "utf8",
  ).replace(/\r\n/g, "\n");

  it("fires when goods reach the Erbil depot", () => {
    expect(scanner).toContain("notifyReadyForCollection(pkg.customerId, 1)");
  });

  it("does not await it", () => {
    // A scan happens with somebody standing at a bench holding a parcel.
    // Meta's reply time is not their problem.
    expect(scanner).toContain("notifyReadyForCollection(pkg.customerId, 1).catch(() => {});");
    expect(scanner, "awaiting it would put a network round trip in the scan")
      .not.toContain("await notifyReadyForCollection");
  });
});
