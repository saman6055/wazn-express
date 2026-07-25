import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { staffProcedure } from "../middleware/auth";
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
  status: z.enum(["active", "hidden", "out_of_stock"]).optional(),
  stock: z.number().int().optional().nullable(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

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
      return db.createStoreProduct({
        ...input,
        nameEn,
        price: input.price.toFixed(2),
        compareAtPrice: input.compareAtPrice != null ? input.compareAtPrice.toFixed(2) : null,
        createdById: ctx.user.id,
      });
    }),

  updateProduct: staffProcedure
    .input(productWriteInput.partial().extend({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { id, price, compareAtPrice, ...rest } = input;
      const updated = await db.updateStoreProduct(id, {
        ...rest,
        ...(price != null ? { price: price.toFixed(2) } : {}),
        ...(compareAtPrice !== undefined ? { compareAtPrice: compareAtPrice != null ? compareAtPrice.toFixed(2) : null } : {}),
      });
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      return updated;
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
      const buffer = Buffer.from(input.base64Data, "base64");
      const { ENV } = await import("../_core/env");
      const hasForge = Boolean(ENV.forgeApiUrl?.trim() && ENV.forgeApiKey?.trim());
      if (hasForge) {
        try {
          const { storagePut } = await import("../services/storage.service");
          const { nanoid } = await import("nanoid");
          const ext = input.fileName.split(".").pop() || "jpg";
          const { url } = await storagePut(`store-products/${nanoid(12)}.${ext}`, buffer, input.contentType);
          return { success: true, url };
        } catch (err) {
          return { success: false, url: null, error: err instanceof Error ? err.message : String(err) };
        }
      }
      try {
        const { localUpload } = await import("../services/localUpload");
        const { url } = localUpload(input.fileName, buffer, input.contentType);
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
