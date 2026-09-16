import { describe, expect, it } from "vitest";
import { waznChatMessage, waznChatUrl, WAZN_CHAT_HELLO, WAZN_CHAT_WEBSITE } from "./waznChat";
import { CONTACT_WHATSAPP_LOCAL } from "@/constants/contactChannels";

describe("the link into Wazn's chat", () => {
  it("is Wazn's own number, 07709183535, in the form WhatsApp wants", () => {
    expect(CONTACT_WHATSAPP_LOCAL).toBe("07709183535");
    expect(waznChatUrl("x").startsWith("https://wa.me/9647709183535?text=")).toBe(true);
  });

  it("carries the message, encoded", () => {
    const url = waznChatUrl("سڵاو\nتراکینگ: SF1400998877");
    expect(decodeURIComponent(url.split("?text=")[1])).toBe("سڵاو\nتراکینگ: SF1400998877");
  });

  it("an empty message opens the chat without a blank text", () => {
    expect(waznChatUrl("")).toBe("https://wa.me/9647709183535");
    expect(waznChatUrl(null)).toBe("https://wa.me/9647709183535");
  });
});

describe("the summary written into the message", () => {
  it("says what, who, where, and the details — a line each", () => {
    const text = waznChatMessage({
      language: "ku",
      intent: { ku: "سڵاو، دەمەوێت باڵانسەکەم بدەم", en: "Hello, I'd like to pay", ar: "مرحباً", zh: "您好" },
      customer: { fullName: "Aram Karim", customerCode: "AZ002" },
      section: { ku: "سەرەکی", en: "Home", ar: "الرئيسية", zh: "首页" },
      details: [[{ ku: "باڵانس", en: "Balance", ar: "الرصيد", zh: "余额" }, "$120.00"]],
    });
    expect(text.split("\n")).toEqual([
      "سڵاو، دەمەوێت باڵانسەکەم بدەم",
      "کڕیار: Aram Karim (AZ002)",
      "بەش: سەرەکی",
      "باڵانس: $120.00",
    ]);
  });

  it("is written in the customer's language", () => {
    const text = waznChatMessage({
      language: "en",
      intent: WAZN_CHAT_HELLO,
      customer: { fullName: "", customerCode: "AZ002" },
      section: "FAQ",
    });
    expect(text).toBe("Hello Wazn Express, I have a question\nCustomer: (AZ002)\nSection: FAQ");
  });

  it("leaves out what it does not know rather than sending an empty label", () => {
    const text = waznChatMessage({
      language: "ku",
      intent: WAZN_CHAT_WEBSITE,
      customer: null,
      details: [
        [{ ku: "تراکینگ", en: "Tracking", ar: "رقم التتبع", zh: "运单号" }, ""],
        [{ ku: "بار", en: "Shipment", ar: "الشحنة", zh: "货运" }, null],
        null,
        false,
        "«SF1400998877»",
      ],
    });
    expect(text).toBe(`${WAZN_CHAT_WEBSITE.ku}\n«SF1400998877»`);
  });

  it("the ready-made openings are plain text in all four languages", () => {
    const EMOJI = /\p{Extended_Pictographic}/u;
    for (const words of [WAZN_CHAT_HELLO, WAZN_CHAT_WEBSITE]) {
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(words[lang], lang).toBeTruthy();
        expect(words[lang], lang).not.toMatch(EMOJI);
      }
    }
  });
});
