import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import recording from "@/demo/portalDemoData.json";
import {
  DEMO_EXACT_ONLY,
  DEMO_QUIET_MUTATIONS,
  demoFetch,
  PORTAL_DEMO_WORDS,
  recordedAnswer,
  shiftDates,
  type PortalDemoData,
} from "@/lib/portalDemo";

const ROOT = path.resolve(__dirname);
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
const data = recording as unknown as PortalDemoData;

/**
 * The portal's demo (owner, 2026-10-09): somebody with no account sees the
 * whole portal, exactly as a customer does, as marketing.
 *
 * It is the real portal answered from a recording - the server's own answers
 * for one seeded customer on a throwaway database - so nothing of it is in
 * the books and no public door hands out a session.
 *
 * Looked at in the local app with no session at all: the button on the login
 * page; 27 portal pages on the classic skin and 14 each on the other two,
 * none with an error panel or a failed request; the home page's counts (2 in
 * China, 3 on the way, 2 in Erbil), the orders with their pictures, the
 * conversation with the office's reply; a phone at 375px with nothing
 * scrolling sideways; and the server refusing a real write from that tab (401).
 */
describe("what the recording holds", () => {
  it("answers every question the portal's main screens ask", () => {
    for (const p of [
      "auth.me",
      "customerPortal.getMyAccount",
      "customerPortal.getMyPackages",
      "customerPortal.getMyBatches",
      "customerPortal.getMyDeliveryBoxes",
      "customerPortal.getMyFinancialSummary",
      "customerPortal.getMyTransactions",
      "customerPortal.getMyFullPackageOrders",
      "customerPortal.getMyNotifications",
      "customerPortal.getMyAddresses",
      "customerPortal.getMyYuanOrders",
      "customerPortal.getPackageTimeline",
      "customerPortal.searchPackage",
      "supportChat.getMessages",
      "supportChat.getOrCreateChat",
    ]) {
      expect(data.calls[p]?.length ?? 0, p).toBeGreaterThan(0);
    }
  });

  it("is a customer's session, and nobody's eyes are on it", () => {
    const me = (data.calls["auth.me"][0].data as { json: Record<string, unknown> }).json;
    expect(me.isCustomer).toBe(true);
    expect(me.role).toBe("customer");
    expect(Object.keys(me).filter((k) => /viewAs/i.test(k))).toEqual([]);
  });

  it("carries nothing that opens a door", () => {
    const text = JSON.stringify(data);
    for (const word of ["passwordHash", "Bearer", "eyJ", "openId", "lockedUntil", "failedLogin", "localhost"]) {
      expect(text, word).not.toContain(word);
    }
  });

  it("says when it was taken", () => {
    expect(Number.isFinite(new Date(data.capturedAt).getTime())).toBe(true);
  });
});

describe("time moves with the visitor", () => {
  it("shifts every moment by whole days and leaves everything else alone", () => {
    const shifted = shiftDates({ at: "2026-10-09T08:30:00.000Z", n: 3, code: "AIR-2026-064", list: ["2026-10-01T00:00:00Z", "x"] }, 10);
    expect(shifted).toEqual({ at: "2026-10-19T08:30:00.000Z", n: 3, code: "AIR-2026-064", list: ["2026-10-11T00:00:00.000Z", "x"] });
  });

  it("a parcel registered four days before the recording is four days old next spring", () => {
    const kept: PortalDemoData = { capturedAt: "2026-10-09T12:00:00.000Z", calls: { "a.b": [{ input: "null", data: { json: { at: "2026-10-05T12:00:00.000Z" } } }] } };
    const now = new Date("2027-04-01T12:00:00.000Z");
    const got = recordedAnswer(kept, "a.b", "null", now) as { json: { at: string } };
    expect(Math.round((now.getTime() - new Date(got.json.at).getTime()) / 86_400_000)).toBe(4);
  });
});

describe("which answer a question gets", () => {
  const kept: PortalDemoData = {
    capturedAt: new Date().toISOString(),
    calls: {
      "x.list": [{ input: '{"limit":50}', data: { json: [1] } }, { input: '{"limit":10}', data: { json: [2] } }],
      "customerPortal.searchPackage": [
        { input: '{"trackingNumber":"T1"}', data: { json: { found: "T1" } } },
        { input: "__miss__", data: { json: { found: null } } },
      ],
    },
  };
  const now = new Date();

  it("the same input, when it was recorded", () => {
    expect(recordedAnswer(kept, "x.list", '{"limit":10}', now)).toEqual({ json: [2] });
  });

  it("a list asked with another page size still opens - the first one kept", () => {
    expect(recordedAnswer(kept, "x.list", '{"limit":7}', now)).toEqual({ json: [1] });
  });

  it("a search for something else finds nothing, never the first parcel", () => {
    expect(DEMO_EXACT_ONLY).toContain("customerPortal.searchPackage");
    expect(recordedAnswer(kept, "customerPortal.searchPackage", '{"trackingNumber":"T1"}', now)).toEqual({ json: { found: "T1" } });
    expect(recordedAnswer(kept, "customerPortal.searchPackage", '{"trackingNumber":"ZZ"}', now)).toEqual({ json: { found: null } });
    expect(recordedAnswer(kept, "customerPortal.getReceiptData", '{"transactionId":99}', now)).toEqual({ json: null });
  });

  it("a question nobody recorded is left for the real server", () => {
    expect(recordedAnswer(kept, "settings.getCompanyInfo", "null", now)).toBeUndefined();
  });
});

