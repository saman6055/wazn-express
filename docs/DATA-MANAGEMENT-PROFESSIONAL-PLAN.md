# پلانی پرۆفیشنال بۆ بەڕێوەبردنی داتا و هەڵگرتن

## ١. بارەی ئێستا (کورتە)

### ئەوەی هەیە
- **داشبۆرد:** ژمارەی تۆمارەکان، کریار، پاکەت، پاشەکەوت؛ Health Score؛ ڕاپۆرتی PDF.
- **پاشەکەوت و گەڕاندنەوە:** پاشەکەوتێکی تەواو (ZIP: database + فایلە S3)، پاشەکەوتێکی داتابەیس-تەنها (JSON)، پاشەکەوتێکی فایلەکان؛ گەڕاندنەوە لە پاشەکەوتی هەڵبژێردراو؛ پاشەکەوت لە سێرڤەر یان S3/Forge.
- **هاوردە / هەناردە:** هەناردەی هەموو داتا یان بە بەش (customers, packages, batches, …) بە JSON؛ هاوردەی JSON یان CSV بە بەش یان تەواو؛ قاڵبی CSV بۆ هەر بەشێک.
- **سڕینەوە و ڕیست:** سڕینەوەی بەشەکانی داتا (بە دووبارەکردنەوە)، سڕینەوەی داتای کۆن بە ڕۆژ؛ ڕیستی تەواو (پێش ئەوە پاشەکەوت دروست دەبێت).
- **Activity Log:** مێژووی سڕینەوە و ڕیست.
- **Backup scheduled:** پاشەکەوتی خۆکار (daily/weekly/monthly) و پاککردنەوەی کۆن.

### کەم و کۆرەکان
- **Validation لە هاوردە:** نەزانینی پێش هاوردە ئایا داتاکە دروست و گونجاوە (schema، FK، duplicate).
- **Preview و Dry-run:** نەبوونی پێشبینینی «چی دەگۆڕێت» پێش پاشەکەوتکردن/هاوردە.
- **Versioning:** پاشەکەوتەکان بە «ناونیشان/version» نین؛ ئاستی point-in-time ڕوون نییە.
- **Merge strategies:** هاوردە تەنها overwrite یان append هەیە؛ merge بە ستراتیژی ڕوون نییە.
- **Performance:** بۆ داتای زۆر، هەناردە/هاوردە ڕاستەوخۆ لە memor؛ streaming و chunking و progress نەگونجێنراوە.
- **Integrity:** دوای گەڕاندنەوە تاقیکردنەوەی ئۆتۆماتیکی integrity (checksum، ژمارەی تۆمار) لە UI نەماوە.
- **Storage tier:** ڕێکخستنی ڕوونی «local vs cloud» و سیاسەتی مانگەڕان (retention) لە UI کەمە.
- **Schema awareness:** وەرگەڕانی schema (نوێکردنەوەی DB) لە فۆرماتی پاشەکەوت و ڕێگری لە restore لە backup کۆن نەماوە.
- **ڕێکی داتا (وینە):** پشکنینی ئەوەی ئایا داتا لەگەڵ یەکتر ڕێکە (وەک پاکەت بەرەو کریاری نەبوو، فاکتۆر بەرەو پاکەتی نەبوو) نەماوە؛ نە دۆزینەوەی وینە نە چاککردنەوە.

---

## ٢. ئامانجی پرۆفیشنال

- داتا بە **نویترین و باشترین ڕێکخستن** هەڵبگیرێت: پاشەکەوتێکی ڕێکوپێک، validation، integrity، و storage ڕوون.
- **ئاسایش و متمانە:** validation پێش هاوردە، checksum/verification دوای پاشەکەوت و گەڕاندنەوە.
- **Performance:** بۆ داتای گەورە streaming، chunking، و progress لە UI.
- **ڕوونی بەڕێوەبردن:** versioning، retention، و merge strategies ڕوون و لە UI بەردەست بن.

---

## ٣. پلانی تەکنیکی (چەند قۆناغ)

### قۆناغ ١: Validation و Import Preview (پێشینە)

