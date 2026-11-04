import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import http from "http";
import express from "express";
import type { Request } from "express";
import { SignJWT } from "jose";
import { authLimiterMiddleware, trpcProcedures, writeLimiterMiddleware } from "./middleware/rateLimiter";
import { boundedFetch } from "./lib/boundedFetch";
import { isPushServiceEndpoint } from "@shared/pushEndpoint";
import { CUSTOMER_UPLOADS_PER_DAY, resetCustomerUploads, takeCustomerUpload } from "./lib/customerUploadQuota";

/**
 * The security audit of 2026-11-05, held in place.
 *
 * Each finding below was confirmed in the code before it was fixed; these
 * tests make the fixed shape the only shape that passes.
 */
const read = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

function listen(app: express.Express | http.RequestListener): Promise<{ base: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer(app as http.RequestListener).listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      resolve({ base: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

describe("the login limit sees what tRPC sees", () => {
  const req = (baseUrl: string, p: string) => ({ method: "POST", baseUrl, path: p, headers: {}, query: {} }) as unknown as Request;

  it("reads the last segment, decoded, the way tRPC's express adapter does", () => {
    expect(trpcProcedures(req("/api/trpc", "/auth.staffLogin"))).toEqual(["auth.staffLogin"]);
    expect(trpcProcedures(req("/api/trpc", "/auth%2EstaffLogin"))).toEqual(["auth.staffLogin"]);
    expect(trpcProcedures(req("/api/trpc", "/x/auth.staffLogin"))).toEqual(["auth.staffLogin"]);
    expect(trpcProcedures(req("/api/trpc", "/auth.staffLogin%2Cauth.logout"))).toEqual(["auth.staffLogin", "auth.logout"]);
    expect(trpcProcedures(req("", "/api/other"))).toEqual([]);
  });

  describe("on a real mount", () => {
    let server: { base: string; close: () => void };
    beforeAll(async () => {
      const app = express();
      app.use("/api/trpc", authLimiterMiddleware, writeLimiterMiddleware, (_req, res) => res.status(401).json({ error: "wrong password" }));
      server = await listen(app);
    });
    afterAll(() => server.close());

    it("refuses a batch that carries a login or a shop order", async () => {
      for (const p of ["auth.staffLogin,auth.logout", "auth.logout,auth.customerLogin", "store.createOrder,store.createOrder"]) {
        const res = await fetch(`${server.base}/api/trpc/${p}?batch=1`, { method: "POST" });
        expect(res.status, p).toBe(400);
        const body = (await res.json()) as unknown[];
        expect(body).toHaveLength(2);
      }
    });

    it("counts an encoded login address against the login limit", async () => {
      let last = 0;
      for (let i = 0; i < 25 && last !== 429; i++) {
        last = (await fetch(`${server.base}/api/trpc/auth%2EstaffLogin`, { method: "POST" })).status;
      }
      expect(last).toBe(429);
    }, 20_000);
  });
});

describe("a customer's failed passwords are counted by the database", () => {
  it("adds one in SQL, and the lock is set by the failure that reaches the limit", () => {
    const db = read("server/db/customers.db.ts");
    expect(db).toContain("export async function countFailedCustomerLogin(");
    expect(db).toContain("${customers.failedLoginAttempts} + 1)");
    // The window is compared through the column, never as a raw Date (time zone).
    expect(db).toContain("${lt(customers.lastFailedLoginAt, windowStart)}");
    expect(db).toContain("sql`${customers.failedLoginAttempts} >= ${rule.maxAttempts}`");
    const auth = read("server/routers/auth.router.ts");
    expect(auth).toContain("await db.countFailedCustomerLogin(customer.id, now, CUSTOMER_LOCK, ATTEMPT_WINDOW_MINUTES)");
    expect(auth).not.toContain("recordFailedCustomerLogin(");
  });
});

describe("a file fetched from a stored link is bounded", () => {
  let server: { base: string; close: () => void };
  beforeAll(async () => {
    server = await listen((req, res) => {
      if (req.url === "/ok") return res.end("hello");
      if (req.url === "/redirect") {
        res.writeHead(302, { location: "http://127.0.0.1:1/secret" });
        return res.end();
      }
      if (req.url === "/big") {
        res.writeHead(200);
        res.write(Buffer.alloc(2048));
        return res.end(Buffer.alloc(2048));
      }
      // /slow: never answers.
    });
  });
  afterAll(() => server.close());

  it("reads an ordinary file", async () => {
    expect((await boundedFetch(`${server.base}/ok`)).toString()).toBe("hello");
  });
  it("gives up on an address that never answers", async () => {
    await expect(boundedFetch(`${server.base}/slow`, { timeoutMs: 300 })).rejects.toThrow();
  });
  it("refuses to follow a redirect", async () => {
    await expect(boundedFetch(`${server.base}/redirect`)).rejects.toThrow();
  });
  it("stops at the size ceiling", async () => {
    await expect(boundedFetch(`${server.base}/big`, { maxBytes: 3000 })).rejects.toThrow(/too large/);
  });
  it("is what every backup uses", () => {
    for (const f of ["server/services/fullBackup.service.ts", "server/services/s3Backup.service.ts", "server/services/zipBackup.service.ts"]) {
      const src = read(f);
      expect(src, f).toContain("boundedFetch(");
      expect(src, f).not.toMatch(/await fetch\((f|file|fileInfo)\.url\)/);
    }
  });
});

describe("ending a look hands nothing out", () => {
  it("exitViewAs signs no session", () => {
    const auth = read("server/routers/auth.router.ts");
    const exit = auth.slice(auth.indexOf("exitViewAs: protectedProcedure"), auth.indexOf("logout: publicProcedure"));
    expect(exit.length).toBeGreaterThan(100);
    expect(exit).not.toContain("SignJWT");
    expect(exit).not.toMatch(/ctx\.res\.cookie\(/);
  });
});

describe("large bodies are for signed-in people", () => {
  let server: { base: string; close: () => void };
  const secret = "test-secret-0123456789abcdef0123456789";
  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    const { trpcBodyParser } = await import("./middleware/bodyLimits");
    const app = express();
    app.use("/api/trpc", trpcBodyParser, (req, res) => res.json({ got: JSON.stringify(req.body).length }));
    server = await listen(app);
  });
  afterAll(() => server.close());

  const body = JSON.stringify({ pad: "x".repeat(300 * 1024) });

  it("a stranger's 300 KB body is refused before it is read", async () => {
    const res = await fetch(`${server.base}/api/trpc/x`, { method: "POST", headers: { "content-type": "application/json" }, body });
    expect(res.status).toBe(413);
  });

  it("a forged cookie is a stranger", async () => {
    const res = await fetch(`${server.base}/api/trpc/x`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "app_session_id=eyJhbGciOiJIUzI1NiJ9.e30.forged" },
      body,
    });
    expect(res.status).toBe(413);
  });

  it("a signed-in person may send it", async () => {
    const token = await new SignJWT({ userId: 1, role: "admin" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode(secret));
    const res = await fetch(`${server.base}/api/trpc/x`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `app_session_id=${token}` },
      body,
    });
    expect(res.status).toBe(200);
  });

  it("both server entries use it", () => {
    for (const f of ["server/_core/prod-entry.ts", "server/_core/index.ts"]) {
      const src = read(f);
      expect(src, f).toContain('app.use("/api/trpc", trpcBodyParser);');
      expect(src, f).not.toContain('express.json({ limit: "50mb" })');
    }
  });
});

