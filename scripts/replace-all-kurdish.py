#!/usr/bin/env python3
"""
Comprehensive script to replace ALL hardcoded Kurdish text with t() function calls.
This script processes all TSX files and replaces Kurdish text with proper i18n calls.
"""

import os
import re
import json
from pathlib import Path

# Kurdish character pattern
KURDISH_PATTERN = r'[ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ]'

# Translation mapping - Kurdish text to translation key
TRANSLATIONS = {
    # Common
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
    "گەیشتووە": "batches.arrived",
    "چاوەڕوانکراو": "batches.pending",
    
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
    
    # Labels
    "لەیبڵەکان": "labels.title",
    "چاپکردنی لەیبڵ": "labels.printLabel",
    "داڕشتنی لەیبڵ": "labels.labelTemplate",
    
    # Invoices
    "پسوڵەکان": "invoices.title",
    "پسوڵە": "invoices.invoice",
    "پسوڵەی نوێ": "invoices.newInvoice",
    "ژمارەی پسوڵە": "invoices.invoiceNumber",
    "بەرواری پسوڵە": "invoices.invoiceDate",
    "کاتی بەسەرچوون": "invoices.dueDate",
    "کۆی پسوڵە": "invoices.totalAmount",
    
    # Reports
    "ڕاپۆرتەکان": "reports.title",
    "ڕاپۆرت": "reports.report",
    "ڕاپۆرتی ڕۆژانە": "reports.dailyReport",
    "ڕاپۆرتی هەفتانە": "reports.weeklyReport",
    "ڕاپۆرتی مانگانە": "reports.monthlyReport",
    "ڕاپۆرتی قازانج و زەرەر": "reports.profitLossReport",
    "ڕاپۆرتی جووڵەی پارە": "reports.cashFlowReport",
    "تەرازوو": "reports.balanceSheet",
    
    # Warehouses
    "کۆگاکان": "warehouses.title",
    "کۆگا": "warehouses.warehouse",
    "کۆگای نوێ": "warehouses.newWarehouse",
    "ناوی کۆگا": "warehouses.warehouseName",
    "شوێنی کۆگا": "warehouses.warehouseLocation",
    
    # Countries
    "وڵاتەکان": "countries.title",
    "وڵات": "countries.country",
    "چین": "countries.china",
    "عێراق": "countries.iraq",
    
    # Portal
    "پۆرتاڵی کڕیار": "portal.title",
    "ماڵەوە": "portal.home",
    "گواستنەوەکان": "portal.shipments",
    "دارایی": "portal.financial",
    "من": "portal.me",
    "گەڕان": "portal.search",
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
    "داهاتی ئەمڕۆ": "dashboard.todayIncome",
    "داهاتی هەفتە": "dashboard.weeklyIncome",
    "داهاتی مانگ": "dashboard.monthlyIncome",
    "قەرزی ئەمڕۆ": "dashboard.todayDebt",
    "باچی چالاک": "dashboard.activeBatches",
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
    "کارەکانی کۆگا": "warehouseOperations.title",
    "هاتنەژوورەوە": "warehouseOperations.inbound",
    "دەرچوون": "warehouseOperations.outbound",
    "ئینڤێنتۆری": "warehouseOperations.inventory",
    
    # Login
    "چوونەژوورەوەی ستاف": "login.staffLogin",
    "چوونەژوورەوەی کڕیار": "login.customerLogin",
    "ژمارەی مۆبایل": "login.mobileNumber",
    "وشەی نهێنی": "login.password",
    "چوونەژوورەوە": "login.login",
    "وشەی نهێنیت لەبیرچووە؟": "login.forgotPassword",
    
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
}

def find_kurdish_text(content):
    """Find all Kurdish text in the content."""
    # Pattern to match Kurdish text in JSX
    patterns = [
        r'"([^"]*[' + KURDISH_PATTERN[1:-1] + r'][^"]*)"',  # Double quotes
        r"'([^']*[" + KURDISH_PATTERN[1:-1] + r"][^']*)'",  # Single quotes
        r'`([^`]*[' + KURDISH_PATTERN[1:-1] + r'][^`]*)`',  # Template literals
        r'>([^<>]*[' + KURDISH_PATTERN[1:-1] + r'][^<>]*)<',  # JSX text content
    ]
    
    matches = []
    for pattern in patterns:
        for match in re.finditer(pattern, content):
            text = match.group(1)
            if text.strip() and len(text.strip()) > 0:
                matches.append((match.start(), match.end(), text, match.group(0)))
    
    return matches

