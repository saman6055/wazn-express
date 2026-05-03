# پلانی پرۆفیشناڵ بۆ مامەڵەکردن لەگەڵ تراکینگ هاوبەش و چەند-تراکینگ
**Multi-Tracking & Shared-Tracking Handling — Professional Plan**

> ئامانج: لە لاپەرەی **تۆماری خێرا** (QuickRegister) و **تۆمار بە کۆمەڵە** (BulkRegister) دۆخەکانی تێکەڵ بە تراکینگ بناسرێنەوە، نیشان بدرێن و بە دروستی پێ مامەڵە بکرێ — تاکو حساب ڕێک بێ، پاکەت ون نەبێ، و ئۆردەرەکان لە کۆمەڵە و گەیاندنەوە دەرنەکەون.

---

## ٠. یاسای کاری (Business Invariant) — یەک-کڕیار

> هەموو ئۆردەرە هاوبەشەکان (هاوتراکینگ) و هەر ئۆردەرێک کە چەند تراکی هەیە، **هەر یەک کڕیاریان هەیە**.

ئەمە یاسایەکی ڕێژەی بەرز (hard rule) لە businessـدا، و سیستەم دەبێ ڕێگری بکات لە شکانی، نەک تەنها بە کاری شەرت بکات. یاسای کاری دەبێتە:
- چەکی validation لە `addOrderTrackings` (multi-select) — هەموو ئۆردەرە هەڵبژێردراوەکان دەبێ هەمان `customerId`ـیان بێ.
- چەکی validation لە `packages.register` — هەموو `linkedOrderIds[]` دەبێ هەمان `customerId`ـیان بێ.
- لە UIی `TrackingAlerts` multi-select، فلتەری هاوکات بە customerId.

**کاریگەری ئەم یاسایە لەسەر ڕیسکی پلان:** کێشەی "کڕیار شارژ دەکرێ بەڵام پاکەت نابینێ" بە تەواوی نامێنێ.

---

## ١. دیاریکردنی کێشە (Problem Statement)

دوو دۆخی پێچەلپێچ هەن کە ئێستا UI بە دروستی نیشان نادات و بەکارهێنەر دەکرێ بە هەڵە بکات:

| دۆخ | وەسف | کەسی-ون-بوون |
|---|---|---|
| **A — هاوبەش (Shared Tracking)** | چەند ئۆردەری جیا (یان لە یەک کڕیار یان زیاتر) هەمان `trackingNumber`ـیان هەیە (یەک کارتۆن چەند کاڵای جیاوازی تێدایە). | تەنها یەکەم ئۆردەر `fullPackageOrderId` لە پاکەت دەگرێت. ئۆردەرەکانی تر "چاوەڕێ" دەمێنن، شاید هەرگیز نەخرێنە کۆمەڵە. |
| **B — چەند-تراکینگ (Multi-Tracking)** | یەک ئۆردەر چەند `trackingNumber`ـی جیای هەیە (چەند کارتۆن بۆ یەک ئۆردەری گەورە). | هەر کارتۆن وەک پاکەتێکی جیا تۆمار دەکرێت، بەڵام UI ئاگادار نییە کە کاتێک کارتۆنی ١ تۆمار دەکرێ، هێشتا ٢ کارتۆنی تر چاوەڕیان. |

دۆخی هەردوو لە کۆد هەن (تەیبڵی `fullPackageOrderTrackings` پشتگیری دەکات)، بەڵام UIی تۆمارکردن:
- هیچ پێشهاتێک نیشان نادات کاتێک تراکێک هاوبەشە
- هیچ پێشهاتێک نیشان نادات کاتێک ئۆردەرێک کارتۆنەکانی تری ماوە
- خاوەنی پاکەت لە سینکی `batchId` لە پاکەتەوە بۆ ئۆردەر، تەنها یەکەم ئۆردەری هاوبەش وەردەگرێ — ئەوانی تر دەمێننەوە دەرەوە

---

## ٢. ئەوەی ئێستا هەیە (Current Code Surface)

### ٢.١ سەرچاوەی داتا