describe("customers' uploads and push addresses", () => {
  it(`a customer may send ${CUSTOMER_UPLOADS_PER_DAY} files a day`, () => {
    resetCustomerUploads();
    const day = new Date("2026-11-05T10:00:00Z");
    for (let i = 0; i < CUSTOMER_UPLOADS_PER_DAY; i++) expect(takeCustomerUpload(7, day)).toBe(true);
    expect(takeCustomerUpload(7, day)).toBe(false);
    expect(takeCustomerUpload(8, day)).toBe(true);
    expect(takeCustomerUpload(7, new Date("2026-11-06T10:00:00Z"))).toBe(true);
    expect(read("server/routers/services.router.ts")).toContain("if (ctx.user.isCustomer && !takeCustomerUpload(ctx.user.id))");
  });

  it("a push subscription points only at a browser's push service", () => {
    expect(isPushServiceEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isPushServiceEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(isPushServiceEndpoint("https://web.push.apple.com/QH")).toBe(true);
    expect(isPushServiceEndpoint("https://wns2-par02p.notify.windows.com/w/?token=x")).toBe(true);
    expect(isPushServiceEndpoint("https://169.254.169.254/latest")).toBe(false);
    expect(isPushServiceEndpoint("https://evil.example/fcm.googleapis.com")).toBe(false);
    expect(isPushServiceEndpoint("https://fcm.googleapis.com.evil.example/x")).toBe(false);
    expect(isPushServiceEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isPushServiceEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(read("server/routers/portal.router.ts")).toContain(".refine(isPushServiceEndpoint");
  });

  it("a customer has no staff place of work", () => {
    expect(read("server/routers/auth.router.ts")).toContain("(ctx.user.isCustomer ? null : db.getUserWorkLocation(ctx.user.id))");
  });
});

describe("the small doors, closed", () => {
  it("both server entries send a Permissions-Policy", async () => {
    const { PERMISSIONS_POLICY } = await import("./_core/permissionsPolicy");
    expect(PERMISSIONS_POLICY).toContain("camera=(self)");
    expect(PERMISSIONS_POLICY).toContain("microphone=(self)");
    expect(PERMISSIONS_POLICY).toContain("payment=()");
    for (const f of ["server/_core/prod-entry.ts", "server/_core/index.ts"]) {
      expect(read(f), f).toContain("app.use(permissionsPolicy);");
    }
  });

  it("an app icon is drawn once per logo and size, not on every request", () => {
    const src = read("server/services/appIcons.service.ts");
    expect(src).toContain("const png = await renderedIcon(url as string, bytes, size);");
    expect(src).toContain("const hit = rendered.get(key);");
  });

  it("which addresses are trusted is the admins' question alone", () => {
    expect(read("server/routers/settings.router.ts")).toContain("isIpWhitelisted: adminProcedure");
  });
});
