# Wazn Express - دۆکیومێنتی سیستەمی تەواو
## پڕۆپۆزاڵ و ڕێنمایی دروستکردنی سیستەمی بەڕێوەبردنی کارگۆ

**ڤێرژن:** 1.0  
**بەرواری:** ٥ی کانوونی دووەم ٢٠٢٦  
**نووسەر:** Manus AI

---

## ناوەڕۆک

1. [پوختەی پڕۆژە](#1-پوختەی-پڕۆژە)
2. [ئەرکیتەکچەری سیستەم](#2-ئەرکیتەکچەری-سیستەم)
3. [تەکنۆلۆژیاکان](#3-تەکنۆلۆژیاکان)
4. [داتابەیس و خشتەکان](#4-داتابەیس-و-خشتەکان)
5. [مۆدیوڵەکان و تایبەتمەندییەکان](#5-مۆدیوڵەکان-و-تایبەتمەندییەکان)
6. [سیستەمی ئۆتەنتیکەیشن](#6-سیستەمی-ئۆتەنتیکەیشن)
7. [سیستەمی دارایی](#7-سیستەمی-دارایی)
8. [سیستەمی سکان و کۆگا](#8-سیستەمی-سکان-و-کۆگا)
9. [پۆرتاڵی کڕیار](#9-پۆرتاڵی-کڕیار)
10. [سیستەمی ڕاپۆرتەکان](#10-سیستەمی-ڕاپۆرتەکان)
11. [سیستەمی زمان (i18n)](#11-سیستەمی-زمان-i18n)
12. [ڕێنمایی جێبەجێکردن](#12-ڕێنمایی-جێبەجێکردن)

---

## 1. پوختەی پڕۆژە

### 1.1 مەبەست

**Wazn Express** سیستەمێکی تەواوی بەڕێوەبردنی کارگۆیە بۆ کۆمپانیاکانی گواستنەوەی کاڵا لە چین بۆ عێراق/کوردستان. ئەم سیستەمە هەموو ئەو تایبەتمەندییانە لەخۆ دەگرێت کە کۆمپانیایەکی کارگۆ پێویستی پێیە:

- **بەڕێوەبردنی کڕیارەکان** - تۆمارکردن، پرۆفایل، کۆدی تایبەت
- **بەڕێوەبردنی پاکەتەکان** - تۆمارکردن، شوێنکەوتن، ستاتەس
- **سیستەمی باچ** - کۆکردنەوەی پاکەتەکان بۆ گواستنەوە
- **سیستەمی نرخدانان** - نرخی پلەبەندی، نرخی تایبەتی کڕیار
- **سیستەمی دارایی** - قەرز، پارەدان، ئینڤۆیس
- **سکانەری QR/باڕکۆد** - سکانی خێرا لە کۆگا
- **Full Package** - کڕینی کاڵا بۆ کڕیار
- **پۆرتاڵی کڕیار** - ئەپی موبایل بۆ کڕیارەکان
- **ڕاپۆرتی زۆر** - دارایی، سکان، قازانج

### 1.2 بەکارهێنەرەکان

| ڕۆڵ | وەسف | دەسەڵات |
|-----|------|---------|
| **Admin** | بەڕێوەبەری سیستەم | هەموو دەسەڵاتەکان |
| **Employee** | کارمەندی کۆگا | سکان، تۆمارکردنی پاکەت |
| **Accountant** | ژمێریار | دارایی، ڕاپۆرت |
| **Customer** | کڕیار | پۆرتاڵی کڕیار |

### 1.3 ڕەوتی کار (Workflow)

```
کڕیار کاڵا دەنێرێت بۆ کۆگای چین
           ↓
کارمەند پاکەت تۆمار دەکات (سکان)
           ↓
پاکەت زیاد دەکرێت بۆ باچ
           ↓
باچ دەگوازرێتەوە (هەوایی/دەریایی)
           ↓
باچ دەگات کۆگای عێراق
           ↓
نرخ حیساب دەکرێت + ئینڤۆیس دروست دەبێت
           ↓
کڕیار پارە دەدات + پاکەت وەردەگرێت
```

---

## 2. ئەرکیتەکچەری سیستەم

### 2.1 ئەرکیتەکچەری گشتی

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Admin Panel │  │ Staff Panel │  │ Customer Portal     │  │
│  │ (Dashboard) │  │ (Scanner)   │  │ (Mobile App Style)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ tRPC (Type-safe API)
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     Backend (Express)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Auth Router │  │ API Routers │  │ AI Services         │  │
│  │ (JWT/OAuth) │  │ (41 routes) │  │ (OCR, Vision, LLM)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Drizzle ORM
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     Database (MySQL/TiDB)                    │
│                        60+ Tables                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 فایلی سەرەکییەکان

| فایل | هێڵ | وەسف |
|------|-----|------|
| `server/routers.ts` | ~5,900 | هەموو tRPC پرۆسیجەرەکان |
| `server/db.ts` | ~7,500 | فەنکشنەکانی داتابەیس |
| `drizzle/schema.ts` | ~1,000 | خشتەکانی داتابەیس |
| `client/src/App.tsx` | ~500 | ڕاوتینگ و لەیاوت |
| `client/src/pages/` | 73 فایل | پەڕەکانی سیستەم |

---

## 3. تەکنۆلۆژیاکان

### 3.1 Frontend Stack

| تەکنۆلۆژیا | ڤێرژن | بەکارهێنان |
|-----------|-------|-----------|
| **React** | 19 | فرەیمۆرکی UI |
| **TypeScript** | 5.x | جۆری داتا |
| **Tailwind CSS** | 4 | ستایل |
| **shadcn/ui** | Latest | کۆمپۆنێنتەکان |
| **wouter** | 3.x | ڕاوتینگ |
| **tRPC Client** | 11 | API کلاینت |
| **React Query** | 5.x | State Management |
| **Recharts** | 2.x | چارتەکان |

### 3.2 Backend Stack

| تەکنۆلۆژیا | ڤێرژن | بەکارهێنان |
|-----------|-------|-----------|
| **Express** | 4.x | سەرڤەر |
| **TypeScript** | 5.x | جۆری داتا |
| **tRPC** | 11 | API |
| **Drizzle ORM** | Latest | داتابەیس |
| **MySQL/TiDB** | 8.x | داتابەیس |
| **bcrypt** | 5.x | هاش پاسۆرد |
| **jsonwebtoken** | 9.x | JWT |
| **pdfkit** | 0.14 | PDF دروستکردن |

### 3.3 AI Services

| خزمەتگوزاری | بەکارهێنان |
|------------|-----------|
| **LLM (GPT-4)** | OCR، وەرگێڕان، شیکاری وێنە |
| **Vision AI** | ناسینەوەی پۆلی کاڵا، تێبینی زیان |
| **Voice AI** | فرمانی دەنگی، Text-to-Speech |

---

## 4. داتابەیس و خشتەکان

### 4.1 خشتە سەرەکییەکان

#### بەکارهێنەرەکان و ئۆتەنتیکەیشن

```sql
-- users: هەموو بەکارهێنەرەکان (ئەدمین، کارمەند، کڕیار)
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openId VARCHAR(64) UNIQUE,           -- بۆ OAuth
  name TEXT,
  email VARCHAR(320),
  loginMethod VARCHAR(64),              -- "manus" یان "mobile"
  role ENUM('user', 'admin', 'employee', 'accountant', 'customer'),
  
  -- بۆ کڕیارەکان
  customerCode VARCHAR(100) UNIQUE,     -- AZ0001(Name)
  sequenceNumber INT,
  fullName VARCHAR(255),
  fullNameArabic VARCHAR(255),
  fullNameKurdish VARCHAR(255),
  gender ENUM('male', 'female'),
  nationality VARCHAR(100),
  businessType VARCHAR(100),
  mobileNumber VARCHAR(20) UNIQUE,
  secondaryMobile VARCHAR(20),
  passwordHash VARCHAR(255),
  country VARCHAR(100),
  city VARCHAR(100),
  district VARCHAR(100),
  address TEXT,
  
  -- بەڵگەنامەکان
  passportUrl VARCHAR(500),
  nationalIdUrl VARCHAR(500),
  contractUrl VARCHAR(500),
  
  isActive BOOLEAN DEFAULT TRUE,
  notes TEXT,
  createdById INT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
);
```

#### پاکەتەکان

```sql
-- packages: هەموو پاکەتەکان
CREATE TABLE packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  packageCode VARCHAR(50) UNIQUE,       -- WZN-AIR-001
  trackingNumber VARCHAR(100),          -- ژمارەی شوێنکەوتن
  customerId INT,                       -- کڕیار (nullable بۆ unclaimed)
  originWarehouseId INT,
  batchId INT,
  categoryId INT,
  
  shippingType ENUM('air_regular', 'air_irregular', 'sea'),
  status ENUM('registered', 'in_batch', 'in_transit', 
              'customs_processing', 'ready_for_delivery', 
              'out_for_delivery', 'delivered'),
  
  -- کێش و قەبارە
  weightKg DECIMAL(10,2),
  lengthCm DECIMAL(10,2),
  widthCm DECIMAL(10,2),
  heightCm DECIMAL(10,2),
  cbm DECIMAL(10,4),                    -- حجم
  
  -- نرخ
  calculatedCostUsd DECIMAL(10,2),
  isCharged BOOLEAN DEFAULT FALSE,
  
  -- وێنەکان
  photos JSON,                          -- ["url1", "url2"]
  
  -- Unclaimed
  isUnclaimed BOOLEAN DEFAULT FALSE,
  claimedAt TIMESTAMP,
  claimedById INT,
  
  description TEXT,
  notes TEXT,
  createdById INT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
);
```

#### باچەکان

```sql
-- batches: کۆمەڵە پاکەت بۆ گواستنەوە
CREATE TABLE batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batchCode VARCHAR(50) UNIQUE,         -- SEA-001, AIR-001
  originWarehouseId INT,
  destinationCountryId INT,
  shippingType ENUM('air_regular', 'air_irregular', 'sea'),
  carrierInfo VARCHAR(255),
  
  departureDate TIMESTAMP,
  estimatedArrival TIMESTAMP,
  actualArrival TIMESTAMP,
  
  status ENUM('preparing', 'in_transit', 'arrived', 
              'customs', 'delivered', 'closed'),
  
  totalPackages INT DEFAULT 0,
  totalWeight DECIMAL(10,2),
  
  -- کێش و حجم ڕاستەقینە
  actualWeightKg DECIMAL(10,2),
  actualCbm DECIMAL(10,4),
  
  -- کێش و حجم charge کراو
  chargedWeightKg DECIMAL(10,2),
  chargedCbm DECIMAL(10,4),
  
  -- تێچووی ئێمە
  costPerKg DECIMAL(10,2),
  costPerCbm DECIMAL(10,2),
  
  -- نرخی فرۆشتن
  pricePerKg DECIMAL(10,2),
  pricePerCbm DECIMAL(10,2),
  
  useTieredPricing BOOLEAN DEFAULT FALSE,
  
  notes TEXT,
  createdById INT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
);
```

### 4.2 خشتەکانی دارایی

```sql
-- ledgerEntries: تۆماری دارایی کڕیار
CREATE TABLE ledgerEntries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customerId INT,
  type ENUM('charge', 'payment', 'adjustment'),
  amountUsd DECIMAL(10,2),
  amountIqd DECIMAL(15,2),
  balanceAfterUsd DECIMAL(10,2),
  balanceAfterIqd DECIMAL(15,2),
  description TEXT,
  referenceType VARCHAR(50),            -- 'package', 'invoice', 'manual'
  referenceId INT,
  createdById INT,
  createdAt TIMESTAMP DEFAULT NOW()
);

-- invoices: ئینڤۆیسەکان
CREATE TABLE invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoiceNumber VARCHAR(50) UNIQUE,
  customerId INT,
  totalAmountUsd DECIMAL(10,2),
  totalAmountIqd DECIMAL(15,2),
  status ENUM('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'),
  dueDate TIMESTAMP,
  paidAmount DECIMAL(10,2),
  notes TEXT,
  createdById INT,
  createdAt TIMESTAMP DEFAULT NOW()
);

-- invoiceItems: بڕگەکانی ئینڤۆیس
CREATE TABLE invoiceItems (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoiceId INT,
  packageId INT,
  description TEXT,
  quantity INT DEFAULT 1,
  unitPriceUsd DECIMAL(10,2),
  totalUsd DECIMAL(10,2)
);

-- payments: پارەدانەکان
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customerId INT,
  invoiceId INT,
  amountUsd DECIMAL(10,2),
  amountIqd DECIMAL(15,2),
  paymentMethod ENUM('cash', 'bank_transfer', 'fib', 
                     'fastpay', 'zaincash', 'asiahawala'),
  receiptNumber VARCHAR(100),
  notes TEXT,
  createdById INT,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

### 4.3 خشتەکانی نرخدانان

```sql
-- batchPricingTiers: نرخی پلەبەندی
CREATE TABLE batchPricingTiers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batchId INT,
  minWeight DECIMAL(10,2),              -- لە کێشی X
  maxWeight DECIMAL(10,2),              -- تا کێشی Y
  pricePerKg DECIMAL(10,2),             -- نرخ بۆ هەر KG
  pricePerCbm DECIMAL(10,2)             -- نرخ بۆ هەر CBM
);

-- batchCustomerPricing: نرخی تایبەتی کڕیار
CREATE TABLE batchCustomerPricing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batchId INT,
  customerId INT,
  pricePerKg DECIMAL(10,2),
  pricePerCbm DECIMAL(10,2),
  notes TEXT,
  createdById INT,
  createdAt TIMESTAMP DEFAULT NOW()
);

-- vipCustomers: کڕیارە VIP ەکان
CREATE TABLE vipCustomers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customerId INT UNIQUE,
  tier ENUM('silver', 'gold', 'platinum'),
  discountPercent DECIMAL(5,2),
  fixedPricePerKg DECIMAL(10,2),
  fixedPricePerCbm DECIMAL(10,2),
  validFrom TIMESTAMP,
  validTo TIMESTAMP,
  notes TEXT,
  createdById INT,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

### 4.4 خشتەکانی Full Package

```sql
-- fullPackageOrders: داواکاری کڕینی کاڵا
CREATE TABLE fullPackageOrders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orderCode VARCHAR(50) UNIQUE,         -- FP-001
  customerId INT,
  supplierId INT,
  serviceType ENUM('full_package', 'buying_agent'),
  
  -- زانیاری کاڵا
  productName VARCHAR(255),
  productNameKu VARCHAR(255),
  productUrl TEXT,
  productImageUrl TEXT,
  quantity INT DEFAULT 1,
  
  -- نرخەکان
  purchasePriceRmb DECIMAL(10,2),
  purchasePriceUsd DECIMAL(10,2),
  sellingPriceUsd DECIMAL(10,2),
  shippingCostUsd DECIMAL(10,2),
  commissionPercent DECIMAL(5,2),
  commissionUsd DECIMAL(10,2),
  
  -- قازانج
  profitUsd DECIMAL(10,2),
  
  -- گواستنەوە
  shippingType ENUM('air_regular', 'air_irregular', 'sea'),
  batchId INT,
  trackingNumber VARCHAR(100),
  
  status ENUM('pending', 'ordered', 'tracking_added', 
              'in_china_warehouse', 'in_batch', 'in_transit', 
              'delivered', 'cancelled', 'refunded', 'returned'),
  
  priority ENUM('normal', 'urgent', 'vip'),
  qualityCheck BOOLEAN DEFAULT FALSE,
  
  orderDate TIMESTAMP,
  notes TEXT,
  createdById INT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
);

-- suppliers: فرۆشیارەکان
CREATE TABLE suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  nameKu VARCHAR(255),
  contactPerson VARCHAR(255),
  phone VARCHAR(50),
  wechat VARCHAR(100),
  email VARCHAR(320),
  address TEXT,
  category VARCHAR(100),
  rating INT,
  isActive BOOLEAN DEFAULT TRUE,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

### 4.5 خشتەکانی کۆمپانیا

```sql
-- expenses: خەرجییەکان
CREATE TABLE expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  categoryId INT,
  amountUsd DECIMAL(10,2),
  amountIqd DECIMAL(15,2),
  description TEXT,
  receiptUrl VARCHAR(500),
  expenseDate TIMESTAMP,
  isRecurring BOOLEAN DEFAULT FALSE,
  recurringInterval VARCHAR(20),
  createdById INT,
  createdAt TIMESTAMP DEFAULT NOW()
);

-- expenseCategories: پۆلی خەرجی
CREATE TABLE expenseCategories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nameEn VARCHAR(100),
  nameKu VARCHAR(100),
  nameAr VARCHAR(100),
  icon VARCHAR(50),
  color VARCHAR(20),
  isActive BOOLEAN DEFAULT TRUE
);

-- partners: هاوبەشەکان
CREATE TABLE partners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  sharePercent DECIMAL(5,2),
  capitalUsd DECIMAL(15,2),
  profitShareUsd DECIMAL(15,2),
  withdrawnUsd DECIMAL(15,2),
  phone VARCHAR(50),
  email VARCHAR(320),
  isActive BOOLEAN DEFAULT TRUE,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT NOW()
);

-- companyDebts: قەرزی کۆمپانیا
CREATE TABLE companyDebts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  creditorName VARCHAR(255),
  debtType ENUM('personal', 'bank', 'supplier'),
  originalAmountUsd DECIMAL(15,2),
  remainingAmountUsd DECIMAL(15,2),
  interestRate DECIMAL(5,2),
  dueDate TIMESTAMP,
  status ENUM('active', 'paid', 'overdue'),
  notes TEXT,
  createdById INT,
  createdAt TIMESTAMP DEFAULT NOW()
);

-- cashAccounts: حسابی کاش و بانک
CREATE TABLE cashAccounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  accountName VARCHAR(255),
  accountType ENUM('cash', 'bank'),
  bankName VARCHAR(255),
  accountNumber VARCHAR(100),
  balanceUsd DECIMAL(15,2) DEFAULT 0,
  balanceIqd DECIMAL(20,2) DEFAULT 0,
  isActive BOOLEAN DEFAULT TRUE,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

### 4.6 خشتەکانی سکان

```sql
-- packageScans: تۆماری سکان
CREATE TABLE packageScans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  packageId INT,
  scanType ENUM('register', 'receive_china', 'ship', 
                'arrive', 'deliver', 'return'),
  scannedById INT,
  warehouseId INT,
  deviceId VARCHAR(100),
  notes TEXT,
  scannedAt TIMESTAMP DEFAULT NOW()
);

-- packageStatusHistory: مێژووی ستاتەس
CREATE TABLE packageStatusHistory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  packageId INT,
  fromStatus VARCHAR(50),
  toStatus VARCHAR(50),
  changedById INT,
  reason TEXT,
  changedAt TIMESTAMP DEFAULT NOW()
);
```

---

## 5. مۆدیوڵەکان و تایبەتمەندییەکان

### 5.1 مۆدیوڵی کڕیارەکان

#### تایبەتمەندییەکان:
- **دروستکردنی کڕیار** - فۆرمی تەواو بە هەموو زانیارییەکان
- **کۆدی کڕیار** - فۆرماتی `AZ{number}({name})` بە شێوەی خۆکار
- **پرۆفایلی کڕیار** - وردەکاری، پاکەتەکان، دارایی، بەڵگەنامەکان
- **فلتەرکردن** - بەپێی پارێزگا، شار، باڵانس، VIP
- **VIP** - پلەی تایبەت بۆ کڕیارە گرنگەکان
- **بەڵگەنامە** - ئەپڵۆدی پاسپۆرت، ناسنامە، گرێبەست

#### پەڕەکان:
| پەڕە | ڕێگا | وەسف |
|------|------|------|
| Customers | `/customers` | لیستی کڕیارەکان |
| CustomerDetail | `/customers/:id` | پرۆفایلی کڕیار |
| VipCustomers | `/vip-customers` | کڕیارە VIP ەکان |

#### API Endpoints:
```typescript
customers.list          // لیستی کڕیارەکان
customers.getById       // وردەکاری کڕیار
customers.create        // دروستکردنی کڕیار
customers.update        // نوێکردنەوە
customers.delete        // سڕینەوە
customers.getBalance    // باڵانس
customers.getLedger     // تۆماری دارایی
customers.uploadDocument // ئەپڵۆدی بەڵگەنامە
```

### 5.2 مۆدیوڵی پاکەتەکان

#### تایبەتمەندییەکان:
- **تۆمارکردنی پاکەت** - ویزارد 5 هەنگاو
- **تۆماری خێرا** - فۆرمی ساکار
- **تۆماری کۆمەڵ** - چەند پاکەت بۆ یەک کڕیار
- **پاکەتی بێ خاوەن** - تۆمار بەبێ کڕیار
- **داواکاری خاوەنداری** - کڕیار داوای پاکەت دەکات
- **فلتەر پیشکەوتوو** - ستاتەس، جۆر، بەروار، کێش
- **ئەکسپۆرتی Excel** - داگرتنی داتا

#### پەڕەکان:
| پەڕە | ڕێگا | وەسف |
|------|------|------|
| PackagesDashboard | `/packages` | داشبۆردی پاکەتەکان |
| Packages | `/packages/list` | لیستی پاکەتەکان |
| PackageRegister | `/packages/register` | تۆمارکردنی ویزارد |
| QuickRegister | `/packages/quick-register` | تۆماری خێرا |
| BulkRegister | `/packages/bulk-register` | تۆماری کۆمەڵ |
| UnclaimedPackages | `/packages/unclaimed` | پاکەتە بێ خاوەنەکان |
| ClaimRequests | `/claim-requests` | داواکاری خاوەنداری |

#### ستاتەسی پاکەت:
```
registered → in_batch → in_transit → customs_processing → 
ready_for_delivery → out_for_delivery → delivered
```

### 5.3 مۆدیوڵی باچەکان

#### تایبەتمەندییەکان:
- **دروستکردنی باچ** - کۆدی تایبەت، کۆگا، جۆری گواستنەوە
- **نرخدانانی باچ** - نرخی سەرەکی، پلەبەندی، تایبەتی کڕیار
- **زیادکردنی پاکەت** - زیادکردنی پاکەت بۆ باچ
- **گۆڕینی ستاتەس** - preparing → in_transit → arrived → delivered
- **ڕاپۆرتی دارایی** - تێچوو، داهات، قازانج

#### پەڕەکان:
| پەڕە | ڕێگا | وەسف |
|------|------|------|
| Batches | `/batches` | لیستی باچەکان |
| BatchFinancialReport | `/batches/:id/financial` | ڕاپۆرتی دارایی |
| CustomerPricingReport | `/customer-pricing-report` | نرخی تایبەتی کڕیار |

#### سیستەمی نرخدانان:
```
1. نرخی تایبەتی کڕیار (batchCustomerPricing)
   ↓ ئەگەر نەبوو
2. نرخی پلەبەندی (batchPricingTiers)
   ↓ ئەگەر نەبوو
3. نرخی سەرەکی باچ (batch.pricePerKg/pricePerCbm)
```

### 5.4 مۆدیوڵی Full Package

#### تایبەتمەندییەکان:
- **جۆری خزمەتگوزاری** - Full Package (کڕین و فرۆشتن) یان Buying Agent (کۆمیشن)
- **فرۆشیارەکان** - بەڕێوەبردنی فرۆشیارەکانی چین
- **شوێنکەوتنی داواکاری** - لە pending تا delivered
- **حیسابی قازانج** - خۆکار بەپێی جۆری خزمەتگوزاری
- **ئاگاداری شوێنکەوتن** - ئاگاداری بۆ داواکاری بەبێ tracking

#### پەڕەکان:
| پەڕە | ڕێگا | وەسف |
|------|------|------|
| FullPackageDashboard | `/full-package` | داشبۆرد |
| FullPackageWizard | `/full-package/new` | فۆرمی نوێ |
| FullPackageOrderForm | `/full-package/:id` | دەستکاری |
| FullPackageReports | `/full-package/reports` | ڕاپۆرتەکان |
| TrackingAlerts | `/full-package/tracking-alerts` | ئاگاداری شوێنکەوتن |
| Suppliers | `/suppliers` | فرۆشیارەکان |

#### حیسابی قازانج:
```
Full Package:
  قازانج = (نرخی فرۆشتن - نرخی کڕین) × ژمارە - تێچووی گواستنەوە

Buying Agent:
  قازانج = کۆمیشن + تێچووی گواستنەوە
```

---

## 6. سیستەمی ئۆتەنتیکەیشن

### 6.1 جۆرەکانی چوونەژوورەوە

| جۆر | بەکارهێنەر | شێواز |
|-----|-----------|-------|
| **Manus OAuth** | Admin, Employee | OAuth 2.0 |
| **Staff Login** | Admin, Employee | Email/Password |
| **Customer Login** | Customer | Mobile/Password |

### 6.2 ڕەوتی چوونەژوورەوەی کارمەند

```typescript
// StaffLogin.tsx
const handleLogin = async () => {
  const result = await trpc.auth.staffLogin.mutate({
    identifier: email,  // ناو یان ئیمەیڵ
    password: password
  });
  
  if (result.success) {
    // JWT token لە cookie دادەنرێت
    window.location.href = '/dashboard';
  }
};
```

### 6.3 ڕەوتی چوونەژوورەوەی کڕیار

```typescript
// CustomerLogin.tsx
const handleLogin = async () => {
  const result = await trpc.auth.customerLogin.mutate({
    mobileNumber: mobile,
    password: password
  });
  
  if (result.success) {
    window.location.href = '/portal';
  }
};
```

### 6.4 پاراستنی ڕاوتەکان

```typescript
// server/routers.ts
export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});
```

---

## 7. سیستەمی دارایی

### 7.1 ئەرکیتەکچەری دارایی

```
┌─────────────────────────────────────────────────────────────┐
│                    Financial Hub                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Treasury    │  │ Customer    │  │ Company             │  │
│  │ (Cash/Bank) │  │ Finance     │  │ Finance             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │                │                    │              │
│         ↓                ↓                    ↓              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ cashAccounts│  │ ledgerEntries│ │ expenses            │  │
│  │ transactions│  │ invoices    │  │ partners            │  │
│  └─────────────┘  │ payments    │  │ companyDebts        │  │
│                   └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 سیستەمی دارایی کڕیار

#### Ledger Entry (تۆماری دارایی):
```typescript
// کاتێک پاکەت charge دەکرێت
await createLedgerEntry({
  customerId: package.customerId,
  type: 'charge',
  amountUsd: calculatedCost,
  description: `Charge for package ${package.packageCode}`,
  referenceType: 'package',
  referenceId: package.id
});

// کاتێک پارە وەردەگیرێت
await createLedgerEntry({
  customerId: customerId,
  type: 'payment',
  amountUsd: -amount,  // منفی بۆ پارەدان
  description: `Payment received`,
  referenceType: 'payment',
  referenceId: payment.id
});
```

#### حیسابی باڵانس:
```typescript
// باڵانس = کۆی charge - کۆی payment
const balance = await db
  .select({ total: sql`SUM(amountUsd)` })
  .from(ledgerEntries)
  .where(eq(ledgerEntries.customerId, customerId));
```

### 7.3 سیستەمی ئینڤۆیس خۆکار

کاتێک پاکەتێک بە `ready_for_delivery` دەگۆڕێت:

```typescript
// 1. نرخ دیاری بکە
const price = await calculatePackagePrice(package, batch);

// 2. پاکەت نوێ بکەرەوە
await updatePackage(package.id, {
  calculatedCostUsd: price,
  isCharged: true
});

// 3. Ledger entry دروست بکە
await createLedgerEntry({
  customerId: package.customerId,
  type: 'charge',
  amountUsd: price,
  referenceType: 'package',
  referenceId: package.id
});

// 4. Invoice دروست بکە
const invoice = await createInvoice({
  customerId: package.customerId,
  totalAmountUsd: price,
  items: [{
    packageId: package.id,
    description: `Shipping: ${package.trackingNumber}`,
    unitPriceUsd: price
  }]
});

// 5. Revenue تۆمار بکە
await createRevenueRecord({
  type: 'shipping',
  amountUsd: price,
  referenceType: 'package',
  referenceId: package.id
});
```

### 7.4 سیستەمی دارایی کۆمپانیا

#### پەڕەکان:
| پەڕە | ڕێگا | وەسف |
|------|------|------|
| CompanyFinanceDashboard | `/company-finance` | داشبۆرد |
| Treasury | `/treasury` | کاش و بانک |
| Expenses | `/expenses` | خەرجییەکان |
| Partners | `/partners` | هاوبەشەکان |
| CompanyDebts | `/company-debts` | قەرزی کۆمپانیا |
| ProfitLossReport | `/profit-loss-report` | ڕاپۆرتی قازانج |
| CashFlowReport | `/cash-flow-report` | ڕاپۆرتی کاش |
| BalanceSheet | `/balance-sheet` | تەرازوونامە |

---

## 8. سیستەمی سکان و کۆگا

### 8.1 جۆرەکانی سکان

| جۆر | وەسف | کردار |
|-----|------|-------|
| **Register** | تۆمارکردنی پاکەتی نوێ | دروستکردنی پاکەت |
| **Receive China** | وەرگرتن لە کۆگای چین | ستاتەس → registered |
| **Ship** | ناردن لە چین | ستاتەس → in_transit |
| **Arrive** | گەیشتن بە عێراق | ستاتەس → ready_for_delivery + charge |
| **Deliver** | گەیاندن بە کڕیار | ستاتەس → delivered |

### 8.2 Warehouse Operations

```typescript
// WarehouseOperations.tsx
const handleScan = async (trackingNumber: string) => {
  // 1. گەڕان بۆ پاکەت
  const pkg = await trpc.scanning.searchByTracking.query({ 
    trackingNumber 
  });
  
  if (!pkg) {
    // پاکەت نەدۆزرایەوە - فۆرمی تۆمارکردن نیشان بدە
    setShowQuickRegister(true);
    return;
  }
  
  // 2. ستاتەس بگۆڕە بەپێی تابی هەڵبژێردراو
  const newStatus = getStatusForTab(activeTab);
  
  // 3. ئەگەر Arrive بوو، نرخ حیساب بکە
  if (activeTab === 'arrive') {
    await trpc.scanning.updatePackageInline.mutate({
      packageId: pkg.id,
      status: 'ready_for_delivery',
      // نرخ خۆکار حیساب دەکرێت
    });
  } else {
    await trpc.packages.updateStatus.mutate({
      id: pkg.id,
      status: newStatus
    });
  }
  
  // 4. سکان تۆمار بکە
  await trpc.scanning.registerScan.mutate({
    packageId: pkg.id,
    scanType: activeTab
  });
  
  // 5. ئاگاداری بنێرە بۆ کڕیار
  await notifyCustomer(pkg.customerId, newStatus);
};
```

### 8.3 AI Smart Scanner

```typescript
// AISmartScanner.tsx
const handleImageScan = async (imageBase64: string) => {
  // 1. LLM Vision بەکاربهێنە بۆ خوێندنەوەی لەیبڵ
  const result = await trpc.scanning.aiScanLabel.mutate({
    imageBase64
  });
  
  // 2. زانیاری دەرهێنراو:
  // - کۆدی کڕیار (AZ0001)
  // - ژمارەی شوێنکەوتن
  // - وەسفی کاڵا (بە چینی)
  // - وەرگێڕان بۆ کوردی
  
  // 3. کڕیار بدۆزەرەوە
  const customer = await trpc.customers.searchByCode.query({
    code: result.customerCode
  });
  
  // 4. فۆرم پڕ بکەرەوە
  setFormData({
    customerId: customer?.id,
    trackingNumber: result.trackingNumber,
    description: result.descriptionKu
  });
};
```

### 8.4 پەڕەکانی سکان

| پەڕە | ڕێگا | وەسف |
|------|------|------|
| WarehouseOperations | `/warehouse-operations` | سکانی سەرەکی |
| AISmartScanner | `/ai-scanner` | سکانی AI |
| ScanDashboard | `/scan-dashboard` | داشبۆردی سکان |
| ScanReports | `/scan-reports` | ڕاپۆرتی سکان |
| MobileScanner | `/mobile-scanner` | سکانی موبایل |

---

## 9. پۆرتاڵی کڕیار

### 9.1 ئەرکیتەکچەر

پۆرتاڵی کڕیار بە شێوەی ئەپی موبایل دیزاین کراوە بە Bottom Navigation:

```
┌─────────────────────────────────────────┐
│              Content Area               │
│                                         │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│  🏠    📦    🏠    💰    👤            │
│ Home  Ship  HOME  Money  Me            │
└─────────────────────────────────────────┘
```

### 9.2 تابەکان

| تاب | وەسف | تایبەتمەندییەکان |
|-----|------|-----------------|
| **Home** | سەرەتا | ئامار، گواستنەوەی تازە، هەواڵ |
| **Shipments** | گواستنەوەکان | لیستی باچ و پاکەت، فلتەر |
| **Full Package** | کڕینی کاڵا | داواکارییەکان |
| **Financial** | دارایی | باڵانس، مامەڵەکان، ئینڤۆیس |
| **Me** | پرۆفایل | ڕێکخستنەکان، یارمەتی |

### 9.3 تایبەتمەندییەکان

- **شوێنکەوتنی پاکەت** - گەڕان بە tracking number
- **بینینی باچ** - پاکەتەکانی کڕیار لە هەر باچ
- **مێژووی مامەڵە** - هەموو charge و payment
- **داگرتنی ئینڤۆیس** - PDF
- **پەیام** - نامەنێری بۆ پشتگیری
- **ئاگاداری** - ئاگادارییەکان
- **ناونیشان** - بەڕێوەبردنی ناونیشان
- **زمان** - گۆڕینی زمان
- **تاریک/ڕووناک** - گۆڕینی تەم

### 9.4 پەڕەکان

| پەڕە | ڕێگا | وەسف |
|------|------|------|
| CustomerPortal | `/portal` | لەیاوتی سەرەکی |
| PortalHome | `/portal/home` | سەرەتا |
| PortalShipments | `/portal/shipments` | گواستنەوەکان |
| PortalBatchDetail | `/portal/batch/:id` | وردەکاری باچ |
| PortalFullPackage | `/portal/full-package` | کڕینی کاڵا |
| PortalFinancial | `/portal/financial` | دارایی |
| PortalProfile | `/portal/me` | پرۆفایل |
| PortalMessages | `/portal/messages` | پەیامەکان |
| PortalNotifications | `/portal/notifications` | ئاگادارییەکان |
| PortalAddresses | `/portal/addresses` | ناونیشانەکان |
| PortalBlog | `/portal/blog` | هەواڵەکان |

---

## 10. سیستەمی ڕاپۆرتەکان

### 10.1 جۆرەکانی ڕاپۆرت

| ڕاپۆرت | وەسف | فۆرمات |
|--------|------|--------|
| **Dashboard Report** | پوختەی ڕۆژانە/هەفتانە/مانگانە | PDF |
| **Customer Report** | پاکەت و پارەدانی کڕیار | PDF |
| **Batch Report** | وردەکاری باچ و قازانج | PDF |
| **P&L Report** | قازانج و زیان | PDF, Excel |
| **Cash Flow** | ڕەوتی کاش | PDF |
| **Balance Sheet** | تەرازوونامە | PDF |
| **Scan Report** | ئاماری سکان | PDF |
| **Debtors Report** | قەرزدارەکان | PDF |

### 10.2 دروستکردنی PDF

```typescript
// server/db.ts
export async function generateDashboardPdf(options: {
  dateRange: 'week' | 'month' | 'year';
}) {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument();
  
  // هێڵی سەرەوە
  doc.fontSize(24).text('Wazn Express', { align: 'center' });
  doc.fontSize(16).text('Dashboard Report', { align: 'center' });
  
  // ئامارەکان
  const stats = await getDashboardStats();
  doc.fontSize(12);
  doc.text(`Total Revenue: $${stats.revenue}`);
  doc.text(`Total Packages: ${stats.packages}`);
  doc.text(`Total Customers: ${stats.customers}`);
  
  // خشتە
  // ...
  
  return doc;
}
```

### 10.3 ئەکسپۆرتی Excel

```typescript
// Packages.tsx
const exportToExcel = () => {
  const data = packages.map(pkg => ({
    'Package Code': pkg.packageCode,
    'Tracking': pkg.trackingNumber,
    'Customer': pkg.customerName,
    'Weight': pkg.weightKg,
    'Status': pkg.status,
    'Cost': pkg.calculatedCostUsd
  }));
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Packages');
  XLSX.writeFile(wb, 'packages.xlsx');
};
```

---

## 11. سیستەمی زمان (i18n)

### 11.1 زمانە پشتگیری کراوەکان

| زمان | کۆد | ئاراستە |
|------|-----|---------|
| کوردی | `ku` | RTL |
| ئینگلیزی | `en` | LTR |
| عەرەبی | `ar` | RTL |
| چینی | `zh` | LTR |

### 11.2 ستراکچەری فایلەکان

```
client/src/locales/
├── ku.json    # کوردی (سەرەکی)
├── en.json    # ئینگلیزی
├── ar.json    # عەرەبی
└── zh.json    # چینی
```

### 11.3 نموونەی فایلی وەرگێڕان

```json
// ku.json
{
  "nav": {
    "dashboard": "داشبۆرد",
    "customers": "کڕیارەکان",
    "packages": "پاکەتەکان",
    "batches": "باچەکان"
  },
  "common": {
    "save": "پاشەکەوتکردن",
    "cancel": "پاشگەزبوونەوە",
    "delete": "سڕینەوە",
    "edit": "دەستکاری",
    "search": "گەڕان"
  },
  "customers": {
    "title": "کڕیارەکان",
    "addNew": "زیادکردنی کڕیار",
    "customerCode": "کۆدی کڕیار",
    "fullName": "ناوی تەواو",
    "mobileNumber": "ژمارەی مۆبایل"
  }
}
```

### 11.4 بەکارهێنان لە کۆمپۆنێنت

```typescript
// LanguageContext.tsx
export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('ku');
  const [translations, setTranslations] = useState({});
  
  const t = (key: string) => {
    const keys = key.split('.');
    let value = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };
  
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

// بەکارهێنان
const { t } = useLanguage();
<h1>{t('customers.title')}</h1>
```

---

## 12. ڕێنمایی جێبەجێکردن

### 12.1 هەنگاوەکانی دروستکردن

#### هەنگاوی ١: دامەزراندنی پڕۆژە

```bash
# پڕۆژە دروست بکە
pnpm create vite my-cargo-system --template react-ts

# پاکەتەکان دابەزێنە
pnpm add @trpc/client @trpc/server @trpc/react-query
pnpm add drizzle-orm mysql2
pnpm add express cors
pnpm add tailwindcss @shadcn/ui
```

#### هەنگاوی ٢: داتابەیس

```bash
# schema.ts بنووسە
# migration دروست بکە
pnpm db:push
```

#### هەنگاوی ٣: Backend

```typescript
// 1. db.ts - فەنکشنەکانی داتابەیس
// 2. routers.ts - tRPC پرۆسیجەرەکان
// 3. auth - ئۆتەنتیکەیشن
```

#### هەنگاوی ٤: Frontend

```typescript
// 1. App.tsx - ڕاوتینگ
// 2. pages/ - پەڕەکان
// 3. components/ - کۆمپۆنێنتەکان
// 4. locales/ - زمانەکان
```

### 12.2 پێشنیاری ستراکچەر

```
my-cargo-system/
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Customers.tsx
│   │   │   ├── Packages.tsx
│   │   │   ├── Batches.tsx
│   │   │   ├── Finance.tsx
│   │   │   └── ...
│   │   ├── components/
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── ...
│   │   ├── contexts/
│   │   │   ├── LanguageContext.tsx
│   │   │   └── AuthContext.tsx
│   │   ├── locales/
│   │   │   ├── ku.json
│   │   │   └── en.json
│   │   ├── lib/
│   │   │   └── trpc.ts
│   │   └── App.tsx
│   └── index.html
├── server/
│   ├── db.ts
│   ├── routers.ts
│   └── _core/
├── drizzle/
│   └── schema.ts
└── package.json
```

### 12.3 چەند تێبینی گرنگ

1. **کۆدی کڕیار**: فۆرماتی `AZ{number}({name})` بەکاربهێنە - ئاسانە بۆ ناسینەوە
2. **نرخدانان**: سیستەمی پلەبەندی بەکاربهێنە بۆ نرخی دادپەروەرانە
3. **سکان**: Workflow-based scanning بەکاربهێنە (Receive → Ship → Arrive → Deliver)
4. **دارایی**: Ledger-based accounting بەکاربهێنە بۆ شوێنکەوتنی دەقیق
5. **زمان**: لە سەرەتاوە i18n دابنێ - زۆر ئاسانترە لە دواتر زیادکردن
6. **PWA**: Progressive Web App بکە بۆ ئەزموونی باشتری موبایل

### 12.4 فرمانە بەکارهاتووەکان

```bash
# سەرڤەر دەستپێبکە
pnpm dev

# داتابەیس push بکە
pnpm db:push

# تێست ڕان بکە
pnpm test

# بیلد بکە
pnpm build
```

---

## کۆتایی

ئەم دۆکیومێنتە ڕێنماییەکی تەواوە بۆ دروستکردنی سیستەمی بەڕێوەبردنی کارگۆ وەک **Wazn Express**. بە شوێنکەوتنی ئەم ستراکچەر و تایبەتمەندییانە، دەتوانیت سیستەمێکی هاوشێوە دروست بکەیت بۆ هەر کۆمپانیایەکی کارگۆ.

**تایبەتمەندییە سەرەکییەکان:**
- ✅ بەڕێوەبردنی کڕیار بە کۆدی تایبەت
- ✅ شوێنکەوتنی پاکەت لە سەرەتاوە تا گەیاندن
- ✅ سیستەمی باچ بۆ کۆکردنەوەی پاکەتەکان
- ✅ نرخدانانی پلەبەندی و تایبەتی کڕیار
- ✅ سیستەمی دارایی تەواو (قەرز، پارەدان، ئینڤۆیس)
- ✅ سکانەری QR/باڕکۆد بە AI
- ✅ Full Package (کڕینی کاڵا)
- ✅ پۆرتاڵی کڕیار (موبایل ئەپ)
- ✅ ڕاپۆرتی زۆر بە PDF و Excel
- ✅ پشتگیری چەند زمان (کوردی، ئینگلیزی، عەرەبی، چینی)

---

**نووسەر:** Manus AI  
**بەرواری:** ٥ی کانوونی دووەم ٢٠٢٦
