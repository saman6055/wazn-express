#!/usr/bin/env python3
"""
Second pass script to replace remaining hardcoded Kurdish text.
This handles more complex patterns that the first script missed.
"""

import os
import re
import json
from pathlib import Path

# Kurdish character pattern
KURDISH_CHARS = 'ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ'

# Extended translation mapping
TRANSLATIONS = {
    # Additional common phrases
    "زیادکردن": "common.add",
    "دەستکاری": "common.edit",
    "سڕینەوە": "common.delete",
    "پاشەکشەکردن": "common.cancel",
    "پاشگەزبوونەوە": "common.cancel",
    "هەڵوەشاندنەوە": "common.cancel",
    "تۆمارکردن": "common.save",
    "گەڕان": "common.search",
    "فلتەر": "common.filter",
    "هەموو": "common.all",
    "چالاک": "common.active",
    "ناچالاک": "common.inactive",
    "بارکردن": "common.loading",
    "چاپکردن": "common.print",
    "داگرتن": "common.download",
    "ناو": "common.name",
    "بەروار": "common.date",
    "بڕ": "common.amount",
    "دۆخ": "common.status",
    "جۆر": "common.type",
    "وەسف": "common.description",
    "تێبینی": "common.notes",
    "کردارەکان": "common.actions",
    "وردەکاری": "common.details",
    "بینین": "common.view",
    "نوێکردنەوە": "common.refresh",
    "هەڵبژاردن": "common.select",
    "نەدۆزرایەوە": "common.notFound",
    "هیچ": "common.none",
    "بەلێ": "common.yes",
    "نەخێر": "common.no",
    "دڵنیابوونەوە": "common.confirm",
    "ئاگاداری": "common.warning",
    "هەڵە": "common.error",
    "سەرکەوتوو": "common.success",
    "زانیاری": "common.info",
    "داخستن": "common.close",
    "کردنەوە": "common.open",
    "پێشوەختە": "common.default",
    "تایبەت": "common.custom",
    "کۆی گشتی": "common.total",
    "ڕێکخستنەکان": "common.settings",
    "پڕۆفایل": "common.profile",
    "دەرچوون": "common.logout",
    "چوونەژوورەوە": "common.login",
    "تۆمارکردنی نوێ": "common.register",
    "پارە": "common.money",
    "دراو": "common.currency",
    "ڕێژە": "common.rate",
    "بەرز": "common.high",
    "نزم": "common.low",
    "ناوەند": "common.medium",
    "سەرەتا": "common.start",
    "کۆتایی": "common.end",
    "پێش": "common.before",
    "دوای": "common.after",
    "ئێستا": "common.now",
    "دوێنێ": "common.yesterday",
    "ئەمڕۆ": "common.today",
    "سبەی": "common.tomorrow",
    "هەفتە": "common.week",
    "مانگ": "common.month",
    "ساڵ": "common.year",
    "ڕۆژ": "common.day",
    "کات": "common.time",
    "ساعەت": "common.hour",
    "خولەک": "common.minute",
    "چرکە": "common.second",
    
    # Customers
    "کڕیارەکان": "customers.title",
    "کڕیار": "customers.customer",
    "کڕیاری نوێ": "customers.newCustomer",
    "زیادکردنی کڕیار": "customers.addCustomer",
    "کۆدی کڕیار": "customers.customerCode",
    "ناوی کڕیار": "customers.customerName",
    "ژمارەی مۆبایل": "customers.mobileNumber",
    "ئیمەیڵ": "customers.email",
    "ناونیشان": "customers.address",
    "باڵانس": "customers.balance",
    "قەرز": "customers.debt",
    "VIP": "customers.vip",
    "ئاسایی": "customers.regular",
    "زیو": "customers.silver",
    "زێڕ": "customers.gold",
    "پلاتینیۆم": "customers.platinum",
    "ئاستی VIP": "customers.vipLevel",
    "داشکاندن": "customers.discount",
    "کڕیارانی قەرزدار": "customers.debtors",
    "کڕیارانی چالاک": "customers.activeCustomers",
    "کڕیارانی ناچالاک": "customers.inactiveCustomers",
    
    # Packages
    "پاکەتەکان": "packages.title",
    "پاکەت": "packages.package",
    "پاکەتی نوێ": "packages.newPackage",
    "زیادکردنی پاکەت": "packages.addPackage",
    "ژمارەی تراک": "packages.trackingNumber",
    "کێش": "packages.weight",
    "قەبارە": "packages.dimensions",
    "درێژی": "packages.length",
    "پانی": "packages.width",
    "بەرزی": "packages.height",
    "نرخ": "packages.price",
    "جۆری گواستنەوە": "packages.shippingType",
    "هەوایی ئاسایی": "packages.airRegular",
    "هەوایی تایبەت": "packages.airIrregular",
    "دەریایی": "packages.sea",
    "تۆمارکراو": "packages.registered",
    "لە باچدا": "packages.inBatch",
    "لە گواستنەوەدا": "packages.inTransit",
    "گەیشتووە": "packages.arrived",
    "لە گومرگدا": "packages.customsProcessing",
    "گەیاندرا": "packages.delivered",
    "گەڕاوە": "packages.returned",
    "پاکەتی بێ خاوەن": "packages.unclaimed",
    "داواکردنی پاکەت": "packages.claimRequest",
    "پاکەتی تۆمارنەکراو": "packages.unregistered",
    
    # Batches
    "باچەکان": "batches.title",
    "باچ": "batches.batch",
    "باچی نوێ": "batches.newBatch",
    "زیادکردنی باچ": "batches.addBatch",
    "ژمارەی باچ": "batches.batchNumber",
    "ژمارەی فڕۆکە": "batches.flightNumber",
    "ژمارەی کۆنتەینەر": "batches.containerNumber",
    "بەرواری ڕەوانەکردن": "batches.departureDate",
    "بەرواری گەیشتن": "batches.arrivalDate",
    "کاتی گەیشتنی چاوەڕوانکراو": "batches.eta",
    "ڕۆیشتوو": "batches.departed",
    "چاوەڕوانکراو": "batches.pending",
    "باچی چالاک": "batches.activeBatches",
    
    # Finance
    "دارایی": "finance.title",
    "داهات": "finance.income",
    "خەرجی": "finance.expense",
    "قازانج": "finance.profit",
    "زەرەر": "finance.loss",
    "پارەدان": "finance.payment",
    "وەرگرتن": "finance.receive",
    "گواستنەوە": "finance.transfer",
    "باڵانسی کڕیار": "finance.customerBalance",
    "قەرزی کڕیار": "finance.customerDebt",
    "کۆی داهات": "finance.totalIncome",
    "کۆی خەرجی": "finance.totalExpense",
    "کۆی قازانج": "finance.totalProfit",
    "داهاتی ئەمڕۆ": "finance.todayIncome",
    "داهاتی هەفتە": "finance.weeklyIncome",
    "داهاتی مانگ": "finance.monthlyIncome",
    "پارەدانی نوێ": "finance.newPayment",
    "تۆمارکردنی پارەدان": "finance.recordPayment",
    "مێژووی پارەدان": "finance.paymentHistory",
    "جۆری پارەدان": "finance.paymentMethod",
    
    # Expenses
    "خەرجییەکان": "expenses.title",
    "خەرجی نوێ": "expenses.newExpense",
    "زیادکردنی خەرجی": "expenses.addExpense",
    "پۆلی خەرجی": "expenses.category",
    "وەسفی خەرجی": "expenses.description",
    "بڕی خەرجی": "expenses.amount",
    
    # Partners
    "هاوبەشەکان": "partners.title",
    "هاوبەش": "partners.partner",
    "هاوبەشی نوێ": "partners.newPartner",
    "زیادکردنی هاوبەش": "partners.addPartner",
    "ڕێژەی هاوبەشی": "partners.sharePercentage",
    "پشکی قازانج": "partners.profitShare",
    
    # Treasury
    "خەزنە": "treasury.title",
    "باڵانسی نەقد": "treasury.cashBalance",
    "باڵانسی بانک": "treasury.bankBalance",
    "دانان": "treasury.deposit",
    "دەرهێنان": "treasury.withdrawal",
    "حسابی بانکی": "treasury.bankAccount",
    "حسابەکانی بانکی": "treasury.bankAccounts",
    
    # Suppliers
    "دابینکەرەکان": "suppliers.title",
    "دابینکەر": "suppliers.supplier",
    "دابینکەری نوێ": "suppliers.newSupplier",
    "زیادکردنی دابینکەر": "suppliers.addSupplier",
    "ناوی دابینکەر": "suppliers.supplierName",
    "زانیاری پەیوەندی": "suppliers.contactInfo",
    
    # Full Package
    "فول پاکەج": "fullPackage.title",
    "داواکاری نوێ": "fullPackage.newOrder",
    "زیادکردنی داواکاری": "fullPackage.addOrder",
    "ناوی بەرهەم": "fullPackage.productName",
    "نرخی کڕین": "fullPackage.purchasePrice",
    "نرخی فرۆشتن": "fullPackage.sellingPrice",
    "تێچووی گواستنەوە": "fullPackage.shippingCost",
    "قازانجی چاوەڕوانکراو": "fullPackage.expectedProfit",
    "چاوەڕوانی تراک": "fullPackage.awaitingTracking",
    "گەیشتووە بە چین": "fullPackage.arrivedChina",
    "ناردراوە": "fullPackage.shipped",
    "گەیشتووە بە عێراق": "fullPackage.arrivedIraq",
    "تەواوبوو": "fullPackage.completed",
    "هەڵوەشێنراوە": "fullPackage.cancelled",
    "داواکاریەکان": "fullPackage.orders",
    "داواکاری": "fullPackage.order",
    
    # Scanner
    "سکانەر": "scanner.title",
    "سکان": "scanner.scan",
    "سکانکردن": "scanner.scanning",
    "سکانی خێرا": "scanner.quickScan",
    "سکانی بەردەوام": "scanner.continuousScan",
    "سکانەری هەمەکارە": "scanner.smartScanner",
    "بارکۆد": "scanner.barcode",
    "QR کۆد": "scanner.qrCode",
    "مێژووی سکان": "scanner.scanHistory",
    "وەرگرتن": "scanner.receive",
    "ناردن": "scanner.ship",
    "گەیاندن": "scanner.deliver",
    "سکانکراو": "scanner.scanned",
    "ڕاپۆرتی سکان": "scanner.scanReport",
    
    # Labels
    "لەیبڵەکان": "labels.title",
    "چاپکردنی لەیبڵ": "labels.printLabel",
    "داڕشتنی لەیبڵ": "labels.labelTemplate",
    "لەیبڵ": "labels.label",
    
    # Invoices
    "پسوڵەکان": "invoices.title",
    "پسوڵە": "invoices.invoice",
    "پسوڵەی نوێ": "invoices.newInvoice",
    "ژمارەی پسوڵە": "invoices.invoiceNumber",
    "بەرواری پسوڵە": "invoices.invoiceDate",
    "کاتی بەسەرچوون": "invoices.dueDate",
    "کۆی پسوڵە": "invoices.totalAmount",
    "داڕشتنی پسوڵە": "invoices.invoiceTemplate",
    
    # Reports
    "ڕاپۆرتەکان": "reports.title",
    "ڕاپۆرت": "reports.report",
    "ڕاپۆرتی ڕۆژانە": "reports.dailyReport",
    "ڕاپۆرتی هەفتانە": "reports.weeklyReport",
    "ڕاپۆرتی مانگانە": "reports.monthlyReport",
    "ڕاپۆرتی قازانج و زەرەر": "reports.profitLossReport",
    "ڕاپۆرتی جووڵەی پارە": "reports.cashFlowReport",
    "تەرازوو": "reports.balanceSheet",
    "ڕاپۆرتی دارایی": "reports.financialReport",
    
    # Warehouses
    "کۆگاکان": "warehouses.title",
    "کۆگا": "warehouses.warehouse",
    "کۆگای نوێ": "warehouses.newWarehouse",
    "ناوی کۆگا": "warehouses.warehouseName",
    "شوێنی کۆگا": "warehouses.warehouseLocation",
    "کارەکانی کۆگا": "warehouses.warehouseOperations",
    
    # Countries
    "وڵاتەکان": "countries.title",
    "وڵات": "countries.country",
    "چین": "countries.china",
    "عێراق": "countries.iraq",
    
    # Portal
    "پۆرتاڵی کڕیار": "portal.title",
    "ماڵەوە": "portal.home",
    "گواستنەوەکان": "portal.shipments",
    "من": "portal.me",
    "هەواڵەکان": "portal.news",
    "خزمەتگوزارییەکان": "portal.services",
    "مەرج و ڕێساکان": "portal.terms",
    "گۆڕینی وشەی نهێنی": "portal.changePassword",
    "ناونیشانەکان": "portal.addresses",
    "ئاگادارکردنەوەکان": "portal.notifications",
    "سەنتەری پەیام": "portal.messageCenter",
    
    # Messages
    "بە سەرکەوتوویی تۆمارکرا": "messages.savedSuccessfully",
    "بە سەرکەوتوویی نوێکرایەوە": "messages.updatedSuccessfully",
    "بە سەرکەوتوویی سڕایەوە": "messages.deletedSuccessfully",
    "هەڵەیەک ڕوویدا": "messages.errorOccurred",
    "تکایە هەموو خانەکان پڕبکەرەوە": "messages.fillAllFields",
    "دڵنیای لە سڕینەوە؟": "messages.confirmDelete",
    "ئەم کردارە ناگەڕێتەوە": "messages.actionIrreversible",
    
    # Dashboard
    "داشبۆرد": "dashboard.title",
    "بەخێربێیت": "dashboard.welcome",
    "پوختەی کارەکان": "dashboard.summary",
    "ئامارەکان": "dashboard.statistics",
    "کڕیاری نوێ": "dashboard.newCustomers",
    "پاکەتی نوێ": "dashboard.newPackages",
    "قەرزی ئەمڕۆ": "dashboard.todayDebt",
    "پاکەتی ئەمڕۆ": "dashboard.todayPackages",
    
    # Tracking
    "شوێنپێگرتن": "tracking.title",
    "شوێنپێگرتنی پاکەت": "tracking.trackPackage",
    "ژمارەی تراک بنووسە": "tracking.enterTrackingNumber",
    "ئاگادارییەکانی شوێنپێگرتن": "tracking.trackingAlerts",
    
    # Data Management
    "بەڕێوەبردنی داتا": "dataManagement.title",
    "پاشەکەوتکردن": "dataManagement.backup",
    "گەڕاندنەوە": "dataManagement.restore",
    "هەناردەکردن": "dataManagement.export",
    "هاوردەکردن": "dataManagement.import",
    
    # Service Types
    "جۆرەکانی خزمەتگوزاری": "serviceTypes.title",
    "جۆری خزمەتگوزاری": "serviceTypes.serviceType",
    "نرخی خزمەتگوزاری": "serviceTypes.servicePrice",
    "کاتی گەیاندن": "serviceTypes.deliveryTime",
    
    # Blog
    "بڵۆگ": "blog.title",
    "بابەتەکان": "blog.posts",
    "بابەتی نوێ": "blog.newPost",
    "پۆلەکان": "blog.categories",
    "بڵاوکردنەوە": "blog.publish",
    "ڕەشنووس": "blog.draft",
    "بابەت": "blog.post",
    
    # Financial Goals
    "ئامانجە داراییەکان": "financialGoals.title",
    "ئامانجی نوێ": "financialGoals.newGoal",
    "ئامانج": "financialGoals.target",
    "پێشکەوتن": "financialGoals.progress",
    "کاتی کۆتایی": "financialGoals.deadline",
    
    # Debt Reminders
    "بیرهێنەرەوەی قەرز": "debtReminders.title",
    "ناردنی بیرهێنەرەوە": "debtReminders.sendReminder",
    "ڕۆژی دواکەوتوو": "debtReminders.daysOverdue",
    
    # Warehouse Operations
    "هاتنەژوورەوە": "warehouseOperations.inbound",
    "ئینڤێنتۆری": "warehouseOperations.inventory",
    
    # Login
    "چوونەژوورەوەی ستاف": "login.staffLogin",
    "چوونەژوورەوەی کڕیار": "login.customerLogin",
    "وشەی نهێنی": "login.password",
    "وشەی نهێنیت لەبیرچووە؟": "login.forgotPassword",
    
    # Product Categories
    "پۆلەکانی بەرهەم": "productCategories.title",
    "پۆلی بەرهەم": "productCategories.category",
    
    # Misc
    "لە ڕێگای بان": "common.viaBank",
    "نەقد": "common.cash",
    "کارتی بانکی": "common.bankCard",
    "گواستنەوەی بانکی": "common.bankTransfer",
    "دۆلار": "common.usd",
    "دینار": "common.iqd",
    "یوان": "common.cny",
    "کیلۆگرام": "common.kg",
    "مەتر کیوبیک": "common.cbm",
    "سانتیمەتر": "common.cm",
    "بێ": "common.without",
    "بە": "common.with",
    "لە": "common.from",
    "بۆ": "common.to",
    "و": "common.and",
    "یان": "common.or",
    "تکایە": "common.please",
    "سوپاس": "common.thanks",
    "بەخێربێیت": "common.welcome",
}