def get_translation_key(text):
    """Get the translation key for a Kurdish text."""
    text = text.strip()
    
    # Check exact match first
    if text in TRANSLATIONS:
        return TRANSLATIONS[text]
    
    # Check if text contains a known phrase
    for kurdish, key in TRANSLATIONS.items():
        if kurdish in text:
            return key
    
    # Generate a key based on the text
    # This is a fallback - ideally all text should be in TRANSLATIONS
    return None

def process_file(filepath):
    """Process a single TSX file and replace Kurdish text with t() calls."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    replacements = 0
    new_keys = []
    
    # Check if file already imports useLanguage/useTranslation
    has_translation_import = 'useLanguage' in content or 'useTranslation' in content
    has_t_hook = 'const { t }' in content or 'const {t}' in content
    
    # Find all Kurdish text
    matches = find_kurdish_text(content)
    
    # Sort matches by position (reverse order to replace from end)
    matches.sort(key=lambda x: x[0], reverse=True)
    
    for start, end, text, full_match in matches:
        key = get_translation_key(text)
        
        if key:
            # Determine the replacement based on context
            if full_match.startswith('>') and full_match.endswith('<'):
                # JSX text content: >text< -> >{t("key")}<
                replacement = f'>{{t("{key}")}}< '
                content = content[:start] + replacement + content[end:]
            elif full_match.startswith('"') or full_match.startswith("'"):
                # String literal: "text" -> t("key")
                # Check if it's in a JSX attribute context
                before_context = content[max(0, start-50):start]
                if '=' in before_context and ('{' not in before_context or before_context.rfind('=') > before_context.rfind('{')):
                    # JSX attribute: attr="text" -> attr={t("key")}
                    replacement = f'{{t("{key}")}}'
                else:
                    replacement = f't("{key}")'
                content = content[:start] + replacement + content[end:]
            
            replacements += 1
            if key not in [k for k, _ in new_keys]:
                new_keys.append((key, text))
    
    # Add translation import if needed and replacements were made
    if replacements > 0 and not has_translation_import:
        # Add import at the top
        import_line = 'import { useLanguage } from "@/contexts/LanguageContext";\n'
        # Find the last import line
        last_import = content.rfind('import ')
        if last_import != -1:
            end_of_import = content.find('\n', last_import)
            content = content[:end_of_import+1] + import_line + content[end_of_import+1:]
    
    # Add t hook if needed
    if replacements > 0 and not has_t_hook:
        # Find the function component
        func_match = re.search(r'(export\s+default\s+function\s+\w+\s*\([^)]*\)\s*{)', content)
        if func_match:
            insert_pos = func_match.end()
            content = content[:insert_pos] + '\n  const { t } = useLanguage();' + content[insert_pos:]
    
    # Write back if changes were made
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return replacements, new_keys
    
    return 0, []

def main():
    """Main function to process all TSX files."""
    pages_dir = Path('/home/ubuntu/wazn-express/client/src/pages')
    components_dir = Path('/home/ubuntu/wazn-express/client/src/components')
    
    total_replacements = 0
    all_new_keys = []
    processed_files = []
    
    # Process all TSX files in pages
    for tsx_file in pages_dir.rglob('*.tsx'):
        replacements, new_keys = process_file(tsx_file)
        if replacements > 0:
            print(f"Processed {tsx_file.name}: {replacements} replacements")
            total_replacements += replacements
            all_new_keys.extend(new_keys)
            processed_files.append(tsx_file.name)
    
    # Process components
    for tsx_file in components_dir.rglob('*.tsx'):
        replacements, new_keys = process_file(tsx_file)
        if replacements > 0:
            print(f"Processed {tsx_file.name}: {replacements} replacements")
            total_replacements += replacements
            all_new_keys.extend(new_keys)
            processed_files.append(tsx_file.name)
    
    print(f"\n{'='*60}")
    print(f"Total replacements: {total_replacements}")
    print(f"Files processed: {len(processed_files)}")
    print(f"New translation keys needed: {len(set(k for k, _ in all_new_keys))}")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
