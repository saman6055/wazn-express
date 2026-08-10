import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    // Client entries cover pure helpers only (no DOM), so the node
    // environment above is enough — no jsdom setup required.
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "client/src/**/*.test.ts",
      // Rules both sides depend on live in shared/. Without this line a test
      // written beside one of them is never run, and reads as passing.
      "shared/**/*.test.ts",
    ],
  },
});
