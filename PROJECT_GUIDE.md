# Wazn Express - پڕۆژەی تەواو

## پوختە (Overview)

**Wazn Express** سیستەمێکی بەڕێوەبردنی کەرگۆیە بۆ گواستنەوەی کاڵا لە چین بۆ عێراق/کوردستان.

### تایبەتمەندییە سەرەکییەکان:
- بەڕێوەبردنی کڕیارەکان و پاکەتەکان
- سیستەمی باچ بۆ کۆکردنەوەی پاکەتەکان
- سیستەمی نرخدانان بەپێی کێش/قەبارە
- سیستەمی دارایی و ئینڤۆیس
- پۆرتاڵی کڕیار (موبایل ئەپ ستایل)
- سکانەری QR و باڕکۆد
- Full Package (کڕینی کاڵا بۆ کڕیار)
- ڕاپۆرتی زۆر

---

## تەکنۆلۆژیاکان (Tech Stack)

### Frontend:
- **React 19** + **TypeScript**
- **Tailwind CSS 4** بۆ ستایل
- **shadcn/ui** بۆ کۆمپۆنێنتەکان
- **wouter** بۆ ڕاوتینگ
- **tRPC** بۆ API کلاینت

### Backend:
- **Express 4** + **TypeScript**
- **tRPC 11** بۆ API
- **Drizzle ORM** بۆ داتابەیس
- **MySQL/TiDB** داتابەیس

---

## خشتەکانی داتابەیس (Database Tables)

### سەرەکییەکان:
| خشتە | وەسف |
|------|------|
| `users` | بەکارهێنەرەکان (ئەدمین، کارمەند، کڕیار) |
| `customers` | کڕیارەکان (کۆدی AZ0001) |
| `packages` | پاکەتەکان |
| `batches` | باچەکان (کۆمەڵە پاکەت) |
| `invoices` | ئینڤۆیسەکان |
| `ledgerEntries` | تۆماری دارایی |

### پشتیوانی:
| خشتە | وەسف |
|------|------|
| `countries` | وڵاتەکان |
| `warehouses` | کۆگاکان |
| `pricingRules` | یاسای نرخدانان |
| `exchangeRates` | نرخی دۆلار |
| `suppliers` | فرۆشیارەکان |
| `fullPackageOrders` | داواکاری Full Package |
| `expenses` | خەرجییەکان |
| `payments` | پارەدانەکان |
| `auditLogs` | لۆگی گۆڕانکارییەکان |

### نرخدانان:
| خشتە | وەسف |
|------|------|
| `batchPricingTiers` | نرخی پلەبەندی بەپێی کێش |
| `batchCustomerPricing` | نرخی تایبەت بۆ کڕیار |
| `vipCustomers` | کڕیارە VIP ەکان |

---

## فایلە سەرەکییەکان (Key Files)

### Backend:

| فایل | هێڵ | وەسف |
|------|-----|------|
| `server/routers.ts` | ~5,856 | هەموو tRPC پرۆسیجەرەکان (41 ڕاوتەر) |
| `server/db.ts` | ~7,401 | هەموو فەنکشنەکانی داتابەیس |
| `drizzle/schema.ts` | ~900 | خشتەکانی داتابەیس (60+ خشتە) |

### Frontend:

| فایل | وەسف |
|------|------|
| `client/src/App.tsx` | ڕاوتینگ و لەیاوت |
| `client/src/pages/` | 70 پەڕەی جیاواز |
| `client/src/components/` | کۆمپۆنێنتە هاوبەشەکان |

---

## ڕاوتەرەکان و شوێنیان (Router Index)

