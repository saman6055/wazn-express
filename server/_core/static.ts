import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { appLogger } from "../utils/logger";

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  
  if (!fs.existsSync(distPath)) {
    appLogger.error("Could not find the build directory", { distPath, hint: "Build the client first" });
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
