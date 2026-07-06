# 🧠 Wazn Express – System Brain File
**فایلی میشکی سیستەمی وەزن ئێکسپرێس — دۆکیومێنتی تەواو بۆ Claude AI**

> ئەم فایلە یەک نیشانەی تەواوە لە سیستەمەکە. کاتێک دەیخەیتە بەردەم Claude (یان هەر AI ێکی تر)، دەتوانێت بە تەواوی تێبگات لە ساختەی سیستەم، تەکنەلۆجیا، داتابەیس، فلۆکان، و خاڵە لاوازەکانی بۆ ئەوەی یارمەتی پێشخستن بدات.

---

## 📋 ١. کورتەی پرۆژە (Project Overview)

### ناو و مەبەست
- **ناو:** Wazn Express — وەزن ئێکسپرێس
- **جۆر:** سیستەمی بەڕێوەبردنی بار و لۆجیستیک (Cargo & Logistics Management System)
- **مەبەست:** بەڕێوەبردنی تەواوی پرۆسەی ناردنی بار لە چین بۆ عێراق (و وڵاتانی تر)، لەگەڵ:
  - تۆمارکردنی پاکەت و کڕیار
  - باچی ئاسمانی/دەریایی
  - حساباتی دارایی و قەرز
  - فاکتور و وەرگرتنی پارە
  - سیستەمی فول-پاکێج (کڕینی کاڵا بۆ کڕیار)
  - سیستەمی عمولە (purchase request)
  - پۆرتاڵی کڕیار
  - سکانی QR/Barcode
  - ڕاپۆرتی قازانج/زەرەر
- **زمانەکان (UI):** کوردی (ku), ئینگلیزی (en), عەرەبی (ar), چینی (zh) — لەگەڵ پشتگیری RTL

### دەرفەتی بازار
- **سەرکارە:** کۆمپانیاکانی لۆجیستیک لە کوردستان/عێراق کە بار لە چین وەردەگرن
- **بەکارهێنەران:** کارمەند، ئەکاونتانت، ئەدمین، سوپەر-ئەدمین، کڕیار (لە ڕێگەی پۆرتاڵ)

---

## 🛠️ ٢. تەکنەلۆجی و ستاک (Tech Stack)

### Frontend
- **Framework:** React 19 + TypeScript
- **Build:** Vite 7
- **Routing:** Wouter 3 (lightweight wouter@3.7.1 لەگەڵ patch)
- **Data layer:** tRPC v11 + TanStack React Query v5 (type-safe end-to-end)
- **UI:** shadcn/ui (Radix UI primitives) + Tailwind CSS v4 + tailwindcss-animate + tw-animate-css
- **Charts:** Recharts 2
- **Forms:** react-hook-form + Zod resolvers
- **Icons:** lucide-react
- **Rich text:** TipTap 3 (link, image, placeholder, text-align, underline)
- **i18n:** Custom `LanguageContext` (no i18next)، 4 زمان (`ku`, `en`, `ar`, `zh`)
- **Theme:** `next-themes` + custom `ThemeContext`, `PortalThemeContext`, `LandingThemeContext`
- **Date:** date-fns 4
- **Notifications:** sonner (toast)
- **Maps:** Google Maps types
- **Animations:** framer-motion 12
- **PWA:** custom PWAInstallPrompt, push notifications, OfflineContext
- **QR/Barcode:** html5-qrcode (scan), qrcode (generate)
- **Excel:** xlsx
- **Error handling:** ErrorBoundary + QueryErrorBoundary

### Backend
- **Runtime:** Node.js + tsx (dev) / esbuild (prod bundle)
- **Framework:** Express 4
- **API:** tRPC v11 (single endpoint `/api/trpc`, type-safe)
- **DB:** MySQL 8 + Drizzle ORM 0.44 + mysql2 driver
- **Auth:** JWT (jose 6) + bcrypt + cookie-based session
- **Security:** helmet, cors, express-rate-limit (global + auth-specific)
- **Logging:** pino 10 + custom appLogger
- **PDF:** pdfkit (invoices, reports, labels)
- **File storage:** AWS S3 (optional) أو local filesystem fallback
- **Email:** Resend (optional)
- **Cron jobs:** node-cron (scheduled backups, tracking alerts)
- **Image:** compressed image upload, sharp-style ops
- **Validation:** Zod 4
- **Serialization:** superjson (Date/BigInt friendly)

### DevOps & Tooling
- **Package manager:** pnpm 10 (لەگەڵ override بۆ tailwindcss>nanoid=3.3.7، patched wouter)
- **Tests:** vitest 2
- **Linting:** prettier (.prettierrc, .prettierignore)
- **Migrations:** drizzle-kit (manual migrations + auto-migrate)
- **Container:** Dockerfile + nixpacks.toml
- **Deployment:** Manus runtime (lە vite-plugin-manus-runtime), startScript.ps1 / start-server.ps1

---

## 📁 ٣. ساختەی فۆڵدەرەکان (Project Structure)

