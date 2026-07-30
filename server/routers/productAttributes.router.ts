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