| تەیبڵ / فیلد | ڕۆڵ | کاریگەری |
|---|---|---|
| `fullPackageOrders.trackingNumber` | فیلدی کۆن (legacy) — یەک تراک بۆ یەک ئۆردەر | بۆ پاراستنی کۆن. یەکەم تراک هەمیشە لێرەش دەنووسرێ. |
| `fullPackageOrders.orderNumber` | ژمارەی ئۆردەر لە لای دابینکەر | تەنها بۆ پیشاندان |
| `fullPackageOrderTrackings` (multi-tracking) | چەند تراک بۆ یەک ئۆردەر، یان چەند ئۆردەر بۆ یەک تراک | سەرچاوەی ڕاست بۆ هەردوو دۆخ |
| `packages.trackingNumber` | یونیکە — یەک پاکەت = یەک تراک | بناغەی کێشەی دۆخی A |
| `packages.fullPackageOrderId` | FK بۆ ئۆردەری گرێدراو | تەنها یەک ئۆردەر دەناسێ، نەک هەموو هاوبەشەکان |

### ٢.٢ ڕێگاکانی گەڕانی تراک

| فانکشن | فایل | چی دەگەڕێنێتەوە |
|---|---|---|
| `lookupTracking` | [packages.router.ts:71](server/routers/packages.router.ts) | یەکەم ئۆردەر |
| `searchTrackingAllTypes` | [scanning.router.ts:65](server/routers/scanning.router.ts) | یەکەم ئۆردەر / یەک پاکەت |
| `getFullPackageOrderByTrackingNumber` | [fullPackage.db.ts:248](server/db/fullPackage.db.ts) | یەکەم ئۆردەر |
| `getAllOrdersByTrackingNumber` | [fullPackage.db.ts:276](server/db/fullPackage.db.ts) | **هەموو ئۆردەرەکانی هاوبەش** ✅ |
| `getOrderTrackings` | [fullPackage.db.ts:331](server/db/fullPackage.db.ts) | **هەموو تراکەکانی ئۆردەرێک** ✅ |

ئەوەی پێویستە: داتا بۆ هەردوو دۆخ هەن، بەڵام تەنها لە بەشی **گەیاندن** (delivery) بەکار دێن. بەشی **تۆمارکردنی پاکەت** هەر یەکەم ئۆردەر دەناسێ.

### ٢.٣ کێشە لە سینکی `batchId`

[scanning.db.ts:384-398](server/db/scanning.db.ts) — کاتێک `batchId`ی پاکەت دەگۆڕێ:
```ts
const fullPackageOrder = await getFullPackageOrderByTrackingNumber(pkg.trackingNumber);
if (fullPackageOrder) {
  await updateFullPackageOrder(fullPackageOrder.id, { batchId: data.batchId });
}
```
تەنها یەکەم ئۆردەر `batchId` وەردەگرێ. ⚠ ئۆردەرەکانی تری هاوبەش لە دەرەوەی کۆمەڵە دەمێنن.

---

## ٣. تەجروبەی مەبەست (Target UX)

### ٣.١ گشتی — ئەوەی بەکارهێنەر دەبینێ

دوای داخڵکردنی `trackingNumber` لە BulkRegister یان QuickRegister، ٨٠٠ms دواتر سیستەم پشتگیری دەکات و یەکێک لەم بانگەوازانە دەنوێنێ:

#### حاڵەتی ئاسایی (Normal)
- ✅ بادج سەوز `یەک ئۆردەر • یەک تراکینگ` لە کەناری ڕیزەکە.

#### دۆخی A — تراکی هاوبەش (Shared)
- 🔗 بادجی پرتەقاڵی `هاوبەش • ٣ ئۆردەر`.
- پانێڵێکی فراوانبوو نیشان دەدات:
  ```
  ⚠ ئەم تراکینگە بۆ ٣ ئۆردەرە:
   • CM-MNU9G16F  •  AZ124 (Hassan)  •  bag           [✓ هێشتا تۆمار نەکراوە]
   • CM-MNU9H937  •  AZ124 (Hassan)  •  watches       [✓ هێشتا تۆمار نەکراوە]
   • CM-MOFEAWDQ  •  AZ003 (Saman)   •  Dress         [⚠ لە کۆمەڵەی AIR-2026-007]
  
  [☐ هەموو ئەم ئۆردەرانە بە یەک پاکەت گرێ بدە (پێشنیار)]
  [☐ تەنها CM-MNU9G16F]
  ```
