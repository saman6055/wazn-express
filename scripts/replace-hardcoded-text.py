#!/usr/bin/env python3
"""
Replace hardcoded Kurdish text in TSX files with t() function calls.
This script processes all pages and replaces common patterns.
"""

import re
import json
from pathlib import Path

PAGES_DIR = Path("/home/ubuntu/wazn-express/client/src/pages")
LOCALES_DIR = Path("/home/ubuntu/wazn-express/client/src/locales")

# Load Kurdish translations to build replacement map
def load_translations():
    with open(LOCALES_DIR / "ku.json", 'r', encoding='utf-8') as f:
        return json.load(f)

# Build reverse mapping: Kurdish text -> translation key
def build_reverse_map(translations, prefix=""):
    reverse_map = {}
    for key, value in translations.items():
        full_key = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            reverse_map.update(build_reverse_map(value, full_key))
        elif isinstance(value, str) and value:
            reverse_map[value] = full_key
    return reverse_map

# Common replacements for Kurdish text patterns
COMMON_REPLACEMENTS = {
    # Common labels
    "تۆمارکردن": "common.save",
    "تۆمارکردن...": "common.saving",
    "دەستکاری": "common.edit",
    "سڕینەوە": "common.delete",
    "زیادکردن": "common.add",
    "دروستکردن": "common.create",
    "نوێکردنەوە": "common.update",
    "گەڕان": "common.search",
    "فلتەر": "common.filter",
    "فلتەرەکان": "common.filters",
    "هەناردەکردن": "common.export",
    "هاوردەکردن": "common.import",
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
    "نوێ": "common.new",
    "کۆن": "common.old",
    "لە": "common.from",
    "بۆ": "common.to",
    "ئەمڕۆ": "common.today",
    "دوێنێ": "common.yesterday",
    "سبەینێ": "common.tomorrow",
    "چاوەڕوانبە...": "common.loading",
    "پاشگەزبوونەوە": "common.cancel",
    "هەموو ببینە": "common.viewAll",
    "جۆر": "common.type",
    "ڕۆژ": "common.days",
    "کاتژمێر": "common.hours",
    "خولەک": "common.minutes",
    "چرکە": "common.seconds",
    "کیلۆگرام": "common.kg",
    "مەتری کیوبی": "common.cbm",
    "دۆلار": "common.usd",
    "دینار": "common.iqd",
    "یوان": "common.cny",
    "کۆد": "common.code",
    "تەلەفۆن": "common.phone",
    "ئیمەیڵ": "common.email",
    "ناونیشان": "common.address",
    "شار": "common.city",
    "وڵات": "common.country",
    "پارێزگا": "common.governorate",
    "گەڕان...": "common.searchPlaceholder",
    "هەڵبژێرە": "common.selectOption",
    
    # Customers
    "کڕیارەکان": "customers.title",
    "زیادکردنی کڕیار": "customers.addCustomer",
    "دەستکاریکردنی کڕیار": "customers.editCustomer",
    "سڕینەوەی کڕیار": "customers.deleteCustomer",
    "ناوی کڕیار": "customers.customerName",
    "کۆدی کڕیار": "customers.customerCode",
    "ناوی تەواو": "customers.fullName",
    "باڵانس": "customers.balance",
    "کۆی پاکەتەکان": "customers.totalPackages",
    "کڕیاری VIP": "customers.vipCustomer",
    "کڕیاری ئاسایی": "customers.regularCustomer",
    "وردەکاری کڕیار": "customers.customerDetails",
    "مێژووی کڕیار": "customers.customerHistory",
    "مۆبایل": "customers.mobile",
    "ژمارەی دووەم": "customers.secondaryPhone",
    "بەرواری تۆمارکردن": "customers.registrationDate",
    "دوایین چالاکی": "customers.lastActivity",
    
    # Packages
    "پاکەتەکان": "packages.title",
    "تۆمارکردنی پاکەت": "packages.registerPackage",
    "کۆدی پاکەت": "packages.packageCode",
    "ژمارەی تراکینگ": "packages.trackingNumber",
    "کێشی ڕاستەقینە": "packages.actualWeight",
    "کێشی قەبارەیی": "packages.volumetricWeight",
    "کێشی حیسابکراو": "packages.chargeableWeight",
    "قەبارەکان": "packages.dimensions",
    "درێژی": "packages.length",
    "پانی": "packages.width",
    "بەرزی": "packages.height",
    "تۆمارکراو": "packages.registered",
    "لە کۆگا": "packages.inWarehouse",
    "لە باچ": "packages.inBatch",
    "لە ڕێگا": "packages.onRoute",
    "گەیشتووە": "packages.arrived",
    "گەیاندرا": "packages.delivered",
    "گەڕێندراوە": "packages.returned",
    "ونبووە": "packages.lost",
    "زیانی پێگەیشتووە": "packages.damaged",
    "ئاسمانی ئاسایی": "packages.airRegular",
    "ئاسمانی نائاسایی": "packages.airIrregular",
    "دەریایی": "packages.sea",
    "جۆری گواستنەوە": "packages.shippingType",
    "وردەکاری پاکەت": "packages.packageDetails",
    "کرێی گواستنەوە": "packages.shippingCost",
    "کۆی تێچوو": "packages.totalCost",
    "ناوەڕۆک": "packages.content",
    "وەسفی ناوەڕۆک": "packages.contentDescription",
    "نرخی ڕاگەیەندراو": "packages.declaredValue",
    "بیمە": "packages.insurance",
    "بیمەکراو": "packages.insured",
    "بیمە نەکراو": "packages.notInsured",
    "شکێنەر": "packages.fragile",
    "مەترسیدار": "packages.dangerous",
    "وەرگر": "packages.receiver",
    "ناردەر": "packages.sender",
    "سەرچاوە": "packages.origin",
    "مەبەست": "packages.destination",
    "کاتی گەیشتنی چاوەڕوانکراو": "packages.eta",
    "کاتی گەیشتنی ڕاستەقینە": "packages.ata",
    "پارچە": "packages.pieces",
    "سندوق": "packages.boxes",
    "پالێت": "packages.pallets",
    
    # Batches
    "باچەکان": "batches.title",
    "باچی نوێ": "batches.newBatch",
    "کۆدی باچ": "batches.batchCode",
    "ناوی باچ": "batches.batchName",
    "گواستنەوە": "batches.carrier",
    "بەرواری ڕۆیشتن": "batches.departureDate",
    "گەیشتنی چاوەڕوانکراو": "batches.expectedArrival",
    "گەیشتنی ڕاستەقینە": "batches.actualArrival",
    "ئامادەکردن": "batches.preparing",
    "ڕۆیشتووە": "batches.departed",
    "لە گواستنەوە": "batches.inTransit",
    "تەواوبوو": "batches.completed",
    "هەڵوەشێنراوە": "batches.cancelled",
    "وردەکاری باچ": "batches.batchDetails",
    "پاکەتەکانی باچ": "batches.packagesInBatch",
    "زیادکردن بۆ باچ": "batches.addToBatch",
    "لابردن لە باچ": "batches.removeFromBatch",
    "داخستنی باچ": "batches.closeBatch",
    "کۆی کێش": "batches.totalWeight",
    "کۆی قەبارە": "batches.totalVolume",
    "ژمارەی فڕۆکە": "batches.flightNumber",
    "ناوی کەشتی": "batches.vesselName",
    "ژمارەی کۆنتەینەر": "batches.containerNumber",
    "ژمارەی B/L": "batches.blNumber",
    "ڕێگا": "batches.route",
    
    # Finance
    "دارایی": "finance.title",
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
    "ژمارەی سەند": "finance.referenceNumber",
    "کۆی وەرگیراو": "finance.totalReceived",
    "داهات": "finance.income",
    "خەرجی": "finance.expense",
    "قازانج": "finance.profit",
    "زەرەر": "finance.loss",
    "قەرز": "finance.debt",
    "کرێدیت": "finance.credit",
    "بەرواری پارەدان": "finance.paymentDate",
    "شێوازی پارەدان": "finance.paymentMethod",
    "بڕی پارەدان": "finance.paymentAmount",
    "تێبینی پارەدان": "finance.paymentNotes",
    "کڕیار هەڵبژێرە": "finance.selectCustomer",
    "بڕ داخڵ بکە": "finance.enterAmount",
    "پارەی مۆبایل": "finance.mobileMoney",
    "تر": "finance.other",
    "کڕیارە قەرزدارەکان": "finance.debtorCustomers",
    "باڵانس (USD)": "finance.balanceUsd",
    "باڵانس (IQD)": "finance.balanceIqd",
    
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
    "چالاکیە تازەکان": "dashboard.recentActivity",
    "کردارە خێراکان": "dashboard.quickActions",
    "ئامارەکان": "dashboard.statistics",
    
    # Settings
    "ڕێکخستنەکان": "settings.title",
    "زمان": "settings.language",
    "ڕووکار": "settings.appearance",
    "تاریک": "settings.darkMode",
    "ڕووناک": "settings.lightMode",
    "ئاگادارکردنەوەکان": "settings.notifications",
    "پڕۆفایل": "settings.profile",
    "ئەمنیەت": "settings.security",
    "گۆڕینی وشەی نهێنی": "settings.changePassword",
    "گشتی": "settings.general",
    "هەژمار": "settings.account",
    
    # Reports
    "ڕاپۆرتەکان": "reports.title",
    "ڕاپۆرتی هەفتانە": "reports.weeklyReport",
    "ڕاپۆرتی مانگانە": "reports.monthlyReport",
    "ڕاپۆرتی ساڵانە": "reports.yearlyReport",
    "ڕاپۆرتی تایبەت": "reports.customReport",
    "دروستکردنی ڕاپۆرت": "reports.generateReport",
    "داگرتنی ڕاپۆرت": "reports.downloadReport",
    "چاپکردنی ڕاپۆرت": "reports.printReport",
    "ماوەی بەروار": "reports.dateRange",
    "بەرواری دەستپێک": "reports.startDate",
    "بەرواری کۆتایی": "reports.endDate",
    "ماوە هەڵبژێرە": "reports.selectPeriod",
    "ڕاپۆرتی دارایی": "reports.financialReport",
    "ڕاپۆرتی کارگێڕی": "reports.operationalReport",
    "ڕاپۆرتی کڕیاران": "reports.customerReport",
    "ڕاپۆرتی پاکەتەکان": "reports.packageReport",
    
    # Scanning
    "سکان": "scanning.title",
    "سکانی پاکەت": "scanning.scanPackage",
    "سکانی بارکۆد": "scanning.scanBarcode",
    "کامێرا": "scanning.camera",
    "داخڵکردنی دەستی": "scanning.manualEntry",
    "سکانەکانی ئەمڕۆ": "scanning.todayScans",
    "کۆی سکانەکان": "scanning.totalScans",
    "سکان سەرکەوتوو بوو": "scanning.scanSuccess",
    "سکان سەرکەوتوو نەبوو": "scanning.scanFailed",
    "پاکەت نەدۆزرایەوە": "scanning.packageNotFound",
    "پێشتر سکانکراوە": "scanning.alreadyScanned",
    "ژمارەی تراکینگ داخڵ بکە": "scanning.enterTrackingNumber",
    "مێژووی سکان": "scanning.scanHistory",
    "دوایین سکان": "scanning.lastScanned",
    "شێوازی سکان": "scanning.scanMode",
    "سکانی بەردەوام": "scanning.continuousScan",
    "سکانی تاک": "scanning.singleScan",
    
    # Full Package
    "پاکەتی تەواو": "fullPackage.title",
    "داواکاری نوێ": "fullPackage.newOrder",
    "کۆدی داواکاری": "fullPackage.orderCode",
    "ناوی بەرهەم": "fullPackage.productName",
    "لینکی بەرهەم": "fullPackage.productLink",
    "نرخی کڕین": "fullPackage.purchasePrice",
    "نرخی فرۆشتن": "fullPackage.sellingPrice",
    "دابینکەر": "fullPackage.supplier",
    "بارودۆخی داواکاری": "fullPackage.orderStatus",
    "چاوەڕوان": "fullPackage.pending",
    "لە کاردا": "fullPackage.processing",
    "ناردراوە": "fullPackage.shipped",
    "وردەکاری داواکاری": "fullPackage.orderDetails",
    "مێژووی داواکاری": "fullPackage.orderHistory",
    "دروستکردنی داواکاری": "fullPackage.createOrder",
    "دەستکاریکردنی داواکاری": "fullPackage.editOrder",
    "سڕینەوەی داواکاری": "fullPackage.deleteOrder",
    
    # Suppliers
    "دابینکەرەکان": "suppliers.title",
    "زیادکردنی دابینکەر": "suppliers.addSupplier",
    "دەستکاریکردنی دابینکەر": "suppliers.editSupplier",
    "سڕینەوەی دابینکەر": "suppliers.deleteSupplier",
    "ناوی دابینکەر": "suppliers.supplierName",
    "کۆدی دابینکەر": "suppliers.supplierCode",
    "کەسی پەیوەندی": "suppliers.contactPerson",
    
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
    "قازانجی کۆ": "companyFinance.grossProfit",
    "قازانجی نێت": "companyFinance.netProfit",
    "خەرجیە کارگێڕییەکان": "companyFinance.operatingExpenses",
    "سامانەکان": "companyFinance.assets",
    "ئەرکەکان": "companyFinance.liabilities",
    "سەرمایە": "companyFinance.equity",
    
    # Warehouses
    "کۆگاکان": "warehouses.title",
    "زیادکردنی کۆگا": "warehouses.addWarehouse",
    "ناوی کۆگا": "warehouses.warehouseName",
    "کۆدی کۆگا": "warehouses.warehouseCode",
    "شوێن": "warehouses.location",
    "گنجایش": "warehouses.capacity",
    "ئەمبارەی ئێستا": "warehouses.currentStock",
    "کارەکان": "warehouses.operations",
    "هاتوو": "warehouses.inbound",
    "چوو": "warehouses.outbound",
    
    # Labels
    "لەیبڵەکان": "labels.title",
    "چاپکردنی لەیبڵ": "labels.printLabel",
    "قاڵبی لەیبڵ": "labels.labelTemplate",
    "قەبارەی لەیبڵ": "labels.labelSize",
    "چاپکردنی هەموو": "labels.printAll",
    "چاپکردنی هەڵبژێردراوەکان": "labels.printSelected",
    "کۆدی QR": "labels.qrCode",
    "بارکۆد": "labels.barcode",
    
    # Invoices
    "پسوڵەکان": "invoices.title",
    "دروستکردنی پسوڵە": "invoices.createInvoice",
    "ژمارەی پسوڵە": "invoices.invoiceNumber",
    "بەرواری پسوڵە": "invoices.invoiceDate",
    "بەرواری سەردەم": "invoices.dueDate",
    "کۆی لاوەکی": "invoices.subtotal",
    "باج": "invoices.tax",
    "داشکاندن": "invoices.discount",
    "کۆی گشتی": "invoices.grandTotal",
    "پارەدراو": "invoices.paid",
    "پارەنەدراو": "invoices.unpaid",
    "بەشێکی پارەدراو": "invoices.partiallyPaid",
    "دواکەوتوو": "invoices.overdue",
    "چاپکردنی پسوڵە": "invoices.printInvoice",
    "داگرتنی پسوڵە": "invoices.downloadInvoice",
    "ناردنی پسوڵە": "invoices.sendInvoice",
    
    # Pricing
    "نرخەکان": "pricing.title",
    "نرخی هەر کیلۆیەک": "pricing.pricePerKg",
    "نرخی هەر مەتری کیوبی": "pricing.pricePerCbm",
    "کەمترین نرخ": "pricing.minimumCharge",
    "کرێی زیادە": "pricing.additionalFees",
    "نرخی تایبەت": "pricing.customPricing",
    "نرخی VIP": "pricing.vipPricing",
    "نرخی ستاندارد": "pricing.standardPricing",
    "جۆری خزمەتگوزاری": "pricing.serviceType",
    
    # Auth
    "چوونەژوورەوە": "auth.login",
    "چوونەدەرەوە": "auth.logout",
    "تۆمارکردن": "auth.register",
    "وشەی نهێنیت بیرچووەتەوە؟": "auth.forgotPassword",
    "ڕیسێتکردنی وشەی نهێنی": "auth.resetPassword",
    "وشەی نهێنی": "auth.password",
    "دڵنیاکردنەوەی وشەی نهێنی": "auth.confirmPassword",
    "بمهێڵەرەوە": "auth.rememberMe",
    "چوونەژوورەوەی ستاف": "auth.staffLogin",
    "چوونەژوورەوەی کڕیار": "auth.customerLogin",
    
    # Navigation
    "سەرەکی": "nav.home",
}

