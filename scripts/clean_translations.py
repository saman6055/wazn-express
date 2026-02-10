#!/usr/bin/env python3
"""
Create clean translation keys for Kurdish text.
"""

import re
import json
import hashlib
from pathlib import Path

# Common Kurdish phrases and their translation keys
COMMON_TRANSLATIONS = {
    # Navigation
    'داشبۆرد': 'nav.dashboard',
    'کڕیارەکان': 'nav.customers',
    'پاکەتەکان': 'nav.packages',
    'باچەکان': 'nav.batches',
    'فاکتورەکان': 'nav.invoices',
    'ڕێکخستنەکان': 'nav.settings',
    'ڕاپۆرتەکان': 'nav.reports',
    'بەکارهێنەران': 'nav.users',
    'سکانەر': 'nav.scanner',
    
    # Common actions
    'سڕینەوە': 'common.delete',
    'پاشگەزبوونەوە': 'common.cancel',
    'تۆمارکردن': 'common.save',
    'گەڕان': 'common.search',
    'زیادکردن': 'common.add',
    'دەستکاریکردن': 'common.edit',
    'نوێکردنەوە': 'common.refresh',
    'چاپکردن': 'common.print',
    'داگرتن': 'common.download',
    'ناردن': 'common.send',
    'وەرگرتن': 'common.receive',
    'گەیاندن': 'common.deliver',
    'دروستکردن': 'common.create',
    'هەڵبژاردن': 'common.select',
    'دەستپێکردن': 'common.start',
    'تەواوکردن': 'common.finish',
    'بینین': 'common.view',
    'گۆڕین': 'common.change',
    
    # Status
    'چالاک': 'status.active',
    'ناچالاک': 'status.inactive',
    'سەرکەوتوو': 'status.success',
    'هەڵە': 'status.error',
    'چاوەڕوان بە': 'status.loading',
    'باردەکرێت': 'status.loading',
    'نەدۆزرا': 'status.notFound',
    'تەواو': 'status.complete',
    
    # Form labels
    'ناو': 'form.name',
    'کۆد': 'form.code',
    'ئیمەیڵ': 'form.email',
    'ژمارەی مۆبایل': 'form.mobile',
    'ناونیشان': 'form.address',
    'وەسف': 'form.description',
    'تێبینی': 'form.notes',
    'بەرواری': 'form.date',
    'کات': 'form.time',
    
    # Financial
    'بڕ': 'finance.amount',
    'نرخ': 'finance.price',
    'کۆی گشتی': 'finance.total',
    'قازانج': 'finance.profit',
    'زیان': 'finance.loss',
    'داهات': 'finance.revenue',
    'خەرجی': 'finance.expense',
    'باڵانس': 'finance.balance',
    'قەرز': 'finance.debt',
    'پارەدان': 'finance.payment',
    'کاش': 'finance.cash',
    'بانک': 'finance.bank',
    'کرێدیت': 'finance.credit',
    
    # Shipping
    'ئاسمانی': 'shipping.air',
    'دەریایی': 'shipping.sea',
    'ئاسمانی ئاسایی': 'shipping.airRegular',
    'ئاسمانی تایبەت': 'shipping.airIrregular',
    'کێش': 'shipping.weight',
    'قەبارە': 'shipping.dimensions',
    'ڕەقەم': 'shipping.trackingNumber',
    
    # Time periods
    'ئەمڕۆ': 'time.today',
    'ئەم هەفتەیە': 'time.thisWeek',
    'ئەم مانگە': 'time.thisMonth',
    'ئەم ساڵە': 'time.thisYear',
    
    # Warehouse operations
    'کۆگا': 'warehouse.warehouse',
    'گەیشتن': 'warehouse.arrive',
    'تۆمار': 'warehouse.register',
    'سکان': 'warehouse.scan',
    
    # Data management
    'دابینکەرەکان': 'data.suppliers',
    'پارەدانەکان': 'data.payments',
    'خەرجیەکان': 'data.expenses',
    
    # Alerts and messages
    'ئاگاداری': 'alert.warning',
    'گرنگ': 'alert.important',
    'دڵنیابوون': 'alert.confirm',
    'هەڵە ڕوویدا': 'alert.errorOccurred',
    'سەرکەوتوو بوو': 'alert.success',
    
    # Misc
    'هەموو': 'common.all',
    'نوێ': 'common.new',
    'کڕیار': 'common.customer',
    'باچ': 'common.batch',
    'پاکەت': 'common.package',
}

def find_kurdish_strings(content):
    """Find Kurdish strings in quotes."""
    # Match Kurdish text in quotes
    pattern = r'["\']([^"\']*[ئابپتثجچحخدذرزژسشصضطظعغفقکگلڵمنوۆهەیێ]+[^"\']*)["\']'
    matches = re.findall(pattern, content)
    
    # Filter to only include clean Kurdish strings (not JSX fragments)
    clean_matches = []
    for match in matches:
        # Skip if contains JSX-like patterns
        if '<' in match or '>' in match or '{' in match or '}' in match:
            continue
        # Skip if contains newlines or is too long
        if '\n' in match or len(match) > 100:
            continue
        # Skip if mostly not Kurdish
        kurdish_chars = len(re.findall(r'[ئابپتثجچحخدذرزژسشصضطظعغفقکگلڵمنوۆهەیێ]', match))
        if kurdish_chars < 2:
            continue
        clean_matches.append(match.strip())
    
    return list(set(clean_matches))

def generate_key(text):
    """Generate a translation key."""
    if text in COMMON_TRANSLATIONS:
        return COMMON_TRANSLATIONS[text]
    
    # Generate hash-based key
    hash_val = hashlib.md5(text.encode()).hexdigest()[:6]
    return f"auto.text_{hash_val}"

def main():
    pages_dir = Path('/home/ubuntu/wazn-express/client/src/pages')
    
    all_texts = set()
    
    for tsx_file in pages_dir.glob('*.tsx'):
        with open(tsx_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        texts = find_kurdish_strings(content)
        all_texts.update(texts)
    
    # Generate translation keys
    translation_keys = {}
    for text in sorted(all_texts):
        key = generate_key(text)
        translation_keys[text] = key
    
    # Save to JSON
    with open('/home/ubuntu/wazn-express/scripts/clean_translation_keys.json', 'w', encoding='utf-8') as f:
        json.dump(translation_keys, f, ensure_ascii=False, indent=2)
    
    print(f"Found {len(translation_keys)} unique Kurdish strings")
    
    # Also generate locale file entries
    ku_translations = {}
    en_translations = {}
    ar_translations = {}
    zh_translations = {}
    
    for text, key in translation_keys.items():
        ku_translations[key] = text
        en_translations[key] = text  # Will need manual translation
        ar_translations[key] = text  # Will need manual translation
        zh_translations[key] = text  # Will need manual translation
    
    # Save locale entries
    with open('/home/ubuntu/wazn-express/scripts/new_ku_entries.json', 'w', encoding='utf-8') as f:
        json.dump(ku_translations, f, ensure_ascii=False, indent=2)
    
    print("Saved Kurdish locale entries to new_ku_entries.json")

if __name__ == '__main__':
    main()