- **یاسای کلیدی:** ئەگەر بەکارهێنەر "هەموو" هەڵبژاردبێ، پاکەتەکە لە تەیبڵی `packageOrderLinks`دا بە هەموو ئۆردەرە هاوبەشەکان گرێ دەدرێ. ئەگەر "تەنها یەک" هەڵبژاردبێ، باکس‌ڕا بەکارهێنەر دەبینێ کە N-1 ئۆردەری تر هێشتا چاوەڕی پاکەتن.

#### دۆخی B — چەند-تراکینگ (Multi)
- 📦 بادجی شین `کارتۆن ١/٤ • CM-MNYE0IWF`.
- پانێڵی فراوانبوو:
  ```
  ⓘ ئەم ئۆردەرە (CM-MNYE0IWF) ٤ تراکینگی هەیە:
   ✅ کارتۆن ١  •  TR-AAA111  •  ئێستا تۆمار دەکرێ
   ⏳ کارتۆن ٢  •  TR-BBB222  •  چاوەڕێ
   ⏳ کارتۆن ٣  •  TR-CCC333  •  چاوەڕێ
   ⏳ کارتۆن ٤  •  TR-DDD444  •  چاوەڕێ
  
  دوای تۆمارکردنی هەموو ٤ کارتۆن، ئۆردەر دەچێتە دۆخی "in_china_warehouse"
  ```

#### دۆخی پێشدا تۆمارکراو
- 🔴 بادجی سوور `پێشتر تۆمار کراوە • PKG-...`.
- ڕێگە نادات تۆمارکردن — ئەرکی DB unique constraint.

### ٣.٢ پێش submit — banneری دڵنیایی
لە BulkRegister، سەرووی دوگمەی تۆمار:
> ⚠ **٣ ڕیزی هاوبەشت هەن** — تکایە دڵنیا بە لە بەشی هاوبەش پێش submit.

---

## ٤. بنیاتی پلان (Architecture)

### ٤.١ تەیبڵی نوێ — `packageOrderLinks`

```sql
CREATE TABLE packageOrderLinks (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  packageId       INT NOT NULL,
  fullPackageOrderId INT NOT NULL,
  cartonIndex     INT NOT NULL DEFAULT 1,
  isPrimary       BOOLEAN NOT NULL DEFAULT FALSE,
  createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uniq_pkg_order (packageId, fullPackageOrderId),
  INDEX idx_package (packageId),
  INDEX idx_order (fullPackageOrderId),

  FOREIGN KEY (packageId) REFERENCES packages(id) ON DELETE CASCADE,
  FOREIGN KEY (fullPackageOrderId) REFERENCES fullPackageOrders(id) ON DELETE CASCADE
);
```

**هۆکارەکان:**
- یەک پاکەت → چەند ئۆردەر (دۆخی A): چەند ڕیز.
- یەک ئۆردەر → چەند پاکەت (دۆخی B): چەند ڕیز، هەر یەک `cartonIndex`ێکی جیا.
- `isPrimary = TRUE` بۆ ئۆردەرەی کە لە `packages.fullPackageOrderId`دایە — بۆ پاراستنی کۆن.
- `ON DELETE CASCADE` گرنگە؛ ئەگەر پاکەتێک سڕایەوە، گرێدانەکانی نامێنن.

### ٤.٢ procedure ـی نوێ — `lookupTrackingExpanded`

```ts
// server/routers/packages.router.ts
lookupTrackingExpanded: staffProcedure
  .input(z.object({ trackingNumber: z.string().min(1).max(100) }))
  .query(async ({ input }) => {
    const tn = input.trackingNumber.trim();

    // 1. Find ALL orders linked to this tracking
    const sharingOrders = await db.getAllOrdersByTrackingNumber(tn);

    if (sharingOrders.length === 0) {
      // Check duplicate package
      const existingPkg = await db.getPackageByTrackingNumber(tn);
      if (existingPkg) return { case: "duplicate", existingPackage: existingPkg };
      return { case: "regular" };
    }

    // 2. For each order, fetch all of its trackings (siblings of this carton)
    const ordersWithTrackings = await Promise.all(
      sharingOrders.map(async (o) => {
        const trackings = await db.getOrderTrackings(o.id);
        const customer = o.customerId ? await db.getCustomerById(o.customerId) : null;
        const batch = o.batchId ? await db.getBatchById(o.batchId) : null;
        return { order: o, trackings, customer, batch };
      })
    );

    // 3. For each tracking, check whether it already has a registered package
    const allTrackingNumbers = new Set<string>();
    for (const owt of ordersWithTrackings) {
      for (const t of owt.trackings) allTrackingNumbers.add(t.trackingNumber);
      if (owt.order.trackingNumber) allTrackingNumbers.add(owt.order.trackingNumber);
    }
    const existingPackages = await db.getPackagesByTrackingNumbers(Array.from(allTrackingNumbers));

    return {
      case: sharingOrders.length > 1 ? "shared" : (
        ordersWithTrackings[0].trackings.length > 1 ? "multi" : "single"
      ),
      orders: ordersWithTrackings,
      existingPackages,    // map<trackingNumber, package>
    };
  })
```

