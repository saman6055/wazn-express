import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../client/src/locales');

// New translation keys to add
const newKeys = {
  common: {
    unknown: {
      en: "Unknown",
      ku: "نەزانراو",
      ar: "غير معروف",
      zh: "未知"
    },
    saving: {
      en: "Saving...",
      ku: "پاشەکەوتکردن...",
      ar: "جاري الحفظ...",
      zh: "保存中..."
    },
    saveChanges: {
      en: "Save Changes",
      ku: "پاشەکەوتکردنی گۆڕانکارییەکان",
      ar: "حفظ التغييرات",
      zh: "保存更改"
    },
    exportPdf: {
      en: "Export PDF",
      ku: "هەناردەکردنی PDF",
      ar: "تصدير PDF",
      zh: "导出PDF"
    }
  },
  customers: {
    selectCity: {
      en: "Select city...",
      ku: "شار هەڵبژێرە...",
      ar: "اختر المدينة...",
      zh: "选择城市..."
    },
    selectGovernorateFirst: {
      en: "Select governorate first",
      ku: "سەرەتا پارێزگا هەڵبژێرە",
      ar: "اختر المحافظة أولاً",
      zh: "请先选择省份"
    },
    noCustomersFound: {
      en: "No customers found",
      ku: "هیچ کڕیارێک نەدۆزرایەوە",
      ar: "لم يتم العثور على عملاء",
      zh: "未找到客户"
    },
    searchPlaceholder: {
      en: "Search by name, code, or phone...",
      ku: "گەڕان بە ناو، کۆد، یان ژمارەی تەلەفۆن...",
      ar: "البحث بالاسم أو الرمز أو الهاتف...",
      zh: "按姓名、代码或电话搜索..."
    },
    customerType: {
      en: "Customer Type",
      ku: "جۆری کڕیار",
      ar: "نوع العميل",
      zh: "客户类型"
    },
    resetPasswordDescription: {
      en: "Enter a new password for this customer",
      ku: "وشەی نهێنی نوێ بنووسە بۆ ئەم کڕیارە",
      ar: "أدخل كلمة مرور جديدة لهذا العميل",
      zh: "为此客户输入新密码"
    },
    stats: {
      total: {
        en: "Total Customers",
        ku: "کۆی کڕیارەکان",
        ar: "إجمالي العملاء",
        zh: "客户总数"
      },
      active: {
        en: "Active",
        ku: "چالاک",
        ar: "نشط",
        zh: "活跃"
      },
      inactive: {
        en: "Inactive",
        ku: "ناچالاک",
        ar: "غير نشط",
        zh: "不活跃"
      },
      vip: {
        en: "VIP",
        ku: "VIP",
        ar: "VIP",
        zh: "VIP"
      }
    },
    form: {
      namePlaceholder: {
        en: "John Doe",
        ku: "ناوی کڕیار",
        ar: "اسم العميل",
        zh: "客户姓名"
      },
      addressPlaceholder: {
        en: "Street name, building number, etc.",
        ku: "ناوی شەقام، ژمارەی بینا، هتد.",
        ar: "اسم الشارع، رقم المبنى، إلخ.",
        zh: "街道名称、建筑号码等"
      },
      documentsDescription: {
        en: "Upload customer documents (passport, national ID, contract)",
        ku: "بەڵگەنامەکانی کڕیار بارکە (پاسپۆرت، ناسنامە، گرێبەست)",
        ar: "تحميل مستندات العميل (جواز السفر، الهوية الوطنية، العقد)",
        zh: "上传客户文件（护照、身份证、合同）"
      }
    }
  },
  packages: {
    unclaimed: {
      en: "Unclaimed",
      ku: "بێ خاوەن",
      ar: "غير مطالب به",
      zh: "无人认领"
    },
    allowPopups: {
      en: "Please allow popups to print labels",
      ku: "تکایە ڕێگە بە پۆپ ئەپەکان بدە بۆ چاپکردنی لێبڵەکان",
      ar: "يرجى السماح بالنوافذ المنبثقة لطباعة الملصقات",
      zh: "请允许弹出窗口以打印标签"
    },
    allStatuses: {
      en: "All Statuses",
      ku: "هەموو بارودۆخەکان",
      ar: "جميع الحالات",
      zh: "所有状态"
    },
    allTypes: {
      en: "All Types",
      ku: "هەموو جۆرەکان",
      ar: "جميع الأنواع",
      zh: "所有类型"
    },
    allAlerts: {
      en: "All Alerts",
      ku: "هەموو ئاگادارکردنەوەکان",
      ar: "جميع التنبيهات",
      zh: "所有警报"
    },
    clickToChangeStatus: {
      en: "Click to change status",
      ku: "کرتە بکە بۆ گۆڕینی بارودۆخ",
      ar: "انقر لتغيير الحالة",
      zh: "点击更改状态"
    },
    viewDetails: {
      en: "View Details",
      ku: "بینینی وردەکاری",
      ar: "عرض التفاصيل",
      zh: "查看详情"
    },
    selectStatus: {
      en: "Select status",
      ku: "بارودۆخ هەڵبژێرە",
      ar: "اختر الحالة",
      zh: "选择状态"
    }
  },
  batches: {
    allBatches: {
      en: "All Batches",
      ku: "هەموو باچەکان",
      ar: "جميع الدفعات",
      zh: "所有批次"
    },
    statusUpdated: {
      en: "Batch status updated",
      ku: "بارودۆخی باچ نوێکرایەوە",
      ar: "تم تحديث حالة الدفعة",
      zh: "批次状态已更新"
    },
    customerAlreadyHasPricing: {
      en: "This customer already has custom pricing",
      ku: "ئەم کڕیارە پێشتر نرخی تایبەتی هەیە",
      ar: "هذا العميل لديه بالفعل تسعير مخصص",
      zh: "此客户已有自定义定价"
    },
    selectWarehouse: {
      en: "Select warehouse",
      ku: "کۆگا هەڵبژێرە",
      ar: "اختر المستودع",
      zh: "选择仓库"
    },
    selectDestination: {
      en: "Select destination",
      ku: "مەبەست هەڵبژێرە",
      ar: "اختر الوجهة",
      zh: "选择目的地"
    },
    selectType: {
      en: "Select type",
      ku: "جۆر هەڵبژێرە",
      ar: "اختر النوع",
      zh: "选择类型"
    },
    carrierPlaceholder: {
      en: "Airline/Shipping line details",
      ku: "وردەکاری فڕۆکەخانە/کەشتی",
      ar: "تفاصيل شركة الطيران/الشحن",
      zh: "航空公司/船运公司详情"
    },
    optionalNote: {
      en: "Optional note",
      ku: "تێبینی ئارەزوومەندانە",
      ar: "ملاحظة اختيارية",
      zh: "可选备注"
    },
    createBatch: {
      en: "Create Batch",
      ku: "دروستکردنی باچ",
      ar: "إنشاء دفعة",
      zh: "创建批次"
    },
    viewPackages: {
      en: "View packages",
      ku: "بینینی پاکەتەکان",
      ar: "عرض الطرود",
      zh: "查看包裹"
    },
    financialReport: {
      en: "Financial report",
      ku: "ڕاپۆرتی دارایی",
      ar: "التقرير المالي",
      zh: "财务报告"
    }
  },
  finance: {
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
        // Direct key-value
        if (!translations[section][key]) {
          translations[section][key] = values[lang];
        }
      } else if (typeof values === 'object') {
        // Nested object
        if (!translations[section][key]) {
          translations[section][key] = {};
        }
        for (const [nestedKey, nestedValues] of Object.entries(values)) {
          if (typeof nestedValues === 'object' && nestedValues[lang] !== undefined) {
            if (!translations[section][key][nestedKey]) {
              translations[section][key][nestedKey] = nestedValues[lang];
            }
          }
        }
      }
    }
  }
  
  // Write back
  fs.writeFileSync(filePath, JSON.stringify(translations, null, 2) + '\n');
  console.log(`Updated ${lang}.json`);
});

console.log('Translation files updated successfully!');
