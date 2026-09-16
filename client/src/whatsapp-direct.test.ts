import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Every WhatsApp button a customer taps goes straight into Wazn's chat,
 * 07709183535, with a summary of the request already written (owner's rule,
 * 2026-09-16).
 *
 * What had drifted: the "Need help?" pill photographed the card and opened
 * the phone's share sheet, so the customer had to pick WhatsApp and then find
 * Wazn among their chats; the public website's buttons dialled the company's
 * phone line from settings, which is not the WhatsApp number; several support
 * links opened an empty chat that said nothing about who was asking.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

/** Where customers and visitors are: the portal, the store, the public website. */
const CUSTOMER_FACING = [
  ...walk(path.join(SRC, "pages/portal")),
  ...walk(path.join(SRC, "components/portal")),
  ...walk(path.join(SRC, "pages/store")),
  ...fs
    .readdirSync(path.join(SRC, "pages"))
    .filter((f) => /^Home[A-Za-z]*\.tsx$/.test(f))
    .map((f) => path.join(SRC, "pages", f)),
];

/**
 * Sharing, not contacting: these send a link to whoever the customer picks —
 * an invitation, a blog post — and pointing them at Wazn would break them.
 */
const SHARE_TO_A_FRIEND = new Set(["components/portal/ReferralCard.tsx", "pages/portal/PortalBlogDetail.tsx"]);

const rel = (file: string) => path.relative(SRC, file).replace(/\\/g, "/");

describe("a customer's WhatsApp button opens Wazn's chat directly", () => {
  it("covers the portal, the store and the website", () => {
    expect(CUSTOMER_FACING.length).toBeGreaterThan(60);
    expect(CUSTOMER_FACING.map(rel)).toContain("pages/HomeModern.tsx");
  });

  it("every chat link is built by lib/waznChat — no hand-made wa.me link", () => {
    const offenders: string[] = [];
    for (const file of CUSTOMER_FACING) {
      const name = rel(file);
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/wa\.me\/[^"'`\s)]*/g)) {
        if (SHARE_TO_A_FRIEND.has(name) && m[0].startsWith("wa.me/?text=")) continue;
        offenders.push(`${name}: ${m[0].slice(0, 40)}`);
      }
    }
    expect(offenders, `use waznChatUrl / openWaznChat from lib/waznChat:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("the help pill no longer goes through the phone's share sheet", () => {
    const pill = read("components/portal/WhatsAppHelpButton.tsx");
    expect(pill).not.toMatch(/navigator\.share|canShareFiles|html-to-image/);
    expect(pill).toContain("openWaznChat(");
    expect(pill).toContain("waznChatMessage({");
  });

  it("the website's buttons use Wazn's WhatsApp, not a phone line from settings", () => {
    for (const file of ["pages/HomeModern.tsx", "pages/HomeLogistick.tsx", "pages/HomeProfessional.tsx", "pages/HomeMinimal.tsx"]) {
      const src = read(file);
      expect(src, file).toMatch(/waznChat(Url|Message)|openWaznChat/);
      expect(src, file).not.toMatch(/company\.phone \|\| ""\)\.replace/);
      expect(src, file).not.toContain("site.social.whatsapp.startsWith");
    }
  });

  it("the portal's messages say who is asking", () => {
    for (const file of [
      "components/portal/WhatsAppHelpButton.tsx",
      "pages/portal/PortalFAQ.tsx",
      "pages/portal/PortalTerms.tsx",
      "pages/portal/PortalProhibitedItems.tsx",
      "pages/portal/PortalProhibitedPackages.tsx",
      "pages/portal/PortalTutorials.tsx",
      "pages/portal/PortalUnclaimedPackages.tsx",
      "pages/portal/PortalYuanExchange.tsx",
      "pages/portal/PortalAbout.tsx",
      "pages/portal/PortalContact.tsx",
      "pages/portal/PortalServices.tsx",
      "pages/portal/modern/ModernPortalProfile.tsx",
      "pages/portal/skin3/Skin3PortalProfile.tsx",
    ]) {
      expect(read(file), file).toContain("useChatCustomer()");
    }
    for (const file of ["pages/portal/PortalHome.tsx", "pages/portal/PortalProfile.tsx", "pages/portal/PortalFullPackage.tsx"]) {
      expect(read(file), file).toContain("customer: account");
    }
  });

  it("the details of the request travel with it", () => {
    expect(read("pages/portal/PortalHome.tsx")).toMatch(/details: \[\[\{ ku: "باڵانس"[^\]]*balanceText\]\]/);
    expect(read("components/portal/PortalSearchDetail.tsx")).toContain('[{ ku: "تراکینگ", en: "Tracking", ar: "رقم التتبع", zh: "运单号" }, item.title]');
    expect(read("pages/portal/PortalProhibitedPackages.tsx")).toContain("it.trackingNumber]");
    expect(read("pages/portal/PortalUnclaimedPackages.tsx")).toContain("selectedPackage.trackingNumber || selectedPackage.packageCode]]");
    expect(read("pages/portal/PortalYuanExchange.tsx")).toContain("fmtNumber(usdNum, 2)");
  });
});