```
wazn-express/
├── client/                    # React frontend
│   ├── index.html
│   └── src/
│       ├── _core/             # Auth hooks (useAuth)
│       ├── components/
│       │   ├── ui/            # shadcn/ui primitives (53 files)
│       │   ├── dashboard/     # DashboardHero, StatsCard, FinancialCard, ChartContainer, DashboardSection (+ index.ts barrel)
│       │   ├── reports/       # PackageOverviewSection, FinancialMetricsSection, ChartContainer, etc.
│       │   ├── delivery/      # BoxTable, BoxFilters, CreateBoxDialog, BoxDetailPanel, DeliveryStats, BatchPrintBoxesSection
│       │   ├── scanner/       # ScanInput, ScannedList, SessionStats
│       │   ├── customers/     # CustomerInfoCard, CustomerPackagesTab, CustomerFinanceTab, etc.
│       │   ├── admin/         # DashboardTab, ActivityLogTab, BackupSection, ImportExportSection, DeleteDataSection
│       │   ├── portal/        # PackageTrackingTimeline, PortalListSkeleton, PriceListSection
│       │   ├── layout/        # PageHeader
│       │   ├── DashboardLayout.tsx, CustomerPortalLayout.tsx, ModernPortalLayout.tsx, Skin3PortalLayout.tsx
│       │   ├── ErrorBoundary, QueryErrorBoundary, MutationToastHandler, LoadingSkeleton, PWAInstallPrompt
│       │   ├── BarcodeScanner, RichTextEditor, ImageUpload, CompressedImageUpload, ImageGallery
│       │   ├── AIChatBox, LiveChatSupport, LanguageSwitcher, CompanyLogo, Map
│       │   └── WarehouseArrivalModal, OrderAuditHistory, SafeDeleteOrderDialog
│       ├── contexts/          # ThemeContext, LanguageContext, PortalThemeContext, LandingThemeContext, OfflineContext
│       ├── hooks/             # useBatches, useCompanyInfo, useComposition, useCustomerDetail, useCustomers,
│       │                      # useDataManagement, useDebouncedValue, useDynamicFavicon, useFinance, useMobile,
│       │                      # usePackages, usePermissions, usePersistFn, usePortalSSE, usePullToRefresh,
│       │                      # useScanning, useVoiceRecorder
│       ├── pages/             # ~110+ page components (admin/, customers/, portal/, portal/modern/, portal/skin3/)
│       ├── locales/           # ku.json, en.json, ar.json, zh.json (i18n)
│       ├── lib/               # trpc.ts, utils.ts, format.ts, storage.ts, soundManager.ts,
│       │                      # csvParser.ts, imageCompression.ts, pushNotifications.ts,
│       │                      # labelPrintUtils.ts, batchLabelPrintUtils.ts, deliveryBoxPrintUtils.ts
│       ├── constants/         # scannerModules.ts, dataManagementCategories.tsx
│       ├── App.tsx            # Wouter routes (110+ routes)
│       └── main.tsx
├── server/                    # Express + tRPC backend
│   ├── _core/                 # index.ts (entry), prod-entry.ts, trpc.ts, context.ts, sdk.ts (auth),
│   │                          # cookies.ts, oauth.ts, health.ts, migrations.ts, autoMigrate.ts,
│   │                          # static.ts, vite.ts, env.ts, llm.ts, imageGeneration.ts, voiceTranscription.ts,
│   │                          # notification.ts, dataApi.ts, map.ts, systemRouter.ts, types/
│   ├── routers/               # 14 tRPC routers (see §6)
│   ├── db/                    # Drizzle queries (see §6)
│   ├── services/              # Business logic services
│   │                          # ai.service, backup.service, invoice.service, migration.service,
│   │                          # notification.service, pdf-generator, pdf.service, pdfGenerator, pdfReports,
│   │                          # s3Backup.service, s3Restore.service, scheduledBackups.service,
│   │                          # storage.service, trackingAlert.service, zipBackup.service, localUpload
│   ├── middleware/            # auth.ts, rateLimiter.ts
│   ├── utils/                 # logger.ts, qr.ts
│   ├── config.ts              # Env validation (DATABASE_URL, JWT_SECRET, MIGRATION_SECRET)
│   └── __tests__/
├── shared/                    # Shared between client and server
│   ├── _core/                 # Errors
│   ├── const.ts               # COOKIE_NAME, AXIOS_TIMEOUT_MS, error messages
│   ├── permissions.ts         # PERMISSION_GROUPS (sidebar-aligned permission system)
│   ├── iraqi-cities.ts        # City data for Iraq
│   └── types.ts               # Re-exports all schema types + UserRole, PackageStatus, ShippingType
├── drizzle/
│   ├── schema/                # 10 schema files (see §5)
│   │   ├── users.schema.ts    # users, customers, vipCustomers, customerAddresses, customerCodePrefixes
│   │   ├── packages.schema.ts # packages, packageQrCodes, packageScans, packageStatusHistory,
│   │   │                      # scanDevices, packageClaimRequests, deliveryBoxes, deliveryBoxItems
│   │   ├── batches.schema.ts  # batches, batchPricingTiers, batchCustomerPricing
│   │   ├── invoices.schema.ts # invoices, invoiceTemplates
│   │   ├── finance.schema.ts  # exchangeRates, customerAccounts, ledgerTransactions, paymentRecords,
│   │   │                      # creditAdjustments, paymentReminders, expenseCategories, expenses,
│   │   │                      # partners, partnerTransactions, companyDebts, debtPayments,
│   │   │                      # cashAccounts, cashTransactions, financialPeriods, revenueRecords,
│   │   │                      # dailyFinancialSummary, expenseAlerts, expenseAlertLogs
│   │   ├── fullPackage.schema.ts # suppliers, fullPackageOrders, fullPackageStatusHistory, fullPackageOrderTrackings
│   │   ├── services.schema.ts # productCategories, serviceTypes, extraServices, labelTemplates,
│   │   │                      # batchLabelTemplates, stockCategories, stockProducts, stockPurchases,
│   │   │                      # stockPurchaseItems, stockSales, stockSaleItems, stockMovements, blogPosts
│   │   ├── settings.schema.ts # countries, warehouses, pricingRules, portalPriceListSettings,
│   │   │                      # systemSettings, notificationSettings, currencies, taxRates,
│   │   │                      # emailTemplates, ipWhitelist, productAttributes
│   │   ├── notifications.schema.ts # notificationLogs, customerNotificationPrefs, scheduledTasksLog,
│   │   │                      # customerMessages
│   │   ├── admin.schema.ts    # auditLogs, permissions, subPermissions, scanHistory, deletionLogs, backups
│   │   └── index.ts           # Re-exports all
│   ├── 0000–0034.sql          # 70+ migration files
│   ├── relations.ts
│   ├── schema.ts              # Combined schema export
│   └── meta/
├── scripts/                   # create-admin.ts, import-customers, translate-*.mjs, redeploy.sh,
│                              # backfill-charge-transaction-id.ts, sync-locales.mjs
├── docs/                      # 25+ planning documents (in Kurdish)
├── uploads/                   # Local file storage fallback
├── .env / .env.example
├── package.json, vite.config.ts, drizzle.config.ts, tsconfig.json, components.json
└── Dockerfile, nixpacks.toml
```

---

## 🗄️ ٤. ساختەی داتابەیس (Database Schema – MySQL)

### کۆی گشتی: ٥٠+ خشتە (table)
کۆکراوەتە بە پۆلی لۆجیکی (logical groups). هەموو `id` خۆکارە (auto-increment)، هەموو `createdAt/updatedAt` تایمستامپ.

### 🧑‍💼 4.1 بەکارهێنەر و کڕیار (Users & Customers)

| Table | Purpose | Key fields |
|-------|---------|-----------|
| `users` | کارمەندان (staff) | role enum: `super_admin`, `admin`, `employee`, `accountant`; loginMethod: `manus`, `mobile`, `username`; passwordHash; mobileNumber unique; openId for OAuth |
| `customers` | کڕیارەکان | customerCode unique (e.g., `AZ0001`), sequenceNumber, fullName/Ar/Ku, mobileNumber unique, passwordHash, country/city/district/address, passportUrl/nationalIdUrl/contractUrl, goodsTypePreferences/shippingTypePreferences (JSON arrays), linkedUserId (optional OAuth link), createdById |
| `vipCustomers` | VIP tier system | tier: silver/gold/platinum; discountPercent; fixedPricePerKgAir/Sea (overrides); creditLimitUsd; validFrom/validTo |
| `customerAddresses` | چەند ناونیشان بۆ هەر کڕیار | label, recipient, phone, country/city/district/street/building/floor, latitude/longitude, isDefault |
| `customerCodePrefixes` | پشتیوانی پرێفیکسەکان (AZ, WZ, TR, …) | code unique, label |
| `customerNotificationPrefs` | per-customer notification preferences | emailEnabled, smsEnabled, whatsappEnabled, packageStatusChange, paymentReminder, promotions |

### 📦 4.2 پاکەت و باچ (Packages & Batches)

| Table | Purpose | Key fields |
|-------|---------|-----------|
| `packages` | پاکەتە تاکەکان | packageCode unique, trackingNumber unique, customerId nullable (unclaimed), originWarehouseId, batchId, fullPackageOrderId, packageOwnership: customer/company, categoryId, isUnclaimed, qrCodeData/Signature, weightKg, lengthCm/widthCm/heightCm, volumeCbm, shippingType: `air_regular`/`air_irregular`/`sea`, calculatedCostUsd, deliveryType: `air_transit`/`warehouse_pickup`/`direct_delivery`, status enum (10 states), recipientName/Signature, deliveryPhoto |
| `batches` | باچ (گرووپی پاکەتەکان بۆ ناردن) | batchCode unique, originWarehouseId, destinationCountryId, shippingType, carrierInfo/airlineName/flightNumber/shippingCompany/containerNumber/vesselName, departureDate, estimatedArrival, status: preparing/in_transit/arrived/customs/delivered/closed, totalPackages, actualWeightKg/Cbm, chargedWeightKg/Cbm, costPerKg/Cbm, pricePerKg/Cbm, useTieredPricing |
| `batchPricingTiers` | نرخدانی پلەیی بۆ هەر باچ | minValue, maxValue, pricePerUnit (KG or CBM tier) |
| `batchCustomerPricing` | نرخی تایبەت بۆ کڕیار لە باچێکی دیاریکراو | pricePerKg/Cbm, notes |
| `packageScans` | تۆماری هەر سکانێک | scanType: registered/received_china/in_batch/in_transit/received_local/out_for_delivery/delivered/returned/customs_hold; scannedById, warehouseId, latitude/longitude, deviceInfo |
| `packageStatusHistory` | مێژووی گۆڕانی بارودۆخ | fromStatus, toStatus, changedById, changeMethod: scan/manual/system/api, scanId, metadata |
| `scanDevices` | ئامێرەکانی سکان | deviceName, deviceType, deviceIdentifier unique, assignedToId, totalScans |
| `packageQrCodes` | QR codes بۆ پاکەت/فول-پاکێج | qrCode unique, qrImageUrl, scanCount |
| `packageClaimRequests` | داواکاری وەرگرتنی پاکەتە بێ-خاوەن | requestNumber unique (CLM-YYYY-NNNN), packageId, customerId, status: pending/approved/rejected, customerNote, adminNote |
| `deliveryBoxes` | بۆکسی گەیاندن (کۆکردنەوەی چەندین پاکەت بۆ یەک کڕیار) | boxCode unique (BOX-YYYYMMDD-NNN), customerId, batchId, deliveryMethod: warehouse_pickup/home_delivery/city_transfer, deliveryCostUsd/ChargeUsd/ProfitUsd, totalPackages/Weight/Value, status: open/ready/in_transit/delivered/cancelled, signature, deliveryPhoto, invoiceId, isCharged |
| `deliveryBoxItems` | ئایتمی ناو بۆکس (snapshot) | boxId, packageId/fullPackageOrderId, trackingNumber, weightKg, calculatedCostUsd, itemType: regular/full_package/commission, sourceInfo |

