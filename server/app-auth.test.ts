import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * What a native app needs from this server that a browser does not.
 *
 * A browser carries its session in an HttpOnly cookie, which is right:
 * script on the page cannot read it, so an injected script cannot steal it.
 * A native app has no such cookie jar to lean on — it holds the token itself
 * and sends it as a header. Same token, same verification, different
 * transport.
 *
 * Until now the server read the cookie and nothing else, and login handed
 * back no token at all, so an app had nothing to hold. That was the one
 * structural thing standing between this API and a phone.
 */

const ROOT = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

const sdk = read("server/_core/sdk.ts");
const authRouter = read("server/routers/auth.router.ts");

describe("a session can arrive in a header", () => {
  const reader = sdk.slice(sdk.indexOf("private sessionTokenFrom"), sdk.indexOf("async authenticateRequest"));

  it("reads Authorization: Bearer as well as the cookie", () => {
    expect(reader).toContain("authorization");
    expect(reader).toMatch(/Bearer/);
  });

  it("prefers the cookie when both are present", () => {
    // A client that sends both is a browser, and its cookie is the one the
    // server set.
    const cookieAt = reader.indexOf("parseCookies");
    const headerAt = reader.indexOf("authorization");
    expect(cookieAt).toBeGreaterThan(-1);
    expect(cookieAt, "the header is consulted before the cookie").toBeLessThan(headerAt);
  });

  it("verifies a header token by exactly the same path", () => {
    // Two verification paths is two chances to get one of them wrong.
    const body = sdk.slice(sdk.indexOf("async authenticateRequest"), sdk.indexOf("async authenticateRequest") + 400);
    expect(body).toContain("this.verifySession(sessionToken)");
    expect(body, "a second, header-only verification path").not.toContain("jwtVerify(");
  });
});

describe("the token is handed out only to a client that asks", () => {
  it("is off by default", () => {
    expect(authRouter).toContain("issueToken: z.boolean().optional()");
  });

  it("is omitted from the response unless requested", () => {
    // Returning it every time would hand away the HttpOnly protection for
    // the sake of a client that is not asking for it.
    expect(authRouter).toContain("...(input.issueToken ? { token } : {})");
  });

  it("still sets the cookie either way", () => {
    // The web client is unchanged: same cookie, same flags, same lifetime.
    expect(authRouter).toContain("ctx.res.cookie(COOKIE_NAME, token,");
  });
});
