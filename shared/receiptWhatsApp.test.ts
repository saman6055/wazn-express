import { describe, expect, it } from "vitest";
import {
  receiptLanguageFor,
  receiptWhatsAppMessage,
  whatsappChatUrl,
  whatsappNumber,
} from "./receiptWhatsApp";

/**
 * The receipt that goes to the customer's WhatsApp (owner, 2026-09-21):
 * written in their own language, chosen from the nationality the customer
 * was created with — and promising no date, because "do not say the period".
 */

describe("which language the customer is written to in", () => {
  it("reads the list's own ids", () => {
    expect(receiptLanguageFor("kurdish")).toBe("ku");
    expect(receiptLanguageFor("arab")).toBe("ar");
    expect(receiptLanguageFor("foreign")).toBe("en");
  });

  it("reads the words themselves, however the list was rewritten", () => {
    expect(receiptLanguageFor("کورد")).toBe("ku");
    expect(receiptLanguageFor("عەرەب")).toBe("ar");
    expect(receiptLanguageFor("عربي")).toBe("ar");
    expect(receiptLanguageFor("English")).toBe("en");
  });

  it("writes Kurdish when nothing says otherwise", () => {
    for (const value of [null, undefined, "", "   ", "turkmen", "تورکمان", "other", "ئاشووری"]) {
      expect(receiptLanguageFor(value), String(value)).toBe("ku");
    }
  });
});

describe("the message", () => {
  const facts = { boxCode: "BOX-20260921-002", parcelCount: 2, totalUsd: 44.88 };

  it("names the box, the parcels and the figure, in each language", () => {
    for (const lang of ["ku", "ar", "en"] as const) {
      const text = receiptWhatsAppMessage(lang, facts);
      expect(text, lang).toContain("BOX-20260921-002");
      expect(text, lang).toContain("2");
      expect(text, lang).toContain("44.88");
    }
  });

  it("promises no date — the owner's own correction", () => {
    for (const lang of ["ku", "ar", "en"] as const) {
      const text = receiptWhatsAppMessage(lang, facts);
      expect(text, lang).not.toMatch(/\b2 (ڕۆژ|days|يوم)/);
      expect(text, lang).not.toMatch(/کەمتر لە|أقل من|less than/);
    }
    expect(receiptWhatsAppMessage("ku", facts)).toContain("گونجاوترین کات");
    expect(receiptWhatsAppMessage("ar", facts)).toContain("أنسب وقت");
    expect(receiptWhatsAppMessage("en", facts)).toContain("most suitable time");
  });

  it("signs with the company's one name per language", () => {
    expect(receiptWhatsAppMessage("ku", facts)).toContain("وەزن ئێکسپرێس");
    expect(receiptWhatsAppMessage("ar", facts)).toContain("وزن اكسبريس");
    expect(receiptWhatsAppMessage("en", facts)).toContain("Wazn Express");
  });

  it("keeps digits 0-9 and survives nonsense figures", () => {
    const odd = receiptWhatsAppMessage("ku", { boxCode: "BOX-1", parcelCount: Number.NaN, totalUsd: Number.NaN });
    expect(odd).toContain("0 پاکەت");
    expect(odd).toContain("0.00");
    expect(odd).not.toMatch(/[٠-٩۰-۹]/);
  });
});

describe("the number and the chat", () => {
  it("turns a local number into one WhatsApp understands", () => {
    expect(whatsappNumber("07709183535")).toBe("9647709183535");
    expect(whatsappNumber("0770 918 35 35")).toBe("9647709183535");
    expect(whatsappNumber("+964 770 9183535")).toBe("9647709183535");
    expect(whatsappNumber("009647709183535")).toBe("9647709183535");
  });

  it("says nothing rather than opening a chat with a number that is not one", () => {
    for (const value of [null, undefined, "", "-", "12345"]) {
      expect(whatsappNumber(value), String(value)).toBeNull();
    }
  });

  it("opens the chat with the message already typed", () => {
    const url = whatsappChatUrl("9647709183535", "سڵاو — BOX-1 & $5");
    expect(url.startsWith("https://wa.me/9647709183535?text=")).toBe(true);
    expect(url).toContain("%26");
    expect(decodeURIComponent(url.split("?text=")[1])).toBe("سڵاو — BOX-1 & $5");
  });
});

/**
 * Owner, 2026-10-21: the chat said $183.03 (304,000) where the paper said
 * $116.93 (197,000) - the advance on the paper was not taken off - and the
 * greeting should name the customer with good wishes.
 */
describe("the message asks for the paper's own figure, by name", () => {
  it("an advance in dollars: the dollars and dinars left, as on the paper", async () => {
    const { receiptDinar } = await import("./receiptDinar");
    const { receiptMessageDue } = await import("./receiptWhatsApp");
    const figures = receiptDinar(183.03, { rate: 1685, step: 250, mode: "nearest", advanceAmount: 66.1, advanceCurrency: "USD" });
    const due = receiptMessageDue(183.03, figures);
    expect(due.usd).toBe(116.93);
    expect(due.iqd).toBe(figures!.dueIqd);
  });

  it("an advance in dinars: dinars only, as on the paper; none: the total and its dinars", async () => {
    const { receiptDinar } = await import("./receiptDinar");
    const { receiptMessageDue } = await import("./receiptWhatsApp");
    const inIqd = receiptDinar(100, { rate: 1500, step: 250, mode: "nearest", advanceAmount: 50000, advanceCurrency: "IQD" });
    expect(receiptMessageDue(100, inIqd)).toEqual({ usd: null, iqd: 100000 });
    const plain = receiptDinar(100, { rate: 1500, step: 250, mode: "nearest", advanceAmount: null, advanceCurrency: "IQD" });
    expect(receiptMessageDue(100, plain)).toEqual({ usd: 100, iqd: 150000 });
    expect(receiptMessageDue(100, null)).toEqual({ usd: 100, iqd: null });
  });

  it("greets the customer by name, with good wishes, in each language", () => {
    const f = { boxCode: "BOX-20261021-023", parcelCount: 9, totalUsd: 116.93, totalIqd: 197000, customerName: "Hama Ali" };
    const ar = receiptWhatsAppMessage("ar", f);
    expect(ar).toContain("حضرة Hama Ali المحترم");
    expect(ar).toContain("نتمنى أن تكونوا بخير");
    expect(ar).toContain("116.93 دولار (197,000 دينار)");
    expect(ar).not.toContain("183.03");
    const ku = receiptWhatsAppMessage("ku", f);
    expect(ku).toContain("بەڕێز Hama Ali");
    expect(ku).toContain("ساغ و سەلامەت");
    expect(ku).toContain("116.93 دۆلار (197,000 دینار)");
    expect(receiptWhatsAppMessage("en", f)).toContain("dear Hama Ali");
    // Dinars only when the paper asks in dinars only.
    expect(receiptWhatsAppMessage("ku", { ...f, totalUsd: null })).toContain("بڕی داواکراو: 197,000 دینار.");
    // No name: still polite, never "undefined".
    expect(receiptWhatsAppMessage("ar", { ...f, customerName: null })).not.toContain("undefined");
  });
});
