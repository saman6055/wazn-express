import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { scrubText, scrubUrl } from "./lib/scrub";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");

describe("a report from a browser carries no one's secrets", () => {
  it("phone numbers, in every way they are written", () => {
    for (const phone of ["07501234567", "0750 123 4567", "+9647501234567", "964 750 123 4567"]) {
      expect(scrubText(`customer ${phone} not found`), phone).toBe("customer [phone] not found");
    }
  });

  it("tokens, passwords, bearer credentials and share links", () => {
    expect(scrubText("session eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjF9.abcdefghijklmn")).toBe("session [jwt]");
    expect(scrubText("password=hunter2&next=/a")).toBe("password=[redacted]&next=/a");
    expect(scrubText('{"token": "abc123def"}')).toBe('{"token": "[redacted]"}');
    expect(scrubText("Authorization: Bearer abc.def-ghi")).toMatch(/Authorization: \[redacted\]|Bearer \[redacted\]/);
    expect(scrubText("GET /t/Xy12ab34cd failed")).toBe("GET /t/[token] failed");
  });

  it("e-mail addresses and long numbers, but not a stack's line numbers", () => {
    expect(scrubText("mail ali@example.com")).toBe("mail [email]");
    expect(scrubText("id 12345678901234")).toBe("id [number]");
    expect(scrubText("at App (index-abc.js:123:45)")).toBe("at App (index-abc.js:123:45)");
  });

  it("is capped, and a page address keeps its path only", () => {
    expect(scrubText("x".repeat(5000), 100).length).toBeLessThanOrEqual(101);
    expect(scrubUrl("https://wazn.example/portal/search?q=07501234567#top")).toBe("/portal/search");
    expect(scrubUrl(undefined)).toBe("");
  });
});

describe("the wiring", () => {
  it("the report endpoint is rate-limited, scrubs, and never answers with an error", () => {
    const src = read("_core/clientErrorsRoute.ts");
    expect(src).toContain('app.post("/api/client-errors", mutationLimiter,');
    expect(src).toContain("scrubText(body.message");
    expect(src).toContain("res.status(204).end()");
  });

  it("the request log keeps the path, never the query string", () => {
    const src = read("utils/logger.ts");
    expect(src).toContain("url: req.path,");
    expect(src).not.toContain("req.originalUrl");
  });
});
