import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";


export default defineConfig(({ command }) => ({
  // The two editor plugins serve the Manus editor during development only.
  // In a production build jsxLoc stamped a source-path attribute on every
  // element (about 29,000 of them, 1.7 MB of text), and the runtime plugin
  // inlined a 366 KB script into index.html — downloaded on every visit, and
  // then refused by the production security policy, which runs no inline
  // script.
  plugins: [
    react(),
    tailwindcss(),
    ...(command === "serve" ? [jsxLocPlugin(), vitePluginManusRuntime()] : []),
  ],
  // console.log / .debug / .info are for development. In a build they printed
  // tracking numbers and whole error objects into any visitor's console.
  // Warnings and errors still reach it.
  esbuild: command === "build" ? { pure: ["console.log", "console.debug", "console.info"] } : undefined,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 3500,
    strictPort: false,
    hmr: { port: 3500, clientPort: 3500, host: "localhost" },
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
}));
