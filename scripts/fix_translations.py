#!/usr/bin/env python3
"""
Fix broken translation patterns where "{t("key")}" was incorrectly inserted.
"""

import re
from pathlib import Path

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Fix pattern: "{t("key")}" -> t("key")
    # This handles cases where the translation was incorrectly wrapped in quotes
    content = re.sub(r'"\{t\("([^"]+)"\)\}"', r't("\1")', content)
    
    # Fix pattern: language === "ku" ? "{t("key")}" : "English"
    # Should be: language === "ku" ? t("key") : "English"
    content = re.sub(r'\? "\{t\("([^"]+)"\)\}"', r'? t("\1")', content)
    
    # Fix pattern: labelKu: "{t("key")}"
    # Should be: labelKu: t("key")
    content = re.sub(r': "\{t\("([^"]+)"\)\}"', r': t("\1")', content)
    
    # Fix pattern: descriptionKu: "{t("key")}"
    content = re.sub(r'descriptionKu: "\{t\("([^"]+)"\)\}"', r'descriptionKu: t("\1")', content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    pages_dir = Path('/home/ubuntu/wazn-express/client/src/pages')
    
    fixed = 0
    for tsx_file in sorted(pages_dir.glob('*.tsx')):
        if fix_file(tsx_file):
            print(f"Fixed: {tsx_file.name}")
            fixed += 1
    
    print(f"\nTotal files fixed: {fixed}")

if __name__ == '__main__':
    main()