| ڕاوتەر | هێڵ | وەسف |
|--------|-----|------|
| dataManagement | 51-127 | بەڕێوەبردنی داتا |
| auth | 128-195 | چوونەژوورەوە |
| dashboard | 196-301 | داشبۆرد |
| users | 302-325 | بەکارهێنەرەکان |
| customers | 326-562 | کڕیارەکان |
| countries | 563-629 | وڵاتەکان |
| warehouses | 630-715 | کۆگاکان |
| pricing | 716-785 | نرخدانان |
| batches | 786-1137 | باچەکان |
| packages | 1138-1831 | پاکەتەکان |
| accounting | 1832-1940 | ژمێریاری |
| invoices | 1941-2109 | ئینڤۆیسەکان |
| exchangeRates | 2110-2144 | نرخی دۆلار |
| auditLogs | 2145-2166 | لۆگەکان |
| reports | 2167-2211 | ڕاپۆرتەکان |
| customerPortal | 2212-2608 | پۆرتاڵی کڕیار |
| settings | 2609-2636 | ڕێکخستنەکان |
| invoiceTemplates | 2637-2812 | داڕشتەی ئینڤۆیس |
| adminMessages | 2813-2861 | پەیامەکان |
| fullPackage | 2862-3284 | Full Package |
| suppliers | 3285-3384 | فرۆشیارەکان |
| vip | 3385-3468 | VIP |
| payments | 3469-3540 | پارەدانەکان |
| qrCodes | 3541-3594 | QR کۆدەکان |
| scanning | 3595-4294 | سکان |
| ledger | 4295-4425 | دەفتەری دارایی |
| productCategories | 4426-4522 | پۆلی کاڵا |
| notifications | 4523-4558 | ئاگادارییەکان |
| expenseCategories | 4559-4610 | پۆلی خەرجی |
| expenses | 4611-4696 | خەرجییەکان |
| partners | 4697-4772 | هاوبەشەکان |
| companyDebts | 4773-4860 | قەرزی کۆمپانیا |
| cashAccounts | 4861-4950 | حسابی کاش |
| financialReports | 4951-5137 | ڕاپۆرتی دارایی |
| scanHistory | 5138-5216 | مێژووی سکان |
| scanReports | 5217-5287 | ڕاپۆرتی سکان |
| extraServices | 5288-5496 | خزمەتگوزاری زیادە |
| notificationTemplates | 5497-5584 | داڕشتەی ئاگاداری |
| labelTemplates | 5585-5688 | داڕشتەی لەیبڵ |
| alerts | 5689-5718 | ئاگادارییەکان |
| financeIntegration | 5719-5853 | یەکگرتنی دارایی |

---

## پرۆسیجەرە سەرەکییەکان

### کڕیارەکان (customers.*):
- `list` - لیستی کڕیارەکان
- `getById` - وردەکاری کڕیار
- `create` - دروستکردنی کڕیار
- `update` - نوێکردنەوەی کڕیار
- `getBalance` - باڵانسی کڕیار
- `getLedger` - تۆماری دارایی

### پاکەتەکان (packages.*):
- `list` - لیستی پاکەتەکان
- `register` - تۆمارکردنی پاکەت
- `updateStatus` - گۆڕینی ستاتەس
- `assignToBatch` - زیادکردن بۆ باچ
- `getByCustomer` - پاکەتەکانی کڕیار

### باچەکان (batches.*):
- `list` - لیستی باچەکان
- `create` - دروستکردنی باچ
- `updateStatus` - گۆڕینی ستاتەس
- `getPackages` - پاکەتەکانی باچ
- `getCustomerPricing` - نرخی کڕیار

### سکان (scanning.*):
- `searchByTracking` - گەڕان بە tracking
- `registerScan` - تۆمارکردنی سکان
- `updatePackageInline` - گۆڕینی پاکەت + charge
- `quickRegisterPackage` - تۆماری خێرا

### دارایی (finance.*):
- `getSummary` - پوختەی دارایی
- `getDebtors` - قەرزدارەکان
- `recordPayment` - تۆمارکردنی پارەدان
- `recordCharge` - تۆمارکردنی charge

---

## لۆجیکی گرنگ

### 1. دروستکردنی ئینڤۆیس خۆکارانە

کاتێک پاکەتێک بە `ready_for_delivery` دەگۆڕێت:
1. نرخ دیاری دەکرێت بەپێی باچ
2. Ledger entry دروست دەکرێت
3. Invoice دروست دەکرێت
4. Revenue تۆمار دەکرێت

### 2. نرخدانان بەپێی باچ

نرخ بەم شێوەیە دیاری دەکرێت:
1. **نرخی تایبەتی کڕیار** (batchCustomerPricing) - ئەگەر هەبوو
2. **نرخی پلەبەندی** (batchPricingTiers) - بەپێی کێش
3. **نرخی سەرەکی باچ** (batch.pricePerKg) - default

### 3. ستاتەسی پاکەت

```
registered → in_batch → in_transit → customs_processing → 
ready_for_delivery → out_for_delivery → delivered
```

---

## کۆدی کڕیار

فۆرمات: `AZ{number}({name})`
مثال: `AZ0001(Xogr)`

---

## جۆری گواستنەوە

- `air_regular` - ئاسمانی ئاسایی
- `air_irregular` - ئاسمانی نائاسایی
- `sea` - دەریایی

---

## فرمانەکان

```bash
# سەرڤەر دەستپێبکە
pnpm dev

# داتابەیس push بکە
pnpm db:push

# تێست ڕان بکە
pnpm test
```
