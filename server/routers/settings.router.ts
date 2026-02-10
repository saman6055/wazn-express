import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { staffProcedure, adminProcedure, accountantProcedure } from "../middleware/auth";
import * as db from "../db";
import { phoneSchema, emailSchema, idSchema, amountSchema, packageCodeSchema, batchCodeSchema } from "./schemas";

export const countriesRouter = router({
    list: staffProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        return db.getAllCountries(input?.activeOnly);
      }),
    getOrigins: staffProcedure.query(async () => {
      return db.getOriginCountries();
    }),
    getDestinations: staffProcedure.query(async () => {
      return db.getDestinationCountries();
    }),
    create: adminProcedure
      .input(z.object({
        nameEn: z.string().min(1),
        nameAr: z.string().optional(),
        nameKu: z.string().optional(),
        nameZh: z.string().optional(),
        nameTr: z.string().optional(),
        nameFa: z.string().optional(),
        isoCode: z.string().length(2).or(z.string().length(3)),
        defaultCurrency: z.string().optional(),
        isOrigin: z.boolean().optional(),
        isDestination: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const country = await db.createCountry(input);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_country",
          entityType: "country",
          entityId: country.id,
          newValues: input,
        });
        return country;
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        nameEn: z.string().optional(),
        nameAr: z.string().optional(),
        nameKu: z.string().optional(),
        nameZh: z.string().optional(),
        nameTr: z.string().optional(),
        nameFa: z.string().optional(),
        defaultCurrency: z.string().optional(),
        isActive: z.boolean().optional(),
        isOrigin: z.boolean().optional(),
        isDestination: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateCountry(id, data);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_country",
          entityType: "country",
          entityId: id,
          newValues: data,
        });
        return { success: true };
      }),
});

export const warehousesRouter = router({
    list: staffProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        return db.getAllWarehouses(input?.activeOnly);
      }),
    getByCountry: staffProcedure
      .input(z.object({ countryId: z.number() }))
      .query(async ({ input }) => {
        return db.getWarehousesByCountry(input.countryId);
      }),
    getById: staffProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getWarehouseById(input.id);
      }),
    create: adminProcedure
      .input(z.object({
        nameEn: z.string().min(1),
        nameAr: z.string().optional(),
        nameKu: z.string().optional(),
        nameZh: z.string().optional(),
        nameTr: z.string().optional(),
        nameFa: z.string().optional(),
        countryId: z.number(),
        city: z.string().min(1),
        addressEn: z.string().optional(),
        addressAr: z.string().optional(),
        addressKu: z.string().optional(),
        warehouseType: z.enum(["air", "sea", "custom"]),
        codePrefix: z.string().min(1).max(10),
        expectedDeliveryMin: z.number().optional(),
        expectedDeliveryMax: z.number().optional(),
        pricingModel: z.enum(["per_kg", "per_cbm"]),
        contactInfo: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const warehouse = await db.createWarehouse(input);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_warehouse",
          entityType: "warehouse",
          entityId: warehouse.id,
          newValues: input,
        });
        return warehouse;
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        nameEn: z.string().optional(),
        nameAr: z.string().optional(),
        nameKu: z.string().optional(),
        nameZh: z.string().optional(),
        nameTr: z.string().optional(),
        nameFa: z.string().optional(),
        city: z.string().optional(),
        addressEn: z.string().optional(),
        addressAr: z.string().optional(),
        addressKu: z.string().optional(),
        warehouseType: z.enum(["air", "sea", "custom"]).optional(),
        expectedDeliveryMin: z.number().optional(),
        expectedDeliveryMax: z.number().optional(),
        pricingModel: z.enum(["per_kg", "per_cbm"]).optional(),
        contactInfo: z.string().optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateWarehouse(id, data);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_warehouse",
          entityType: "warehouse",
          entityId: id,
          newValues: data,
        });
        return { success: true };
      }),
});

export const pricingRouter = router({
    list: staffProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        return db.getAllPricingRules(input?.activeOnly);
      }),
    getApplicable: staffProcedure
      .input(z.object({
        originCountryId: z.number(),
        destinationCountryId: z.number(),
        shippingType: z.enum(["air_regular", "air_irregular", "sea"]),
      }))
      .query(async ({ input }) => {
        return db.getApplicablePricingRule(
          input.originCountryId,
          input.destinationCountryId,
          input.shippingType
        );
      }),
    create: adminProcedure
      .input(z.object({
        originCountryId: z.number(),
        originWarehouseId: z.number().optional(),
        destinationCountryId: z.number(),
        shippingType: z.enum(["air_regular", "air_irregular", "sea"]),
        pricePerUnit: z.string(),
        unit: z.enum(["kg", "cbm"]),
        effectiveFrom: z.date(),
        effectiveTo: z.date().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const rule = await db.createPricingRule({
          ...input,
          createdById: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_pricing_rule",
          entityType: "pricing_rule",
          entityId: rule.id,
          newValues: input,
        });
        return rule;
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        pricePerUnit: z.string().optional(),
        effectiveTo: z.date().optional(),
        isActive: z.boolean().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updatePricingRule(id, data);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_pricing_rule",
          entityType: "pricing_rule",
          entityId: id,
          newValues: data,
        });
        return { success: true };
      }),
});

