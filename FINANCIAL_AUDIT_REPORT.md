# ڕاپۆرتی پیداچوونەوەی سیستەمی دارایی
# Financial System Audit Report

**بەروار:** ٢٠٢٦/٠١/١٩

---

## ١. خشتەکانی داتابەیس بۆ دارایی (Database Tables)

### خشتە سەرەکییەکان (Core Tables)

| خشتە | کارکردن | بارودۆخ |
|------|---------|---------|
| `customerAccounts` | هەژماری دارایی کڕیار (باڵانس، قەرز، کرێدیت) | ✅ کاردەکات |
| `ledgerTransactions` | هەموو گواستنەوە داراییەکان (یەکگرتوو) | ✅ کاردەکات |
| `invoices` | وەسڵەکان | ✅ کاردەکات |
| `payments` | پارەدانەکان (کۆن) | ⚠️ دووبارە |
| `paymentRecords` | پارەدانەکان (نوێ) | ✅ کاردەکات |

### خشتە زیادەکان (Additional Tables)

| خشتە | کارکردن | بارودۆخ |
|------|---------|---------|
| `expenses` | مەسروفات | ✅ کاردەکات |
| `expenseCategories` | جۆرەکانی مەسروفات | ✅ کاردەکات |
| `partners` | شەریکان | ✅ کاردەکات |
| `partnerTransactions` | گواستنەوەکانی شەریکان | ✅ کاردەکات |
| `companyDebts` | قەرزەکانی کۆمپانیا | ✅ کاردەکات |
| `debtPayments` | پارەدانی قەرز | ✅ کاردەکات |
| `cashAccounts` | هەژمارە کاشەکان | ✅ کاردەکات |
| `cashTransactions` | گواستنەوەکانی کاش | ✅ کاردەکات |
| `financialPeriods` | ماوەی دارایی | ✅ کاردەکات |
| `creditAdjustments` | ڕێکخستنەوەی کرێدیت | ✅ کاردەکات |
| `paymentReminders` | بیرهێنەرەوەی پارەدان | ✅ کاردەکات |
| `dailyFinancialSummary` | پوختەی ڕۆژانەی دارایی | ✅ کاردەکات |
| `revenueRecords` | تۆمارەکانی داهات | ✅ کاردەکات |

---

## ٢. شتە دووبارەکان (Duplications)

### 🔴 کێشەی گەورە: دوو خشتەی پارەدان

**کێشە:** دوو خشتەی جیاواز هەیە بۆ پارەدان:
1. `payments` - خشتەی کۆن
2. `paymentRecords` - خشتەی نوێ

**شیکاری:**
```
payments:
- id, customerId, invoiceId, amountUsd, paymentMethod, status, receivedById

paymentRecords:
- id, accountId, transactionId, paymentNumber, amountUsd, amountIqd, paymentMethod, paymentStatus, receiptNumber, notes, receivedById
```

**چارەسەر:** `paymentRecords` تەواوترە و پەیوەندی بە `ledgerTransactions` هەیە. `payments` دەبێت لابدرێت.

---

### 🟡 ئاگاداری: فانکشنی کۆن لە ڕاوتەرەکان

**کێشە:** لە `routers.ts` بەشی `accounting` هەیە کە deprecated (کۆنە):

```typescript
// ============ ACCOUNTING (DEPRECATED - Use ledger.* instead) ============
accounting: router({
  // DEPRECATED: Use ledger.recordPayment instead
  recordPayment: ...
  recordRefund: ...
  recordAdjustment: ...
  getLedgerEntries: ...
})
```

**چارەسەر:** ئەم بەشە دەبێت لابدرێت و هەموو بەکارهێنەران بگوازرێنەوە بۆ `ledger.*`

---

## ٣. فانکشنەکانی سەرەکی کە کاردەکەن (Working Functions)