### ٤.٣ گۆڕانکاری لە `packages.register`

- `fullPackageOrderId: number` → `linkedOrderIds: number[]` (دەستۆریش هەڵدەگرێ بۆ پاراستنی کۆن).
- دوای دروستکردنی پاکەت، بۆ هەر `orderId` لە `linkedOrderIds`، ڕیزێک لە `packageOrderLinks` دروست بکە.
- یەکەم `orderId` `isPrimary = TRUE` و لە `packages.fullPackageOrderId` دەنوسرێ.

### ٤.٤ ڕاستکردنەوەی سینکی `batchId`

[scanning.db.ts:384-398](server/db/scanning.db.ts) چاک دەکرێ:

```ts
if (data.batchId !== undefined) {
  const links = await db.getOrderLinksByPackageId(packageId);
  for (const link of links) {
    await updateFullPackageOrder(link.fullPackageOrderId, { batchId: data.batchId });
  }
}
```

ئەمە لە یەک تراکنزەشن، تاکو ئەگەر هەر یەکێک شکستی هێنا، هەموویان rollback بکرێن.

---

## ٥. پلانی فازی (Phased Implementation)

| فاز | کار | فایلی سەرەکی | ڕیسک | کات |
|---|---|---|---|---|
| **0** | تەیبڵی `packageOrderLinks` + بێکفیل بۆ پاکەتە کۆنەکان | migration + backfill script | کەم | نیو ڕۆژ |
| **1** | `lookupTrackingExpanded` procedure (read-only) | [packages.router.ts](server/routers/packages.router.ts) | بێ | چارەک ڕۆژ |
| **2** | UIی BulkRegister: detection, badges, panel, confirm-banner | [BulkRegister.tsx](client/src/pages/BulkRegister.tsx) | کەم | ١ ڕۆژ |
| **3** | UIی QuickRegister: modal/banner, confirm flow | [QuickRegister.tsx](client/src/pages/QuickRegister.tsx) | کەم | چارەک ڕۆژ |
| **4** | `packages.register` پشتگیری `linkedOrderIds[]` و نوسین لە `packageOrderLinks` | [packages.router.ts](server/routers/packages.router.ts) + [packages.db.ts](server/db/packages.db.ts) | ناوەند | چارەک ڕۆژ |
| **5** | سینکی `batchId` بۆ هەموو ئۆردەرە گرێدراوەکان (بە تراکنزەشن) | [scanning.db.ts](server/db/scanning.db.ts) | ناوەند | چارەک ڕۆژ |
| **6** | بەرز کردنەوەی دۆخی ئۆردەر کاتێک هەموو کارتۆنەکانی گەیشتن | [packages.db.ts](server/db/packages.db.ts) | کەم | چارەک ڕۆژ |
| **7** | ڕاپۆرت پێش-گەیاندن: "ئۆردەرە هاوبەشانە کە لە کۆمەڵە نین" | بەشی Reports | کەم | چارەک ڕۆژ |
| **8** | پشکنینی پاش-گەیاندن: هەر ئۆردەر یەک جار شارژ کرابێ | کۆدێکی audit | کەم | چارەک ڕۆژ |

**فازە کلیلیەکان:** 0, 1, 2, 4, 5. فازی 3 (QuickRegister) دەکرێ پاش 2.

---

## ٦. دۆخە تایبەتەکان (Edge Cases)

### ٦.١ تراکی هاوبەش، بەکارهێنەر "تەنها یەک" هەڵبژارد
- پاکەت بە تەنها یەک ئۆردەر گرێ دەدرێ.
- ئۆردەرەکانی تر دەمێننەوە چاوەڕێ. **پێویستە لە لاپەرەی Tracking Alerts نیشان بدرێن** بە بادجی "هاوبەش — پاکەتی هاوبەش پێشتر تۆمار کراوە".
- ئامرازێک لە لاپەرەی Tracking Alerts: "بیخە سەر پاکەتی پێشوو" — ڕیزێکی نوێ لە `packageOrderLinks` بۆ ئەو ئۆردەرە بۆ ئەو پاکەتە کۆنە دروست دەکات.

