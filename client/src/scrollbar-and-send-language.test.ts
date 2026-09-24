import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Two of the owner's notes from 2026-09-24.
 *
 * "When sending the receipt, if the customer's nationality is Arab, both the
 * receipt and the message must be in Arabic." They already follow the
 * nationality — but a customer created without one falls back to Kurdish and
 * nobody is told, which is what he caught: a Kurdish message in an Arab
 * customer's chat. A guess that cannot be seen is the fault, so the send menu
 * shows the language it will use and lets it be changed.
 *
 * "A slider is better than those two arrows — they are annoying, and it
 * should work with scrolling too. Make it like that across the whole system."
 * A pair of buttons that jump a screen at a time cannot say how long a page
 * is or where in it you are; a thumb does both without being asked.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");

describe("the language a receipt goes out in", () => {
  const panel = read("components/delivery/BoxDetailPanel.tsx");

  it("is the customer's, and is shown before it is used", () => {
    expect(panel).toContain("const [sendLanguage, setSendLanguage] = useState<ReceiptLanguage | null>(null);");
    expect(panel).toContain('data-testid={`receipt-language-${code}`}');
    expect(panel).toContain('{pickLang(language, { ku: "زمانی وەسڵ و پەیام"');
  });

  it("is the same for the paper and for the message", () => {
    expect(panel).toContain("receiptWhatsAppMessage(sendLanguage ?? receiptLanguageFor((customer as any)?.nationality), {");
    expect(panel).toContain("(sendLanguage ?? receiptLanguageFor((customer as any)?.nationality)) as Language,");
  });

  it("still follows the nationality until somebody says otherwise", () => {
    expect(panel).toContain('const chosen = (sendLanguage ?? receiptLanguageFor((customer as any)?.nationality)) === code;');
  });
});

describe("the scrollbar", () => {
  const css = read("index.css");

  it("is a thumb you can see and drag, in both engines", () => {
    expect(css).toContain("scrollbar-width: thin;");
    expect(css).toContain("scrollbar-color: var(--border) transparent;");
    // The palette is oklch: hsl(var(--token)) is invalid CSS here.
    expect(css).not.toMatch(/hsl\(var\(--/);
    expect(css).toContain("::-webkit-scrollbar-thumb {");
    expect(css).toContain("::-webkit-scrollbar-thumb:hover {");
  });

  it("is not hidden away once the app is installed", () => {
    const standalone = css.slice(css.indexOf("@media (display-mode: standalone)"), css.indexOf("/* Touch-friendly tap highlights */"));
    expect(standalone).not.toContain("display: none");
    expect(standalone).not.toContain("scrollbar-width: none");
  });

  it("leaves the deliberately bare rows bare", () => {
    expect(css).toContain(".no-scrollbar::-webkit-scrollbar,");
    expect(css).toContain(".scrollbar-hide::-webkit-scrollbar {");
  });

  it("and the two floating arrows are gone", () => {
    expect(fs.existsSync(path.join(SRC, "components", "ScrollButtons.tsx"))).toBe(false);
    expect(read("components/DashboardLayout.tsx")).not.toContain("ScrollButtons");
  });
});
