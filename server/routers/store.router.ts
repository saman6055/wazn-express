import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { staffProcedure } from "../middleware/auth";
import { acceptUpload } from "../lib/uploadGate";
import { appLogger } from "../utils/logger";
import * as db from "../db";

// ---------------------------------------------------------------------------
// Wazn Store router
//   Public: browse products, place an order (guest checkout — no login).
//   Staff:  manage products, upload images, view + progress orders.
// Prices and totals are ALWAYS recomputed server-side from the stored product;
// the client-submitted price is never trusted.
// ---------------------------------------------------------------------------

const productWriteInput = z.object({
  // Any one language is enough; a base name is derived server-side.
  nameEn: z.string().max(300).optional(),
  nameKu: z.string().max(300).optional(),
  nameAr: z.string().max(300).optional(),
  descriptionEn: z.string().optional(),
  descriptionKu: z.string().optional(),
  descriptionAr: z.string().optional(),
  price: z.number().nonnegative(),
  compareAtPrice: z.number().nonnegative().optional(),
  currency: z.string().max(10).optional(),
  coverImageUrl: z.string().max(500).optional(),
  images: z.array(z.string().max(500)).optional(),
  category: z.string().max(100).optional(),
  barcode: z.string().max(64).optional().nullable(),
  sku: z.string().max(64).optional().nullable(),
  size: z.string().max(30).optional().nullable(),
  variantGroup: z.string().max(100).optional().nullable(),
  status: z.enum(["active", "hidden", "out_of_stock"]).optional(),
  stock: z.number().int().optional().nullable(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// One spreadsheet row, already read by shared/storeImport on the client.
// Price may be missing: such a product is saved hidden at 0 until priced.
const optText = (max: number) => z.string().max(max).nullable().optional();
const importRowInput = z.object({
  nameEn: optText(300),
  nameKu: optText(300),
  nameAr: optText(300),
  descriptionEn: z.string().nullable().optional(),
  descriptionKu: z.string().nullable().optional(),
  descriptionAr: z.string().nullable().optional(),
  price: z.number().nonnegative().nullable(),
  compareAtPrice: z.number().nonnegative().nullable().optional(),
  currency: optText(10),
  coverImageUrl: optText(500),
  images: z.array(z.string().max(500)).nullable().optional(),
  category: optText(100),
  barcode: optText(64),
  sku: optText(64),
  size: optText(30),
  variantGroup: optText(100),
  status: z.enum(["active", "hidden", "out_of_stock"]).nullable().optional(),
  stock: z.number().int().nonnegative().nullable().optional(),
  isFeatured: z.boolean().nullable().optional(),
  sortOrder: z.number().int().nullable().optional(),
});

/** Blank -> null, and no stray spaces inside a scanned code. */
function cleanBarcode(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  const s = (v ?? "").replace(/\s+/g, "");
  return s === "" ? null : s;
}

/** A second product with the same barcode is refused by the unique index. */
function isDuplicateBarcode(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return /duplicate entry/i.test(m) && /barcode/i.test(m);
}

const DUPLICATE_BARCODE = "This barcode already belongs to another product — بارکۆدەکە هی کاڵایەکی ترە";

export const storeRouter = router({
  // ---- Public reads -------------------------------------------------------
  listProducts: publicProcedure.query(async () => {
    return db.getVisibleStoreProducts();
  }),

  featured: publicProcedure.query(async () => {
    return db.getFeaturedStoreProducts();
  }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const product = await db.getStoreProductBySlug(input.slug);
      if (product && product.status !== "hidden") {
        await db.incrementStoreProductView(product.id);
      }
      return product && product.status !== "hidden" ? product : null;
    }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const product = await db.getStoreProductById(input.id);
      if (product && product.status !== "hidden") {
        await db.incrementStoreProductView(product.id);
      }
      return product && product.status !== "hidden" ? product : null;
    }),

  // ---- Public order (guest checkout) --------------------------------------
  createOrder: publicProcedure
    .input(z.object({
      productId: z.number(),
      quantity: z.number().int().min(1).max(999).default(1),
      customerName: z.string().min(1).max(200),
      customerPhone: z.string().min(6).max(50),
      customerCity: z.string().max(100).optional(),
      customerAddress: z.string().max(2000).optional(),
      note: z.string().max(1000).optional(),
    }))
    .mutation(async ({ input }) => {
      const product = await db.getStoreProductById(input.productId);
      if (!product || product.status === "hidden") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }
      if (product.status === "out_of_stock") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Product is out of stock" });
      }

      // Recompute money server-side from the stored product price.
      const unitPrice = Number(product.price);
      const totalPrice = (unitPrice * input.quantity).toFixed(2);
      const orderCode = `WS-${Date.now().toString(36).toUpperCase()}`;

      const order = await db.createStoreOrder({
        orderCode,
        productId: product.id,
        productName: product.nameEn || product.nameKu || product.nameAr || "Product",
        productImageUrl: product.coverImageUrl || (Array.isArray(product.images) ? product.images[0] : undefined) || null,
        unitPrice: unitPrice.toFixed(2),
        quantity: input.quantity,
        totalPrice,
        currency: product.currency,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone.trim(),
        customerCity: input.customerCity?.trim() || null,
        customerAddress: input.customerAddress?.trim() || null,
        note: input.note?.trim() || null,
      });

      appLogger.info("[Store] New order", { orderCode, productId: product.id, qty: input.quantity });
      return { orderCode: order.orderCode, id: order.id, totalPrice: order.totalPrice, currency: order.currency };
    }),

  // ---- Staff: product management ------------------------------------------
  listAllProducts: staffProcedure.query(async () => {
    return db.getAllStoreProducts();
  }),

  createProduct: staffProcedure
    .input(productWriteInput)
    .mutation(async ({ input, ctx }) => {
      const nameEn = input.nameEn || input.nameKu || input.nameAr;
      if (!nameEn) throw new TRPCError({ code: "BAD_REQUEST", message: "A product name is required" });
      try {
        return await db.createStoreProduct({
          ...input,
          nameEn,
          barcode: cleanBarcode(input.barcode) ?? null,
          price: input.price.toFixed(2),
          compareAtPrice: input.compareAtPrice != null ? input.compareAtPrice.toFixed(2) : null,
          createdById: ctx.user.id,
        });
      } catch (e) {
        if (isDuplicateBarcode(e)) throw new TRPCError({ code: "CONFLICT", message: DUPLICATE_BARCODE });
        throw e;
      }
    }),

  updateProduct: staffProcedure
    .input(productWriteInput.partial().extend({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { id, price, compareAtPrice, barcode, ...rest } = input;
      let updated;
      try {
        updated = await db.updateStoreProduct(id, {
          ...rest,
          ...(barcode !== undefined ? { barcode: cleanBarcode(barcode) ?? null } : {}),
          ...(price != null ? { price: price.toFixed(2) } : {}),
          ...(compareAtPrice !== undefined ? { compareAtPrice: compareAtPrice != null ? compareAtPrice.toFixed(2) : null } : {}),
        });
      } catch (e) {
        if (isDuplicateBarcode(e)) throw new TRPCError({ code: "CONFLICT", message: DUPLICATE_BARCODE });
        throw e;
      }
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      return updated;
    }),

  // The catalogue from a spreadsheet. A row whose barcode is already in the
  // store updates that product; any other row is a new product. A row with no
  // price yet is saved hidden at 0, so nothing goes on sale unpriced. Each row
  // stands alone: one bad row is reported and the rest are still saved.
  importProducts: staffProcedure
    .input(z.object({ rows: z.array(importRowInput).min(1).max(2000) }))
    .mutation(async ({ input, ctx }) => {
      let created = 0;
      let updated = 0;
      const failed: { index: number; name: string; error: string }[] = [];

      for (let index = 0; index < input.rows.length; index++) {
        const row = input.rows[index];
        const nameEn = row.nameEn || row.nameKu || row.nameAr;
        if (!nameEn) {
          failed.push({ index, name: "", error: "A product name is required" });
          continue;
        }
        const barcode = cleanBarcode(row.barcode) ?? null;
        const unpriced = row.price == null;
        const values = {
          nameEn,
          nameKu: row.nameKu || null,
          nameAr: row.nameAr || null,
          descriptionEn: row.descriptionEn || null,
          descriptionKu: row.descriptionKu || null,
          descriptionAr: row.descriptionAr || null,
          category: row.category || null,
          barcode,
          sku: row.sku || null,
          size: row.size || null,
          variantGroup: row.variantGroup || null,
          price: (row.price ?? 0).toFixed(2),
          compareAtPrice: row.compareAtPrice != null ? row.compareAtPrice.toFixed(2) : null,
          currency: row.currency || "USD",
          stock: row.stock ?? null,
          status: unpriced ? ("hidden" as const) : (row.status ?? "active"),
          ...(row.coverImageUrl ? { coverImageUrl: row.coverImageUrl } : {}),
          ...(row.images && row.images.length ? { images: row.images } : {}),
          ...(row.isFeatured != null ? { isFeatured: row.isFeatured } : {}),
          ...(row.sortOrder != null ? { sortOrder: row.sortOrder } : {}),
        };
        try {
          const existing = barcode ? await db.getStoreProductByBarcode(barcode) : null;
          if (existing) {
            await db.updateStoreProduct(existing.id, values);
            updated++;
          } else {
            await db.createStoreProduct({ ...values, createdById: ctx.user.id });
            created++;
          }
        } catch (e) {
          const message = isDuplicateBarcode(e) ? DUPLICATE_BARCODE : e instanceof Error ? e.message : String(e);
          appLogger.error("[store.importProducts] row failed", { index, barcode, error: message });
          failed.push({ index, name: nameEn, error: message });
        }
      }
      return { created, updated, failed };
    }),

  deleteProduct: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const ok = await db.deleteStoreProduct(input.id);
      return { success: ok };
    }),

  // Image upload — base64 in, hosted URL out (same S3/local fallback as blog).
  uploadImage: staffProcedure
    .input(z.object({ fileName: z.string(), contentType: z.string(), base64Data: z.string() }))
    .mutation(async ({ input }) => {
      // A product picture is a picture (shared/uploadRule).
      const { buffer, ext } = acceptUpload({
        fileName: input.fileName,
        contentType: input.contentType,
        base64: input.base64Data,
        purpose: "image",
      });
      const { ENV } = await import("../_core/env");
      const hasForge = Boolean(ENV.forgeApiUrl?.trim() && ENV.forgeApiKey?.trim());
      if (hasForge) {
        try {
          const { storagePut } = await import("../services/storage.service");
          const { nanoid } = await import("nanoid");
          const { url } = await storagePut(`store-products/${nanoid(12)}.${ext}`, buffer, input.contentType);
          return { success: true, url };
        } catch (err) {
          return { success: false, url: null, error: err instanceof Error ? err.message : String(err) };
        }
      }
      try {
        const { localUpload } = await import("../services/localUpload");
        const { url } = localUpload(`image.${ext}`, buffer, input.contentType);
        return { success: true, url };
      } catch (err) {
        return { success: false, url: null, error: err instanceof Error ? err.message : String(err) };
      }
    }),

  // ---- Staff: order management --------------------------------------------
  listOrders: staffProcedure.query(async () => {
    return db.getAllStoreOrders();
  }),

  updateOrderStatus: staffProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["new", "confirmed", "preparing", "shipped", "delivered", "cancelled"]),
    }))
    .mutation(async ({ input }) => {
      const updated = await db.updateStoreOrderStatus(input.id, input.status);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      return updated;
    }),
});