### 💰 4.3 دارایی (Finance)

| Table | Purpose | Key fields |
|-------|---------|-----------|
| `customerAccounts` | حسابی دارایی هەر کڕیارێک | accountNumber unique (ACC-AZxxx-YYYY), currentBalanceUsd/Iqd, breakdown (packageDebt/fullPackageDebt/purchaseRequestDebt/commissionDebt/serviceDebt), creditBalanceUsd/Iqd (prepaid), creditLimitUsd/Iqd, totalDebit/Credit (lifetime), accountStatus: active/suspended/blocked, customerScore, paymentRating |
| `ledgerTransactions` | تۆماری گشتی هەموو جوڵە داراییەکان (unified ledger) | transactionNumber unique (TXN-YYYYMMDD-NNNN), transactionType (14 enum: DEBIT_PACKAGE/FULL_PACKAGE/PURCHASE_REQUEST/COMMISSION/SERVICE/PENALTY/OTHER + CREDIT_PAYMENT/DEPOSIT/REFUND/DISCOUNT/OTHER + ADJUSTMENT_DEBIT/CREDIT), amountUsd/Iqd, exchangeRate, balanceBefore/After (USD/IQD), referenceType+referenceId, invoiceId |
| `paymentRecords` | وردەکاری پارەدانەکان | paymentNumber unique (PAY-YYYYMMDD-NNNN), amountUsd/Iqd, **reversedAmountUsd / reversedAt / reversalTransactionId** (advance payment reversals), paymentMethod: CASH/BANK_TRANSFER/FIB/FASTPAY/ZAINCASH/ASIAHAWALA/CARD/OTHER, paymentStatus: pending/confirmed/cancelled/refunded |
| `creditAdjustments` | ڕێکخستنی دەستی balance | adjustmentType: increase_debt/decrease_debt/write_off, approvalStatus: pending/approved/rejected |
| `paymentReminders` | بیرخستنەوەی پارەدان بۆ قەرزدار | reminderType: sms/whatsapp/email/call, scheduledAt, sentAt, customerResponse, promisedPaymentDate, promisedAmount |
| `invoices` | فاکتور | invoiceNumber unique, customerId, packageId, batchId, subtotalUsd, taxUsd, totalUsd, totalIqd/Rmb, status: draft/issued/paid/partially_paid/cancelled/refunded, lineItems (JSON), pdfUrl |
| `invoiceTemplates` | شێوازی فاکتور | style: modern/classic/minimal, company info (3 langs), logo, colors (primary/secondary/accent/text/bg), bank details (×2 for dual currency), terms/footer (3 langs) |
| `exchangeRates` | نرخی گۆڕینەوەی دراو | baseCurrency (default USD), targetCurrency, rate, source: api/manual, isManualOverride |
| `expenses` | مەسروفەکانی کۆمپانیا | categoryId, amount, currency: USD/IQD, exchangeRate, amountUsd, expenseDate, paymentMethod, isRecurring, recurringDay, vendor, receiptUrl, cashAccountId |
| `expenseCategories` | پۆلی مەسروفەکان | nameEn/Ar/Ku, icon, color, isRecurring |
| `partners` | شەریکانی کۆمپانیا | name, ownershipPercentage, initialCapital, currentBalance, joinDate |
| `partnerTransactions` | جوڵەی پارەی شەریکان | transactionType: capital_contribution/profit_share/withdrawal/loan_to_company/loan_repayment/adjustment, periodMonth/Year, amount/Usd, balanceBefore/After |
| `companyDebts` | قەرزی کۆمپانیا (لای دەرەکیی) | creditorName, creditorType: personal/bank/supplier/other, principalAmount, interestRate, totalAmount, paidAmount, remainingAmount, installmentCount, installmentAmount, status: active/paid/overdue/restructured |
| `debtPayments` | پارەدانی قەرزی کۆمپانیا | debtId, amount, principalPaid, interestPaid, cashAccountId |
| `cashAccounts` | حسابی نەقد و بانک | accountType: cash/bank/mobile_wallet, bankName, accountNumber, currency, currentBalance, isPrimary |
| `cashTransactions` | جوڵەی پارە لە حسابەکان | transactionType (10 enums), amount, balanceBefore/After, relatedAccountId (transfers), relatedEntityType+Id |
| `financialPeriods` | ماوە دارایی (مانگ/چارەک/ساڵ) | periodType, year, month, quarter, totalRevenue, packageRevenue, fullPackageRevenue, totalExpenses, grossProfit, netProfit, status: open/closed/locked |
| `revenueRecords` | تۆماری داهات | revenueType (7 enums)، amountUsd/Iqd, costUsd, profitUsd, referenceType+Id, customerId |
| `dailyFinancialSummary` | پوختەی دارایی ڕۆژانە | summaryDate unique, totalRevenue/Expenses, breakdown by source, cashIn/Out, netCashFlow, totalReceivables/Payables, isFinalized |
| `expenseAlerts` | ئاگادارکردنەوەی مەسروفات | alertType: daily/weekly/monthly/per_transaction, thresholdAmount, categoryId (optional), notifyMethod |
| `expenseAlertLogs` | تۆماری ئاگادارکردنەوەکان | alertId, totalExpenses, periodStart/End, expenseCount, notificationSent |

### 🛍️ 4.4 فول پاکێج و کڕینی تایبەت (Full Package & Commission)

| Table | Purpose | Key fields |
|-------|---------|-----------|
| `suppliers` | فرۆشیارانی چینی | name/Ar/Cn, contactPerson, wechatId, platform: 1688/taobao/alibaba/pinduoduo/other, platformShopUrl, rating, totalOrders, totalSpentUsd |
| `fullPackageOrders` | داواکاری کاڵا | orderCode unique (FP-XXXXX), orderType: **full_package** (we buy & resell) / **purchase_request** (customer requests via portal) / **commission** (we buy for customer with fee), productName/Link/Image(s)/Description, quantity, color, size, productType, supplierId, supplierTrackingNumber, supplierOrderNumber, **resale pricing:** purchasePriceUsd/Cny + sellingPriceUsd, **commission pricing:** itemPriceUsd/Cny + commissionFeeUsd + totalPrepaidUsd, **advance payment:** advancePaidUsd / advancePaidAt / advancePaymentMethod / advancePaymentTransactionId, isPrepaid/prepaidAt, gross/netProfit, shippingType, weightKg, volumeCbm, dimensions, totalCostUsd, paidFromBalanceUsd, remainingBalanceUsd, **isCharged / chargedAt / isShippingCharged / shippingChargedAt** (separate charge for commission shipping), trackingNumber + trackingNumbers (JSON for multi-carton), expectedDeliveryDate, qualityCheckStatus, returns (isReturned/returnReason/returnStatus/refundAmount), **status enum (18 states)** including `pending_quote`, `quoted`, `rejected` for purchase requests, `in_china_warehouse`, `quality_check`, `in_batch`, `in_transit`, `arrived`, `ready_for_delivery`, `delivered`, `cancelled`, `refunded`, `returned`. **Safe edit/delete infra (Plan v3, Phase 1):** `chargeTransactionId` (FK to ledger DEBIT for atomic reversal), `version` (optimistic concurrency), `deletedAt/deletedById/deletionReason` (soft delete) |
| `fullPackageStatusHistory` | مێژووی گۆڕانی بارودۆخی فول-پاکێج | previousStatus, newStatus, changedByName, metadata |
| `fullPackageOrderTrackings` | چەند tracking number بۆ یەک ئۆردەر (هەمان کارتۆن) | trackingNumber + cartonIndex (NOT unique) |

### 🛎️ 4.5 خزمەتگوزاری و کاڵا (Services & Inventory)

