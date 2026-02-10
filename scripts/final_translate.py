#!/usr/bin/env python3
"""
Final translation script - replace all remaining hardcoded Kurdish text with t() calls.
This script handles JSX content more carefully.
"""

import re
import json
import hashlib
from pathlib import Path

def load_translation_keys():
    with open('/home/ubuntu/wazn-express/scripts/clean_translation_keys.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def generate_key(text):
    """Generate a translation key from text."""
    hash_val = hashlib.md5(text.encode()).hexdigest()[:6]
    return f"auto.text_{hash_val}"

def replace_jsx_text_content(content, translations):
    """Replace Kurdish text that appears directly in JSX (between > and <)."""
    
    def replace_match(match):
        before = match.group(1)  # >
        text = match.group(2)
        after = match.group(3)  # <
        
        # Skip if already translated
        if '{t(' in text:
            return match.group(0)
        
        # Find Kurdish text in the content
        kurdish_pattern = r'([ئابپتثجچحخدذرزژسشصضطظعغفقکگلڵمنوۆهەیێ][^\n<>{}]*[ئابپتثجچحخدذرزژسشصضطظعغفقکگلڵمنوۆهەیێ])'
        
        def replace_kurdish(m):
            kurdish_text = m.group(1).strip()
            if len(kurdish_text) < 2:
                return m.group(0)
            key = translations.get(kurdish_text, generate_key(kurdish_text))
            return '{t("' + key + '")}'
        
        new_text = re.sub(kurdish_pattern, replace_kurdish, text)
        return before + new_text + after
    
    # Match content between > and <
    pattern = r'(>)([^<>]*[ئابپتثجچحخدذرزژسشصضطظعغفقکگلڵمنوۆهەیێ][^<>]*)(<)'
    return re.sub(pattern, replace_match, content)

def replace_string_literals(content, translations):
    """Replace Kurdish text in string literals like title="text"."""
    
    def replace_match(match):
        prop = match.group(1)
        text = match.group(2)
        
        # Skip if too short or already translated
        if len(text) < 2 or '{t(' in text:
            return match.group(0)
        
        # Check if contains Kurdish
        if not re.search(r'[ئابپتثجچحخدذرزژسشصضطظعغفقکگلڵمنوۆهەیێ]', text):
            return match.group(0)
        
        key = translations.get(text, generate_key(text))
        return f'{prop}={{t("{key}")}}'
    
    # Match prop="Kurdish text"
    pattern = r'(\w+)="([^"]*[ئابپتثجچحخدذرزژسشصضطظعغفقکگلڵمنوۆهەیێ][^"]*)"'
    return re.sub(pattern, replace_match, content)

def process_file(filepath, translations):
    """Process a single file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Replace JSX text content
    content = replace_jsx_text_content(content, translations)
    
    # Replace string literals
    content = replace_string_literals(content, translations)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    translations = load_translation_keys()
    pages_dir = Path('/home/ubuntu/wazn-express/client/src/pages')
    
    # Process all tsx files
    modified = 0
    for tsx_file in sorted(pages_dir.glob('*.tsx')):
        if process_file(tsx_file, translations):
            print(f"Modified: {tsx_file.name}")
            modified += 1
    
    print(f"\nTotal files modified: {modified}")

if __name__ == '__main__':
    main()