### ٦.٢ ئۆردەرێک لە کۆمەڵەی جیایە
- ئەگەر یەکێک لە ئۆردەرە هاوبەشەکان لە کۆمەڵەی جیادایە، گرێدان قەدەغە دەکرێ یان پرسیار دەکرێ:
  > "ئۆردەری CM-MOFEAWDQ لە کۆمەڵەی AIR-2026-007 دایە. هەڵگرتنی بۆ ئەم پاکەتەی نوێ لێی دەربکات؟"

### ٦.٣ کارتۆنێکی "لەناکاو" گەیشتووە بێ ئەوەی لە چاوەڕێ بێ
- بەکارهێنەر تراکی نوێ داخڵ دەکات کە لە `fullPackageOrderTrackings`دا نییە.
- سیستەم وەک پاکەتی ئاسایی (regular) تۆمار دەکات — هیچ ئۆردەرێک گرێ ناخات.
- ئەگەر دواتر بەکارهێنەر زانی ئەوە بۆ ئۆردەرێکی FPیە، لە TrackingAlerts دەتوانێ زیادی بکات.

### ٦.٤ شارژی دووبارە (Double-charging)
- ئێستا `isCharged` فلاگ پارێزراوە لەسەر ئۆردەر.
- لە `splitShippingCost` ([fullPackage.router.ts:1596](server/routers/fullPackage.router.ts)) و لە بەشی گەیاندن ([batches.router.ts:893](server/routers/batches.router.ts))، هەر ئۆردەر یەک جار شارژ دەکرێ.
- پلانی نوێ ئەم ڕێزانە ناشکێنێ.

### ٦.٥ سڕینەوەی پاکەت
- `packageOrderLinks` بە `ON DELETE CASCADE` ڕێکخراوە.
- ئەگەر پاکەتێک بسڕێتەوە، هەموو گرێدانەکانی نامێنن — ئۆردەرەکان دۆخی "no-package" بەدەست دەهێنن و دەتوانن بە پاکەتی نوێ گرێ بدرێن.

### ٦.٦ بێکفیل بۆ داتای کۆن
- پاکەتە هەن کە `fullPackageOrderId`ـیان هەیە — بۆ هەر یەکێک، ڕیزێک لە `packageOrderLinks` بە `isPrimary=TRUE` دروست بکە.
- بۆ پاکەتانی کە تراکینگیان هەیە بەڵام `fullPackageOrderId`ـیان نییە، بپشکنە: `getAllOrdersByTrackingNumber(tn)` — ئەگەر دۆزرایەوە، ڕیزی پەیوەندیدار دروست بکە (هەموویان غەیر-`isPrimary` لە بێکفیلدا، چونکە ئەوانە "lost orders" بوون لەو پاکەتەوە).
- بێکفیل دەبێ idempotent بێ — دووبارە کاری زیان نەدات.

### ٦.٧ کاتی hard-refresh لە ناوەڕاستی BulkRegister
- داتا لە `useState` پارێزراوە — refresh = ون.
- پێشنیار: localStorageـدا "draft" پاراستن بۆ ئەو حاڵەتە. (دەرەکی، نەک پێویست).

---

## ٧. شکانی ڕیسک (Risk Analysis)

| ڕیسک | ئاستی کاریگەری | چارەسەر |
|---|---|---|
| Migration هەڵە دەدات لە سێرڤەری ئاکتیڤ | بەرز | لە maintenance window؛ snapshot DB پێش هەنگاو؛ ڕێگەی rollback ئامادە |
| بێکفیل بۆ هەزاران پاکەت کاتگیر دەبێ | ناوەند | بە batch ‌(چەند سەد ڕیز هەر کات) ڕێژەی idempotent |
| `packageOrderLinks` بێ ڕیز بۆ پاکەتانی کۆن | ناوەند | بێکفیل پێش deploy کردنی فاز 4؛ skip linked-orders-empty تا بێکفیل تەواو دەبێ |
| UIی BulkRegister زیاتر debounce پێویستە | کەم | 800ms ئێستا باشە؛ زیادکردنی loadingەکی بچوک |
| سینکی `batchId` بۆ هەموو ئۆردەرە هاوبەشەکان قەبارە دەکات کاتی update | کەم | unit-test کردن بۆ دڵنیابوون لە یەکجار-update، indexی DB چاکە |
| Race لە multi-staff تۆمار | کەم | unique key لە `packages.trackingNumber` ڕێگری دەکات لە دووبارە |

