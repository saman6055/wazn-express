import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Who can call what.
 *
 * Every procedure added to this system picks an access level on one line, and
 * the wrong choice is invisible in review — `publicProcedure` and
 * `staffProcedure` look equally deliberate. These tests write down the
 * choices that have been made, so changing one has to be an edit here too.
 *
 * The lists are allowlists rather than patterns on purpose. A pattern quietly
 * accepts the next thing that matches it; a list has to be argued with.
 */

const ROUTERS = path.join(__dirname, "routers");

interface Procedure {
  router: string;
  name: string;
  kind: string;
  operation: "query" | "mutation";
}

function allProcedures(): Procedure[] {
  const out: Procedure[] = [];
  for (const file of fs.readdirSync(ROUTERS).filter((f) => /\.router\.ts$/.test(f))) {
    const src = fs.readFileSync(path.join(ROUTERS, file), "utf8");
    const re = /^\s+([a-zA-Z][a-zA-Z0-9_]*): ([a-zA-Z]+Procedure)\b([\s\S]{0,900}?)\.(query|mutation)\(/gm;
    for (const m of src.matchAll(re)) {
      out.push({
        router: file.replace(".router.ts", ""),
        name: m[1],
        kind: m[2],
        operation: m[4] as "query" | "mutation",
      });
    }
  }
  return out;
}

/** Callable with no session at all. Every one of these is a front door. */
const PUBLIC_MUTATIONS = [
  "auth.logout",
  "auth.customerLogin",
  "auth.staffLogin",
  // The public shop: anyone may place an order without an account. Price is
  // recomputed server-side from the stored product, so the amount cannot be
  // driven from the request.
  "store.createOrder",
];

/** Destructive enough to be admins only, not staff. */
const ADMIN_ONLY = [
  { router: "batches", name: "delete" },
  { router: "trash", name: "purge" },
];

describe("who can call what", () => {
  const procs = allProcedures();

  it("finds the procedures at all", () => {
    // Guard the guard: if the shape of a router declaration changes, every
    // test below would pass against an empty list.
    expect(procs.length).toBeGreaterThan(200);
  });

  it("the unauthenticated write surface is exactly what we agreed", () => {
    const found = procs
      .filter((p) => p.kind === "publicProcedure" && p.operation === "mutation")
      .map((p) => `${p.router}.${p.name}`)
      .sort();
    expect(found, "a new mutation is callable without logging in").toEqual([...PUBLIC_MUTATIONS].sort());
  });

  it("nothing is left on the bare protectedProcedure inside staff routers", () => {
    // protectedProcedure only means "signed in" — a customer account passes
    // it. In a staff router that is almost always a mistake; the portal
    // router is where a signed-in-but-not-staff caller legitimately lands.
    const staffRouters = ["batches", "packages", "customers", "finance", "invoices"];
    const loose = procs
      .filter((p) => staffRouters.includes(p.router) && p.kind === "protectedProcedure")
      .map((p) => `${p.router}.${p.name}`);
    expect(loose, "these are reachable by any signed-in customer").toEqual([]);
  });

  it("destroying something requires an admin", () => {
    for (const { router, name } of ADMIN_ONLY) {
      const proc = procs.find((p) => p.router === router && p.name === name);
      expect(proc, `${router}.${name} not found`).toBeDefined();
      expect(proc!.kind, `${router}.${name} must be admin-only`).toBe("adminProcedure");
    }
  });

  it("every procedure declares an access level from the known set", () => {
    const known = new Set([
      "publicProcedure",
      "protectedProcedure",
      "customerProcedure",
      "staffProcedure",
      "accountantProcedure",
      "adminProcedure",
      "superAdminProcedure",
    ]);
    const unknown = [...new Set(procs.map((p) => p.kind))].filter((k) => !known.has(k));
    expect(unknown, "an access level nobody has reviewed").toEqual([]);
  });

  it("the portal router never uses staff or admin access for customer data", () => {
    // A staffProcedure in the portal router would be unreachable for the
    // customer it was written for, which usually means it is in the wrong
    // file — or worse, that it is reachable and returning everyone's data.
    const wrong = procs
      .filter((p) => p.router === "portal" && p.kind === "staffProcedure" && p.name.startsWith("getMy"))
      .map((p) => p.name);
    expect(wrong).toEqual([]);
  });
});

describe("the rate limiters that exist are the ones that run", () => {
  const limiterSrc = fs.readFileSync(path.join(__dirname, "middleware/rateLimiter.ts"), "utf8");
  const wiring = [
    fs.readFileSync(path.join(__dirname, "_core/index.ts"), "utf8"),
    fs.readFileSync(path.join(__dirname, "_core/prod-entry.ts"), "utf8"),
  ].join("\n");

  it("records which limiters are actually mounted", () => {
    // Documented in RATE_LIMIT_REPORT.md: mutationLimiter and
    // fileUploadLimiter are defined and exported but never mounted, so the
    // only real protection is the global 1000/min per IP plus the auth
    // limiter. This test states today's truth rather than an aspiration —
    // when they are wired up, it should be updated, deliberately.
    const defined = [...limiterSrc.matchAll(/export const ([a-zA-Z]+Limiter)/g)].map((m) => m[1]);
    expect(defined).toContain("globalLimiter");
    expect(defined).toContain("mutationLimiter");

    const mounted = defined.filter((name) => new RegExp(`\\b${name}\\b`).test(wiring));
    expect(mounted, "the set of mounted limiters changed — was that intended?")
      .toEqual(["globalLimiter"]);
  });

  it("login is limited far more tightly than everything else", () => {
    // Brute-forcing a password is the attack the global limiter cannot stop.
    expect(wiring).toContain("authLimiterMiddleware");
    const authMax = limiterSrc.match(/authLimiter = rateLimit\(\{[\s\S]*?max: isDev \? \d+ : (\d+)/);
    const globalMax = limiterSrc.match(/globalLimiter = rateLimit\(\{[\s\S]*?max: isDev \? \d+ : (\d+)/);
    expect(authMax, "authLimiter max not found").toBeTruthy();
    expect(Number(authMax![1])).toBeLessThan(Number(globalMax![1]));
  });
});
