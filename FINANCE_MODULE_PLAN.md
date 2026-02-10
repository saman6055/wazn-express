# پلانی بەشی دارایی (Finance Module) - Wazn Express

## پێشەکی

بەشی دارایی دڵی سیستەمی Wazn Express یە. هەموو جموجۆڵێکی پارە، وەسڵ، ئینڤۆیس، زەرەر و قازانج دەبێت لەم بەشەوە تۆمار بکرێت و شوێنپێگیری بکرێت. ئەم پلانە ڕێنمایی تەواوە بۆ دروستکردنی سیستەمێکی دارایی یەکگرتوو.

---

## 1. دۆخی ئێستا

### خشتەکانی داتابەیس کە هەن:

| خشتە | کارەکەی |
|------|---------|
| `ledgerEntries` | تۆماری حیسابەکان |
| `ledgerTransactions` | جموجۆڵەکانی حیساب |
| `invoices` | وەسڵەکان |
| `payments` | پارەدانەکان |
| `paymentRecords` | تۆماری پارەدان |
| `expenses` | خەرجیەکان |
| `expenseCategories` | پۆلەکانی خەرجی |
| `partners` | هاوبەشەکان |
| `partnerTransactions` | جموجۆڵەکانی هاوبەش |
| `companyDebts` | قەرزەکانی کۆمپانیا |
| `debtPayments` | پارەدانی قەرز |
| `cashAccounts` | حیسابە نەقدیەکان |
| `cashTransactions` | جموجۆڵە نەقدیەکان |
| `financialPeriods` | ماوەکانی دارایی |
| `customerAccounts` | حیسابی کەستمەرەکان |
| `creditAdjustments` | ڕێکخستنی کریدیت |

### بەشەکانی سیستەم کە دەبێت بە داراییەوە ببەسترێنەوە:

1. **Packages (پاکەتەکان)** - هەر پاکەتێک داهاتێکە
2. **Full Package Orders** - داواکاریەکانی فولپاکێج (کڕین و فرۆشتنەوە)
3. **Batches** - باچەکان و نرخەکانیان
4. **Customers** - باڵانسی کەستمەرەکان
5. **Suppliers** - پارەدان بە فرۆشیارەکان
6. **Expenses** - خەرجیەکانی کۆمپانیا
7. **Partners** - هاوبەشەکان و پشکەکانیان

---

## 2. ئامانجەکان

### 2.1 شوێنپێگیری داهات (Revenue Tracking)
- هەر پاکەتێک کە گەیشت = داهات
- هەر فولپاکێجێک کە فرۆشرایەوە = داهات + قازانج
- خزمەتگوزاریەکانی زیادە = داهات

### 2.2 شوێنپێگیری خەرجی (Expense Tracking)
- خەرجی گواستنەوە
- خەرجی کارمەندان
- خەرجی کرێی شوێن
- خەرجی کڕینی کاڵا (فولپاکێج)
- خەرجیە جیاوازەکان

### 2.3 شوێنپێگیری قەرز (Debt Tracking)
- قەرزی کەستمەرەکان بۆ ئێمە
- قەرزی ئێمە بۆ فرۆشیارەکان
- قەرزی کۆمپانیا

### 2.4 ڕاپۆرتەکان (Reports)
- ڕاپۆرتی ڕۆژانە
- ڕاپۆرتی هەفتانە
- ڕاپۆرتی مانگانە
- ڕاپۆرتی قازانج و زەرەر (P&L)
- ڕاپۆرتی کاش فلۆ

---

## 3. پلانی جێبەجێکردن

### قۆناغی 1: یەکگرتنی داهات (Revenue Integration)

#### 1.1 پاکەتەکان → دارایی
```
کاتێک پاکەت گەیشت (delivered):
  → زیادکردنی داهات بۆ ledgerTransactions
  → نوێکردنەوەی باڵانسی کەستمەر
  → تۆمارکردن لە cashTransactions (ئەگەر نەقد بوو)
```

#### 1.2 فولپاکێج → دارایی
```
کاتێک فولپاکێج تەواو بوو:
  → تۆمارکردنی نرخی کڕین (خەرجی)
  → تۆمارکردنی نرخی فرۆشتن (داهات)
  → حیسابکردنی قازانج
  → نوێکردنەوەی باڵانسی کەستمەر
```