---

## ٨. لیستی پشکنین (Verification Checklist)

پێش closing فازەکان:

- [ ] لە BulkRegister، تراکی هاوبەش (٣ ئۆردەری) داخڵ بکە → بادج و پانێڵ نیشان دەدرێن
- [ ] checkbox "هەموو" → submit → ٣ ڕیز لە `packageOrderLinks` نوسران
- [ ] چەند-تراکینگ (یەک ئۆردەر، ٤ کارتۆن) → بادجی "1/4" نیشان دراوە
- [ ] دوای تۆمارکردنی ٤ کارتۆن، ئۆردەر بۆ "in_china_warehouse" ئاپدەیت بوو
- [ ] گۆڕینی `batchId`ی پاکەتێکی هاوبەش → هەموو ٣ ئۆردەر `batchId` وەرگرت
- [ ] گەیاندنی کۆمەڵە → هەر ئۆردەر یەک جار شارژ کراوە (لە finance ledger پشکنە)
- [ ] سڕینەوەی پاکەت → ڕیزەکانی `packageOrderLinks` نامێنن (CASCADE)
- [ ] لە لاپەرەی Tracking Alerts، ئۆردەرە هاوبەشانە کە پاکەتێکی پێشوویان هەیە، بەلابەلەی نیشان دراون
- [ ] ڕاپۆرتی پێش-گەیاندن: ئەگەر ئۆردەرێکی هاوبەش لە کۆمەڵە نییە، ئاگاداری دەنێرێ

---

## ٩. کۆتا — یەک خاڵ بۆ یاد

ئەم پلانە **هیچ شارژی دووبارە** دروست ناکات. هاوکات لە ئاکامی فاز 5، **هیچ ئۆردەرێک لە کۆمەڵە دانامێنێ** بە هۆی هاوبەشی تراکینگ. ئەمە دۆخێک کە لە کۆد ئێستا دۆزراوەتەوە (بە بەڵگەی [scanning.db.ts:389](server/db/scanning.db.ts)).

**خۆ کاتێک چاکسازی دەکرێ، بێکفیل بۆ پاکەتە کۆنەکانیش گرنگە** — تاکو ڕاپۆرتی پێش-گەیاندن لە سەرەتاوە دروست کار بکات و هەموو ئۆردەرە "ون"ەکانی پێشوو بدۆزرێنەوە.

---

## ١٠. ئاماژەکانی کۆد (Code References)

- [client/src/pages/BulkRegister.tsx:222-253](client/src/pages/BulkRegister.tsx) — ئێستا lookup
- [client/src/pages/QuickRegister.tsx:82-122](client/src/pages/QuickRegister.tsx) — ئێستا searchTrackingAllTypes
- [client/src/pages/TrackingAlerts.tsx:170-196](client/src/pages/TrackingAlerts.tsx) — multi-select کۆن (handleSaveTracking)
- [server/routers/packages.router.ts:71-144](server/routers/packages.router.ts) — `lookupTracking` ئێستا
- [server/routers/packages.router.ts:167-334](server/routers/packages.router.ts) — `register` ئێستا
- [server/db/fullPackage.db.ts:248-269](server/db/fullPackage.db.ts) — `getFullPackageOrderByTrackingNumber` (کێشە)
- [server/db/fullPackage.db.ts:276-309](server/db/fullPackage.db.ts) — `getAllOrdersByTrackingNumber` (✅)
- [server/db/fullPackage.db.ts:331-336](server/db/fullPackage.db.ts) — `getOrderTrackings`
- [server/db/scanning.db.ts:384-398](server/db/scanning.db.ts) — کێشەی سینکی batchId
- [server/routers/batches.router.ts:880-899](server/routers/batches.router.ts) — گەیاندن کە دروست کار دەکات
- [server/routers/fullPackage.router.ts:1596-1686](server/routers/fullPackage.router.ts) — splitShippingCost
- [drizzle/schema/fullPackage.schema.ts:243-254](drizzle/schema/fullPackage.schema.ts) — `fullPackageOrderTrackings`
