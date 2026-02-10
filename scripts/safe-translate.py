#!/usr/bin/env python3
"""
Safe translation script that only handles simple patterns
and avoids breaking code structure
"""

import os
import re
import json
import hashlib

PAGES_DIR = "/home/ubuntu/wazn-express/client/src/pages"
LOCALES_DIR = "/home/ubuntu/wazn-express/client/src/locales"

# Track new translation keys
new_keys = {}

def generate_key(text):
    """Generate a unique key for the text"""
    hash_val = hashlib.md5(text.encode()).hexdigest()[:6]
    return f"auto.text_{hash_val}"

def add_translation(key, ku_text):
    """Add a translation key"""
    if key not in new_keys:
        new_keys[key] = {
            'ku': ku_text,
            'en': ku_text,
            'ar': ku_text,
            'zh': ku_text
        }

def has_kurdish(text):
    """Check if text contains Kurdish characters"""
    kurdish_chars = 'ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ'
    return any(c in text for c in kurdish_chars)

def process_file(filepath):
    """Process a single file with safe patterns only"""
    # Skip files that have t() used outside component (in const arrays before export)
    skip_files = ['ScanDashboard.tsx', 'FinancialGoals.tsx', 'SmartScanner.tsx']
    if os.path.basename(filepath) in skip_files:
        return 0
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return 0
    
    original = content
    replacements = 0
    
    # Check if file has useLanguage and t available
    has_t = 'const { t }' in content or 'const { t,' in content or ', t }' in content or ', t,' in content
    
    if not has_t:
        # Skip files without t() available
        return 0
    
    # Pattern 1: >Kurdish text< (simple JSX text content)
    # Only match text that is purely Kurdish without variables
    pattern1 = re.compile(r'>([^<>{}\n]*[ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ][^<>{}\n]*)</')
    for match in pattern1.finditer(content):
        ku_text = match.group(1).strip()
        # Skip if contains variables or is too short
        if '{' in ku_text or '}' in ku_text or len(ku_text) < 2:
            continue
        # Skip if already translated
        if 't(' in ku_text:
            continue
        key = generate_key(ku_text)
        add_translation(key, ku_text)
        old_text = f'>{match.group(1)}</'
        new_text = f'>{{t("{key}")}} </'
        content = content.replace(old_text, new_text, 1)
        replacements += 1
    
    # Pattern 2: placeholder="Kurdish text"
    pattern2 = re.compile(r'placeholder="([^"]*[ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ][^"]*)"')
    for match in pattern2.finditer(content):
        ku_text = match.group(1)
        if '{' in ku_text or '}' in ku_text:
            continue
        key = generate_key(ku_text)
        add_translation(key, ku_text)
        old_text = f'placeholder="{ku_text}"'
        new_text = f'placeholder={{t("{key}")}}'
        content = content.replace(old_text, new_text, 1)
        replacements += 1
    
    # Pattern 3: title="Kurdish text"
    pattern3 = re.compile(r'title="([^"]*[ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ][^"]*)"')
    for match in pattern3.finditer(content):
        ku_text = match.group(1)
        if '{' in ku_text or '}' in ku_text:
            continue
        key = generate_key(ku_text)
        add_translation(key, ku_text)
        old_text = f'title="{ku_text}"'
        new_text = f'title={{t("{key}")}}'
        content = content.replace(old_text, new_text, 1)
        replacements += 1
    
    # Pattern 4: description: "Kurdish text" (in objects)
    pattern4 = re.compile(r'description:\s*"([^"]*[ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ][^"]*)"')
    for match in pattern4.finditer(content):
        ku_text = match.group(1)
        if '{' in ku_text or '}' in ku_text:
            continue
        key = generate_key(ku_text)
        add_translation(key, ku_text)
        old_text = f'description: "{ku_text}"'
        new_text = f'description: t("{key}")'
        content = content.replace(old_text, new_text, 1)
        replacements += 1
    
    # Pattern 5: toast.success("Kurdish text")
    pattern5 = re.compile(r'toast\.success\("([^"]*[ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ][^"]*)"\)')
    for match in pattern5.finditer(content):
        ku_text = match.group(1)
        if '{' in ku_text or '}' in ku_text:
            continue
        key = generate_key(ku_text)
        add_translation(key, ku_text)
        old_text = f'toast.success("{ku_text}")'
        new_text = f'toast.success(t("{key}"))'
        content = content.replace(old_text, new_text, 1)
        replacements += 1
    
    # Pattern 6: toast.error("Kurdish text")
    pattern6 = re.compile(r'toast\.error\("([^"]*[ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ][^"]*)"\)')
    for match in pattern6.finditer(content):
        ku_text = match.group(1)
        if '{' in ku_text or '}' in ku_text:
            continue
        key = generate_key(ku_text)
        add_translation(key, ku_text)
        old_text = f'toast.error("{ku_text}")'
        new_text = f'toast.error(t("{key}"))'
        content = content.replace(old_text, new_text, 1)
        replacements += 1
    
    # Pattern 7: toast("Kurdish text")
    pattern7 = re.compile(r'toast\("([^"]*[ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ][^"]*)"\)')
    for match in pattern7.finditer(content):
        ku_text = match.group(1)
        if '{' in ku_text or '}' in ku_text:
            continue
        key = generate_key(ku_text)
        add_translation(key, ku_text)
        old_text = f'toast("{ku_text}")'
        new_text = f'toast(t("{key}"))'
        content = content.replace(old_text, new_text, 1)
        replacements += 1
    
    if content != original:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✓ {os.path.basename(filepath)}: {replacements} replacements")
            return replacements
        except Exception as e:
            print(f"Error writing {filepath}: {e}")
            return 0
    
    return 0

def update_locale_files():
    """Update all locale files with new keys"""
    if not new_keys:
        return
    
    print("\nUpdating locale files...")
    
    for lang in ['ku', 'en', 'ar', 'zh']:
        locale_path = os.path.join(LOCALES_DIR, f"{lang}.json")
        try:
            with open(locale_path, 'r', encoding='utf-8') as f:
                locale_data = json.load(f)
        except:
            locale_data = {}
        
        # Add new keys
        if 'auto' not in locale_data:
            locale_data['auto'] = {}
        
        for key, translations in new_keys.items():
            parts = key.split('.')
            if len(parts) == 2:
                section, subkey = parts
                if section not in locale_data:
                    locale_data[section] = {}
                if subkey not in locale_data[section]:
                    locale_data[section][subkey] = translations[lang]
        
        with open(locale_path, 'w', encoding='utf-8') as f:
            json.dump(locale_data, f, ensure_ascii=False, indent=2)
        
        print(f"✓ Updated {lang}.json")

def main():
    print("=" * 50)
    print("Safe Translation Script")
    print("=" * 50)
    
    total_replacements = 0
    
    for root, dirs, files in os.walk(PAGES_DIR):
        for file in files:
            if file.endswith('.tsx'):
                filepath = os.path.join(root, file)
                total_replacements += process_file(filepath)
    
    print("-" * 50)
    print(f"Total: {total_replacements} replacements, {len(new_keys)} new keys")
    
    update_locale_files()
    print("Done!")

if __name__ == "__main__":
    main()