describe("standing where the network would be", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stand = () => vi.stubGlobal("window", { location: { origin: "https://portal.example" } });
  const url = (paths: string, inputs: unknown) => `/api/trpc/${paths}?batch=1&input=${encodeURIComponent(JSON.stringify(inputs))}`;

  it("answers a recorded question without asking the server", async () => {
    stand();
    const real = vi.fn();
    const res = await demoFetch(url("auth.me", { 0: { json: null } }), undefined, real);
    const body = (await res.json()) as Array<{ result: { data: { json: { customerCode: string } } } }>;
    expect(real).not.toHaveBeenCalled();
    expect(body[0].result.data.json.customerCode).toBe("AZ777");
  });

  it("sends the company's own facts to the real server, and keeps the order of the answers", async () => {
    stand();
    const real = vi.fn(async (asked: RequestInfo | URL) => {
      expect(String(asked)).toContain("/api/trpc/settings.getCompanyInfo?");
      return new Response(JSON.stringify([{ result: { data: { json: { name: "Wazn" } } } }]));
    });
    const res = await demoFetch(url("settings.getCompanyInfo,auth.me", { 0: { json: null }, 1: { json: null } }), undefined, real);
    const body = (await res.json()) as Array<{ result: { data: { json: Record<string, unknown> } } }>;
    expect(real).toHaveBeenCalledTimes(1);
    expect(body[0].result.data.json.name).toBe("Wazn");
    expect(body[1].result.data.json.customerCode).toBe("AZ777");
  });

  it("a question the server will not answer a visitor shows nothing, not a refusal", async () => {
    stand();
    const real = vi.fn(async () => new Response(JSON.stringify([{ error: { json: { message: "no", data: { code: "UNAUTHORIZED" } } } }])));
    const res = await demoFetch(url("customerPortal.somethingNew", { 0: { json: null } }), undefined, real);
    expect(await res.json()).toEqual([{ result: { data: { json: null } } }]);
  });

  it("changes nothing: a write is refused in words, with the way to a real account", async () => {
    stand();
    const real = vi.fn();
    const res = await demoFetch("/api/trpc/customerPortal.createAddress?batch=1", { method: "POST", body: "{}" }, real);
    const body = (await res.json()) as Array<{ error: { json: { message: string; data: { code: string } } } }>;
    expect(real).not.toHaveBeenCalled();
    expect(body[0].error.json.data.code).toBe("FORBIDDEN");
    expect(body[0].error.json.message).toBe(PORTAL_DEMO_WORDS.refused.ku);
    // The cause, then numbered steps (shared/fixAdvice's rule, in a sentence).
    for (const lang of ["ku", "en", "ar", "zh"] as const) expect(PORTAL_DEMO_WORDS.refused[lang]).toMatch(/1\..*2\./s);
  });

  it("what a page does by itself is accepted quietly - no red toast nobody asked for", async () => {
    stand();
    const real = vi.fn();
    for (const p of DEMO_QUIET_MUTATIONS) {
      const res = await demoFetch(`/api/trpc/${p}?batch=1`, { method: "POST", body: "{}" }, real);
      const body = (await res.json()) as Array<{ result?: unknown; error?: unknown }>;
      expect(body[0].error, p).toBeUndefined();
    }
    expect(real).not.toHaveBeenCalled();
  });
});

describe("where it is wired", () => {
  it("the demo is asked for before the network is", () => {
    const main = read("main.tsx");
    expect(main).toContain("if (isPortalDemo()) return await demoFetch(");
    expect(main).toContain("readPortalDemoLink();");
    // A visitor has no session to lose: no question may throw them to the login page.
    const redirect = main.slice(main.indexOf("const redirectToLoginIfUnauthorized"), main.indexOf("queryClient.getQueryCache()"));
    expect(redirect).toContain("if (isPortalDemo()) return;");
    expect(redirect.indexOf("if (isPortalDemo()) return;")).toBeLessThan(redirect.indexOf("window.location.href = getLoginUrl();"));
  });

  it("no live channel is opened for a visitor", () => {
    expect(read("hooks/usePortalSSE.ts")).toContain("if (!enabled || isPortalDemo()) return;");
  });

  it("the door is on the login page, and standing at that door ends a demo", () => {
    const login = read("pages/CustomerLogin.tsx");
    expect(login).toContain("onClick={enterPortalDemo}");
    expect(login).toContain('data-testid="portal-demo-open"');
    expect(login).toContain("useEffect(() => forgetPortalDemo(), []);");
  });

  it("every screen of it says it is a demo, and asks for the one thing it is for", () => {
    expect(read("App.tsx")).toContain("<PortalDemoBanner />");
    const bar = read("components/portal/PortalDemoBanner.tsx");
    expect(bar).toContain('location.startsWith("/portal")');
    // WhatsApp goes straight to Wazn, as every customer button does.
    expect(bar).toContain("openWaznChat(say(PORTAL_DEMO_WORDS.askAccount))");
    expect(bar).toContain("onClick={leavePortalDemo}");
  });

  it("the recording is its own chunk: a customer who signs in never downloads it", () => {
    const lib = read("lib/portalDemo.ts");
    expect(lib).toContain('import("@/demo/portalDemoData.json")');
    expect(lib).not.toMatch(/^import .*portalDemoData/m);
    for (const file of ["main.tsx", "App.tsx", "pages/CustomerLogin.tsx", "components/portal/PortalDemoBanner.tsx"]) {
      expect(read(file), file).not.toContain("portalDemoData");
    }
  });

  it("nothing imports the app's entry - under the dev server that mounts the app twice", () => {
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const e of fs.readdirSync(dir)) {
        const p = path.join(dir, e);
        if (fs.statSync(p).isDirectory()) walk(p, out);
        else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
      }
      return out;
    };
    const offenders = walk(ROOT).filter((f) => /from\s+["'](@\/main|\.{1,2}\/(\.\.\/)*main)["']/.test(fs.readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });
});
