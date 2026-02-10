# پلانی داشبۆردی دارایی کۆمپانیا (P&L Dashboard)

## ئامانج
دروستکردنی داشبۆردێکی زۆر پرۆفیشناڵ بۆ شوێنگیری قازانج و زیان و تێچوو و داهات بە هەموو سەرچاوەکانەوە.

---

## بەشی ١: کارتەکانی سەرەکی (Summary Cards)

### ١.١ هێڵی یەکەم - ٤ کارتی گەورە

| کارت | ڕەنگ | ناوەڕۆک |
|------|------|---------|
| **کۆی داهات** | سەوز | کۆی هەموو داهاتەکان (باچ + فول پاکێج + عمولە + خزمەتگوزاری) |
| **کۆی تێچوو** | سوور | کۆی هەموو خەرجییەکان (گواستنەوە + کڕین + مووچە + کرێ + ...) |
| **قازانجی خاوێن** | ئاسمانی/سەوز | داهات - تێچوو = قازانج (یان زیان بە سوور) |
| **ڕێژەی قازانج** | مۆر | (قازانج ÷ داهات) × ١٠٠% |

---

## بەشی ٢: وردەکاری داهات بە سەرچاوە (Revenue Breakdown)

### ٢.١ قازانجی خاوێنی باچ (Batch Net Profit)
- **فۆرمولا**: `SUM(packages.calculatedCostUsd)` بۆ هەر باچێک - `batches.shippingCost`
- **مانا**: ئەو پارەیەی کڕیارەکان دەیدەن بۆ گواستنەوەی پاکەتەکانیان - ئەو تێچووەی ئێمە دەیدەین بۆ هەڵگر (carrier)
- **نیشاندان**: کۆی قازانج + ژمارەی باچ + نرخی مامناوەندی هەر کیلۆ

### ٢.٢ قازانجی خاوێنی فول پاکێج (Full Package Net Profit)
- **فۆرمولا**: `SUM(sellingPriceUsd - purchasePriceUsd - shippingCostUsd)` بۆ orderType = 'full_package'
- **مانا**: نرخی فرۆشتن - نرخی کڕین - تێچووی گواستنەوە
- **نیشاندان**: کۆی قازانج + ژمارەی ئۆردەر + نرخی مامناوەندی قازانج بۆ هەر ئۆردەرێک

### ٢.٣ عمولەی کڕین بە عمولە (Commission Income)
- **فۆرمولا**: `SUM(commissionFeeUsd)` بۆ orderType = 'commission'
- **مانا**: عمولەی خزمەتگوزاری کڕین بۆ کڕیار
- **نیشاندان**: کۆی عمولە + ژمارەی ئۆردەر + مامناوەندی عمولە

### ٢.٤ قازانجی خزمەتگوزاری (Service Profit)
- **فۆرمولا**: `SUM(priceAmount - costAmount)` لە extraServices
- **مانا**: نرخی خزمەتگوزاری - تێچووی خزمەتگوزاری
- **نیشاندان**: کۆی قازانج + ژمارەی خزمەتگوزاری + مامناوەندی قازانج

---

## بەشی ٣: وردەکاری تێچوو (Expense Breakdown)

### ٣.١ کارتەکانی تێچوو بە جۆر

| جۆری تێچوو | سەرچاوە |
|-------------|---------|
| **تێچووی گواستنەوە** | batches.shippingCost (ئەوەی بە هەڵگر دەدەین) |
| **تێچووی کڕینی کاڵا** | fullPackageOrders.purchasePriceUsd (نرخی کڕینی فول پاکێج) |
| **مووچە و کرێکاران** | expenses WHERE category = salary |
| **کرێی شوێن** | expenses WHERE category = rent |
| **خزمەتگوزارییەکان** | expenses WHERE category = utilities |
| **تێچووی ئۆپەرەیشناڵ** | expenses WHERE category = operational |
| **تێچووی تر** | expenses WHERE category = other |

### ٣.٢ Progress Bar بۆ هەر جۆرێک
- هەر جۆرێک بە progress bar و ڕێژەی سەدی نیشان دەدرێت

---

## بەشی ٤: قازانج و زیان (Profit & Loss Statement)

### ٤.١ تەیبڵی P&L

