import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { VIEW_AS_EXIT_PATH, VIEW_AS_MINUTES, VIEW_AS_REFUSAL, viewAsMayPerform } from "./viewAsCustomer";
import { hasFix } from "./fixAdvice";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * The owner, 2026-09-26: "I want to get into any customer's account from
 * Portal Center without a username and password, so I can find what the
 * portal is missing." Real need, and a real hazard — so the two things that
 * make it safe are asserted here, not trusted.
 */
describe("looking at a customer's portal", () => {
  it("may read everything", () => {
    expect(viewAsMayPerform(true, "query")).toBe(true);
    expect(viewAsMayPerform(true, "subscription")).toBe(true);
  });

  it("may write nothing", () => {
    // Not "should not": a look must never leave a declaration, a claim, a
    // rating or a WhatsApp request on a real customer's account.
    expect(viewAsMayPerform(true, "mutation")).toBe(false);
  });

  it("leaves an ordinary session alone", () => {
    for (const op of ["query", "mutation", "subscription"] as const) {
      expect(viewAsMayPerform(false, op), op).toBe(true);
      expect(viewAsMayPerform(undefined, op), op).toBe(true);
    }
  });

  it("says why it refused, and how to get out of it", () => {
    expect(hasFix(VIEW_AS_REFUSAL)).toBe(true);
  });

  it("is refused in the one place every call passes through", () => {
    /*
     * Beside the auditor's rule, for the same reason it was written that
     * way: a list of blocked endpoints is a list somebody forgets to add to,
     * and the first forgotten mutation is the one that writes to a real
     * customer's account.
     */
    const trpc = read("server/_core/trpc.ts");
    expect(trpc).toContain("viewAsMayPerform(!!ctx.viewAs, type, path)");
    expect(trpc).toContain("VIEW_AS_REFUSAL");
    // Nowhere else may decide this.
    const routers = fs
      .readdirSync(path.resolve(__dirname, "../server/routers"))
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    for (const file of routers) {
      expect(read(`server/routers/${file}`), file).not.toContain("viewAsMayPerform");
    }
  });

  it("lets a look end itself, and nothing else", () => {
    // Ending the look writes the staff session back, so it is a mutation.
    // It is the one path through, and it must stay the one path.
    expect(viewAsMayPerform(true, "mutation", VIEW_AS_EXIT_PATH)).toBe(true);
    expect(viewAsMayPerform(true, "mutation", "portal.declarePackage")).toBe(false);
    expect(viewAsMayPerform(true, "mutation")).toBe(false);
    expect(VIEW_AS_EXIT_PATH).toBe("auth.exitViewAs");
    // And that path is signed-in only, so it widens nothing for the world.
    const auth = read("server/routers/auth.router.ts");
    expect(auth).toContain("exitViewAs: protectedProcedure.mutation");
  });

  it("is short, and comes only from the signed session", () => {
    expect(VIEW_AS_MINUTES).toBeLessThanOrEqual(240);
    const ctx = read("server/_core/context.ts");
    // Read off the cookie the request already verified — never off a header,
    // a query string or the body, which the client controls.
    expect(ctx).toContain("function readViewAs");
    expect(ctx).toContain("parseCookieHeader(req.headers.cookie");
    // A look never renews itself into a year-long session.
    expect(ctx).toContain("if (user?.isCustomer && !viewAs)");
  });

  it("is recorded, before the session is handed over", () => {
    const router = read("server/routers/portalCenter.router.ts");
    const proc = router.slice(router.indexOf("viewAsCustomer: adminProcedure"), router.indexOf("exitViewAs") + 1 || undefined);
    const block = proc.length > 200 ? proc : router.slice(router.indexOf("viewAsCustomer: adminProcedure"));
    expect(block).toContain("adminProcedure");
    expect(block.indexOf('action: "view_as_customer"')).toBeGreaterThan(-1);
    // The audit row is written before the token is minted, let alone handed
    // over. (It used to be compared against the cookie; the look now travels
    // as a token so it can live in one tab — 2026-09-26.)
    expect(block.indexOf('action: "view_as_customer"')).toBeLessThan(block.indexOf("new SignJWT"));
    expect(block).not.toContain("ctx.res.cookie");
  });

  it("wears a bar the customer's own session never wears", () => {
    const banner = read("client/src/components/portal/ViewAsBanner.tsx");
    // Drawn from the session, not from a prop or a URL.
    expect(banner).toContain("trpc.auth.me.useQuery");
    expect(banner).toContain("if (!viewAs) return null;");
    expect(banner).toContain("exitViewAs");
    // Above all three skins, so no skin can be the one that forgets.
    expect(read("client/src/components/portal/PortalLayout.tsx")).toContain("<ViewAsBanner />");
  });
});

describe("a look lives in one tab", () => {
  it("is handed over as a token, not set as a cookie", () => {
    // The owner, 2026-09-26: opening one should not cost him the admin page
    // he was on. A cookie is the whole browser's; a token is this tab's.
    const router = read("server/routers/portalCenter.router.ts");
    const proc = router.slice(router.indexOf("viewAsCustomer: adminProcedure"));
    expect(proc.slice(0, 3000)).toContain("token,");
    expect(read("client/src/pages/PortalCenter.tsx"))
      .toContain('const href = "/portal?viewas=" + encodeURIComponent(result.token);');
  });

  it("keeps the token to that tab, and off the address bar", () => {
    const main = read("client/src/main.tsx");
    expect(main).toContain('export const VIEW_AS_TOKEN_KEY = "wazn-view-as";');
    expect(main).toContain("sessionStorage.setItem(VIEW_AS_TOKEN_KEY, handed)");
    // A token left in a shared link is a session shared with it.
    expect(main).toContain('params.delete("viewas")');
    expect(main).toContain("window.history.replaceState");
    expect(main).toContain("authorization: `Bearer ${viewAs}`");
  });

  it("is the only bearer the server prefers over a cookie", () => {
    const sdk = read("server/_core/sdk.ts");
    expect(sdk).toContain("if (bearer && looksLikeViewAs(bearer)) return bearer;");
    expect(sdk).toContain("JSON.parse(json)?.viewAs === true");
    // Everything else keeps the old order: the cookie the server set.
    expect(sdk).toContain("if (fromCookie) return fromCookie;");
  });
});