export const settingsRouter = router({
    get: adminProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        return db.getSetting(input.key);
      }),
    set: adminProcedure
      .input(z.object({
        key: z.string(),
        value: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.setSetting(input.key, input.value, ctx.user.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_setting",
          entityType: "setting",
          newValues: input,
        });
        return { success: true };
      }),
    list: adminProcedure.query(async () => {
      return db.getAllSettings();
    }),
});

export const productCategoriesRouter = router({
    list: staffProcedure.query(async () => {
      return db.getAllProductCategories();
    }),
    listActive: publicProcedure.query(async () => {
      return db.getActiveProductCategories();
    }),
    getById: staffProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getProductCategoryById(input.id);
      }),
    create: adminProcedure
      .input(z.object({
        nameEn: z.string().min(1),
        nameAr: z.string().optional(),
        nameKu: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const category = await db.createProductCategory({
          ...input,
          createdById: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_product_category",
          entityType: "productCategory",
          entityId: category.id,
          newValues: input,
        });
        return category;
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        nameEn: z.string().optional(),
        nameAr: z.string().optional(),
        nameKu: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateProductCategory(id, data);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_product_category",
          entityType: "productCategory",
          entityId: id,
          newValues: data,
        });
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteProductCategory(input.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_product_category",
          entityType: "productCategory",
          entityId: input.id,
        });
        return { success: true };
      }),
    // Seed default categories
    seedDefaults: adminProcedure.mutation(async ({ ctx }) => {
      const defaults = [
        { nameEn: "Clothing", nameAr: "ملابس", nameKu: "جل و بەرگ", icon: "👔", color: "#3B82F6", sortOrder: 1 },
        { nameEn: "Shoes", nameAr: "أحذية", nameKu: "پێڵاو", icon: "👟", color: "#8B5CF6", sortOrder: 2 },
        { nameEn: "Bags", nameAr: "حقائب", nameKu: "جانتا", icon: "👜", color: "#EC4899", sortOrder: 3 },
        { nameEn: "Electronics", nameAr: "إلكترونيات", nameKu: "ئەلیکترۆنیات", icon: "📱", color: "#10B981", sortOrder: 4 },
        { nameEn: "Medical", nameAr: "طبي", nameKu: "پزیشکی", icon: "💊", color: "#EF4444", sortOrder: 5 },
        { nameEn: "Cosmetics", nameAr: "مستحضرات تجميل", nameKu: "کۆسمەتیک", icon: "💄", color: "#F472B6", sortOrder: 6 },
        { nameEn: "Home Items", nameAr: "أدوات منزلية", nameKu: "کەلوپەلی ماڵ", icon: "🏠", color: "#F59E0B", sortOrder: 7 },
        { nameEn: "Games", nameAr: "ألعاب", nameKu: "یاری", icon: "🎮", color: "#6366F1", sortOrder: 8 },
        { nameEn: "Books", nameAr: "كتب", nameKu: "کتێب", icon: "📚", color: "#84CC16", sortOrder: 9 },
        { nameEn: "Tools", nameAr: "أدوات", nameKu: "ئامراز", icon: "🔧", color: "#64748B", sortOrder: 10 },
        { nameEn: "Food", nameAr: "طعام", nameKu: "خواردن", icon: "🍔", color: "#F97316", sortOrder: 11 },
        { nameEn: "Other", nameAr: "أخرى", nameKu: "هیتر", icon: "📦", color: "#94A3B8", sortOrder: 12 },
      ];
      for (const cat of defaults) {
        await db.createProductCategory({ ...cat, createdById: ctx.user.id });
      }
      return { success: true, count: defaults.length };
    }),
});

