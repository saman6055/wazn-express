import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { clearSignedInData, USER_DATA_KEYS } from "./lib/signOut";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");

describe("sign-out leaves nothing of the person behind", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("empties the fetched answers and the person's lists, keeps the device's preferences", () => {
    const store = () => {
      const data = new Map<string, string>([
        ["wazn-recent", "[1]"], ["wazn_portal_recent_searches", "[\"EB16\"]"], ["theme", "dark"], ["wazn-express-language", "ku"],
      ]);
      return { data, removeItem: (k: string) => data.delete(k) };
    };
    const local = store();
    const session = store();
    vi.stubGlobal("window", { localStorage: local, sessionStorage: session });
    const clear = vi.fn();
    clearSignedInData({ clear } as never);
    expect(clear).toHaveBeenCalled();
    expect([...local.data.keys()].sort()).toEqual(["theme", "wazn-express-language"]);
    expect(USER_DATA_KEYS).toContain("wazn.orderFormSwitchDraft");
  });

  it("is what logout runs, and every way out replaces the page", () => {
    expect(read("_core/hooks/useAuth.ts")).toContain("clearSignedInData(queryClient)");
    expect(read("pages/portal/PortalProfile.tsx")).toContain('window.location.replace("/")');
    for (const f of ["pages/portal/modern/ModernPortalProfile.tsx", "pages/portal/skin3/Skin3PortalProfile.tsx"]) {
      expect(read(f), f).toContain("window.location.replace(getLoginUrl())");
    }
    expect(read("components/DashboardLayout.tsx")).toContain("await logout(); window.location.replace(getLoginUrl());");
  });

  it("a page restored from the back-forward cache reloads", () => {
    expect(read("main.tsx")).toMatch(/addEventListener\("pageshow"[\s\S]{0,120}persisted\)\s*window\.location\.reload\(\)/);
  });
});

describe("the connection tells the truth", () => {
  it("the offline banner no longer claims work is saved, in any language", () => {
    const claims = {
      ku: "کارەکانت پاشەکەوت دەکرێن",
      en: "your work is saved",
      ar: "يتم حفظ عملك",
      zh: "您的操作已保存",
    };
    for (const [lang, claim] of Object.entries(claims)) {
      // The locale files start with a byte-order mark; JSON.parse does not skip it.
      const json = JSON.parse(read(`locales/${lang}.json`).replace(/^﻿/, ""));
      expect(json.errors.offlineBanner, lang).not.toContain(claim);
      expect(json.errors.offlinePendingActions, lang).toContain("{{count}}");
    }
  });

  it("a 4xx answer is not asked for again", () => {
    expect(read("main.tsx")).toMatch(/status >= 400 && status < 500\) return false;/);
  });

  it("the live channel reconnects the moment the internet returns", () => {
    const src = read("hooks/usePortalSSE.ts");
    expect(src).toContain('window.addEventListener("online", onOnline)');
    expect(src).toContain('window.removeEventListener("online", onOnline)');
  });
});