| کار | وەسف |
|-----|------|
| **Schema validation** | پێش هاوردە: پشکنینی ستونە پێویستەکان، جۆرەکان (number, date, enum)، و درێژی خانە. ئەگەر هەڵە هەبێت، لیستی هەڵەکان بڵاو بکەرێتەوە و هاوردە ڕاوەستێت. |
| **FK / reference check** | پشکنینی ID‑ی پەیوەندیدار (customerId, batchId, …) ئەگەر لە داتاکەدا یان لە DB هەبێت. |
| **Import preview (dry-run)** | API/ئەندامی نوێ: `importPreview({ data, overwrite })` → ئەنجام: `{ toInsert, toUpdate, toSkip, errors }` بە بەش. لە UI پێش «پاشەکەوتکردن» پێشبینین نیشان بدە. |
| **Duplicate policy** | لە هاوردە: دەتوانرێت «skip duplicates»، «overwrite»، یان «merge (update if exists)» هەڵبژێردرێت بە ستراتیژی ڕوون. |

**جێبەجێکردن:**  
- Backend: فەنکشنی `validateImportData(category, data)` و `importPreview(data, options)`.  
- Client: لە «هاوردە» دوای هەڵبژاردنی فایل، دوگمەی «پێشبینین» و پانێڵی پێشبینین (ژمارەی add/update/skip و هەڵەکان).

---

### قۆناغ ٢: Backup و Storage بە شێوەی پرۆفیشنال

| کار | وەسف |
|-----|------|
| **Backup version/label** | لە تابلۆی `backups`: خانەی `versionLabel` (وەک "v1.0-pre-migration") و `schemaVersion` (ژمارەی schema یان hash). لە دروستکردنی backup ئەمانە تۆمار بکرێن. |
| **Integrity بعد از backup/restore** | دوای دروستکردنی backup: hash (SHA-256) یان checksum تۆمار بکرێت. دوای restore: ژمارەی تۆمار و ئەگەر ممکن بوو hash بپشکنە؛ ئەنجام لە UI و audit log بڵاو بکەرەوە. |
| **Retention policy ڕوون** | لە ڕێکخستنەکان: «ژمارەی پاشەکەوتەکان بەدەست هەڵبگرە» یان «پاشەکەوتەکان لە دوای X ڕۆژ بسڕەوە». پاککردنەوەی خۆکار (وەک ئێستا) بەم سیاسەتەوە بێت. |
| **Storage tier (local + cloud)** | ئەوەی هەیە بەردەستە (local + S3/Forge). لە UI نیشان بدە پاشەکەوت لە کوێ storedە (local / cloud) و ئەگەر دەتوانرێت دانەوە بکرێتەوە بۆ cloud. |
| **Restore compatibility** | کاتێک backup دروست دەکرێت، `schemaVersion` یان `backupFormatVersion` تۆمار بکرێت. کاتێک restore دەکرێت، پشکنین: ئایا ئەم backup‑ە لەگەڵ schema ی ئێستا compatible‑ە؛ ئەگەر نا، هۆشدار و ئەگەر پێویست بوو migration یان «legacy restore» پیشنهاد بکرێت. |

**جێبەجێکردن:**  
- Migration: زیادکردنی `versionLabel`, `schemaVersion`, `contentHash` بۆ `backups`.  
- Backend: لە `createZipBackup` / `createBackup` ئەم خانانە پڕ بکەن؛ لە `restoreBackup` پشکنینی compatibility و integrity.  
- UI: لە لیستی پاشەکەوت نیشاندانی version/label و شوێنی storage؛ لە ڕێکخستن retention و ئەگەر هەبێت storage tier.

---

### قۆناغ ٣: Performance و UX

| کار | وەسف |
|-----|------|
| **Streaming export** | بۆ «هەناردەی هەموو»: لە سێرڤەر داتا بە chunk (وەک ١٠٠٠ ڕیز) بگەڕێنرێتەوە یان فایل دروست بکرێت و لینکی download بدە؛ نەک هەموو JSON لە memor. |
| **Chunked import** | هاوردەی گەورە بە پارچە (chunk) بێت؛ هەر پارچەیەک validation + insert؛ progress (ژمارەی تۆمار یان %) لە UI نیشان بدە. |
| **Progress در UI** | هەناردە و هاوردە و دروستکردنی backup: progress bar یان «X / Y تۆمار» لە پەڕەی بەڕێوەبردنی داتا. |
| **Background jobs (ئارەزوومەندانە)** | بۆ backup/export/import گەورە: job لە queue (وەک Bull یان سادە) و status لە UI؛ نەک blocking. |

