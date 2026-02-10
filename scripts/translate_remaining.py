#!/usr/bin/env python3
"""
Script to translate hardcoded Kurdish text in React components to use t() function.
This script handles the special case where t() can only be called inside React components.
"""

import re
import os
import json
from pathlib import Path

# Kurdish text patterns
KURDISH_PATTERN = r'[ئابپتثجچحخدذرزژسشصضطظعغفقکگلڵمنوۆهەیێ]+'

# Translation key mappings for common phrases
COMMON_TRANSLATIONS = {
    'کڕیارەکان': 'customers.title',
    'پاکەتەکان': 'packages.title',
    'باچەکان': 'batches.title',
    'فاکتورەکان': 'invoices.title',
    'پارەدانەکان': 'payments.title',
    'خەرجیەکان': 'expenses.title',
    'دابینکەرەکان': 'suppliers.title',
    'داشبۆرد': 'nav.dashboard',
    'ڕێکخستنەکان': 'nav.settings',
    'سڕینەوە': 'forms.delete',
    'پاشگەزبوونەوە': 'forms.cancel',
    'تۆمارکردن': 'forms.save',
    'گەڕان': 'forms.search',
    'زیادکردن': 'forms.add',
    'دەستکاریکردن': 'forms.edit',
    'نوێکردنەوە': 'forms.refresh',
    'چاپکردن': 'forms.print',
    'داگرتن': 'forms.download',
    'ناردن': 'forms.send',
    'هەموو': 'common.all',
    'نوێ': 'common.new',
    'چالاک': 'status.active',
    'ناچالاک': 'status.inactive',
    'سەرکەوتوو': 'status.success',
    'هەڵە': 'status.error',
    'چاوەڕوان بە': 'common.loading',
    'دڵنیابوون': 'common.confirm',
    'ئاگاداری': 'common.warning',
    'گرنگ': 'common.important',
    'بەرواری': 'common.date',
    'کات': 'common.time',
    'ناو': 'common.name',
    'کۆد': 'common.code',
    'بڕ': 'common.amount',
    'نرخ': 'common.price',
    'کۆی گشتی': 'common.total',
    'قازانج': 'common.profit',
    'زیان': 'common.loss',
    'داهات': 'common.revenue',
    'خەرجی': 'common.expense',
    'باڵانس': 'common.balance',
    'قەرز': 'common.debt',
    'پارەدان': 'common.payment',
    'وەرگرتن': 'common.receive',
    'ناردن': 'common.send',
    'گەیشتن': 'common.arrive',
    'گەیاندن': 'common.deliver',
    'تۆماری نوێ': 'common.newRecord',
    'هیچ تۆمارێک نییە': 'common.noRecords',
    'بارکردن': 'common.loading',
    'هەڵە ڕوویدا': 'common.errorOccurred',
    'سەرکەوتوو بوو': 'common.successMessage',
}

def find_kurdish_text(content):
    """Find all Kurdish text in the content."""
    # Match Kurdish text in quotes (both single and double)
    pattern = r'["\']([^"\']*[ئابپتثجچحخدذرزژسشصضطظعغفقکگلڵمنوۆهەیێ][^"\']*)["\']'
    matches = re.findall(pattern, content)
    return matches

def generate_translation_key(text, prefix='auto'):
    """Generate a translation key from Kurdish text."""
    # Use hash of text for unique key
    import hashlib
    hash_val = hashlib.md5(text.encode()).hexdigest()[:6]
    return f"{prefix}.text_{hash_val}"

def process_file(filepath):
    """Process a single file and return translation keys needed."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    kurdish_texts = find_kurdish_text(content)
    
    # Filter out texts that are already using t()
    new_texts = []
    for text in kurdish_texts:
        # Check if this text is already wrapped in t()
        if f"t('{text}')" not in content and f't("{text}")' not in content:
            # Check if it's not inside a t() call
            pattern = rf't\(["\'][^"\']*{re.escape(text)}[^"\']*["\']\)'
            if not re.search(pattern, content):
                new_texts.append(text)
    
    return list(set(new_texts))

def main():
    pages_dir = Path('/home/ubuntu/wazn-express/client/src/pages')
    
    all_texts = {}
    
    for tsx_file in pages_dir.glob('*.tsx'):
        texts = process_file(tsx_file)
        if texts:
            all_texts[tsx_file.name] = texts
            print(f"{tsx_file.name}: {len(texts)} Kurdish texts found")
    
    # Generate translation keys
    translation_keys = {}
    for filename, texts in all_texts.items():
        for text in texts:
            if text in COMMON_TRANSLATIONS:
                key = COMMON_TRANSLATIONS[text]
            else:
                key = generate_translation_key(text)
            translation_keys[text] = key
    
    # Save translation keys to JSON
    with open('/home/ubuntu/wazn-express/scripts/translation_keys.json', 'w', encoding='utf-8') as f:
        json.dump(translation_keys, f, ensure_ascii=False, indent=2)
    
    print(f"\nTotal unique texts: {len(translation_keys)}")
    print("Translation keys saved to translation_keys.json")

if __name__ == '__main__':
    main()