#### 1.3 خزمەتگوزاری → دارایی
```
کاتێک خزمەتگوزاری زیادە فرۆشرا:
  → زیادکردنی داهات
  → تۆمارکردن لە serviceRevenue
```

### قۆناغی 2: یەکگرتنی خەرجی (Expense Integration)

#### 2.1 پۆلەکانی خەرجی
| پۆل | وەسف |
|-----|------|
| گواستنەوە | نرخی گواستنەوەی پاکەتەکان |
| کارمەندان | موچە و بۆنەس |
| کرێ | کرێی ئۆفیس و کۆگا |
| کڕین | کڕینی کاڵا بۆ فولپاکێج |
| خزمەتگوزاری | ئینتەرنێت، کارەبا، تەلەفۆن |
| تر | خەرجیە جیاوازەکان |

#### 2.2 تۆمارکردنی خەرجی
```
هەر خەرجیەک:
  → تۆمارکردن لە expenses
  → کەمکردنەوە لە cashAccounts
  → تۆمارکردن لە ledgerTransactions
```

### قۆناغی 3: یەکگرتنی قەرز (Debt Integration)

#### 3.1 قەرزی کەستمەر
```
کاتێک کەستمەر پارە نادات:
  → زیادکردن بۆ customerAccounts.balance
  → تۆمارکردن وەک receivable
```

#### 3.2 قەرزی فرۆشیار
```
کاتێک لە فرۆشیار دەکڕین و پارە نادەین:
  → زیادکردن بۆ supplierDebts
  → تۆمارکردن وەک payable
```

### قۆناغی 4: داشبۆردی دارایی (Finance Dashboard)

#### 4.1 کارتەکانی سەرەکی
| کارت | ناوەڕۆک |
|------|--------|
| داهاتی ئەمڕۆ | کۆی داهاتی ڕۆژ |
| خەرجی ئەمڕۆ | کۆی خەرجی ڕۆژ |
| قازانجی ئەمڕۆ | داهات - خەرجی |
| باڵانسی نەقد | کۆی پارەی نەقد |
| قەرزی وەرگیراو | پارەی کەستمەرەکان |
| قەرزی دراو | پارەی فرۆشیارەکان |

#### 4.2 چارتەکان
- چارتی داهات و خەرجی (مانگانە)
- چارتی قازانج (هەفتانە)
- چارتی کاش فلۆ
- چارتی جۆرەکانی داهات

### قۆناغی 5: ڕاپۆرتەکان (Reports)

#### 5.1 ڕاپۆرتی قازانج و زەرەر (P&L)
```
داهات:
  + داهاتی پاکەتەکان
  + داهاتی فولپاکێج
  + داهاتی خزمەتگوزاری
  = کۆی داهات

خەرجی:
  - خەرجی گواستنەوە
  - خەرجی کارمەندان
  - خەرجی کڕین
  - خەرجیە تر
  = کۆی خەرجی

قازانج/زەرەر = کۆی داهات - کۆی خەرجی
```

#### 5.2 ڕاپۆرتی کاش فلۆ
```
پارەی سەرەتا
  + پارەی وەرگیراو
  - پارەی دراو
  = پارەی کۆتایی
```

#### 5.3 ڕاپۆرتی باڵانس شیت
```
دارایی:
  + نەقد
  + قەرزی وەرگیراو
  + کاڵای ستۆک
  = کۆی دارایی

بەرپرسیاریەتی:
  + قەرزی دراو
  + قەرزی کۆمپانیا
  = کۆی بەرپرسیاریەتی

سەرمایە = دارایی - بەرپرسیاریەتی
```

---

## 4. گۆڕانکاریەکانی پێویست

### 4.1 گۆڕانکاری لە خشتەکان

