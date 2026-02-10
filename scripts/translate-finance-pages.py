#!/usr/bin/env python3
"""
Script to translate hardcoded Kurdish text in finance pages to t() function calls
"""

import re
import os

# Define translation mappings for common patterns
TRANSLATIONS = {
    # Toast messages
    'toast.success("بە سەرکەوتوویی زیادکرا")': 'toast.success(t("common.addedSuccessfully"))',
    'toast.success("بە سەرکەوتوویی نوێکرایەوە")': 'toast.success(t("common.updatedSuccessfully"))',
    'toast.success("بە سەرکەوتوویی سڕایەوە")': 'toast.success(t("common.deletedSuccessfully"))',
    'toast.error("هەڵە لە زیادکردن")': 'toast.error(t("common.addError"))',
    'toast.error("هەڵە لە نوێکردنەوە")': 'toast.error(t("common.updateError"))',
    'toast.error("هەڵە لە سڕینەوە")': 'toast.error(t("common.deleteError"))',
    
    # Common UI elements
    '>زیادکردن<': '>{t("common.add")}<',
    '>نوێکردنەوە<': '>{t("common.update")}<',
    '>سڕینەوە<': '>{t("common.delete")}<',
    '>پاشگەزبوونەوە<': '>{t("common.cancel")}<',
    '>گەڕان<': '>{t("common.search")}<',
    '>گەڕان...</': '>{t("common.searching")}...</',
    '>پاشەکەوتکردن<': '>{t("common.save")}<',
    '>دەستکاریکردن<': '>{t("common.edit")}<',
    '>بینین<': '>{t("common.view")}<',
    
    # Labels
    'ناو': 't("common.name")',
    'بڕ': 't("finance.amount")',
    'بەروار': 't("common.date")',
    'تێبینی': 't("common.notes")',
    'جۆر': 't("common.type")',
    'دۆخ': 't("common.status")',
    
    # Finance specific
    'داهات': 't("finance.income")',
    'خەرجی': 't("finance.expense")',
    'قازانج': 't("finance.profit")',
    'زەرەر': 't("finance.loss")',
    'باڵانس': 't("finance.balance")',
    'کۆی گشتی': 't("finance.total")',
    'پارەدان': 't("finance.payment")',
    'وەرگرتن': 't("finance.receive")',
    
    # Partners specific
    'هاوبەش': 't("partners.partner")',
    'هاوبەشەکان': 't("partners.title")',
    'پشکی هاوبەش': 't("partners.share")',
    'سەرمایە': 't("partners.capital")',
    
    # Treasury specific
    'خەزنە': 't("treasury.title")',
    'صندوق': 't("treasury.cashBox")',
    'جووڵەی پارە': 't("treasury.cashFlow")',
    
    # Expenses specific
    'خەرجییەکان': 't("expenses.title")',
    'جۆری خەرجی': 't("expenses.expenseType")',
    
    # Company Debts specific
    'قەرزی کۆمپانیا': 't("companyDebts.title")',
    'قەرزدەر': 't("companyDebts.creditor")',
    'قەرزخۆر': 't("companyDebts.debtor")',
}

def translate_file(filepath):
    """Translate hardcoded Kurdish text in a file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    replacements = 0
    
    # Apply direct replacements
    for kurdish, english in TRANSLATIONS.items():
        if kurdish in content:
            content = content.replace(kurdish, english)
            replacements += content.count(english) - original_content.count(english)
    
    # Pattern-based replacements for common structures
    patterns = [
        # {language === "ku" ? "Kurdish" : "English"} -> {t("key")}
        (r'\{language === "ku" \? "([^"]+)" : "([^"]+)"\}', lambda m: '{t("' + get_translation_key(m.group(1), m.group(2)) + '")}'),
        
        # placeholder="Kurdish text" -> placeholder={t("key")}
        (r'placeholder="([ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ][^"]*)"', lambda m: 'placeholder={t("' + get_placeholder_key(m.group(1)) + '")}'),
        
        # <Label>Kurdish text</Label> -> <Label>{t("key")}</Label>
        (r'<Label>([ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ][^<]*)</Label>', lambda m: '<Label>{t("' + get_label_key(m.group(1)) + '")}</Label>'),
        
        # <CardTitle>Kurdish text</CardTitle> -> <CardTitle>{t("key")}</CardTitle>
        (r'<CardTitle[^>]*>([ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ][^<]*)</CardTitle>', lambda m: '<CardTitle>{t("' + get_title_key(m.group(1)) + '")}</CardTitle>'),
    ]
    
    for pattern, replacement in patterns:
        content = re.sub(pattern, replacement, content)
    
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
        return True
    return False

def get_translation_key(kurdish, english):
    """Generate a translation key based on the English text"""
    key = english.lower().replace(' ', '_').replace('-', '_')
    key = re.sub(r'[^a-z0-9_]', '', key)
    return f"common.{key}"

def get_placeholder_key(kurdish):
    """Generate a placeholder key"""
    return "common.placeholder"

def get_label_key(kurdish):
    """Generate a label key"""
    return "common.label"

def get_title_key(kurdish):
    """Generate a title key"""
    return "common.title"

def main():
    pages = [
        '/home/ubuntu/wazn-express/client/src/pages/Partners.tsx',
        '/home/ubuntu/wazn-express/client/src/pages/Treasury.tsx',
        '/home/ubuntu/wazn-express/client/src/pages/Expenses.tsx',
        '/home/ubuntu/wazn-express/client/src/pages/CompanyDebts.tsx',
    ]
    
    for page in pages:
        if os.path.exists(page):
            translate_file(page)
        else:
            print(f"File not found: {page}")

if __name__ == "__main__":
    main()