| Table | Purpose | Key fields |
|-------|---------|-----------|
| `serviceTypes` | جۆرەکانی خزمەتگوزاری | nameEn/Ku/Ar, icon, color, defaultCost/Price, requiresCustomer, addToCustomerBalance, **showOnPortal**, portalDescription/Badge/PriceLabel (4 langs) |
| `extraServices` | خزمەتگوزاری بۆ کڕیار | serviceNumber unique (SRV-YYYY-NNNN), serviceTypeId, costAmount, priceAmount, profitAmount, currency: USD/IQD/CNY, paymentMethod: cash/card/transfer/balance, addedToBalance, ledgerTransactionId, invoiceId |
| `productCategories` | پۆلی کاڵا (clothing, medical, shoes, …) | nameEn/Ar/Ku, icon, color |
| `productAttributes` | ڕەنگ، قەبارە، جۆری کاڵا | type: color/size/productType, value, sortOrder |
| `labelTemplates` | شێوازی لەیبڵی پاکەت | size: 10x15/10x10/A6/A5/custom, QR/Barcode toggles, logo, fields toggles (15+) |
| `batchLabelTemplates` | شێوازی لەیبڵی باچ | similar to labelTemplates but per-customer in batch |
| `stockCategories` | پۆلی stock | parentId (subcategories), slug unique |
| `stockProducts` | کاتالۆگی کاڵای ستۆک | sku/barcode unique, names (4 langs), categoryId, costPrice/sellingPrice/minSellingPrice, currentStock/reservedStock/availableStock, minStockLevel, maxStockLevel, reorderQuantity, weight/dimensions, defaultSupplierId |
| `stockPurchases` | کڕینی ستۆک لە فرۆشیار | purchaseCode unique (PO-YYYY-NNNN), supplierId, status: draft/ordered/shipped/received/cancelled, currency, paymentStatus |
| `stockPurchaseItems` | لاینێکانی کڕینی ستۆک | productId, orderedQuantity, receivedQuantity, unitCost |
| `stockSales` | فرۆشتنی ستۆک | saleCode unique (SO/POS-YYYY-NNNN), saleType: account/cash, customerId optional, paymentMethod, addedToLedger |
| `stockSaleItems` | لاینێکانی فرۆشتن | productId, productName/Sku (denormalized), quantity, unitPrice/Cost, profit |
| `stockMovements` | جوڵەی ستۆک | movementType (9 enums)، quantity (signed)، stockBefore/After، unitCost، referenceType+Id+Code |
| `blogPosts` | پۆست/ئاگادارکردنەوە بۆ پۆرتاڵ | title/content/summary (3 langs)، coverImageUrl، category: announcement/news/promotion/update/guide، status: draft/published/archived، slug unique، viewCount |

### ⚙️ 4.6 ڕێکخستنەکان (Settings)

| Table | Purpose |
|-------|---------|
| `countries` | وڵاتەکان (6-language names + isoCode + isOrigin/isDestination flags) |
| `warehouses` | کۆگاکان (6-language names، warehouseType: air/sea/custom، codePrefix، expectedDelivery min/max، pricingModel: per_kg/per_cbm) |
| `pricingRules` | یاسای نرخدان (origin/destination، shippingType، pricePerUnit، unit: kg/cbm، effectiveFrom/To، **portal toggles** showOnPortal + portalLabel/Icon/Color/Badge/SortOrder × 4 langs) |
| `portalPriceListSettings` | ڕێکخستنی لیستی نرخی پۆرتاڵ (یەک ڕیز، id=1)؛ titles/subtitles × 4 langs، layoutVariant: tabs/stacked/compact، position، showShippingRates/Services/Rmb/Iqd، disclaimer × 4 langs |
| `systemSettings` | key-value store گشتی |
| `notificationSettings` | per-event notification config (email/sms/whatsapp toggles + WhatsApp API config) |
| `currencies` | دراوەکان + exchange rate to base |
| `taxRates` | نرخی باج (VAT, …) |
| `emailTemplates` | شابلۆنی ئیمەیڵ (HTML + variables) |
| `ipWhitelist` | IPی ڕێگەپێدراو |

### 🔐 4.7 سیستەم و ئادمین (System & Admin)

| Table | Purpose |
|-------|---------|
| `auditLogs` | تۆماری هەموو جوڵەکان (action، actionLabel، category enum، entityType، entityId، oldValues/newValues/changedFields، ipAddress، userAgent) |
| `permissions` | per-user × module: canView/canCreate/canEdit/canDelete |
| `subPermissions` | per-user × module × permissionKey (granular toggles لەگەڵ shared/permissions.ts) |
| `notificationLogs` | تۆماری ئیمەیڵ/SMS/WhatsApp ناردراو |
| `scheduledTasksLog` | بەکارهێنانی cron jobs |
| `customerMessages` | چاتی نێوان کڕیار و کارمەند |
| `scanHistory` | پوختەی هەموو سکانەکان |
| `deletionLogs` | تۆماری سڕینەوەکانی گەورە |
| `backups` | تۆماری backup فایلەکان (database/files/full، manual/scheduled، S3 + local) |

---

## 🔌 ٥. tRPC Routers (API Layer)

سەرجەم: **١٤ ڕاوتەر** کە تێکڕا ٢٥٠+ پرۆسیجەری دیکە دارن.

### 5.1 `auth.router.ts`
- `staffLogin`, `customerLogin`, `logout`, `me`, `changePassword`
- ئەدمین: `registerStaff`, `getStaffList`, `resetStaffPassword`, `toggleStaffStatus`, `deleteStaff`

### 5.2 `customers.router.ts`
- `list`, `getById`, `create`, `update`, `delete` (admin)، `resetPassword`، `getBalance`، `getLedger`، `uploadDocument`، `deleteDocument`، `getByCustomer`

### 5.3 `batches.router.ts`
- `list`, `getActive`, `getById`, `getPackages`, `create`, `update`, `updateStatus`, `reprocessInvoicing`
- نرخدان: `getByShippingType`, `getPricingTiers`, `getCustomerPricing`, `listAllCustomerPricing`, `calculateCustomerPrice`
- ڕاپۆرت: `getFinancialSummary`, `getCustomerPackages`, `generateFinancialPDF`

### 5.4 `packages.router.ts`
- `list`, `getById`, `getByCode`, `getByCustomer`, `getByStatus`, `register`, `update`, `updateStatus`, `delete`, `assignToBatch`
- بێ-خاوەن: `getUnclaimed`, `getUnclaimedCount`, `claimPackage`, `getClaimRequests`, `approveClaimRequest`, `rejectClaimRequest`, `getPendingClaimRequestsCount`
- سکان: `verifyQr`, `lookupTracking`, `recentPackages`, `stats`, `getCbmDivisor`, `setCbmDivisor`

### 5.5 `invoices.router.ts`
- `list`, `getById`, `getByCustomer`, `create`, `update`, `delete`, `generatePDF`
- شابلۆن: `getDefault`, `setDefault`, `ensureDefault`

### 5.6 `finance.router.ts` (3247 lines DB layer!)
- ئەکاونت: `getOrCreateAccount`, `getAccountByCustomer`, `getAllAccounts`, `getAccountBreakdown`, `validateAccount`, `validateAllAccounts`, `repairAccount`
- جوڵە: `getTransactions`, `getRecentTransactions`, `addTransaction`, `recordCharge`, `recordPayment`
- پارەدان: `getPayments`, `generatePackageInvoice`, `generatePaymentReceipt`
- قەرزدار: `getDebtors`, `getTotalDebt`, `getInvoices`, `getInvoice`, `getSummary`
- بیرخستنەوە: `createReminder`, `getPendingReminders`
- نرخی دۆلار: `getCurrent`, `list`, `create`, `update`, `delete`, `listActive`, `toggle`
- لۆگ: `logs`

### 5.7 `fullPackage.router.ts` (1688 lines!)
- بنەڕەت: `list`, `getById`, `getStats`, `create`, `bulkCreate`, `update`, `delete`, `updateStatus`
- ئۆپەرەیشن: `assignToBatch`, `chargeShippingCost`, `splitShippingCost`, `markReturned`, `updateQualityCheck`
- ترەکینگ: `addOrderTrackings`, `getOrderTrackings`, `removeOrderTracking`, `getOrdersByTracking`, `getOrdersPendingTracking`, `getOverdueOrders`, `getOrdersByAlertLevel`, `getTrackingAlertStats`, `processAlerts`
- عمولە: `createCommissionOrder`
- پۆرتاڵ: `getMyOrders`, `getMyPurchaseRequests`, `approveQuote`, `rejectQuote`, `quoteOrder`
- ڕاپۆرت: `getProfitSummary`, `getProfitByCustomer`, `getProfitBySupplier`, `getProfitByOrderType`, `getProfitReport`, `getMonthlyProfitReport`, `getDeliveryTimeReport`, `getReturnsReport`, `getProfitSummaryByType`, `getSupplierTrackingPerformance`, `getAggregatedProfitAndExpenses`
- مۆدێل: `getCustomerPendingOrders`, `getStatusHistory`

