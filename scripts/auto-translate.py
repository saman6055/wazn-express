#!/usr/bin/env python3
"""
Automated translation script for Wazn Express.
Replaces hardcoded Kurdish text with t() function calls and adds translations.
"""

import os
import re
import json
from pathlib import Path
from collections import defaultdict

# Directory paths
PAGES_DIR = Path("/home/ubuntu/wazn-express/client/src/pages")
LOCALES_DIR = Path("/home/ubuntu/wazn-express/client/src/locales")

# Common translations mapping (Kurdish -> translation key)
# This maps common Kurdish phrases to their translation keys
COMMON_TRANSLATIONS = {
    # Common actions
    "تۆمارکردن": "common.save",
    "پاشەکەوتکردن": "common.save",
    "گۆڕانکاری": "common.edit",
    "سڕینەوە": "common.delete",
    "زیادکردن": "common.add",
    "دروستکردن": "common.create",
    "نوێکردنەوە": "common.update",
    "گەڕان": "common.search",
    "فلتەر": "common.filter",
    "هەناردەکردن": "common.export",
    "هاوردەکردن": "common.import",
    "نوێکردنەوە": "common.refresh",
    "داخستن": "common.close",
    "دڵنیاکردنەوە": "common.confirm",
    "بەڵێ": "common.yes",
    "نەخێر": "common.no",
    "هەموو": "common.all",
    "هیچ": "common.none",
    "کردارەکان": "common.actions",
    "بارودۆخ": "common.status",
    "بەروار": "common.date",
    "کات": "common.time",
    "ناو": "common.name",
    "وەسف": "common.description",
    "تێبینی": "common.notes",
    "کۆ": "common.total",
    "بڕ": "common.amount",
    "نرخ": "common.price",
    "ژمارە": "common.quantity",
    "کێش": "common.weight",
    "قەبارە": "common.volume",
    "سەرکەوتوو": "common.success",
    "هەڵە": "common.error",
    "ئاگاداری": "common.warning",
    "زانیاری": "common.info",
    "داتا نییە": "common.noData",
    "ئەنجام نەدۆزرایەوە": "common.noResults",
    "گەڕانەوە": "common.back",
    "دواتر": "common.next",
    "پێشتر": "common.previous",
    "ناردن": "common.submit",
    "ڕیسێتکردن": "common.reset",
    "پاککردنەوە": "common.clear",
    "هەڵبژاردن": "common.select",
    "داگرتن": "common.download",
    "بارکردن": "common.upload",
    "چاپکردن": "common.print",
    "کۆپیکردن": "common.copy",
    "بینین": "common.view",
    "وردەکاری": "common.details",
    "زیاتر": "common.more",
    "کەمتر": "common.less",
    "چالاک": "common.active",
    "ناچالاک": "common.inactive",
    "پێویست": "common.required",
    "ئارەزوومەندانە": "common.optional",
    "نوێ": "common.new",
    "کۆن": "common.old",
    "لە": "common.from",
    "بۆ": "common.to",
    "ئەمڕۆ": "common.today",
    "دوێنێ": "common.yesterday",
    "سبەینێ": "common.tomorrow",
    "ئەم هەفتەیە": "common.thisWeek",
    "هەفتەی ڕابردوو": "common.lastWeek",
    "ئەم مانگە": "common.thisMonth",
    "مانگی ڕابردوو": "common.lastMonth",
    "ئەم ساڵە": "common.thisYear",
    "ساڵی ڕابردوو": "common.lastYear",
    "چاوەڕوان بە...": "common.loading",
    "چاوەڕوانبە...": "common.loading",
    "چاوەڕوانبکە...": "common.loading",
    "بارکردن...": "common.loading",
    "پاشگەزبوونەوە": "common.cancel",
    "هەڵوەشاندنەوە": "common.cancel",
    
    # Finance
    "دارایی": "finance.title",
    "پارەدان": "finance.payments",
    "پارەدانەکان": "finance.payments",
    "تۆمارکردنی پارەدان": "finance.recordPayment",
    "قەرزداران": "finance.debtors",
    "کۆی قەرز": "finance.totalDebt",
    "کۆی پارەدان": "finance.totalPayments",
    "کۆی حسابەکان": "finance.totalAccounts",
    "حسابی چالاک": "finance.activeAccounts",
    "باڵانسی نێت": "finance.netBalance",
    "پوختە": "finance.overview",
    "حسابەکان": "finance.accounts",
    "حسابی کڕیاران": "finance.customerAccounts",
    "هەموو حسابەکان": "finance.allAccounts",
    "ژمارەی حساب": "finance.accountNumber",
    "نەقد": "finance.cash",
    "گواستنەوەی بانکی": "finance.bankTransfer",
    "کارت": "finance.card",
    "بانک": "finance.bank",
    "شێواز": "finance.method",
    "ژمارەی سەندی": "finance.referenceNumber",
    "ژمارەی سەند": "finance.referenceNumber",
    
    # Customers
    "کڕیارەکان": "customers.title",
    "کڕیار": "customers.title",
    "زیادکردنی کڕیار": "customers.addCustomer",
    "دەستکاریکردنی کڕیار": "customers.editCustomer",
    "سڕینەوەی کڕیار": "customers.deleteCustomer",
    "ناوی کڕیار": "customers.customerName",
    "کۆدی کڕیار": "customers.customerCode",
    "ژمارەی تەلەفۆن": "customers.phone",
    "ئیمەیڵ": "customers.email",
    "ناونیشان": "customers.address",
    "شار": "customers.city",
    "وڵات": "customers.country",
    "باڵانس": "customers.balance",
    
    # Packages
    "پاکەتەکان": "packages.title",
    "پاکەت": "packages.title",
    "تۆمارکردنی پاکەت": "packages.registerPackage",
    "کۆدی پاکەت": "packages.packageCode",
    "ژمارەی تراکینگ": "packages.trackingNumber",
    "کێشی ڕاستەقینە": "packages.actualWeight",
    "کێشی قەبارەیی": "packages.volumetricWeight",
    "تۆمارکراو": "packages.registered",
    "لە کۆگا": "packages.inWarehouse",
    "لە باچ": "packages.inBatch",
    "لە ڕێگا": "packages.onRoute",
    "گەیشتووە": "packages.arrived",
    "گەیاندرا": "packages.delivered",
    "گەڕێندراوە": "packages.returned",
    "ونبووە": "packages.lost",
    "زیانی پێگەیشتووە": "packages.damaged",
    
    # Batches
    "باچەکان": "batches.title",
    "باچ": "batches.title",
    "باچی نوێ": "batches.newBatch",
    "کۆدی باچ": "batches.batchCode",
    "ناوی باچ": "batches.batchName",
    "گواستنەوە": "batches.carrier",
    "بەرواری ڕۆیشتن": "batches.departureDate",
    "بەرواری گەیشتنی چاوەڕوانکراو": "batches.expectedArrival",
    "بەرواری گەیشتنی ڕاستەقینە": "batches.actualArrival",
    "ئامادەکردن": "batches.preparing",
    "ڕۆیشتووە": "batches.departed",
    "لە گواستنەوە": "batches.inTransit",
    "تەواوبوو": "batches.completed",
    "هەڵوەشێنراوە": "batches.cancelled",
    
    # Shipping types
    "ئاسمانی ئاسایی": "packages.airRegular",
    "ئاسمانی نائاسایی": "packages.airIrregular",
    "دەریایی": "packages.sea",
    "جۆری گواستنەوە": "packages.shippingType",
    
    # Dashboard
    "داشبۆرد": "dashboard.title",
    "بەخێربێیت!": "dashboard.welcome",
    "ڕاپۆرتی ڕۆژانە": "dashboard.dailyReport",
    "داهاتی ئەمڕۆ": "dashboard.todayIncome",
    "داهاتی هەفتانە": "dashboard.weeklyIncome",
    "داهاتی مانگانە": "dashboard.monthlyIncome",
    "پاکەتەکانی ئەمڕۆ": "dashboard.todayPackages",
    "کڕیارە نوێیەکان": "dashboard.newCustomers",
    "باچە چالاکەکان": "dashboard.activeBatches",
    
    # Full Package
    "پاکەتی تەواو": "fullPackage.title",
    "داواکاری نوێ": "fullPackage.newOrder",
    "کۆدی داواکاری": "fullPackage.orderCode",
    "ناوی بەرهەم": "fullPackage.productName",
    "لینکی بەرهەم": "fullPackage.productLink",
    "نرخی کڕین": "fullPackage.purchasePrice",
    "نرخی فرۆشتن": "fullPackage.sellingPrice",
    "قازانج": "fullPackage.profit",
    "دابینکەر": "fullPackage.supplier",
    
    # Scanning
    "سکان": "scanning.title",
    "سکانکردن": "scanning.title",
    "سکانی پاکەت": "scanning.scanPackage",
    "سکانی بارکۆد": "scanning.scanBarcode",
    "کامێرا": "scanning.camera",
    "داخڵکردنی دەستی": "scanning.manualEntry",
    "سکانەکانی ئەمڕۆ": "scanning.todayScans",
    "کۆی سکانەکان": "scanning.totalScans",
    
    # Reports
    "ڕاپۆرتەکان": "reports.title",
    "ڕاپۆرت": "reports.title",
    "ڕاپۆرتی هەفتانە": "reports.weeklyReport",
    "ڕاپۆرتی مانگانە": "reports.monthlyReport",
    "ڕاپۆرتی ساڵانە": "reports.yearlyReport",
    
    # Settings
    "ڕێکخستنەکان": "settings.title",
    "ڕێکخستن": "settings.title",
    "زمان": "settings.language",
    "ڕووکار": "settings.appearance",
    "تاریک": "settings.darkMode",
    "ڕووناک": "settings.lightMode",
    "ئاگادارکردنەوەکان": "settings.notifications",
    "پڕۆفایل": "settings.profile",
    "ئەمنیەت": "settings.security",
    "گۆڕینی وشەی نهێنی": "settings.changePassword",
    
    # Company Finance
    "دارایی کۆمپانیا": "companyFinance.title",
    "قازانج و زەرەر": "companyFinance.profitLoss",
    "جووڵەی پارە": "companyFinance.cashFlow",
    "تەرازووی حساب": "companyFinance.balanceSheet",
    "حسابە بانکییەکان": "companyFinance.bankAccounts",
    "خەرجییەکان": "companyFinance.expenses",
    "هاوبەشەکان": "companyFinance.partners",
    "قەرزەکان": "companyFinance.debts",
    "خەزنە": "companyFinance.treasury",
}

