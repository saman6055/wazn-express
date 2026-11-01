import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");

describe("a thumb can hit it", () => {
  it("every shared button size grows on a touch screen, and only there", () => {
    const src = read("components/ui/button.tsx");
    for (const size of [
      'default: "h-9 pointer-coarse:h-11',
      'sm: "h-8 pointer-coarse:h-10',
      'lg: "h-10 pointer-coarse:h-11',
      'icon: "size-9 pointer-coarse:size-11"',
      '"icon-sm": "size-8 pointer-coarse:size-10"',
      '"icon-lg": "size-10 pointer-coarse:size-11"',
    ]) {
      expect(src, size).toContain(size);
    }
  });

  it("dialog and sheet close buttons too — and the sheet's sits at the reading end", () => {
    expect(read("components/ui/dialog.tsx")).toContain("inline-flex size-8 pointer-coarse:size-11");
    const sheet = read("components/ui/sheet.tsx");
    expect(sheet).toContain("absolute top-4 end-4 inline-flex size-8 pointer-coarse:size-11");
    expect(sheet).not.toContain("absolute top-4 right-4");
  });

  it("photo controls are there on a phone, not only on hover", () => {
    const src = read("components/CompressedImageUpload.tsx");
    // Bare "opacity-0 group-hover:opacity-100" hides a control from every
    // touch screen; hidden only where there is a mouse is the fix.
    expect(src).not.toMatch(/(?<!\[@media\(hover:hover\)\]:)opacity-0 group-hover:opacity-100/);
    expect(src).toContain("opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100");
  });
});

describe("it can be read", () => {
  it("the portal's bottom bar labels meet contrast on white and on dark", () => {
    const src = read("components/CustomerPortalLayout.tsx");
    expect(src).not.toContain('"text-slate-400 hover:text-slate-600');
    for (const hue of ["blue", "sky", "purple", "amber"]) {
      expect(src, hue).toContain(`activeColor: "text-${hue}-700 dark:text-${hue}-300"`);
    }
  });

  it("the offline banner is dark enough for white text, and is announced", () => {
    const src = read("components/PWAInstallPrompt.tsx");
    expect(src).toContain('role="status" aria-live="polite"');
    expect(src).toContain("bg-amber-700 text-white");
    expect(src).not.toContain("bg-amber-500 text-white");
  });
});

describe("it has a name", () => {
  it("each chat icon button says what it does; new messages are announced", () => {
    const src = read("components/LiveChatSupport.tsx");
    for (const word of ['en: "Refresh"', 'en: "Expand"', 'en: "Minimize"', 'en: "Close"', 'en: "Send"']) {
      expect(src, word).toContain(word);
    }
    expect(src).toMatch(/role="log"\s+aria-live="polite"/);
  });

  it("every show-password toggle says whether it shows or hides", () => {
    const src = read("pages/portal/PortalSecurity.tsx");
    const toggles = src.match(/onClick=\{\(\) => setShow\w+\(\(v\) => !v\)\}/g) ?? [];
    const named = src.match(/onClick=\{\(\) => setShow\w+\(\(v\) => !v\)\} aria-label=/g) ?? [];
    expect(toggles.length).toBeGreaterThanOrEqual(2);
    expect(named.length).toBe(toggles.length);
  });
});