def has_kurdish(text):
    """Check if text contains Kurdish characters."""
    return bool(re.search(f'[{KURDISH_CHARS}]', text))

def get_translation_key(text):
    """Get the translation key for Kurdish text."""
    text = text.strip()
    
    # Exact match
    if text in TRANSLATIONS:
        return TRANSLATIONS[text]
    
    # Check for partial matches (longer phrases first)
    sorted_keys = sorted(TRANSLATIONS.keys(), key=len, reverse=True)
    for kurdish in sorted_keys:
        if kurdish in text:
            return TRANSLATIONS[kurdish]
    
    return None

def process_file(filepath):
    """Process a single TSX file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    replacements = 0
    
    # Pattern 1: Kurdish text in JSX text content: >Kurdish text<
    pattern1 = re.compile(r'>([^<>]*[' + KURDISH_CHARS + r'][^<>]*)<')
    
    def replace_jsx_text(match):
        nonlocal replacements
        text = match.group(1).strip()
        if not text or not has_kurdish(text):
            return match.group(0)
        
        key = get_translation_key(text)
        if key:
            replacements += 1
            return f'>{{t("{key}")}}< '
        return match.group(0)
    
    content = pattern1.sub(replace_jsx_text, content)
    
    # Pattern 2: Kurdish text in string literals (not already in t())
    # Match "Kurdish text" but not t("Kurdish text")
    pattern2 = re.compile(r'(?<!t\()"([^"]*[' + KURDISH_CHARS + r'][^"]*)"(?!\))')
    
    def replace_string_literal(match):
        nonlocal replacements
        text = match.group(1).strip()
        if not text or not has_kurdish(text):
            return match.group(0)
        
        key = get_translation_key(text)
        if key:
            replacements += 1
            return f't("{key}")'
        return match.group(0)
    
    content = pattern2.sub(replace_string_literal, content)
    
    # Pattern 3: Kurdish text in single quotes
    pattern3 = re.compile(r"(?<!t\()'([^']*[" + KURDISH_CHARS + r"][^']*)'(?!\))")
    content = pattern3.sub(replace_string_literal, content)
    
    # Pattern 4: Kurdish text in template literals
    pattern4 = re.compile(r'`([^`]*[' + KURDISH_CHARS + r'][^`]*)`')
    
    def replace_template_literal(match):
        nonlocal replacements
        text = match.group(1).strip()
        if not text or not has_kurdish(text):
            return match.group(0)
        
        key = get_translation_key(text)
        if key:
            replacements += 1
            return f't("{key}")'
        return match.group(0)
    
    content = pattern4.sub(replace_template_literal, content)
    
    # Write back if changes were made
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return replacements
    
    return 0

def main():
    """Main function."""
    pages_dir = Path('/home/ubuntu/wazn-express/client/src/pages')
    components_dir = Path('/home/ubuntu/wazn-express/client/src/components')
    
    total_replacements = 0
    processed_files = []
    
    # Process pages
    for tsx_file in pages_dir.rglob('*.tsx'):
        replacements = process_file(tsx_file)
        if replacements > 0:
            print(f"Processed {tsx_file.name}: {replacements} replacements")
            total_replacements += replacements
            processed_files.append(tsx_file.name)
    
    # Process components
    for tsx_file in components_dir.rglob('*.tsx'):
        replacements = process_file(tsx_file)
        if replacements > 0:
            print(f"Processed {tsx_file.name}: {replacements} replacements")
            total_replacements += replacements
            processed_files.append(tsx_file.name)
    
    print(f"\n{'='*60}")
    print(f"Total replacements: {total_replacements}")
    print(f"Files processed: {len(processed_files)}")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