**جێبەجێکردن:**  
- Backend: `exportAllDataStream()` یان export بۆ فایل + endpoint دانان؛ `importChunked(category, chunks, options)` و progress callback یان WebSocket/SSE.  
- Client: بەکارهێنانی progress state و نیشاندانی progress bar و ئەنجامی کۆتایی.

---

### قۆناغ ٤: Merge strategies و Import options

| کار | وەسف |
|-----|------|
| **Overwrite / Skip / Merge** | لە هاوردە: هەڵبژاردنی «Overwrite existing»، «Skip duplicates»، «Merge (update if key exists)». پێناسەی key بۆ هەر بەش (وەک id یان code). |
| **Conflict handling** | ئەگەر merge هەڵبژێردرا و دوو ڕیز conflict‑ی هەبێت: «پێشکەشکراو» wins یان «کۆن» wins یان «بەکارهێنەر دەستکاری بکات» (لە قۆناغە دواترەکان). |
| **Selective restore** | لە گەڕاندنەوە: ئەگەر پێویست بوو، هەڵبژاردنی تابلۆ/بەشەکان بۆ restore (تەنها ئەو بەشانە)، نەک هەموو backup‑ەکە. |

**جێبەجێکردن:**  
- Backend: گۆڕینی `importCategoryData` / `importAllData` بۆ وەرگرتنی `strategy: 'overwrite' | 'skip_duplicates' | 'merge'` و key fields.  
- UI: لە دیالۆگی هاوردە هەڵبژاردنی strategy و ئەگەر هەبێت selective restore.

---

### قۆناغ ٥: Audit و ڕاپۆرت

| کار | وەسف |
|-----|------|
| **Audit برای import/export/backup/restore** | هەر export، import، backup، restore تۆمار بکرێت لە audit log (کێ، کەی، چی، ئەنجام). |
| **Data Management report** | ڕاپۆرتێکی کاتەوە (وەک PDF) کە ژمارەی پاشەکەوت، دوایین پاشەکەوت، حجم، و ئەگەر هەبێت integrity status و هەڵەکان لە خۆ بگرێت. |

ئەوەی ئێستا هەیە (Health Score، PDF، deletion log) بەردەستە؛ زیادکردنی «integrity status» و «last restore» لە ڕاپۆرت باشە.

---

### قۆناغ ٦: پشکنینی ڕێکی داتا و چاککردنی «وینە» (Data Consistency)

کاتێک داتا **وینە** دەبێت (inconsistent) — وەک پاکەتێک کە پەیوەندی بە کریار یان باچێکەوە هەیە کە چیتر نییە — سیستەم دەبێت بتوانێت **بدۆزێتەوە** و ئارەزوومەندانە **چاکی بکاتەوە**.

| جۆری وینە | وەسف | نمونە |
|------------|------|--------|
| **پاکەت بەرەو کریاری نەبوو** | `packages.customerId` ئاماژە بە `customers.id` دەکات کە سڕدراوەتەوە | پاکەت وینە دەبێت؛ دەتوانرێت `customerId = null` و `isUnclaimed = true` بکرێت |
| **پاکەت بەرەو باچی نەبوو** | `packages.batchId` ئاماژە بە باچێک دەکات کە نییە | پاکەت «بێ باچ» دەبێت؛ دەتوانرێت `batchId = null` یان ڕاپۆرت بکرێت |
| **پاکەت بەرەو ئۆردەری فول پاکێجی نەبوو** | `packages.fullPackageOrderId` ئاماژە بە ئۆردەرێک دەکات کە سڕدراوە | دەتوانرێت لینکەکە بسڕێتەوە (`fullPackageOrderId = null`) |
| **فاکتۆر بەرەو پاکەتی نەبوو** | `invoices.packageId` یان پەیوەندیدارێک ئاماژە بە پاکەتێک دەکات کە نییە | ڕاپۆرت یان چاککردنەوە (وەک packageId = null ئەگەر ڕێگە بدرێت) |
| **دووبارەی نەمبەر** | دوو پاکەت یان دوو کریار هەمان `trackingNumber` یان `customerCode` | ڕاپۆرت؛ چاککردن دەستی یان یەکلاکردنەوەی ئۆتۆماتیک |

**چی پێویستە بکرێت:**

