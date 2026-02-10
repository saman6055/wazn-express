#!/usr/bin/env python3
"""
Fix all broken translation patterns in the codebase.
"""

import re
from pathlib import Path

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Pattern 1: "{t("key")}..." -> t("key") + "..."
    content = re.sub(r'"\{t\("([^"]+)"\)\}([^"]*)"', r't("\1") + "\2"', content)
    
    # Pattern 2: "{t("key")}؟" -> t("key") + "؟"
    content = re.sub(r'"\{t\("([^"]+)"\)\}(؟)"', r't("\1") + "\2"', content)
    
    # Pattern 3: "{t("key")} (kg)" -> t("key") + " (kg)"
    content = re.sub(r'"\{t\("([^"]+)"\)\} \(([^)]+)\)"', r't("\1") + " (\2)"', content)
    
    # Pattern 4: confirm("{t("key")}؟") -> confirm(t("key") + "؟")
    content = re.sub(r'confirm\("\{t\("([^"]+)"\)\}(؟?)"\)', r'confirm(t("\1") + "\2")', content)
    
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
