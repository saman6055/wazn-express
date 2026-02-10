import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../client/src/locales');

// New translation keys to add for Finance and other pages
const newKeys = {
  common: {
    viewAll: {
      en: "View All",
      ku: "هەموو ببینە",
      ar: "عرض الكل",
      zh: "查看全部"
    },
    saving: {
      en: "Saving...",
      ku: "پاشەکەوتکردن...",
      ar: "جاري الحفظ...",
      zh: "保存中..."
    }
  },
  finance: {
    recordPaymentDesc: {
      en: "Record a new payment from a customer",
      ku: "تۆمارکردنی پارەدانی نوێ لە کڕیارێک",
      ar: "تسجيل دفعة جديدة من عميل",
      zh: "记录客户的新付款"
    },
    selectCustomerLabel: {
      en: "Select Customer",
      ku: "هەڵبژاردنی کڕیار",
      ar: "اختر العميل",
      zh: "选择客户"
    },
    amountUsd: {
      en: "Amount (USD)",
      ku: "بڕ (USD)",
      ar: "المبلغ (USD)",
      zh: "金额 (USD)"
    },
    paymentRecorded: {
      en: "Payment recorded successfully",
      ku: "پارەدان بە سەرکەوتوویی تۆمارکرا",
      ar: "تم تسجيل الدفع بنجاح",
      zh: "付款记录成功"
    },
    selectCustomer: {
      en: "Select a customer",
      ku: "کڕیارێک هەڵبژێرە",
      ar: "اختر عميلاً",
      zh: "选择客户"
    },
    referencePlaceholder: {
      en: "Transaction or receipt number",
      ku: "ژمارەی مامەڵە یان وەسڵ",
      ar: "رقم المعاملة أو الإيصال",
      zh: "交易或收据编号"
    },
    referenceNumber: {
      en: "Reference Number",
      ku: "ژمارەی سەندی",
      ar: "رقم المرجع",
      zh: "参考编号"
    },
    mobileMoney: {
      en: "Mobile Money",
      ku: "پارەی مۆبایل",
      ar: "المال المتنقل",
      zh: "移动支付"
    },
    other: {
      en: "Other",
      ku: "تر",
      ar: "أخرى",
      zh: "其他"
    },
    debtorCustomers: {
      en: "debtor customers",
      ku: "کڕیاری قەرزدار",
      ar: "عملاء مدينون",
      zh: "欠款客户"
    },
    totalPayments: {
      en: "Total Payments",
      ku: "کۆی پارەدان",
      ar: "إجمالي المدفوعات",
      zh: "总付款"
    },
    totalAccounts: {
      en: "Total Accounts",
      ku: "کۆی حسابەکان",
      ar: "إجمالي الحسابات",
      zh: "账户总数"
    },
    activeAccounts: {
      en: "Active Accounts",
      ku: "حسابی چالاک",
      ar: "الحسابات النشطة",
      zh: "活跃账户"
    },
    netBalance: {
      en: "Net Balance",
      ku: "باڵانسی نێت",
      ar: "الرصيد الصافي",
      zh: "净余额"
    },
    debtMinusCredit: {
      en: "Debt - Credit",
      ku: "قەرز - کرێدیت",
      ar: "الدين - الائتمان",
      zh: "债务 - 信用"
    },
    overview: {
      en: "Overview",
      ku: "پوختە",
      ar: "نظرة عامة",
      zh: "概览"
    },
    accounts: {
      en: "Accounts",
      ku: "حسابەکان",
      ar: "الحسابات",
      zh: "账户"
    },
    customerAccounts: {
      en: "Customer Accounts",
      ku: "حسابی کڕیاران",
      ar: "حسابات العملاء",
      zh: "客户账户"
    },
    allAccounts: {
      en: "All Accounts",
      ku: "هەموو حسابەکان",
      ar: "جميع الحسابات",
      zh: "所有账户"
    },
    searchAccounts: {
      en: "Search by code, name, or mobile...",
      ku: "گەڕان بە کۆد، ناو، یان مۆبایل...",
      ar: "البحث بالرمز أو الاسم أو الجوال...",
      zh: "按代码、姓名或手机搜索..."
    },
    accountNumber: {
      en: "Account Number",
      ku: "ژمارەی حساب",
      ar: "رقم الحساب",
      zh: "账号"
    },
    balanceUsd: {
      en: "Balance (USD)",
      ku: "باڵانس (USD)",
      ar: "الرصيد (USD)",
      zh: "余额 (USD)"
    },
    balanceIqd: {
      en: "Balance (IQD)",
      ku: "باڵانس (IQD)",
      ar: "الرصيد (IQD)",
      zh: "余额 (IQD)"
    },
    totalReceived: {
      en: "Total Received",
      ku: "کۆی وەرگیراو",
      ar: "إجمالي المستلم",
      zh: "总收款"
    },
    bank: {
      en: "Bank",
      ku: "بانک",
      ar: "بنك",
      zh: "银行"
    },
    method: {
      en: "Method",
      ku: "شێواز",
      ar: "الطريقة",
      zh: "方式"
    },
    noPayments: {
      en: "No payments found",
      ku: "هیچ پارەدانێک نەدۆزرایەوە",
      ar: "لم يتم العثور على مدفوعات",
      zh: "未找到付款"
    },
    recordFirstPayment: {
      en: "Record your first payment to get started",
      ku: "یەکەم پارەدان تۆمار بکە بۆ دەستپێکردن",
      ar: "سجل أول دفعة للبدء",
      zh: "记录您的第一笔付款以开始"
    },
    searchPayments: {
      en: "Search by customer or reference...",
      ku: "گەڕان بە کڕیار یان ژمارەی سەند...",
      ar: "البحث بالعميل أو المرجع...",
      zh: "按客户或参考搜索..."
    }
  }
};

// Function to deep merge objects
function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// Process each language file
const languages = ['en', 'ku', 'ar', 'zh'];

languages.forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  
  // Read existing translations
  let translations = {};
  if (fs.existsSync(filePath)) {
    translations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  
  // Add new keys
  for (const [section, keys] of Object.entries(newKeys)) {
    if (!translations[section]) {
      translations[section] = {};
    }
    
    for (const [key, values] of Object.entries(keys)) {
      if (typeof values === 'object' && values[lang] !== undefined) {
        // Only add if key doesn't exist
        if (translations[section][key] === undefined) {
          translations[section][key] = values[lang];
        }
      }
    }
  }
  
  // Write back
  fs.writeFileSync(filePath, JSON.stringify(translations, null, 2) + '\n');
  console.log(`Updated ${lang}.json`);
});

console.log('Translation files updated successfully!');