export const advancedSettingsRouter = router({
    // ===== SYSTEM SETTINGS =====
    getAllSettings: adminProcedure.query(async () => {
      return await db.getAllSystemSettings();
    }),

    getSetting: adminProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        return await db.getSystemSetting(input.key);
      }),

    setSetting: adminProcedure
      .input(
        z.object({
          key: z.string(),
          value: z.string(),
          type: z.string().optional(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await db.setSystemSetting({
          ...input,
          updatedById: ctx.user.id,
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_setting",
          entityType: "system_setting",
          entityId: result?.id,
        });

        return result;
      }),

    // ===== CURRENCY MANAGEMENT =====
    getAllCurrencies: staffProcedure.query(async () => {
      return await db.getAllCurrencies();
    }),

    getActiveCurrencies: staffProcedure.query(async () => {
      return await db.getActiveCurrencies();
    }),

    createCurrency: adminProcedure
      .input(
        z.object({
          code: z.string().min(2).max(10),
          name: z.string().min(1).max(100),
          symbol: z.string().min(1).max(10),
          exchangeRate: z.string(),
          isBaseCurrency: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const [result] = await db.createCurrency({
          ...input,
          createdById: ctx.user.id,
          createdByName: ctx.user.name || ctx.user.email || undefined,
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_currency",
          entityType: "currency",
          entityId: result?.id,
        });

        return result;
      }),

    updateCurrency: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          symbol: z.string().optional(),
          exchangeRate: z.string().optional(),
          isBaseCurrency: z.boolean().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const [result] = await db.updateCurrency(id, data);

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_currency",
          entityType: "currency",
          entityId: id,
        });

        return result;
      }),

    deleteCurrency: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteCurrency(input.id);

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_currency",
          entityType: "currency",
          entityId: input.id,
        });

        return { success: true };
      }),

    // ===== TAX RATE MANAGEMENT =====
    getAllTaxRates: staffProcedure.query(async () => {
      return await db.getAllTaxRates();
    }),

    getActiveTaxRates: staffProcedure.query(async () => {
      return await db.getActiveTaxRates();
    }),

    createTaxRate: adminProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          rate: z.string(),
          isDefault: z.boolean().optional(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const [result] = await db.createTaxRate({
          ...input,
          createdById: ctx.user.id,
          createdByName: ctx.user.name || ctx.user.email || undefined,
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_tax_rate",
          entityType: "tax_rate",
          entityId: result?.id,
        });

        return result;
      }),

    updateTaxRate: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          rate: z.string().optional(),
          isDefault: z.boolean().optional(),
          isActive: z.boolean().optional(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const [result] = await db.updateTaxRate(id, data);

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_tax_rate",
          entityType: "tax_rate",
          entityId: id,
        });

        return result;
      }),

    deleteTaxRate: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteTaxRate(input.id);

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_tax_rate",
          entityType: "tax_rate",
          entityId: input.id,
        });

        return { success: true };
      }),

    // ===== EMAIL TEMPLATE MANAGEMENT =====
    getAllEmailTemplates: adminProcedure.query(async () => {
      return await db.getAllEmailTemplates();
    }),

    getEmailTemplateByName: adminProcedure
      .input(z.object({ name: z.string() }))
      .query(async ({ input }) => {
        return await db.getEmailTemplateByName(input.name);
      }),

    createEmailTemplate: adminProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          subject: z.string().min(1).max(255),
          body: z.string(),
          variables: z.string().optional(),
          category: z.enum(["notification", "invoice", "report", "alert"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const [result] = await db.createEmailTemplate({
          ...input,
          createdById: ctx.user.id,
          createdByName: ctx.user.name || ctx.user.email || undefined,
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_email_template",
          entityType: "email_template",
          entityId: result?.id,
        });

        return result;
      }),

    updateEmailTemplate: adminProcedure
      .input(
        z.object({
          id: z.number(),
          subject: z.string().optional(),
          body: z.string().optional(),
          variables: z.string().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const [result] = await db.updateEmailTemplate(id, data);

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_email_template",
          entityType: "email_template",
          entityId: id,
        });

        return result;
      }),

    deleteEmailTemplate: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteEmailTemplate(input.id);

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_email_template",
          entityType: "email_template",
          entityId: input.id,
        });

        return { success: true };
      }),

    // ===== IP WHITELIST MANAGEMENT =====
    getAllIpWhitelist: adminProcedure.query(async () => {
      return await db.getAllIpWhitelist();
    }),

    getActiveIpWhitelist: adminProcedure.query(async () => {
      return await db.getActiveIpWhitelist();
    }),

    isIpWhitelisted: protectedProcedure
      .input(z.object({ ip: z.string() }))
      .query(async ({ input }) => {
        return await db.isIpWhitelisted(input.ip);
      }),

    addIpToWhitelist: adminProcedure
      .input(
        z.object({
          ipAddress: z.string().min(7).max(45),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const [result] = await db.addIpToWhitelist({
          ...input,
          createdById: ctx.user.id,
          createdByName: ctx.user.name || ctx.user.email || undefined,
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "add_ip_whitelist",
          entityType: "ip_whitelist",
          entityId: result?.id,
        });

        return result;
      }),

    removeIpFromWhitelist: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.removeIpFromWhitelist(input.id);

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "remove_ip_whitelist",
          entityType: "ip_whitelist",
          entityId: input.id,
        });

        return { success: true };
      }),
});

export const settingsRouters = {
  countries: countriesRouter,
  warehouses: warehousesRouter,
  pricing: pricingRouter,
  settings: settingsRouter,
  productCategories: productCategoriesRouter,
  advancedSettings: advancedSettingsRouter,
};