```
┌─────────────────────────────────────────────┐
│           قازانج و زیان (P&L)                │
├─────────────────────────────────────────────┤
│ داهات:                                       │
│   + قازانجی باچ              $XX,XXX         │
│   + قازانجی فول پاکێج        $XX,XXX         │
│   + عمولەی کڕین              $XX,XXX         │
│   + قازانجی خزمەتگوزاری      $XX,XXX         │
│   ─────────────────────────────              │
│   = کۆی داهات                $XX,XXX         │
├─────────────────────────────────────────────┤
│ تێچوو:                                      │
│   - تێچووی گواستنەوە         $XX,XXX         │
│   - تێچووی کڕینی کاڵا        $XX,XXX         │
│   - مووچە                    $XX,XXX         │
│   - کرێی شوێن               $XX,XXX         │
│   - خزمەتگوزارییەکان         $XX,XXX         │
│   - تێچووی ئۆپەرەیشناڵ      $XX,XXX         │
│   - تێچووی تر               $XX,XXX         │
│   ─────────────────────────────              │
│   = کۆی تێچوو               $XX,XXX         │
├─────────────────────────────────────────────┤
│ قازانجی خاوێن = داهات - تێچوو               │
│   = $XX,XXX (سەوز بۆ قازانج / سوور بۆ زیان) │
│ ڕێژەی قازانج = XX.X%                        │
└─────────────────────────────────────────────┘
```

---

## بەشی ٥: چارتەکان (Charts)

### ٥.١ چارتی هێڵی (Line Chart)
- ٣ هێڵ: داهات (سەوز) + تێچوو (سوور) + قازانجی خاوێن (ئاسمانی)
- بە مانگ یان هەفتە بەگوێرەی فلتەر

### ٥.٢ چارتی پای (Donut Chart)
- دابەشبوونی داهات بە سەرچاوە:
  - باچ (ئاسمانی)
  - فول پاکێج (سەوز)
  - عمولە (مۆر)
  - خزمەتگوزاری (نارنجی)

### ٥.٣ چارتی بار (Bar Chart)
- بەراوردی قازانج و زیان بە مانگ
- هەر مانگ دوو بار: داهات (سەوز) و تێچوو (سوور)

---

## بەشی ٦: فلتەر و ڕاپۆرت

### ٦.١ فلتەرەکان
- ئەم مانگە / مانگی ڕابردوو / ئەم ساڵە / ساڵی ڕابردوو
- بەرواری دیاریکراو (لە X بۆ Y)

### ٦.٢ هەناردەکردن
- **PDF**: ڕاپۆرتی P&L بە شێوەیەکی زۆر پرۆفیشناڵ
  - لۆگۆی کۆمپانیا
  - بەروار و ماوەی ڕاپۆرت
  - تەیبڵی P&L بە ڕەنگ
  - چارتەکان
  - واژووی ئەدمین
- **Excel**: داتای تەواو بە شیتەکانی جیاواز
  - شیتی خولاسە
  - شیتی داهات بە وردەکاری
  - شیتی تێچوو بە وردەکاری
  - شیتی P&L

---

## بەشی ٧: ئامارەکانی چالاکی

| ئامار | سەرچاوە |
|-------|---------|
| ژمارەی پاکەتی گەیاندراو | packages WHERE status = 'delivered' |
| ژمارەی فول پاکێجی فرۆشراو | fullPackageOrders WHERE status = 'delivered' |
| ژمارەی ئینڤۆیسی دەرکراو | invoices |
| ژمارەی پارەدانی وەرگیراو | paymentRecords |
| ژمارەی خزمەتگوزاری تەواوکراو | extraServices |

---

## ستراکچەری API

### Backend Procedures (tRPC)

```typescript
financeIntegration.dashboardStats → {
  period, startDate, endDate,
  
  // Revenue by source (calculated from actual tables)
  revenueBySource: {
    batchProfit: { total, count, avgPerBatch },
    fullPackageProfit: { total, count, avgPerOrder },
    commissionIncome: { total, count, avgPerOrder },
    serviceProfit: { total, count, avgPerService },
    totalRevenue: number,
  },
  
  // Expenses by category
  expensesByCategory: [
    { category, nameKu, amount, percentage, color }
  ],
  totalExpenses: number,
  
  // P&L Summary
  profitLoss: {
    grossRevenue, totalExpenses, netProfit, profitMargin
  },
  
  // Monthly trend data (for charts)
  monthlyTrend: [
    { month, revenue, expenses, netProfit }
  ],
  
  // Activity stats
  activity: {
    packagesDelivered, fullPackagesSold,
    invoicesIssued, paymentsReceived, servicesCompleted
  }
}
```