### 5.8 `portal.router.ts`
- کڕیار: `getMyAccount`, `getMyBalance`, `getMyTransactions`, `getMyInvoices`, `getMyFinancialSummary`, `getMyPackages`, `getMyBatches`, `getMyPackagesInBatch`, `getMyUnbatchedPackages`, `getMyFullPackageOrders`, `getMyFullPackageOrderDetail`, `getMyPendingOrders`
- بێ-خاوەن: `getUnclaimedPackages`, `createClaimRequest`, `getMyClaimRequests`
- پەیام: `getMyMessages`, `sendMessage`, `markMessagesAsRead`, `getUnreadMessageCount`
- ئاگادارکردنەوە: `getMyNotifications`, `markNotificationAsRead`, `markAllNotificationsAsRead`, `getNotificationCount`, `getUnreadNotificationCount`
- ناونیشان: `getMyAddresses`, `createAddress`, `updateAddress`, `deleteAddress`, `setDefaultAddress`
- گەڕان: `searchPackage`, `getPackageDetails`, `getReceiptData`
- نرخ: `getPriceList` (publicProcedure)
- ئەدمین: `getSettings`, `updateSettings`, `listShippingRatesWithMeta`, `updatePricingRulePortalFields`, `listServicesWithMeta`, `updateServiceTypePortalFields`

### 5.9 `services.router.ts`
- خزمەتگوزاری: `list`, `getById`, `getByCustomer`, `getUnpaid`, `create`, `update`, `delete`, `markAsPaid`, `getSummary`, `getBatches`, `getPackages`
- جۆرەکان: `getServiceTypes`, `getActiveServiceTypes`, `createServiceType`, `updateServiceType`, `deleteServiceType`
- بلۆگ (مەرکوریجی): `published`, `featured`, `getBySlug`, `getById` (public)، `getByCategory`, `create`, `update`, `delete`, `uploadCoverImage`, `upload`

### 5.10 `scanning.router.ts` (سکانی هۆشمەند + AI + delivery boxes)
- سکان: `scan`, `smartScan`, `record`, `register`, `quickRegisterPackage`, `searchByTracking`, `searchTrackingAllTypes`, `findCustomerByCode`, `detectCarrier`, `getMissingInfo`
- AI (LLM-powered): `aiScanLabel`, `aiOcr`, `aiAnalyzePackage`, `aiTranslate`, `aiExtractPackageInfo`
- بۆکس: `getOpenBoxes`, `create`, `addItem`, `removeItem`, `getItems`, `getById`, `seal`, `markInTransit`, `markDelivered`, `cancel`, `update`, `list`, `createBoxesForBatch`, `generate`
- inline edits: `updatePackageInline`, `updateFullPackageInline`
- ئامار: `myRecentScans`, `todayScans`, `todayStats`, `todaySummary`, `getDailySummary`, `getMonthlySummary`, `statistics`, `scanAnalytics`, `getStatsByDateRange`, `getByDateRange`, `getByEmployee`, `getByPackage`, `getStatusHistory`, `getTotalsByType`, `registerScan`

### 5.11 `settings.router.ts`
- وڵات: `list`, `getById`, `getByCountry`, `getOrigins`, `getDestinations`, `create`, `update`, `delete`
- نرخ: `list`, `getApplicable`
- ڕێکخستن: `getSetting`, `setSetting`, `getAllSettings`, `getCompanyInfo`, `getPublicWebsiteInfo`, `seedDefaults`
- دراو: `getAllCurrencies`, `getActiveCurrencies`, `createCurrency`, `updateCurrency`, `deleteCurrency`
- باج: `getAllTaxRates`, `getActiveTaxRates`, `createTaxRate`, `updateTaxRate`, `deleteTaxRate`
- شابلۆنی ئیمەیڵ: `getAllEmailTemplates`, `getEmailTemplateByName`, `createEmailTemplate`, `updateEmailTemplate`, `deleteEmailTemplate`
- IP: `getAllIpWhitelist`, `getActiveIpWhitelist`, `addIpToWhitelist`, `removeIpFromWhitelist`, `isIpWhitelisted`

### 5.12 `admin.router.ts` (1346 lines — هەمە جۆر)
- داشبۆرد: `financialStats`, `revenueChart`, `profitLossChart`, `recentActivity`, `topDebtors`, `newCustomers`, `activeBatches`
- بەکارهێنەران: `list`, `getById`, `create`, `update`, `updateRole`, `delete`
- پەرمیشن: `checkPermission`, `checkSubPermission`, `setPermission`, `setSubPermission`, `getUserPermissions`, `bulkUpdate`, `deletePermissions`
- ئۆدیت: `getByEntity`, `list`, `getStats`, `getFilters`
- backup: `list`, `create`, `restore`, `delete`, `getScheduleConfig`, `updateSchedule`, `run`
- داتا: `getCounts`, `getDetailedCounts`, `getDeletionLogs`, `deleteOldData`, `deleteAll{Customers/Packages/Batches/Invoices/Payments/Suppliers/FullPackages/Scans/StatusHistory/AuditLogs/LedgerTransactions/Expenses/BlogPosts}`, `resetAllData`, `exportAllData`, `importAllData`, `exportCategory`, `importCategory`, `getDeletionPreview`, `createDeletionLog`, `getResetHistory`
- PDF: `exportPDF`, `exportFilteredPDF`, `exportBatchPDF`, `exportCustomerPDF`
- پەیامی کڕیار: `getConversations`, `getMessages`, `sendReply`, `getUnreadCount`, `markAllAsRead`, `markAsRead`, `getMyChats`, `getOrCreateChat`, `getChatById`, `sendMessage`, `getAllChats`, `updateChatStatus`
- ئاگادارکردنەوە: `alerts`, `getSettings`, `updateSetting`, `saveWhatsappConfig`
- پۆرتاڵی landing: `getLandingPageVariant`, `getLandingTeam`, `getLandingTheme`, `getPortalTheme` (هەموو public)

### 5.13 `reports.router.ts`
- `packageStats`, `packagesByStatus`, `topCustomers`, `batchPerformance`, `timePeriodSummary`

### 5.14 `productAttributes.router.ts`
- `list`, `create`, `update`, `delete` (color/size/productType)

---

## 🔐 ٦. سیستەمی Auth و پەرمیشن

### Auth flow
- **Cookie-based session** (cookie name: `app_session_id`، `shared/const.ts`)
- JWT signed with `JWT_SECRET` لە `.env`
- Three login methods:
  1. **Username/password** (staff)
  2. **Mobile/password** (staff or customer)
  3. **Manus OAuth** (لە ڕێگەی `openId`)
- **Session expiry:** STAFF_SESSION_EXPIRY (24h default)، CUSTOMER_SESSION_EXPIRY (7d default)
- **Bcrypt rounds:** 12 (configurable)

### tRPC procedures (server/_core/trpc.ts)
- `publicProcedure` — هیچ auth ێک ناویست
- `protectedProcedure` — پێویستە user ئەوی هەبێت (staff or customer)
- `adminProcedure` — تەنها `admin` یان `super_admin`
- `staffProcedure` — تەنها staff (هەموو role کان جیا لە customer) — لە پشت پەردە `protectedProcedure` + check role
- `customerPortalProcedure` — تەنها کڕیار (`isCustomer: true`)

### TrpcContext
```ts
{ req, res, user: ContextUser | null, logger: AppLogger }
```
`ContextUser = StaffUser | CustomerUser`. هەمیشە له `createContext` ێ لە `sdk.authenticateRequest(req)` دێت.

