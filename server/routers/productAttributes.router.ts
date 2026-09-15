import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { staffProcedure, adminProcedure } from "../middleware/auth";
import {
  getAllProductAttributes,
  getProductAttributesByType,
  createProductAttribute,
  updateProductAttribute,
  deleteProductAttribute,
} from "../db/productAttributes.db";

const attributeTypeSchema = z.enum(["color", "size", "productType", "platform"]);

export const productAttributesRouter = router({
  // List all attributes (optionally filtered by type)
  list: protectedProcedure
    .input(z.object({ type: attributeTypeSchema.optional() }).optional())
    .query(async ({ input }) => {
      if (input?.type) {
        return getProductAttributesByType(input.type);
      }
      return getAllProductAttributes();
    }),

  /**
   * "Which of our product types is this a photo of?"
   *
   * The office's own list is read here rather than sent by the browser: a
   * caller cannot then widen the choices, and the answer is guaranteed to be
   * a row the dropdown actually holds.
   *
   * Answers `{ type: null }` for everything that is not a confident match —
   * an unclear photo, an unconfigured AI key, a slow model. The dropdown
   * next to it works by hand and always did; this only ever saves a
   * scroll.
   */
  suggestType: staffProcedure
    .input(z.object({
      /** The photo, as the form holds it (a data URI is fine). */
      imageUrl: z.string().min(1).max(12_000_000),
      /** The product name, when one has been typed — a second signal. */
      hint: z.string().max(300).optional(),
    }))
    .mutation(async ({ input }) => {
      const attributes = await getProductAttributesByType("productType");
      const options = attributes
        .filter((a) => a.isActive !== false)
        .map((a) => a.value);
      if (options.length === 0) return { type: null, confidence: 0 };

      const { classifyProductType } = await import("../services/productTypeVision");
      return classifyProductType(input.imageUrl, options, input.hint);
    }),

  // Create a new attribute
  create: adminProcedure
    .input(z.object({
      type: attributeTypeSchema,
      value: z.string().min(1).max(200),
      sortOrder: z.number().int().default(0),
    }))
    .mutation(async ({ input }) => {
      const result = await createProductAttribute({
        type: input.type,
        value: input.value,
        sortOrder: input.sortOrder,
        isActive: true,
      });
      if (!result) throw new Error("نەتوانرا دروست بکرێت");
      return result;
    }),

  // Update (value, sortOrder, isActive)
  update: adminProcedure
    .input(z.object({
      id: z.number().int(),
      value: z.string().min(1).max(200).optional(),
      sortOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateProductAttribute(id, data);
      return { success: true };
    }),

  // Delete
  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      await deleteProductAttribute(input.id);
      return { success: true };
    }),
});