def generate_translation_key(text, page_name):
    """Generate a translation key for a given text"""
    # First check if we have a common translation
    clean_text = text.strip()
    if clean_text in COMMON_TRANSLATIONS:
        return COMMON_TRANSLATIONS[clean_text]
    
    # Generate a new key based on page name
    page_prefix = page_name.replace('.tsx', '').lower()
    # Convert to camelCase key
    words = clean_text[:30].split()[:3]  # Take first 3 words, max 30 chars
    if len(words) > 1:
        key = words[0].lower() + ''.join(w.capitalize() for w in words[1:])
    else:
        key = clean_text[:20].lower().replace(' ', '_')
    
    return f"page.{page_prefix}.{key}"

def process_file(file_path):
    """Process a single TSX file and return translation mappings"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    translations = {}
    replacements = []
    
    # Check if file already imports useLanguage
    has_language_import = 'useLanguage' in content or 'useTranslation' in content
    has_t_destructure = 'const { t }' in content or 'const {t}' in content
    
    # Pattern for JSX text: >Kurdish text<
    jsx_pattern = re.compile(r'(>)([^<>]*[\u0600-\u06FF]+[^<>]*)(<)')
    
    for match in jsx_pattern.finditer(content):
        text = match.group(2).strip()
        if text and len(text) > 1:
            key = generate_translation_key(text, file_path.name)
            if key.startswith('page.'):
                # Skip complex keys for now
                continue
            translations[key] = text
            replacements.append({
                'original': match.group(0),
                'replacement': f'>{{t("{key}")}}<',
                'text': text,
                'key': key
            })
    
    return {
        'file': str(file_path),
        'has_language_import': has_language_import,
        'has_t_destructure': has_t_destructure,
        'translations': translations,
        'replacements': replacements
    }

def main():
    """Main function"""
    all_translations = defaultdict(dict)
    file_reports = []
    
    for tsx_file in sorted(PAGES_DIR.glob("*.tsx")):
        result = process_file(tsx_file)
        if result['translations']:
            file_reports.append(result)
            for key, text in result['translations'].items():
                all_translations['ku'][key] = text
    
    # Print summary
    print(f"\n{'='*60}")
    print("TRANSLATION EXTRACTION SUMMARY")
    print(f"{'='*60}\n")
    
    total_keys = len(all_translations['ku'])
    print(f"Total unique translation keys: {total_keys}")
    print(f"Files with hardcoded text: {len(file_reports)}")
    
    # Save translations to be added
    output_path = Path("/home/ubuntu/wazn-express/scripts/new-translations.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(dict(all_translations), f, ensure_ascii=False, indent=2)
    
    print(f"\nNew translations saved to: {output_path}")
    
    # Print sample of common translations found
    print(f"\n{'='*60}")
    print("COMMON TRANSLATIONS FOUND:")
    print(f"{'='*60}\n")
    
    for key, text in list(all_translations['ku'].items())[:20]:
        print(f"  {key}: {text}")

if __name__ == "__main__":
    main()