### Permissions (granular)
- `permissions` table: per-user × module با `canView/canCreate/canEdit/canDelete`
- `subPermissions` table: per-user × module × permissionKey (e.g., `view_financial_info`, `edit_prices`)
- `shared/permissions.ts` — تەواوی `PERMISSION_GROUPS` پێناسە کراوە کە هاوبەشی sidebar (10 گرووپ، 50+ مۆدۆڵ):
  1. `main` — dashboard, customers
  2. `operations` — packages, quick_register, bulk_register, batches, unclaimed_packages, claim_requests
  3. `fullPackage` — unified_orders, full_package, commission, suppliers, tracking_alerts
  4. `scanning` — scan_quick_register, batch_assignment_scanner, arrival_verification, customer_delivery_scanner, scan_dashboard, scan_reports
  5. `customerFinance` — finance_management, invoices, debtors_report, debt_reminders
  6. `companyFinance` — company_dashboard, balance_sheet, bank_accounts, expenses, expense_alerts, partners, treasury, company_debts
  7. `services` — all_services, service_types
  8. `reports` — reports_overview, batch_reports, service_reports, profit_dashboard, monthly_profit, profit_by_type, scan_reports_page, invoice_reports, business_analytics
  9. `settings` — system_settings, countries, warehouses, vip_customers, product_categories, pricing_config, customer_code_prefixes
  10. `users` — users_list, ...

---

## 🎨 ٧. UI/UX پاتەرنەکان (Frontend Patterns)

### Component reuse
- **Dashboard barrel:** `@/components/dashboard` ـ هاوردە بکە لە یەک شوێن: `DashboardHero`, `StatsCard`, `FinancialCard`, `ChartContainer`, `DashboardSection`
- **Reports barrel:** `@/components/reports` بۆ بەشە یەکگرتووەکان (PackageOverviewSection, FinancialMetricsSection, RevenueProfitChartsSection, BatchPerformanceSection, CustomerAnalyticsSection, ScanningActivitySection, FullPackageServicesSection, QuickLinksSection)
- **shadcn/ui:** هەموو `client/src/components/ui/*.tsx` — ratio: استفاده بکە، نووسین نا.
- **PageHeader:** `@/components/layout/PageHeader` بۆ سەرەوە یەکگرتووی پەڕە.

### i18n usage
```tsx
import { useTranslation } from "@/contexts/LanguageContext";
const { t, language, direction, isRTL } = useTranslation();
t("nav.dashboard");                    // simple key
t("errors.minLength", { min: 8 });     // params
```
- چوار زمان: `ku` (default, RTL), `en` (LTR), `ar` (RTL), `zh` (LTR)
- کلیلەکان لە `client/src/locales/{ku,en,ar,zh}.json`
- بۆ RTL: بەکار بهێنە `me-2` / `ms-2` لە جیاتی `mr-2` / `ml-2` (logical properties)

### Routing (Wouter)
- 110+ route لە `App.tsx`
- هەموو پەڕەکان `lazy()` لۆد دەبن
- `Suspense` لەگەڵ `LoadingSkeleton`
- `ErrorBoundary` + `QueryErrorBoundary` بۆ ئاسایش
- `MutationToastHandler` گلۆباڵ بۆ نیشاندانی toast لەسەر هەموو mutation

### Theming
- **3 theme contexts:**
  - `ThemeContext` بۆ admin app
  - `PortalThemeContext` بۆ پۆرتاڵی کڕیار
  - `LandingThemeContext` بۆ پەڕەی فڕۆکە
- بنکە: `next-themes` بۆ light/dark/system
- Tailwind CSS variables (primary, muted, success, destructive, …) بەکاردێن لە چارت و کارتەکان

### Charts (Recharts)
- بۆ dark mode: tooltipy `contentStyle` بەکار بێنە لەگەڵ CSS custom properties
- مەنوای ئاسایی: `<ChartContainer>` لە `@/components/dashboard`

### Three portal skins
- `PortalHome.tsx` — کلاسیک
- `client/src/pages/portal/modern/` — مۆدێرن
- `client/src/pages/portal/skin3/` — skin سێیەم
- وەرگیراو لە `PortalThemeContext`

---

## 🔄 ٨. فلۆکانی کاری گرنگ (Critical Business Flows)

### 8.1 پاکەتی ئاسایی (Regular Package)
1. **تۆمارکردن** (`/packages/quick-register` یا `/packages/bulk-register`) — staffProcedure `packages.register`
2. سکانی **`registered`** → packageScans + packageStatusHistory
3. **`received_china`** سکان لە کۆگای چین
4. باچ دروست دەکرێت (`/batches`) — `batches.create`
5. پاکەت بۆ باچ تەرخان دەکرێت — `packages.assignToBatch` (status → `in_batch`)
6. باچ دەنێرێت (`updateStatus` → `in_transit`)
7. لە کۆگای ناوخۆ (Erbil) سکانی **`received_local`**
8. سکانی **`out_for_delivery`**
9. سکانی **`delivered`** + signature/photo
10. خۆکارانە: charge بۆ ledger + invoice دروست دەکرێت

### 8.2 فول-پاکێج (Full Package — کۆمپانیا کڕی و دەفرۆشێ)
1. کارمەند ئۆردەر دروست دەکات (`/full-package/new`) — `fullPackage.create` با `orderType: full_package`
2. کاتی پێویست: `purchasePriceUsd/Cny` (نرخی کڕینی ئێمە) + `sellingPriceUsd` (نرخی فرۆشتن بۆ کڕیار)
3. فرۆشیار (`supplierId`) بەخۆکارانە لینک دەکرێت
4. ترەکینگی فرۆشیار زیاد دەکرێت (`fullPackageOrderTrackings` — یەک ئۆردەر دەتوانێ چەند ترەکینگی هەبێت چونکە چەند کارتۆن)
5. status لە `pending` → `approved` → `ordered` → `tracking_added` → `in_china_warehouse` → `quality_check` → `in_batch` → `in_transit` → `arrived` → `ready_for_delivery` → `delivered`
6. کاتی `delivered`: charge to ledger با sellingPriceUsd
7. **ledger:** `chargeTransactionId` تۆمار دەکرێت بۆ safe edit/delete

### 8.3 Purchase Request (کڕیار داوا دەکات لە پۆرتاڵ)
1. کڕیار لە پۆرتاڵ (`/portal/full-package`) داوا دەکات — `fullPackage.create` با `orderType: purchase_request` و `status: pending_quote`
2. کارمەند `quoteOrder` — نرخ بۆ ئۆردەر دادەنێ → `status: quoted`
3. کڕیار `approveQuote` (status → `approved`) یا `rejectQuote` (status → `rejected`)
4. ئەگەر approved، فلۆی فول-پاکێج بەردەوام دەبێت

### 8.4 عمولە (Commission — کڕیار کاڵا دەناسێت، ئێمە دەکڕین لە ڕیی فی)
1. کارمەند `createCommissionOrder` — orderType: `commission`
2. **ئاگاداری:** `itemPriceUsd` (نرخی ڕاستی کاڵا — کڕیار دەزانێت) + `commissionFeeUsd` (کرێی ئێمە)
3. کاتی دروستکردن، `totalPrepaidUsd = itemPriceUsd + commissionFeeUsd` تۆمار دەبێت — کڕیار **پێشەکی پارە دەدات**
4. **`advancePaidUsd`** پارەی پێشەکی تۆمار دەکرێت (دەکرێت partial بێت)
5. کاتێک کاڵا گەیشت + کڕایوە لای ئێمە، **shipping cost** جیا charge دەکرێت لە کڕیار (`isShippingCharged` / `shippingChargedAt` / `shippingChargedUsd`)
6. delivery boxí جیاوازە بۆ commission ئایتمەکان (`itemType: commission` لە `deliveryBoxItems`)

### 8.5 پارەدان (Payment)
1. کارمەند `finance.recordPayment` (یا `addTransaction`)
2. paymentNumber: `PAY-YYYYMMDD-NNNN`
3. ledgerTransaction درست دەکرێت با type `CREDIT_PAYMENT`
4. `customerAccount.currentBalanceUsd/Iqd` نوێ دەبێتەوە
5. `cashAccount.currentBalance` ئەگەر بانک/نقد بێت نوێ دەبێتەوە (`cashTransactions`)
6. invoice ـی پەیوەست `status: paid` یا `partially_paid`
7. **Reversal:** ئەگەر payment ێک reverse کرا، `reversedAmountUsd / reversedAt / reversalTransactionId` تۆمار دەکرێت — لاینی نا-سڕاوە چونکە audit trail بپاراست

