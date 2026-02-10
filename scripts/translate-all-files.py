#!/usr/bin/env python3
"""
Comprehensive script to replace hardcoded Kurdish text with t() function calls.
This script processes all TSX files and replaces common patterns.
"""

import os
import re
import json
from pathlib import Path

# Common translation mappings - Kurdish text to translation key
TRANSLATIONS = {
    # Common words
    "هەموو": "common.all",
    "گەڕان": "common.search",
    "زیادکردن": "common.add",
    "دەستکاری": "common.edit",
    "سڕینەوە": "common.delete",
    "پاشەکەوتکردن": "common.save",
    "پاشگەزبوونەوە": "common.cancel",
    "داخستن": "common.close",
    "بەڵێ": "common.yes",
    "نەخێر": "common.no",
    "ناو": "common.name",
    "کۆد": "common.code",
    "بەروار": "common.date",
    "کات": "common.time",
    "بڕ": "common.amount",
    "نرخ": "common.price",
    "کۆی گشتی": "common.total",
    "بارکردن": "common.loading",
    "هەڵە": "common.error",
    "سەرکەوتوو": "common.success",
    "ئاگاداری": "common.warning",
    "زانیاری": "common.info",
    "وەسف": "common.description",
    "تێبینی": "common.notes",
    "دۆخ": "common.status",
    "چالاک": "common.active",
    "ناچالاک": "common.inactive",
    "ڕۆژ": "common.days",
    "مانگ": "common.month",
    "ساڵ": "common.year",
    "ئەمڕۆ": "common.today",
    "دوێنێ": "common.yesterday",
    "هەفتە": "common.week",
    
    # Customers
    "کڕیار": "customers.customer",
    "کڕیارەکان": "customers.title",
    "زیادکردنی کڕیار": "customers.addCustomer",
    "ناوی تەواو": "customers.fullName",
    "ژمارەی مۆبایل": "customers.mobileNumber",
    "ناونیشان": "customers.address",
    "شار": "customers.city",
    
    # Packages
    "پاکەت": "packages.package",
    "پاکەتەکان": "packages.title",
    "زیادکردنی پاکەت": "packages.addPackage",
    "کۆدی پاکەت": "packages.packageCode",
    "ژمارەی تراک": "packages.trackingNumber",
    "کێش": "packages.weight",
    "قەبارە": "packages.volume",
    "جۆری ناردن": "packages.shippingType",
    "فڕۆکە": "packages.air",
    "دەریایی": "packages.sea",
    "گەیشتووە": "packages.delivered",
    "تۆمارکراو": "packages.registered",
    "لە ڕێگادا": "packages.inTransit",
    "گومرگ": "packages.customs",
    "ئامادەی گەیاندن": "packages.readyForDelivery",
    
    # Batches
    "باچ": "batches.batch",
    "باچەکان": "batches.title",
    "زیادکردنی باچ": "batches.addBatch",
    "کۆدی باچ": "batches.batchCode",
    
    # Finance
    "دارایی": "finance.title",
    "داهات": "finance.income",
    "خەرجی": "finance.expense",
    "قازانج": "finance.profit",
    "زەرەر": "finance.loss",
    "باڵانس": "finance.balance",
    "پارەدان": "finance.payment",
    "قەرز": "finance.debt",
    "پسوڵە": "finance.invoice",
    
    # Treasury
    "خەزنە": "treasury.title",
    "کاش": "treasury.cash",
    "بانک": "treasury.bank",
    "گواستنەوە": "treasury.transfer",
    
    # Expenses
    "خەرجییەکان": "expenses.title",
    "جۆری خەرجی": "expenses.expenseType",
    
    # Partners
    "هاوبەش": "partners.partner",
    "هاوبەشەکان": "partners.title",
    
    # Suppliers
    "دابینکەر": "suppliers.supplier",
    "دابینکەرەکان": "suppliers.title",
    
    # Reports
    "ڕاپۆرت": "reports.report",
    "ڕاپۆرتەکان": "reports.title",
    "قازانج و زەرەر": "reports.profitLoss",
    "تەرازوو": "reports.balanceSheet",
    
    # Scanner
    "سکان": "scanner.scan",
    "سکانەر": "scanner.scanner",
    "بارکۆد": "scanner.barcode",
    
    # Full Package
    "فول پاکەج": "fullPackage.title",
    "داواکاری": "fullPackage.order",
    "بەرهەم": "fullPackage.product",
    
    # Warehouse
    "کۆگا": "warehouse.title",
    "وەرگرتن": "warehouse.receive",
    "دەرکردن": "warehouse.dispatch",
    
    # Actions
    "نوێکردنەوە": "common.refresh",
    "ئەکسپۆرت": "common.export",
    "چاپکردن": "common.print",
    "فلتەر": "common.filter",
    "ڕیزکردن": "common.sort",
    "هەڵبژاردن": "common.select",
    "هەڵبژێرە": "common.select",
    
    # Dates
    "لە بەرواری": "common.fromDate",
    "بۆ بەرواری": "common.toDate",
    
    # Status messages
    "دڵنیایت": "common.areYouSure",
    "ئەم کردارە ناگەڕێتەوە": "common.actionCannotBeUndone",
    "بۆ هەمیشە دەسڕێتەوە": "common.permanentlyDeleted",
}

