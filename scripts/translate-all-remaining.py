#!/usr/bin/env python3
"""
Script to replace hardcoded Kurdish text with t() function calls in TSX files.
"""

import os
import re
import json
from pathlib import Path

# Common translations mapping (Kurdish -> translation key)
TRANSLATIONS = {
    # Common UI elements
    "پاشگەزبوونەوە": "common.cancel",
    "داخستن": "common.close",
    "سڕینەوە": "common.delete",
    "دەستکاری": "common.edit",
    "بینین": "common.view",
    "زیادکردن": "common.add",
    "پاشەکەوتکردن": "common.save",
    "نوێکردنەوە": "common.update",
    "گەڕان": "common.search",
    "هەموو": "common.all",
    "چالاک": "common.active",
    "ناچالاک": "common.inactive",
    "بارودۆخ": "common.status",
    "ناو": "common.name",
    "تێبینی": "common.notes",
    "وەسف": "common.description",
    "بەروار": "common.date",
    "کۆ": "common.total",
    "کۆی گشتی": "common.grandTotal",
    "هەڵە": "common.error",
    "سەرکەوتوو": "common.success",
    "ئاگاداری": "common.warning",
    "چاوەڕوان بە": "common.loading",
    "هەڵبژێرە": "common.select",
    "دڵنیایت": "common.confirmDelete",
    "بەڵێ": "common.yes",
    "نەخێر": "common.no",
    
    # Finance
    "قازانج": "finance.profit",
    "زەرەر": "finance.loss",
    "داهات": "finance.income",
    "خەرجی": "finance.expense",
    "باڵانس": "finance.balance",
    "پارەدان": "finance.payment",
    "پسوڵە": "finance.invoice",
    "قەرز": "finance.debt",
    "خەزنە": "finance.treasury",
    "هاوبەش": "finance.partner",
    "سەرمایە": "finance.capital",
    "دراو": "finance.currency",
    "نرخ": "finance.price",
    "بڕ": "finance.amount",
    "عمولە": "finance.commission",
    
    # Customers
    "کەستمەر": "customers.title",
    "کڕیار": "customers.title",
    "ناوی کەستمەر": "customers.name",
    "ژمارەی مۆبایل": "customers.phone",
    "ناونیشان": "customers.address",
    "شار": "customers.city",
    
    # Packages
    "پاکەج": "packages.title",
    "پاکەجەکان": "packages.title",
    "کۆدی پاکەج": "packages.code",
    "کێش": "packages.weight",
    "قەبارە": "packages.dimensions",
    "جۆری ناردن": "packages.shippingType",
    "ئاسمانی ئاسایی": "packages.airRegular",
    "ئاسمانی تایبەت": "packages.airIrregular",
    "دەریایی": "packages.sea",
    
    # Batches
    "باچ": "batches.title",
    "باچەکان": "batches.title",
    "کۆدی باچ": "batches.code",
    "گواستنەوە": "batches.shipping",
    "گەیشتووە": "batches.arrived",
    "لە ڕێگا": "batches.inTransit",
    
    # Full Package
    "داواکاری": "fullPackage.order",
    "داواکاری نوێ": "fullPackage.newOrder",
    "فرۆشتنەوە": "fullPackage.resale",
    "کڕین": "fullPackage.purchase",
    "نرخی کڕین": "fullPackage.purchasePrice",
    "نرخی فرۆشتن": "fullPackage.sellingPrice",
    "نرخی تەخمینی": "fullPackage.estimatedPrice",
    "نرخی ڕاستەقینە": "fullPackage.actualPrice",
    "عمولەی کڕین": "fullPackage.purchaseFee",
    "نرخی گواستنەوە": "fullPackage.shippingCost",
    "ژمارەی ئۆردەر": "fullPackage.orderNumber",
    "ژمارەی تراک": "fullPackage.trackingNumber",
    "دانە": "fullPackage.quantity",
    "ڕەنگ": "fullPackage.color",
    "فرۆشیار": "suppliers.title",
    "دابینکەر": "suppliers.title",
    
    # Scanner
    "سکان": "scanner.title",
    "سکانکردن": "scanner.scan",
    "بارکۆد": "scanner.barcode",
    "QR کۆد": "scanner.qrCode",
    
    # Reports
    "ڕاپۆرت": "reports.title",
    "ڕاپۆرتی قازانج و زەرەر": "reports.profitLoss",
    "تەرازوو": "reports.balanceSheet",
    "جووڵەی پارە": "reports.cashFlow",
    
    # Settings
    "ڕێکخستنەکان": "settings.title",
    "داشبۆرد": "dashboard.title",
    
    # Dates
    "ئەمڕۆ": "dates.today",
    "دوێنێ": "dates.yesterday",
    "ئەم هەفتەیە": "dates.thisWeek",
    "ئەم مانگە": "dates.thisMonth",
    "ئەم ساڵە": "dates.thisYear",
    "لە": "dates.from",
    "بۆ": "dates.to",
    
    # Actions
    "چاپکردن": "actions.print",
    "داگرتن": "actions.download",
    "ناردن": "actions.send",
    "هاوبەشکردن": "actions.share",
    "کۆپیکردن": "actions.copy",
    
    # Status labels
    "چاوەڕوان": "status.pending",
    "پەسەندکراو": "status.approved",
    "ڕەتکراوەتەوە": "status.rejected",
    "تەواوکراو": "status.completed",
    "هەڵوەشێندراوە": "status.cancelled",
    "گەیاندرا": "status.delivered",
    
    # Priority
    "پێشینەیی": "priority.title",
    "کەم": "priority.low",
    "ئاسایی": "priority.normal",
    "بەرز": "priority.high",
    "فریاکەوتن": "priority.urgent",
    
    # Warehouse
    "کۆگا": "warehouse.title",
    "مەخزەن": "warehouse.title",
    "وەرگرتن": "warehouse.receive",
    "دەرکردن": "warehouse.dispatch",
    
    # Tracking
    "شوێنپێگیری": "tracking.title",
    "ئاگادارکردنەوە": "tracking.alerts",
    
    # Blog
    "بڵۆگ": "blog.title",
    "بابەت": "blog.post",
    "نووسین": "blog.write",
    "بڵاوکردنەوە": "blog.publish",
    
    # Data Management
    "بەڕێوەبردنی داتا": "dataManagement.title",
    "هاوردەکردن": "dataManagement.import",
    "هەناردەکردن": "dataManagement.export",
    "پاککردنەوە": "dataManagement.clear",
    
    # Invoice/Label Templates
    "داڕشتەی پسوڵە": "invoiceTemplate.title",
    "داڕشتەی لەیبڵ": "labelTemplate.title",
    
    # Service Types
    "جۆری خزمەتگوزاری": "serviceTypes.title",
    
    # Financial Goals
    "ئامانجە داراییەکان": "financialGoals.title",
    
    # Treasury
    "خەزنەدار": "treasury.cashier",
    "واردە": "treasury.deposit",
    "دەرچوو": "treasury.withdrawal",
    
    # Partners
    "هاوبەشەکان": "partners.title",
    "سەرمایەدار": "partners.investor",
    "وەبەرهێنان": "partners.investment",
    
    # Expenses
    "خەرجییەکان": "expenses.title",
    "جۆری خەرجی": "expenses.type",
    
    # Company Debts
    "قەرزی کۆمپانیا": "companyDebts.title",
    "قەرزدار": "companyDebts.debtor",
    "قەرزخواز": "companyDebts.creditor",
    
    # Scan Reports
    "ڕاپۆرتی سکان": "scanReports.title",
}