### 8.6 ئامار/ڕاپۆرتی قازانج
- **چەند داشبۆرد:**
  - `/profit-dashboard` — کوردی کۆ
  - `/profit-by-type` — بەپێی شیپینگ تایپ
  - `/reports/unified-profit` — هەموو سەرچاوەکان
  - `/reports/monthly-profit` — مانگانە
- داهات: `revenueRecords` + باچ + فول-پاکێج + خزمەتگوزاری
- مەسروف: `expenses` (بە بەرواری مەسروف، نەک بەرواری دروستکردن)
- **پەیامی گرنگ لە docs:** ئەگەر داشبۆرد سفر نیشان دەدات، چونکە بەکاری filter ی period ـی هەڵە (`createdAt` لە جیاتی `expenseDate` و …)

### 8.7 Delivery Box (بۆکسی گەیاندن)
1. کاتی delivery، چەند پاکەت لە سەرچاوە جیاواز (regular + full_package + commission) بۆ کڕیارێک کۆ دەکرێنەوە لە یەک بۆکسدا
2. boxCode: `BOX-YYYYMMDD-NNN`
3. status: `open` → `ready` → `in_transit` → `delivered` (or `cancelled`)
4. بۆ هەر ئایتم snapshot لە packageInfo لە `deliveryBoxItems`
5. signature + photo کاتی delivered
6. delivery cost (ئێمە دەدەین) و delivery charge (لە کڕیار وەردەگرین) و profit

---

## 🔧 ٩. Pattern های ئەنجامێ نەبەرچاو (Hidden Patterns)

### Frontend
1. **Pagination shape inconsistency:** `trpc.batches.list` paginated `{ data, total, page, pageSize }` ـە، بەڵام هەندێ ڕاوتەری تر array ساکارن. کۆد بایی بایی هەردووکی بپشکنێت.
2. **Service field names:** بەکار بێنە `nameEn`/`nameKu`/`defaultPrice` — **نەک** `code`/`basePrice`. کۆدی کۆن ئاهەنگی هەڵە دەکات.
3. **Translation hook return:** `useTranslation()` چوار شت دەگەڕێنێتەوە: `{ t, language, direction, isRTL }`.
4. **CSS logical properties for RTL:** `me-2` (margin-end-2), `ms-2` (margin-start-2), هەروەها `ps-`, `pe-`. **نا** `mr-`/`ml-` (مەگەر بۆ ٤ زمان نەبێت).
5. **Pre-existing TS errors:** ErrorBoundary, ArrivalVerificationScanner و چەند فایلی تردا TypeScript ئەرۆرە. مەرسەن بکە ئەوانە fix بکەی مەگەر بەخۆیان بێنە سەر ڕێگاکەت.
6. **Scanner modules:** پێناسەی `client/src/constants/scannerModules.ts` ـە. هەر سکانێر مۆدۆڵ نوێ لێرەوە ڕاوێژ بکە.

### Backend
1. **`ledgerTransactions` is THE unified ledger** — `ledgerEntries` ی کۆن سڕاوەتەوە. هەر transaction (DEBIT یا CREDIT) لێ بنووسە.
2. **Soft-delete + version + chargeTransactionId** لە `fullPackageOrders`:
   - **ئاسوودەی ledger:** کاتی edit یا delete، `chargeTransactionId` بۆ گەڕانەوەی DEBIT اصلی بەکار دێت — هیچ کات guess مەکە.
   - **Optimistic concurrency:** UI version دەنێرێت؛ ئەگەر database version جیاوازە، 409 Conflict.
   - **Soft delete:** هیچ هاردنە سڕینەوە. هەموو query کان `WHERE deletedAt IS NULL`.
3. **Audit log everywhere:** هەر create/update/delete بنووسەرەوە بۆ `auditLogs` لەگەڵ `oldValues`/`newValues`/`changedFields`.
4. **Idempotency کلیلی unique:** `transactionNumber`, `paymentNumber`, `invoiceNumber`, `boxCode`, `orderCode`, `serviceNumber`, `requestNumber` — هەموو unique و pattern ـی دیاریکراویان هەیە.
5. **Multi-tracking per order:** `fullPackageOrderTrackings.trackingNumber` **NOT unique** چونکە چەند ئۆردەر دەکرێ هەمان tracking number لە کارتۆنێکدا هاوبەش بکەن.
6. **CBM divisor setting:** dim-weight calculation بۆ پاکەت — `packages.getCbmDivisor` / `setCbmDivisor`. `(L × W × H) / divisor` = volumetric weight.
7. **Tiered pricing:** بۆ `air_irregular` و `sea` `useTieredPricing: true` — `batchPricingTiers` چاو لێبکە. بۆ `air_regular` نرخێکی فلات `pricePerKg`.

### Migration
- ٧٠+ migration فایل لە `drizzle/`. هیندێ migration دووچار بوونە (number ـی دووجار) چونکە دوو developer سەربەخۆ تێکیان شێواوە — وردبە. **ENV variable** `MIGRATION_SECRET` پێویستە بۆ endpoint ـی `POST /api/run-migration`.

---

## 🛡️ ١٠. ئاسایش (Security)

### Server
- helmet (CSP لە production فعالە)
- CORS — تەنها `ALLOWED_ORIGINS` پێشتر دیاریکراو
- express-rate-limit — `globalLimiter` + `authLimiterMiddleware` بۆ login (سترایکی توندتر)
- IP whitelist (`ipWhitelist` table) — اختیاری
- bcrypt 12 rounds
- JWT با expiry محدود
- Migration endpoint با secret-protected

### Sensitive (نابێ تێکدرێ)
- هەرگیز `.env` کۆممیت مەکە
- هەرگیز پاسوۆرد لە log یا audit نەبینێ (newValues/oldValues filter بکە)
- هەرگیز بازرگانیی pickup ئاسایش بێ-بایی نا
- IP whitelist بۆ admin actions توند بکە لە production

---

## 📚 ١١. خاڵە لاوازەکان و دەرفەتەکانی پێشخستن (Known Pain Points & Improvement Opportunities)

### Code-level
1. **`server/db/finance.db.ts`** — **3247 لاین!** خوێنەرەوە دەخوازێ refactor لە چەند فایل (accounts.db, transactions.db, payments.db, …).
2. **`server/db/admin.db.ts`** — 3522 لاین. هەمان شت.
3. **`server/db/reports.db.ts`** — 2267 لاین. SQL queryی پێچاوپێچ خۆیان دەخوازن abstraction.
4. **`server/routers/fullPackage.router.ts`** — 1688 لاین، 38 پرۆسیجەر. شایستەی feature-based split (orders.router, profit.router, tracking.router).
5. **`scanning.router.ts`** — 1196 لاین، 50+ پرۆسیجەر. کاری AI لەگەڵ scanning ـدا تێکەڵە — جیا بکەرەوە (`scanning.router` + `aiScanning.router`).
6. **`admin.router.ts`** — 1346 لاین، هەمە جۆر! data-management, audit, dashboard, messaging, theme، هەموو لێرە تێکەڵن.

### UX gaps (لە docs/)
- داشبۆردی دارایی کۆمپانیا گاهی سفر نیشان دەدات (period filter لە `createdAt` بەکار دێت لە جیاتی `expenseDate`/`saleDate`).
- پلانە چەند `*.md` لە `docs/` نووسراون بۆ refactor و UI پۆلیش بەڵام جێبەجێ نەکراون.
- لە چەند پەڕە (Quick Register, Profit reports, Reports dashboard) UI/UX ئاستێکی ناتەواوی هەیە — `docs/UI-UX-PROFESSIONAL-PLAN.md`, `docs/PROFESSIONAL-PAGES-GUIDE.md`.

### Architectural gaps
1. **هیچ E2E test ێک نییە** — تەنها vitest unit/integration. Playwright یا Cypress زۆر یارمەتیدەرە.
2. **Error tracking** — Sentry یا هاوشانی نییە.
3. **Caching layer** — `server/db/cache.ts` لە 50 لاین، تەنها in-memory. Redis ئەلتەرناتیڤ گەورە بۆ ledger و reports.
4. **Server-Sent Events (SSE)** — `usePortalSSE` هۆک هەیە بەڵام پلانێکی تەواوی realtime نییە. WebSocket یا upgraded SSE بۆ نوتیفکەیشن لە دەمۆ.
5. **Background job queue** — تەنها node-cron. BullMQ یا Trigger.dev بۆ jobs ـی گەرم باشترە (PDF generation, batch invoice processing, notifications).
6. **Multi-tenancy** — سیستەم تاکە-کۆمپانیایە. ئەگەر گرنگ بێت SaaS بکە، schema ـی پێویستە refactor بکات با `companyId` لە هەر table.
7. **Audit log query performance** — index هەن، بەڵام هەزار ڕیز قورس دەبن. archival strategy (move old to cold storage) پێویستە.

