import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * vite.config.ts exports a function (defineConfig(({ command }) => …)).
 * setupVite spread it as if it were an object, so `npm run dev` served the
 * client with no root, no aliases and no plugins — every client file came
 * back as index.html. Found 2026-09-28 running the app against a local
 * database to test the phone layout.
 */
describe("the dev server reads the real vite config", () => {
  it("resolves the config function before spreading it", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "_core/vite.ts"), "utf8");
    expect(src).toContain('typeof viteConfig === "function"');
    expect(src).toContain('await viteConfig({ command: "serve", mode: "development"');
    expect(src).toContain("...config,");
  });
});