# Patterns to replace
PATTERNS = [
    # Toast messages
    (r'toast\.success\("([^"]+)"\)', lambda m: f'toast.success(t("{get_key(m.group(1))}"))'),
    (r'toast\.error\("([^"]+)"\)', lambda m: f'toast.error(t("{get_key(m.group(1))}"))'),
    (r'toast\.warning\("([^"]+)"\)', lambda m: f'toast.warning(t("{get_key(m.group(1))}"))'),
    (r'toast\.info\("([^"]+)"\)', lambda m: f'toast.info(t("{get_key(m.group(1))}"))'),
    
    # Labels and placeholders
    (r'<Label>([^<]+)</Label>', lambda m: f'<Label>{{t("{get_key(m.group(1))}")}}</Label>' if has_kurdish(m.group(1)) else m.group(0)),
    (r'placeholder="([^"]+)"', lambda m: f'placeholder={{t("{get_key(m.group(1))}")}}' if has_kurdish(m.group(1)) else m.group(0)),
    
    # Dialog titles
    (r'<DialogTitle>([^<]+)</DialogTitle>', lambda m: f'<DialogTitle>{{t("{get_key(m.group(1))}")}}</DialogTitle>' if has_kurdish(m.group(1)) else m.group(0)),
    (r'<AlertDialogTitle>([^<]+)</AlertDialogTitle>', lambda m: f'<AlertDialogTitle>{{t("{get_key(m.group(1))}")}}</AlertDialogTitle>' if has_kurdish(m.group(1)) else m.group(0)),
    
    # Card headers
    (r'<CardTitle>([^<]+)</CardTitle>', lambda m: f'<CardTitle>{{t("{get_key(m.group(1))}")}}</CardTitle>' if has_kurdish(m.group(1)) else m.group(0)),
    
    # Button text
    (r'>([^<>]+)</Button>', lambda m: f'>{{t("{get_key(m.group(1))}")}}</Button>' if has_kurdish(m.group(1)) and not m.group(1).strip().startswith('{') else m.group(0)),
    
    # SelectItem
    (r'<SelectItem value="[^"]+">([^<]+)</SelectItem>', lambda m: f'<SelectItem value="{m.group(0).split(\'"\')[1]}">{{t("{get_key(m.group(1))}")}}</SelectItem>' if has_kurdish(m.group(1)) else m.group(0)),
]

def has_kurdish(text):
    """Check if text contains Kurdish characters"""
    kurdish_pattern = r'[ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ]'
    return bool(re.search(kurdish_pattern, text))

def get_key(text):
    """Get translation key for text"""
    text = text.strip()
    
    # Check if we have a direct mapping
    for kurdish, key in TRANSLATIONS.items():
        if kurdish in text:
            return key
    
    # Generate a key based on the text
    # Remove Kurdish and special characters, use English if present
    english_match = re.search(r'[A-Za-z]+', text)
    if english_match:
        return f"common.{english_match.group(0).lower()}"
    
    # Default key
    return "common.text"

def process_file(filepath):
    """Process a single TSX file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Apply patterns
    for pattern, replacement in PATTERNS:
        try:
            content = re.sub(pattern, replacement, content)
        except Exception as e:
            print(f"Error applying pattern {pattern}: {e}")
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    pages_dir = Path('/home/ubuntu/wazn-express/client/src/pages')
    
    modified_count = 0
    for tsx_file in pages_dir.glob('*.tsx'):
        if process_file(tsx_file):
            modified_count += 1
            print(f"Modified: {tsx_file.name}")
    
    print(f"\nTotal files modified: {modified_count}")

if __name__ == '__main__':
    main()
