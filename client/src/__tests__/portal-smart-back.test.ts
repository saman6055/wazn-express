import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The portal's Back — the arrows on screen and the phone's own button —
 * takes exactly one step.
 *
 * The owner's brief (2026-09-19): every back arrow does what the phone's
 * Back does and returns to the screen before, as it was; only on the first
 * page of a visit does it open the home. Before it, eleven arrows on nine
 * pages went to a fixed page — About, FAQ and Security always to the
 * profile, Messages to the home — and four of them pointed forward in
 * Kurdish. And a dialog open over a page was not a step at all: the phone's
 * Back left the page under it.
 *
 * The rules: lib/historySteps (tested beside it), hooks/useSmartBack,
 * hooks/useBackCloses, components/portal/PortalBackButton.
 */

const SRC = __dirname;
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

function files(dir: string): string[] {
  return fs.readdirSync(path.join(SRC, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return files(rel);
    return /\.tsx$/.test(entry.name) && !/\.test\./.test(entry.name) ? [rel] : [];
  });
}

const PORTAL = [...files("pages/portal"), ...files("components/portal")];

describe("the back arrows", () => {
  it("covers the portal's pages", () => {
    expect(PORTAL.length).toBeGreaterThan(40);
  });

  it("never lead to a fixed page: no arrow inside a link to a written-out address", () => {
    const offenders: string[] = [];
    for (const rel of PORTAL) {
      const lines = read(rel).split("\n");
      lines.forEach((line, i) => {
        if (!/<Link href="[^"{]+"|navigate\("\/portal[^"]*"\)|setLocation\("\/portal[^"]*"\)/.test(line)) return;
        const next = lines.slice(i, i + 6).join("\n");
        if (/<(ArrowLeft|ArrowRight|ChevronLeft|BackArrow|BackIcon)\b/.test(next)) offenders.push(`${rel}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("are the one shared button on every page that had its own", () => {
    for (const page of [
      "PortalAbout",
      "PortalFAQ",
      "PortalSecurity",
      "PortalAddresses",
      "PortalNotifications",
      "PortalMessages",
      "PortalBatchDetail",
      "PortalBlog",
      "PortalBlogDetail",
    ]) {
      const src = read(`pages/portal/${page}.tsx`);
      expect(src, page).toContain("<PortalBackButton");
      expect(src, page).not.toMatch(/const BackArrow\b/);
    }
  });

  it("say where they go only when a button names its page", () => {
    const blogPost = read("pages/portal/PortalBlogDetail.tsx");
    expect(blogPost).toContain('<PortalBackButton\n            to="/portal/blog"');
    expect(read("pages/portal/PortalAbout.tsx")).not.toContain('"پرۆفایل"');
  });

  it("point back, which is right in Kurdish and Arabic", () => {
    const button = read("components/portal/PortalBackButton.tsx");
    expect(button).toContain('const isRTL = language === "ku" || language === "ar";');
    expect(button).toContain("isRTL ? ArrowRight : ArrowLeft");
    expect(button).toContain("isRTL ? ChevronRight : ChevronLeft");
  });

  it("take the phone's step when the portal is behind, and open the home in place otherwise", () => {
    const hook = read("hooks/useSmartBack.ts");
    expect(hook).toContain('backStep(currentStepFrom(), target) === "back") window.history.back()');
    expect(hook).toContain("navigate(fallback, { replace: true })");
    expect(hook).toContain('fallback = "/portal"');
  });

  it("include the top bar's ←, which is never greyed out on a page opened from a link", () => {
    const bar = read("contexts/PortalHistoryContext.tsx");
    expect(bar).toContain('const canBack = backStep(currentStepFrom()) === "back" || pathOf(location) !== "/portal";');
    expect(bar).toContain("back: () => smartBack(),");
    expect(bar).not.toContain("canBack: state.pos > 0");
  });

  it("know where each step came from, from before the first navigation", () => {
    const main = read("main.tsx");
    const install = main.indexOf("installHistorySteps();");
    const mount = main.indexOf("createRoot(");
    expect(install).toBeGreaterThan(-1);
    expect(mount).toBeGreaterThan(-1);
    expect(install).toBeLessThan(mount);
  });
});

describe("what covers a page", () => {
  it("is one step: every dialog in the portal is closed by the phone's Back", () => {
    const missing: string[] = [];
    for (const rel of [...PORTAL, "components/PhotoStack.tsx", "components/PWAInstallPrompt.tsx"]) {
      const src = read(rel);
      const dialogs = (src.match(/<Dialog[\s>]/g) ?? []).length;
      const layers = (src.match(/useBackCloses\(/g) ?? []).length;
      if (dialogs > layers) missing.push(`${rel}: ${dialogs} dialogs, ${layers} closed by Back`);
    }
    expect(missing).toEqual([]);
  });

  it("includes the overlays drawn by hand: the tutorial player and the journey's photo", () => {
    expect(read("pages/portal/PortalTutorials.tsx")).toContain("useBackCloses(playing != null, () => setPlaying(null));");
    expect(read("components/portal/PackageTrackingTimeline.tsx")).toContain(
      "useBackCloses(openPhoto != null, () => setOpenPhoto(null));",
    );
  });

  it("includes a receipt opened in its row on the payments page, and keeps its tab", () => {
    const page = read("pages/portal/PortalFinancial.tsx");
    expect(page).toContain("useBackCloses(invoiceBoxId != null, () => setInvoiceBoxId(null), invoiceBoxId != null && invoiceBoxId === boxFromAddress);");
    expect(page).toContain("useBackCloses(invoiceBatchId != null, () => setInvoiceBatchId(null));");
  });

  it("is not a second step when the address opened it — Back returns to where the link was", () => {
    const orders = read("pages/portal/PortalFullPackage.tsx");
    expect(orders).toContain("openOrderDetail(match, true);");
    expect(orders).toContain("useBackCloses(showDetailDialog, () => setShowDetailDialog(false), detailFromAddress);");
    const money = read("pages/portal/PortalFinancial.tsx");
    const effect = money.indexOf("if (box != null) {");
    expect(effect).toBeGreaterThan(-1);
    expect(money.slice(effect, effect + 160)).toContain("setBoxFromAddress(box);");
  });

  it("closed on screen takes its step back, but never when the page itself is leaving", () => {
    const hook = read("hooks/useBackCloses.ts");
    expect(hook).toContain("window.history.pushState(withLayer(window.history.state, id), \"\");");
    expect(hook).toContain("if (!takenBack && isLayerEntry(window.history.state, id)) window.history.back();");
  });
});