#### خشتەی نوێ: `financialSummary`
```sql
CREATE TABLE financialSummary (
  id INT PRIMARY KEY,
  date DATE,
  totalRevenue DECIMAL(12,2),
  packageRevenue DECIMAL(12,2),
  fullPackageRevenue DECIMAL(12,2),
  serviceRevenue DECIMAL(12,2),
  totalExpense DECIMAL(12,2),
  netProfit DECIMAL(12,2),
  cashBalance DECIMAL(12,2),
  receivables DECIMAL(12,2),
  payables DECIMAL(12,2)
);
```

#### خشتەی نوێ: `revenueRecords`
```sql
CREATE TABLE revenueRecords (
  id INT PRIMARY KEY,
  date DATETIME,
  type ENUM('package', 'fullPackage', 'service', 'other'),
  referenceId INT,
  amount DECIMAL(12,2),
  currency VARCHAR(3),
  description TEXT,
  createdById INT
);
```

### 4.2 گۆڕانکاری لە ڕووتەرەکان

#### ڕووتەری نوێ: `finance.dashboard`
- `getSummary` - پوختەی دارایی
- `getRevenueChart` - چارتی داهات
- `getExpenseChart` - چارتی خەرجی
- `getCashFlow` - کاش فلۆ

#### ڕووتەری نوێ: `finance.reports`
- `getProfitLoss` - ڕاپۆرتی P&L
- `getBalanceSheet` - باڵانس شیت
- `getCashFlowReport` - ڕاپۆرتی کاش فلۆ

### 4.3 گۆڕانکاری لە بەشەکانی تر

#### پاکەتەکان
```typescript
// کاتێک پاکەت گەیشت
async function onPackageDelivered(packageId: number) {
  // 1. وەرگرتنی زانیاری پاکەت
  const pkg = await getPackage(packageId);
  
  // 2. تۆمارکردنی داهات
  await createRevenueRecord({
    type: 'package',
    referenceId: packageId,
    amount: pkg.totalPrice,
    description: `Package ${pkg.trackingNumber} delivered`
  });
  
  // 3. نوێکردنەوەی باڵانسی کەستمەر
  await updateCustomerBalance(pkg.customerId, pkg.totalPrice);
}
```

#### فولپاکێج
```typescript
// کاتێک فولپاکێج تەواو بوو
async function onFullPackageCompleted(orderId: number) {
  const order = await getFullPackageOrder(orderId);
  
  // 1. تۆمارکردنی خەرجی (نرخی کڕین)
  await createExpenseRecord({
    category: 'purchase',
    referenceId: orderId,
    amount: order.purchasePrice,
    description: `Full Package purchase: ${order.productName}`
  });
  
  // 2. تۆمارکردنی داهات (نرخی فرۆشتن)
  await createRevenueRecord({
    type: 'fullPackage',
    referenceId: orderId,
    amount: order.sellingPrice,
    description: `Full Package sale: ${order.productName}`
  });
  
  // 3. حیسابکردنی قازانج
  const profit = order.sellingPrice - order.purchasePrice;
  await updateDailyProfit(profit);
}
```

---

## 5. پێشینەیی جێبەجێکردن

| قۆناغ | ماوە | پێشینەیی |
|-------|------|----------|
| قۆناغی 1 | 2-3 ڕۆژ | باڵا |
| قۆناغی 2 | 2 ڕۆژ | باڵا |
| قۆناغی 3 | 1-2 ڕۆژ | ناوەند |
| قۆناغی 4 | 2-3 ڕۆژ | باڵا |
| قۆناغی 5 | 3-4 ڕۆژ | ناوەند |

**کۆی ماوە: 10-14 ڕۆژ**

---

## 6. کورتە

ئەم پلانە سیستەمی داراییەکی تەواو دروست دەکات کە:

1. **هەموو داهاتێک تۆمار دەکات** - پاکەت، فولپاکێج، خزمەتگوزاری
2. **هەموو خەرجیەک تۆمار دەکات** - گواستنەوە، کارمەند، کڕین
3. **قەرزەکان شوێنپێدەگرێت** - کەستمەر، فرۆشیار، کۆمپانیا
4. **ڕاپۆرتی تەواو دەدات** - P&L، کاش فلۆ، باڵانس شیت
5. **داشبۆردی زیندوو** - ئامارەکان بە ڕۆژانە

---

*دروستکرا لەلایەن Manus AI*
*بەرواری: 25/12/2024*