| کار | وەسف |
|-----|------|
| **API پشکنین** | فەنکشنی `dataManagement.runConsistencyCheck()` کە هەموو پشکنینەکانی سەرەوە بکات و لیستێک لە «وینەکان» بگەڕێنێتەوە: `{ type, entity, id, description, suggestedFix }`. |
| **ڕاپۆرت لە UI** | لە بەشی بەڕێوەبردنی داتا تبێک یان کاردێک: «پشکنینی ڕێکی داتا»؛ دوگمەی «پشکنین» → ئەنجام: ژمارەی وینە بە جۆر، و لیست (پاکەتە وینەکان، فاکتۆرە وینەکان، …). |
| **چاککردنەوە (ئارەزوومەندانە)** | دوگمەی «چاککردنی پیشنهادکراو» یان «چاککردنی هەر یەک»: وەک «هەموو پاکەتە بێ کریارەکان بکە بە unclaimed» یان «لینکی fullPackageOrder بسڕەوە». پێش چاککردن پاشەکەوت و ڕازیکردنی بەکارهێنەر پێشنیار بکرێت. |
| **پشکنینی خۆکار (ئارەزوومەندانە)** | هەفتانە یان پێش هەر backupێک consistency check بکرێت؛ ئەگەر وینە هەبوو، هۆشدار بۆ ئەدمین (وەک لە Health Score). |

**نمونەی پاکەت وینە:**  
پاکەتێک `customerId = ٥٠٠` هەیە بەڵام کریاری ٥٠٠ سڕدراوەتەوە → سیستەم ئەم پاکەتە وەک «پاکەت وینە (بێ کریار)» دەناسێنێت و پیشنهاد دەکات: «بیکە بە پاکەتی بێ خاوەن (unclaimed)» یان کریارێکی دروست بۆی دیاری بکە.

ئەم قۆناغە متمانە بە داتا زیاد دەکات و ڕوون دەکاتەوە کەی شت «وینە» دەبێت و چۆن چاکی بکەیتەوە.

---

## ٤. ڕیزبەندی جێبەجێکردن (پێشنیار)

| پێشەنگی | قۆناغ | کورتە |
|---------|--------|-------|
| ١ | Validation + Import Preview | schema/FK check؛ dry-run؛ پێشبینین لە UI |
| ٢ | Backup versioning + integrity | versionLabel، schemaVersion، contentHash؛ پشکنین دوای restore |
| ٣ | Retention و storage display | سیاسەتی retention ڕوون؛ نیشاندانی local/cloud لە UI |
| ٤ | Chunked import + progress | هاوردەی گەورە بە chunk؛ progress bar |
| ٥ | Streaming export (ئەگەر داتا زۆر بێت) | export بە stream یان فایل + download link |
| ٦ | Merge strategies | overwrite / skip / merge لە هاوردە |
| ٧ | **پشکنینی ڕێکی داتا (وینە)** | دۆزینەوە و ڕاپۆرتی پاکەت/فاکتۆر وینە؛ چاککردنەوەی پیشنهادکراو |
| ٨ | Selective restore (ئارەزوومەندانە) | هەڵبژاردنی تابلۆ بۆ restore |

---

## ٥. سیستەمی هەڵگرتن (نویترین و باشترین ڕێکخستن)

- **Primary:** MySQL (ئێستا) وەک سەرچاوەی ڕاست؛ پاشەکەوت تەواو و ڕێکوپێک (ZIP + database.json + فایلەکان) بە version و checksum.
- **Backup storage:** Local (data/backups) بۆ خێرایی و نەبوونی تەنها ئینتەرنێت؛ S3/Forge بۆ دووبارەبوونەوە و disaster recovery.
- **Format:** JSON بۆ داتا (ئاسان بۆ وەرگەڕان و پشکنین)؛ ZIP بۆ تەواو (database + files)؛ CSV بۆ هاوردەی بەشێکی بەکارهێنەر.
- **Integrity:** Hash (SHA-256) لە backup؛ پشکنینی ژمارەی تۆمار و ئەگەر ممکن hash دوای restore.
- **Lifecycle:** پاشەکەوتە خۆکارەکان بە cron؛ پاککردنەوە بە retention؛ پاشەکەوتە گرنگەکان بە label (وەک pre-migration) بەدەست هەڵبگرە.

ئەم پلانە سیستەمی بەڕێوەبردنی داتا بە شێوەیەکی پرۆفیشنال نۆژەن دەکاتەوە و داتاکان بە validation، integrity، versioning، و performance باشتر هەڵدەگرێت. دەتوانیت بە قۆناغ ١ دەست پێ بکەیت (validation + preview) چونکە کاریگەری ڕاستەوخۆی لەسەر quality و متمانەی هاوردە هەیە.
