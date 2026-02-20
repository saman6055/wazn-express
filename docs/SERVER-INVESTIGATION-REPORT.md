# ڕاپۆرتی پشکنینی سێرڤەر (Hostinger VPS) — Wazn Express

## کورتە (Summary)

بە SSH چووینە ناو سێرڤەر و سێرڤەر و ئەپ و داتابەیس و لاگەکانمان پشکناند. **هۆکاری سەرەکی هەڵەکانی 500** بریتیین لە **نەبوونی تابلۆی `batchLabelTemplates`** و **کەمبوونەوەی ستوونەکانی `productCategories`** (وەک `sortOrder`) لە داتابەیسەکەی سێرڤەر.

---

## ١. دۆخی سێرڤەر

| بابەت | دۆخ |
|------|-----|
| **ئۆپەراسیۆن سیستەم** | Ubuntu 24.04.3 LTS |
| **Uptime** | ~5 کاتژمێر |
| **Disk** | 48G، 33G بەردەست، 33% بەکارهاتوو |
| **Memory** | 3.8G، ~2.3G بەکار، ~1.5G بەردەست |
| **Docker** | کاردەکات؛ Coolify + Traefik + ئەپ + MySQL + Postgres + Redis |

### پۆرتە ئێستاکان

- **22** — SSH
- **80 / 443** — Traefik (Coolify proxy)
- **8000** — Coolify panel
- **6001, 6002** — Coolify realtime
- **8080** — Traefik dashboard
- **3000** — ئەپی Wazn Express (ناو کۆنتێنەر، پێویستە لە ڕێگەی Traefik بگات پێی)

### کۆنتێنەرەکان

- **x08kggs8c4o8s0owgc80ssoo-215817095976** — ئەپی Wazn Express (healthy)
- **zss4ckkk0080444w0kwcwcsc** — MySQL 8 (داتابەیسەکەی ئەپ)
- **coolify-proxy** (Traefik)، **coolify**، **coolify-db** (Postgres)، **coolify-redis**، **coolify-sentinel**، **coolify-realtime**

---

## ٢. هەڵەکانی لاگی ئەپ

لە لاگی کۆنتێنەری ئەپ (`docker logs`) ئەم هەڵانە دەردەکەون:

### هەڵە/ئاگاداری گشتی

- **`OAUTH_SERVER_URL is not set`** — OAuth/Forge login ناچالاکە.
- **`Notification service URL is not configured`** — [Tracking Alerts] هەڵە لە check/notify.

### API‑ەکانی status 500

| API | وەسف |
|-----|------|
| `productCategories.list` | زۆر جار 500 |
| `packages.register` | زۆر جار 500 |
| `extraServices.list` | 500 |
| `extraServices.createServiceType` | 500 |
| `batchLabelTemplates.list` | 500 |

هەموویان لە کۆدی سێرڤەر (tRPC) دەشکێن و وەک 500 دەگەڕێنەوە.

---

## ٣. هۆکاری دۆزینەوە (Root causes)

### ٣.١ تابلۆی `batchLabelTemplates` نییە

- لە داتابەیسەکەی سێرڤەر (**default**) فەرمانی `DESCRIBE batchLabelTemplates` ئەم هەڵەیە دەدات:
  - **`Table 'default.batchLabelTemplates' doesn't exist`**
- کۆد `getAllBatchLabelTemplates()` لە `services.db.ts` `SELECT` لەم تابلۆە دەکات، بۆیە MySQL هەڵە دەگەڕێنێت و ئەپ 500 دەنێرێت.

### ٣.٢ تابلۆی `productCategories` — ستوونەکانی کەم

- لە سێرڤەردا `DESCRIBE productCategories` ئەم ستوونانە دەردەخات:
  - `id`, `nameEn`, `nameAr`, `nameKu`, `nameZh`, `description`, `isActive`, `createdAt`, `updatedAt`
- کۆدی ئەپ (Drizzle schema) چاوەڕوانی ئەم ستوونانە دەکات:
  - `sortOrder`, `icon`, `color`, `createdById` (هەروەها لە `getAllProductCategories()` دا `.orderBy(productCategories.sortOrder)` بەکاردەهێنرێت).
