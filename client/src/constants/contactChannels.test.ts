import { describe, it, expect } from "vitest";
import {
  DIRECT_CHANNELS,
  SOCIAL_CHANNELS,
  CONTACT_ADDRESS,
  CONTACT_MAP_URL,
  CONTACT_WHATSAPP_LOCAL,
  CONTACT_WHATSAPP_INTL,
  CONTACT_PHONE_LOCAL,
  CONTACT_PHONE_INTL,
  CONTACT_EMAIL,
} from "./contactChannels";
import { TERMS_WHATSAPP_NUMBER } from "./portalTerms";

/**
 * Contact details used to be written out wherever they were needed, which is
 * how a placeholder WhatsApp number survived in four separate pages. These
 * tests hold the details in one place and check that a link a customer taps
 * actually goes somewhere.
 */

const allChannels = [...DIRECT_CHANNELS, ...SOCIAL_CHANNELS];

describe("contact numbers", () => {
  it("uses the company's real numbers, not a placeholder", () => {
    expect(CONTACT_WHATSAPP_LOCAL).toBe("07709183535");
    expect(CONTACT_PHONE_LOCAL).toBe("07509183535");
    // The number that was left as a sample in earlier pages.
    for (const channel of allChannels) {
      expect(channel.href).not.toContain("9647501234567");
    }
  });

  it("keeps one WhatsApp number across the app", () => {
    expect(CONTACT_WHATSAPP_INTL).toBe(TERMS_WHATSAPP_NUMBER);
  });

  it("derives each international number from its local one", () => {
    // 07709183535 → 964 7709183535
    expect(CONTACT_WHATSAPP_INTL).toBe(`964${CONTACT_WHATSAPP_LOCAL.slice(1)}`);
    expect(CONTACT_PHONE_INTL).toBe(`964${CONTACT_PHONE_LOCAL.slice(1)}`);
  });

  it("writes an email that looks like an email", () => {
    expect(CONTACT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
  });
});

describe("channel links", () => {
  it("gives every channel a usable link", () => {
    for (const channel of allChannels) {
      expect(channel.href, channel.id).toMatch(/^(https:\/\/|tel:\+|mailto:)/);
    }
  });

  it("dials and messages the right numbers", () => {
    const whatsapp = DIRECT_CHANNELS.find((c) => c.id === "whatsapp")!;
    const phone = DIRECT_CHANNELS.find((c) => c.id === "phone")!;
    expect(whatsapp.href).toBe(`https://wa.me/${CONTACT_WHATSAPP_INTL}`);
    expect(phone.href).toBe(`tel:+${CONTACT_PHONE_INTL}`);
  });

  it("points the address at a Google Maps link", () => {
    const address = DIRECT_CHANNELS.find((c) => c.id === "address")!;
    expect(address.href).toBe(CONTACT_MAP_URL);
    expect(CONTACT_MAP_URL).toMatch(/^https:\/\/maps\.app\.goo\.gl\//);
  });

  it("uses each platform's own domain", () => {
    const expected: Record<string, string> = {
      tiktok: "tiktok.com",
      facebook: "facebook.com",
      instagram: "instagram.com",
      telegram: "t.me",
      youtube: "youtube.com",
      "whatsapp-channel": "whatsapp.com/channel/",
      website: "waznexpress.com",
    };
    for (const channel of SOCIAL_CHANNELS) {
      expect(channel.href, channel.id).toContain(expected[channel.id]);
    }
  });

  it("has no duplicate channel ids", () => {
    const ids = allChannels.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("labels", () => {
  it("names every channel in all four languages", () => {
    for (const channel of allChannels) {
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(channel.label[lang], `${channel.id}.${lang}`).toBeTruthy();
      }
    }
  });

  it("writes the address in all four languages", () => {
    for (const lang of ["ku", "en", "ar", "zh"] as const) {
      expect(CONTACT_ADDRESS[lang].length, lang).toBeGreaterThan(5);
    }
  });

  it("shows a value on every row except the address, which is translated", () => {
    for (const channel of allChannels) {
      if (channel.id === "address") {
        // Filled in per-language at render time.
        expect(channel.value).toBe("");
      } else {
        expect(channel.value, channel.id).toBeTruthy();
      }
    }
  });

  it("offers copy only where there is something worth pasting", () => {
    const copyable = DIRECT_CHANNELS.filter((c) => c.copyable).map((c) => c.id);
    expect(copyable).toEqual(["whatsapp", "phone", "email"]);
  });

  it("gives every channel a brand colour", () => {
    for (const channel of allChannels) {
      expect(channel.color, channel.id).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});