### ✅ `applyCharge()` - فانکشنی یەکگرتوو بۆ کرێ
- خۆکارانە وەسڵ دروست دەکات
- خۆکارانە گواستنەوەی ledger دروست دەکات
- باڵانس نوێ دەکاتەوە
- بۆ: پاکەت، فول پاکیج، داواکاری کڕین، کۆمیشن، خزمەتگوزاری

### ✅ `recordPaymentReceived()` - تۆمارکردنی پارەدان
- گواستنەوەی ledger دروست دەکات
- تۆماری پارەدان دروست دەکات
- باڵانس نوێ دەکاتەوە

### ✅ `getOrCreateCustomerAccount()` - هەژماری کڕیار
- خۆکارانە هەژمار دروست دەکات بۆ کڕیاری نوێ

### ✅ `validateAccountBalance()` - پشتڕاستکردنەوەی باڵانس
- پشکنینی باڵانس لەگەڵ کۆی گواستنەوەکان

### ✅ `repairAccountBalance()` - چاککردنی باڵانس
- چاککردنی باڵانس ئەگەر هەڵە هەبوو

---

## ٤. ڕاوتەرەکانی سەرەکی (Main Routers)

### ✅ `ledger` - سیستەمی یەکگرتوو (ڕاستە)
```
ledger.getFinancialSummary
ledger.getCustomerAccounts
ledger.getAccountByCustomerId
ledger.getOrCreateAccount
ledger.getTransactions
ledger.getPayments
ledger.recordPayment
ledger.createReminder
ledger.validateBalance
ledger.repairBalance
ledger.getAccountBreakdown
ledger.generateInvoice
ledger.generateReceipt
ledger.getInvoices
ledger.getInvoiceById
```

### ✅ `invoices` - وەسڵەکان
```
invoices.list
invoices.getById
invoices.create
invoices.issue
invoices.markPaid
invoices.getSummary
invoices.getMonthlyReport
invoices.getYearlyReport
invoices.getByCustomerReport
invoices.getByServiceTypeReport
invoices.getRecent
invoices.generatePdf
```

### ✅ `payments` - پارەدانەکان
```
payments.list
payments.byInvoice
payments.create
```

### ⚠️ `accounting` - کۆن (DEPRECATED)
```
accounting.recordPayment (کۆن - بەکاری مەهێنە)
accounting.recordRefund
accounting.recordAdjustment
accounting.getLedgerEntries
```

### ✅ `financialReports` - ڕاپۆرتەکان
```
financialReports.getOverview
financialReports.getProfitAndLoss
financialReports.getMonthlyTrend
financialReports.generateProfitLossPDF
financialReports.generateBalanceSheetPDF
financialReports.generatePartnerReportPDF
financialReports.generateExpenseReportPDF
financialReports.generateDebtSchedulePDF
```

---

## ٥. پێشنیارەکان بۆ چاککردن

### 🔴 پێویستە ئێستا بکرێت:

1. **لابردنی خشتەی `payments`** - تەنها `paymentRecords` بەکاربهێنە
2. **لابردنی بەشی `accounting`** - تەنها `ledger.*` بەکاربهێنە
3. **پشکنینی هەموو شوێنەکان** کە `payments` بەکاردەهێنن و بیگۆڕە بۆ `paymentRecords`

### 🟡 پێشنیاری باشکردن:

1. **زیادکردنی index** بۆ خشتەکانی دارایی بۆ خێراتر بوون
2. **زیادکردنی validation** بۆ هەموو گواستنەوە داراییەکان
3. **زیادکردنی audit log** بۆ هەموو گۆڕانکارییەکانی دارایی

---

## ٦. کۆتایی

سیستەمی دارایی بە گشتی **باشە** و یەکگرتووە. کێشەی سەرەکی ئەوەیە کە دوو خشتەی پارەدان هەیە (`payments` و `paymentRecords`) کە دەبێت یەکیان لابدرێت. هەروەها بەشی `accounting` لە ڕاوتەرەکان کۆنە و دەبێت لابدرێت.

**ئامۆژگاری:** تەنها `ledger.*` و `paymentRecords` بەکاربهێنە بۆ هەموو کارە داراییەکان.