- چونکە **`sortOrder` لە سێرڤەردا نییە**، فەرمانی `ORDER BY sortOrder` هەڵە دەدات و **productCategories.list** دەگاتە 500.

### ٣.٣ ئەگەری تر

- **packages.register** و **extraServices** دەتوانن بەهۆی هەمان جۆر کەمبوونەوەی schema یان پەیوەندی داتابەیسەوە بەشێک لە 500‑ەکان دروست بکەن (دەتوانیت دوای چاککردنی productCategories و batchLabelTemplates دووبارە لاگەکان بپشکنیت).

---

## ٤. چاککردنەوە (Fixes)

### ٤.١ دروستکردنی تابلۆی `batchLabelTemplates`

فایلی **`docs/fix-server-database.sql`** دروست کراوە؛ دەتوانیت لە سێرڤەردا (یان لە ڕێگەی Coolify/MySQL client) ئەم SQL‑انە جێبەجێ بکەیت. یەکەم بەش تابلۆی `batchLabelTemplates` دروست دەکات بە هەمان شێوازی کۆدی ئەپ.

### ٤.٢ زیادکردنی ستوونەکانی `productCategories`

هەمان فایل `ALTER TABLE productCategories` لەخۆدەگرێت بۆ زیادکردنی:
- `icon`, `color`, `sortOrder`, `createdById`

دوای جێبەجێکردنی ئەم SQL‑انە، ئەم ئەندپۆینتانە دەبێت باشتر کار بکەن:
- `productCategories.list`
- `batchLabelTemplates.list`

و دەتوانیت دووبارە `packages.register` و `extraServices` تاقی بکەیتەوە.

### ٤.٣ ڕێکخستنە ئیستەکانی تر (ئارەزوومەندانە)

- **OAUTH_SERVER_URL** — ئەگەر OAuth/Forge login دەتەوێت، لە Coolify (Environment) زیادەکە.
- **Notification service URL** — بۆ Tracking Alerts لە ڕێکخستنەکانی ئەپ زیادەکە.

---

## ٥. ژێدەرەکانی تەکنیکی

| شوێن | ڕۆڵ |
|------|-----|
| `server/db/connection.ts` | پەیوەندی MySQL (DATABASE_URL) |
| `server/db/services.db.ts` | `getAllProductCategories`, `getAllBatchLabelTemplates`, extraServices, labelTemplates |
| `drizzle/schema/services.schema.ts` | سکێمای productCategories، batchLabelTemplates |
| `server/_core/migrations.ts` | SQL‑ی migration بۆ productCategories، batchLabelTemplates |

---

## ٦. فەرمانەکانی پشکنین (لە سێرڤەردا)

```bash
# چوونە ناو سێرڤەر
ssh hostinger

# لیستی کۆنتێنەرەکان
docker ps -a

# لاگی ئەپ (دوایین 100 ڕیز)
docker logs --tail 100 x08kggs8c4o8s0owgc80ssoo-215817095976

# تابلۆکانی داتابەیس
docker exec zss4ckkk0080444w0kwcwcsc mysql -umysql -p'PASSWORD' default -e "SHOW TABLES"
```

ئەم ڕاپۆرتە و فایلی `fix-server-database.sql` لە پرۆژەکەدا نووسراون؛ دوای جێبەجێکردنی SQL‑ەکە دووبارە دیپلۆی/تاقیکردنەوە ڕاسپاردە.

---

## جێبەجێکراو (Applied)

- **SQL لە سێرڤەر:** فایلی `fix-server-database.sql` لە سێرڤەر جێبەجێ کراوە (CREATE TABLE batchLabelTemplates + ALTER TABLE productCategories).
- **کۆد بەقەوەت (resilient):** لە `server/db/services.db.ts` — `getAllProductCategories` / `getActiveProductCategories` fallback بە raw SELECT ئەگەر ستوونی sortOrder نەبێت؛ `getBatchLabelTemplates` / `getBatchLabelTemplateById` / `getDefaultBatchLabelTemplate` لە هەڵەدا [] یان null دەگەڕێننەوە.