def replace_in_file(file_path, reverse_map):
    """Replace hardcoded Kurdish text with t() function calls"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    replacements_made = 0
    
    # Check if useTranslation is imported
    has_translation_import = "useTranslation" in content
    has_t_hook = "const { t }" in content or "const {t}" in content
    
    # Sort by length (longest first) to avoid partial replacements
    sorted_items = sorted(COMMON_REPLACEMENTS.items(), key=lambda x: len(x[0]), reverse=True)
    
    for kurdish_text, translation_key in sorted_items:
        # Skip if text is not in file
        if kurdish_text not in content:
            continue
        
        # Various patterns to replace
        patterns = [
            # JSX text content: >text<
            (f'>{kurdish_text}<', f'>{{t("{translation_key}")}}}<'),
            # JSX text content with space: > text<
            (f'> {kurdish_text}<', f'> {{t("{translation_key}")}}<'),
            # Attribute value: ="text"
            (f'="{kurdish_text}"', f'={{t("{translation_key}")}}'),
            # Attribute value: ='text'
            (f"='{kurdish_text}'", f'={{t("{translation_key}")}}'),
            # Placeholder: placeholder="text"
            (f'placeholder="{kurdish_text}"', f'placeholder={{t("{translation_key}")}}'),
            # Title: title="text"
            (f'title="{kurdish_text}"', f'title={{t("{translation_key}")}}'),
            # Label: label="text"
            (f'label="{kurdish_text}"', f'label={{t("{translation_key}")}}'),
            # Description: description="text"
            (f'description="{kurdish_text}"', f'description={{t("{translation_key}")}}'),
            # Toast/message: "text"
            (f'"{kurdish_text}"', f't("{translation_key}")'),
            # Template literal: `text`
            (f'`{kurdish_text}`', f't("{translation_key}")'),
        ]
        
        for old, new in patterns:
            if old in content:
                content = content.replace(old, new)
                replacements_made += 1
    
    # Only write if changes were made
    if content != original_content:
        # Add import if needed
        if not has_translation_import and replacements_made > 0:
            # Find the first import line
            import_match = re.search(r'^import .+;?\n', content, re.MULTILINE)
            if import_match:
                insert_pos = import_match.end()
                content = content[:insert_pos] + 'import { useTranslation } from "@/contexts/LanguageContext";\n' + content[insert_pos:]
        
        # Add t hook if needed
        if not has_t_hook and replacements_made > 0:
            # Find function component start
            func_match = re.search(r'(export default function \w+\([^)]*\)\s*{)', content)
            if func_match:
                insert_pos = func_match.end()
                content = content[:insert_pos] + '\n  const { t } = useTranslation();' + content[insert_pos:]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return replacements_made
    
    return 0

def main():
    translations = load_translations()
    reverse_map = build_reverse_map(translations)
    
    # Merge with common replacements
    reverse_map.update(COMMON_REPLACEMENTS)
    
    total_replacements = 0
    files_modified = 0
    
    for tsx_file in PAGES_DIR.glob("*.tsx"):
        replacements = replace_in_file(tsx_file, reverse_map)
        if replacements > 0:
            print(f"{tsx_file.name}: {replacements} replacements")
            total_replacements += replacements
            files_modified += 1
    
    print(f"\nTotal: {total_replacements} replacements in {files_modified} files")

if __name__ == "__main__":
    main()
