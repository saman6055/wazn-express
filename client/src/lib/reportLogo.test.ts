import { afterEach, describe, expect, it, vi } from "vitest";
import { BRAND_LOGO_URL, reportLogoHtml } from "./brand";

/**
 * A report prints from a blank window of its own, where "/brand/…" resolves
 * against nothing. The mark has to arrive with a full address, and it has to
 * arrive even when no logo is uploaded.
 */
describe("the mark on a printed report", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is the built-in mark, addressed absolutely, when nothing is uploaded", () => {
    vi.stubGlobal("window", { location: { origin: "https://waznexpress.com" } });
    expect(reportLogoHtml("")).toContain(`src="https://waznexpress.com${BRAND_LOGO_URL}"`);
    expect(reportLogoHtml(undefined)).toContain(`src="https://waznexpress.com${BRAND_LOGO_URL}"`);
  });

  it("is the uploaded logo when there is one", () => {
    vi.stubGlobal("window", { location: { origin: "https://waznexpress.com" } });
    expect(reportLogoHtml("/uploads/logo.png")).toContain('src="https://waznexpress.com/uploads/logo.png"');
    expect(reportLogoHtml("https://cdn.example.com/l.png")).toContain('src="https://cdn.example.com/l.png"');
  });

  it("sits on a white tile at the height asked for", () => {
    const html = reportLogoHtml("https://cdn.example.com/l.png", 32);
    expect(html).toContain("height:32px");
    expect(html).toContain("background:#fff");
  });

  it("cannot break out of its attribute", () => {
    expect(reportLogoHtml('https://x.example/a".png')).not.toContain('a".png');
  });
});
