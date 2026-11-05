import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * wouter's <Switch> takes the first route that matches. A fixed address
 * declared after a ":param" route with the same start is never reached:
 * "/customers/standing" sat after "/customers/:id", so the blacklist opened
 * as customer "standing" and loaded for ever (owner, 2026-11-05).
 */
describe("no page is hidden behind a :param route declared before it", () => {
  const app = readFileSync(resolve(__dirname, "..", "App.tsx"), "utf8");
  const paths = Array.from(app.matchAll(/<Route\s+path="([^"]+)"/g), (m) => m[1]);

  const matches = (pattern: string, path: string) => {
    const a = pattern.split("/");
    const b = path.split("/");
    if (a.length !== b.length) return false;
    return a.every((seg, i) => seg.startsWith(":") || seg === b[i]);
  };

  it("reads the routes", () => {
    expect(paths.length).toBeGreaterThan(50);
    expect(paths).toContain("/customers/standing");
  });

  it("every fixed address comes before any :param route that would catch it", () => {
    const shadowed: string[] = [];
    paths.forEach((path, i) => {
      if (path.includes(":") || path.includes("*")) return;
      const earlier = paths.slice(0, i).find((p) => p.includes(":") && matches(p, path));
      if (earlier) shadowed.push(`${path} is caught by ${earlier}`);
    });
    expect(shadowed).toEqual([]);
  });
});