### Customer experience
1. **پۆرتاڵی کڕیار** سێ skin هەیە — کام راستی production ـە؟ یەکێکیان توندبکرێت.
2. **WhatsApp integration** — config کراوە بەڵام بە تەواوی فعال نییە لە production.
3. **AI features** — لە scanning router (aiScanLabel, aiOcr, aiAnalyzePackage, aiTranslate, aiExtractPackageInfo). نموونەی LLM کام؟ کۆست monitoring هەیە؟

---

## 🚀 ١٢. کاتی دەستپێکردن (How to start the system)

### Dev
```bash
pnpm install
# Copy .env.example to .env, fill DATABASE_URL, JWT_SECRET, MIGRATION_SECRET
pnpm db:push        # Run migrations
pnpm create-admin   # Create first super_admin
pnpm dev            # API + Vite client (HMR)
```
ـ سەرڤەر: `http://localhost:3500`
- Vite client: `http://localhost:5173`

### Production
```bash
pnpm build          # Vite build + esbuild server bundle
pnpm start          # NODE_ENV=production node dist/index.js
```

### کۆمەند سەرەکیەکان
- `pnpm check` — TypeScript type-check
- `pnpm test` — vitest
- `pnpm format` — prettier
- `pnpm db:push` — drizzle-kit generate + migrate

### ENV vars (`.env`)
- **پێویست:** `DATABASE_URL`, `JWT_SECRET`, `MIGRATION_SECRET`
- **اختیاری:** `PORT` (3500), `NODE_ENV`, `ALLOWED_ORIGINS`, `S3_BUCKET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `STAFF_SESSION_EXPIRY` (24h), `CUSTOMER_SESSION_EXPIRY` (7d), `BCRYPT_ROUNDS` (12), `DB_POOL_SIZE` (10), `VITE_APP_ID`, `OAUTH_SERVER_URL`

---

## 🎯 ١٣. پێشنیار بۆ پێشخستنی سیستەم (Strategic Recommendations)

### Quick wins (1–2 ڕۆژ)
1. **Refactor `finance.db.ts` و `admin.db.ts`** بە چەند فایلی بچوک — فایلی > 1000 لاین خراپە بۆ پاراستن.
2. **پەڕەی داشبۆردی دارایی کۆمپانیا fix بکە** بە بەکارهێنانی `expenseDate`/`saleDate`.
3. **TypeScript ئەرۆرە کۆنەکان** (ErrorBoundary، ArrivalVerificationScanner) بە یەک PR چارە بکە.
4. **Period filter یەکگرتوو** بکە لە هەموو ڕاپۆرتەکان — هۆک یەکگرتوو `useDateRangeFilter`.

### Medium term (1–2 هەفتە)
1. **`fullPackage.router.ts` و `scanning.router.ts` بپشکنە** بە چەند ڕاوتەری بچوک.
2. **Sentry integration** بۆ error tracking لە production.
3. **Redis caching** بۆ ledger queries و dashboard summary.
4. **Playwright E2E suite** بۆ سێ فلۆی سەرەکی: package register → batch → delivery، full package end-to-end، payment recording.
5. **WhatsApp integration یەکگرتوو** کرد بە چاکی.
6. **پۆرتاڵ skin یەکگرتوو** — یەکێک هەڵبژێرە و نوێ بکەرەوە.

### Long term (1+ مانگ)
1. **Multi-tenancy support** ئەگەر بازاری SaaS مەبەستە.
2. **Mobile app native** (React Native) بۆ scanning operations — نەک تەنها PWA.
3. **AI agent بۆ کارمەندان** — کاتی سکانێک لاوازە، چ بکەن. کاتی ئۆردەرێک overdue ـە، یارمەتی AI.
4. **Realtime collaboration** — کارمەند دوو دیار سکانیان دەکات هاوکات، realtime sync.
5. **Predictive analytics** — کام کڕیار لە دواییدا کاڵا کڕیوە، probability of next order.

---

## 📞 ١٤. Quick reference — هەموو شتێک لە یەک نێرەدا

### Tech versions
- React **19.2.1**, Vite **7.1.7**, TypeScript **5.9.3**
- tRPC **11.6.0**, React Query **5.90.2**
- Tailwind **4.1.14**, Drizzle **0.44.5**
- Node ≥ 18, pnpm 10
- MySQL 8

### File counts
- Schema files: **10**
- DB query files: **18**
- tRPC routers: **14**
- Pages: **110+**
- UI components: **53 (shadcn) + 50+ custom**
- Locales: **4 zmany x ~5500+ خاڵ**
- Migrations: **70+ SQL files**
- Server services: **15**
- Hooks: **17**

### Status enums (سەرەکی)
- **Package status:** registered, in_batch, in_transit, customs_processing, ready_for_delivery, out_for_delivery, delivered, returned, cancelled
- **Batch status:** preparing, in_transit, arrived, customs, delivered, closed
- **Full package status (18):** pending_quote, quoted, pending, approved, rejected, ordered, tracking_added, in_china_warehouse, quality_check, in_batch, in_transit, arrived, ready_for_delivery, delivered, cancelled, refunded, returned
- **Invoice status:** draft, issued, paid, partially_paid, cancelled, refunded
- **Account status:** active, suspended, blocked
- **Payment status:** pending, confirmed, cancelled, refunded
- **Box status:** open, ready, in_transit, delivered, cancelled

### Currency setup
- Base: **USD**
- Operating: **IQD** (Iraqi Dinar)
- Foreign: **CNY** (Chinese Yuan) بۆ نرخی فرۆشیار
- Customer balance لە دوو currency جیا (USD + IQD) دەپارێزرێت
- exchange rate قەناعن `exchangeRates` (manual or API)

### URL prefixes
- `/api/trpc/*` — هەموو procedures
- `/api/oauth/callback` — OAuth (Manus)
- `/api/run-migration` — secret-protected migration
- `/api/backup-file/:id` — admin-only backup download
- `/api/health/*` — load-balancer health checks

---

## 🤝 ١٥. سەرنج بۆ Claude/AI

### کاتی پرۆمپتداڵای دەرهێنەری
- **خاڵی فۆکەس:** ئەم سیستەمە operational، financial، logistics ـیە. هەموو suggestion پێویستە بزانێت impact ـی بانکی، invoicing، یا audit چی دەبێت.
- **MUST preserve:** ledger integrity (هەرگیز transaction سڕینەوە، تەنها reversal بنوسە)، audit logs، soft-delete patterns.
- **Naming conventions:** camelCase لە TS، snake_case لە MySQL columns (Drizzle خۆکارانە map دەکات), table name singular ـیشن (e.g., `users`, `customers`, `packages` — هەموو plural).
- **i18n ـی پێویست:** هەر UI string نوێ پێویستە لە چوار locale زیاد بکرێت.
- **RTL aware:** بۆ Kurdish/Arabic، logical CSS بەکار بێنە.
- **Permission check:** پێش هەر mutation، چاوی usePermissions / checkPermission / checkSubPermission بکە.
- **Type-safe end-to-end:** Zod schema لە input، Drizzle schema لە DB، tRPC ئاسانگاری دەکات. هەرگیز `any` نا.

### بۆ بەکارهێنەر (waznexe / Saman)
- زمانی سەرەکی: کوردی (RTL، RTL، RTL!)
- زمانی فەنی: Mix of Kurdish + English
- بەهەند کارکردن: docs/ folder ئەو پلانە کوردیە تێیدایە کە هەلاتانە ساڵە جێبەجێ نەکراون — پێنج لە کارمی نییە کە plan ـی هەواڵە تازە بنووسرێ، ئاوا فۆکەس بکە لە ENGINEERING.

---

**کۆتا نوسین:** ئەم میشکی سیستەمە بەرامبەرە لە **2026-04-30**. بۆ نوێکردنەوەی ئوتۆماتیکی، `git log --since=...` پشکنە، یا داوە بکە لە کارمەند.
