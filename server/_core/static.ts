import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { appLogger } from "../utils/logger";
import { getStoreProductBySlug } from "../db";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    appLogger.error("Could not find the build directory", { distPath, hint: "Build the client first" });
  }

  app.use(express.static(distPath));

  // Wazn Store product pages get real Open Graph / Twitter tags injected so a
  // shared link (WhatsApp, Facebook, ...) previews the product's own image,
  // name, and price instead of the generic site card. The SPA still hydrates
  // normally — we only add tags to the <head> of the same index.html.
  app.get("/store/:slug", async (req, res, next) => {
    try {
      const product = await getStoreProductBySlug(req.params.slug);
      if (!product || product.status === "hidden") return next();

      const indexPath = path.resolve(distPath, "index.html");
      if (!fs.existsSync(indexPath)) return next();
      let html = fs.readFileSync(indexPath, "utf8");

      const origin = `${req.protocol}://${req.get("host")}`;
      const name = product.nameEn || product.nameKu || product.nameAr || "Wazn Store";
      const desc = (product.descriptionEn || product.descriptionKu || product.descriptionAr || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);
      let img = product.coverImageUrl || (Array.isArray(product.images) ? product.images[0] : "") || "";
      if (img && img.startsWith("/")) img = `${origin}${img}`;
      const url = `${origin}${req.originalUrl}`;

      const tags = [
        `<meta property="og:type" content="product">`,
        `<meta property="og:site_name" content="Wazn Store">`,
        `<meta property="og:title" content="${escapeHtml(name)}">`,
        desc ? `<meta property="og:description" content="${escapeHtml(desc)}">` : "",
        img ? `<meta property="og:image" content="${escapeHtml(img)}">` : "",
        `<meta property="og:url" content="${escapeHtml(url)}">`,
        `<meta property="product:price:amount" content="${escapeHtml(String(product.price))}">`,
        `<meta property="product:price:currency" content="${escapeHtml(product.currency)}">`,
        `<meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}">`,
        `<meta name="twitter:title" content="${escapeHtml(name)}">`,
        desc ? `<meta name="twitter:description" content="${escapeHtml(desc)}">` : "",
        img ? `<meta name="twitter:image" content="${escapeHtml(img)}">` : "",
      ].filter(Boolean).join("\n    ");

      html = html.replace("</head>", `    ${tags}\n  </head>`);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } catch (err) {
      appLogger.error("[Store OG] failed to inject product meta", { err: String(err) });
      return next();
    }
  });

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
