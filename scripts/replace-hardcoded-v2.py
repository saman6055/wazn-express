#!/usr/bin/env python3
"""
Improved script to replace hardcoded Kurdish text in TSX files with t() function calls.
Uses regex patterns for more accurate matching.
"""

import re
import json
from pathlib import Path

PAGES_DIR = Path("/home/ubuntu/wazn-express/client/src/pages")
LOCALES_DIR = Path("/home/ubuntu/wazn-express/client/src/locales")

# Load Kurdish translations
def load_translations():
    with open(LOCALES_DIR / "ku.json", 'r', encoding='utf-8') as f:
        return json.load(f)

# Flatten translations to key-value pairs
def flatten_translations(data, prefix=""):
    result = {}
    for key, value in data.items():
        full_key = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            result.update(flatten_translations(value, full_key))
        elif isinstance(value, str):
            result[full_key] = value
    return result

def process_file(file_path, translations):
    """Process a single TSX file and replace hardcoded text"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    replacements = 0
    
    # Check if file already has translation import
    has_import = 'useTranslation' in content
    has_hook = 'const { t }' in content or 'const {t}' in content or '{ t }' in content
    
    # Create reverse map: Kurdish text -> translation key
    reverse_map = {}
    for key, value in translations.items():
        if value and isinstance(value, str):
            reverse_map[value] = key
    
    # Sort by length (longest first) to avoid partial replacements
    sorted_texts = sorted(reverse_map.keys(), key=len, reverse=True)
    
    for kurdish_text in sorted_texts:
        if len(kurdish_text) < 2:  # Skip very short strings
            continue
        
        trans_key = reverse_map[kurdish_text]
        
        # Escape special regex characters in the Kurdish text
        escaped_text = re.escape(kurdish_text)
        
        # Pattern 1: JSX text content >text< or > text <
        pattern1 = rf'(>)\s*{escaped_text}\s*(<)'
        replacement1 = rf'\1{{t("{trans_key}")}}\2'
        new_content = re.sub(pattern1, replacement1, content)
        if new_content != content:
            content = new_content
            replacements += 1
        
        # Pattern 2: Attribute values like title="text" or label="text"
        pattern2 = rf'(\w+)="{escaped_text}"'
        replacement2 = rf'\1={{t("{trans_key}")}}'
        new_content = re.sub(pattern2, replacement2, content)
        if new_content != content:
            content = new_content
            replacements += 1
        
        # Pattern 3: Single quote attributes
        pattern3 = rf"(\w+)='{escaped_text}'"
        replacement3 = rf'\1={{t("{trans_key}")}}'
        new_content = re.sub(pattern3, replacement3, content)
        if new_content != content:
            content = new_content
            replacements += 1
        
        # Pattern 4: String in toast/message calls like toast("text")
        pattern4 = rf'(toast\(|toast\.success\(|toast\.error\(|toast\.info\(|toast\.warning\()"{escaped_text}"'
        replacement4 = rf'\1t("{trans_key}")'
        new_content = re.sub(pattern4, replacement4, content)
        if new_content != content:
            content = new_content
            replacements += 1
    
    # If changes were made, ensure imports and hook are present
    if content != original_content:
        # Add import if needed
        if not has_import:
            # Find first import statement
            import_match = re.search(r'^import .+?;\n', content, re.MULTILINE)
            if import_match:
                insert_pos = import_match.end()
                import_line = 'import { useTranslation } from "@/contexts/LanguageContext";\n'
                content = content[:insert_pos] + import_line + content[insert_pos:]
        
        # Add hook if needed
        if not has_hook:
            # Find function component declaration
            func_patterns = [
                r'(export default function \w+\([^)]*\)\s*\{)',
                r'(export function \w+\([^)]*\)\s*\{)',
                r'(function \w+\([^)]*\)\s*\{)',
            ]
            for pattern in func_patterns:
                match = re.search(pattern, content)
                if match:
                    insert_pos = match.end()
                    hook_line = '\n  const { t } = useTranslation();'
                    content = content[:insert_pos] + hook_line + content[insert_pos:]
                    break
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return replacements

def main():
    translations = load_translations()
    flat_translations = flatten_translations(translations)
    
    total_replacements = 0
    files_modified = 0
    
    for tsx_file in sorted(PAGES_DIR.glob("*.tsx")):
        replacements = process_file(tsx_file, flat_translations)
        if replacements > 0:
            print(f"{tsx_file.name}: {replacements} patterns matched")
            total_replacements += replacements
            files_modified += 1
    
    print(f"\nTotal: {total_replacements} patterns in {files_modified} files")

if __name__ == "__main__":
    main()