def replace_kurdish_text(content, filename):
    """Replace hardcoded Kurdish text with t() function calls."""
    changes = 0
    
    # Sort translations by length (longest first) to avoid partial replacements
    sorted_translations = sorted(TRANSLATIONS.items(), key=lambda x: len(x[0]), reverse=True)
    
    for kurdish, key in sorted_translations:
        # Pattern for text inside JSX elements: >Kurdish text<
        pattern1 = re.compile(r'>' + re.escape(kurdish) + r'<', re.UNICODE)
        if pattern1.search(content):
            content = pattern1.sub(f'>{{t("{key}")}}<', content)
            changes += 1
        
        # Pattern for text in JSX with newlines: >\n  Kurdish text\n<
        pattern2 = re.compile(r'>\s*\n\s*' + re.escape(kurdish) + r'\s*\n\s*<', re.UNICODE)
        if pattern2.search(content):
            content = pattern2.sub(f'>{{t("{key}")}}<', content)
            changes += 1
        
        # Pattern for placeholder attributes: placeholder="Kurdish text"
        pattern3 = re.compile(r'placeholder="' + re.escape(kurdish) + r'"', re.UNICODE)
        if pattern3.search(content):
            content = pattern3.sub(f'placeholder={{t("{key}")}}', content)
            changes += 1
        
        # Pattern for title attributes: title="Kurdish text"
        pattern4 = re.compile(r'title="' + re.escape(kurdish) + r'"', re.UNICODE)
        if pattern4.search(content):
            content = pattern4.sub(f'title={{t("{key}")}}', content)
            changes += 1
        
        # Pattern for toast messages: toast.success("Kurdish text")
        pattern5 = re.compile(r'toast\.(success|error|info|warning)\("' + re.escape(kurdish) + r'"\)', re.UNICODE)
        if pattern5.search(content):
            content = pattern5.sub(rf'toast.\1(t("{key}"))', content)
            changes += 1
        
        # Pattern for Label content: <Label>Kurdish text</Label>
        pattern6 = re.compile(r'<Label[^>]*>' + re.escape(kurdish) + r'</Label>', re.UNICODE)
        if pattern6.search(content):
            content = pattern6.sub(lambda m: m.group(0).replace(f'>{kurdish}<', f'>{{t("{key}")}}<'), content)
            changes += 1
    
    return content, changes

def process_file(filepath):
    """Process a single TSX file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content, changes = replace_kurdish_text(content, filepath)
        
        if changes > 0:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"✓ {filepath}: {changes} replacements")
        else:
            print(f"- {filepath}: no changes")
        
        return changes
    except Exception as e:
        print(f"✗ {filepath}: {e}")
        return 0

def main():
    pages_dir = Path("/home/ubuntu/wazn-express/client/src/pages")
    total_changes = 0
    
    for tsx_file in pages_dir.glob("*.tsx"):
        changes = process_file(tsx_file)
        total_changes += changes
    
    print(f"\nTotal replacements: {total_changes}")

if __name__ == "__main__":
    main()
