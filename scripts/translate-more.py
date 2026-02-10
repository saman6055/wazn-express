#!/usr/bin/env python3
"""
Extended translation script that handles more patterns safely
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
    """Process a single file with extended patterns"""
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
        return 0
    
    # Pattern 1: label: "Kurdish text" (in objects inside component)
    pattern1 = re.compile(r'label:\s*"([^"]*[ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ][^"]*)"')
    for match in pattern1.finditer(content):
        ku_text = match.group(1)
        if '{' in ku_text or '}' in ku_text:
            continue
        # Check if this is inside component function (after export default function)
        match_pos = match.start()
        component_start = content.find('export default function')
        if component_start == -1 or match_pos < component_start:
            continue
        key = generate_key(ku_text)
        add_translation(key, ku_text)
        old_text = f'label: "{ku_text}"'
        new_text = f'label: t("{key}")'
        content = content.replace(old_text, new_text, 1)
        replacements += 1
    
    # Pattern 2: name: "Kurdish text" (in objects inside component)
    pattern2 = re.compile(r'name:\s*"([^"]*[ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ][^"]*)"')
    for match in pattern2.finditer(content):
        ku_text = match.group(1)
        if '{' in ku_text or '}' in ku_text:
            continue
        match_pos = match.start()
        component_start = content.find('export default function')
        if component_start == -1 or match_pos < component_start:
            continue
        key = generate_key(ku_text)
        add_translation(key, ku_text)
        old_text = f'name: "{ku_text}"'
        new_text = f'name: t("{key}")'
        content = content.replace(old_text, new_text, 1)
        replacements += 1
    
    # Pattern 3: value: "Kurdish text" (in objects inside component)
    pattern3 = re.compile(r'value:\s*"([^"]*[ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ][^"]*)"')
    for match in pattern3.finditer(content):
        ku_text = match.group(1)
        if '{' in ku_text or '}' in ku_text:
            continue
        match_pos = match.start()
        component_start = content.find('export default function')
        if component_start == -1 or match_pos < component_start:
            continue
        key = generate_key(ku_text)
        add_translation(key, ku_text)
        old_text = f'value: "{ku_text}"'
        new_text = f'value: t("{key}")'
        content = content.replace(old_text, new_text, 1)
        replacements += 1
    
    # Pattern 4: text: "Kurdish text"
    pattern4 = re.compile(r'text:\s*"([^"]*[ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ][^"]*)"')
    for match in pattern4.finditer(content):
        ku_text = match.group(1)
        if '{' in ku_text or '}' in ku_text:
            continue
        match_pos = match.start()
        component_start = content.find('export default function')
        if component_start == -1 or match_pos < component_start:
            continue
        key = generate_key(ku_text)
        add_translation(key, ku_text)
        old_text = f'text: "{ku_text}"'
        new_text = f'text: t("{key}")'
        content = content.replace(old_text, new_text, 1)
        replacements += 1
    
    # Pattern 5: message: "Kurdish text"
    pattern5 = re.compile(r'message:\s*"([^"]*[ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ][^"]*)"')
    for match in pattern5.finditer(content):
        ku_text = match.group(1)
        if '{' in ku_text or '}' in ku_text:
            continue
        match_pos = match.start()
        component_start = content.find('export default function')
        if component_start == -1 or match_pos < component_start:
            continue
        key = generate_key(ku_text)
        add_translation(key, ku_text)
        old_text = f'message: "{ku_text}"'
        new_text = f'message: t("{key}")'
        content = content.replace(old_text, new_text, 1)
        replacements += 1
    
    # Pattern 6: content: "Kurdish text"
    pattern6 = re.compile(r'content:\s*"([^"]*[ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ][^"]*)"')
    for match in pattern6.finditer(content):
        ku_text = match.group(1)
        if '{' in ku_text or '}' in ku_text:
            continue
        match_pos = match.start()
        component_start = content.find('export default function')
        if component_start == -1 or match_pos < component_start:
            continue
        key = generate_key(ku_text)
        add_translation(key, ku_text)
        old_text = f'content: "{ku_text}"'
        new_text = f'content: t("{key}")'
        content = content.replace(old_text, new_text, 1)
        replacements += 1
    
    # Pattern 7: header: "Kurdish text"
    pattern7 = re.compile(r'header:\s*"([^"]*[ئابپتثجچحخدذرڕزژسشصضطظعغفڤقکگلڵمنوۆهەیێ][^"]*)"')
    for match in pattern7.finditer(content):
        ku_text = match.group(1)
        if '{' in ku_text or '}' in ku_text:
            continue
        match_pos = match.start()
        component_start = content.find('export default function')
        if component_start == -1 or match_pos < component_start:
            continue
        key = generate_key(ku_text)
        add_translation(key, ku_text)
        old_text = f'header: "{ku_text}"'
        new_text = f'header: t("{key}")'
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
    print("Extended Translation Script")
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
