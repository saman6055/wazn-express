#!/usr/bin/env python3
"""
Script to extract hardcoded Kurdish text from TSX files and generate translation replacements.
"""

import os
import re
import json
from pathlib import Path

# Directory paths
PAGES_DIR = Path("/home/ubuntu/wazn-express/client/src/pages")
LOCALES_DIR = Path("/home/ubuntu/wazn-express/client/src/locales")

# Kurdish character pattern
KURDISH_PATTERN = re.compile(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+')

def has_kurdish(text):
    """Check if text contains Kurdish/Arabic characters"""
    return bool(KURDISH_PATTERN.search(text))

def extract_hardcoded_strings(file_path):
    """Extract hardcoded Kurdish strings from a TSX file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    strings = []
    
    # Pattern 1: JSX text content >Kurdish text<
    jsx_pattern = re.compile(r'>([^<>]*[\u0600-\u06FF]+[^<>]*)<')
    for match in jsx_pattern.finditer(content):
        text = match.group(1).strip()
        if text and has_kurdish(text):
            strings.append({
                'type': 'jsx',
                'text': text,
                'line': content[:match.start()].count('\n') + 1
            })
    
    # Pattern 2: String literals "Kurdish text" or 'Kurdish text'
    string_pattern = re.compile(r'["\']([^"\']*[\u0600-\u06FF]+[^"\']*)["\']')
    for match in string_pattern.finditer(content):
        text = match.group(1).strip()
        if text and has_kurdish(text):
            strings.append({
                'type': 'string',
                'text': text,
                'line': content[:match.start()].count('\n') + 1
            })
    
    # Pattern 3: Template literals `Kurdish text`
    template_pattern = re.compile(r'`([^`]*[\u0600-\u06FF]+[^`]*)`')
    for match in template_pattern.finditer(content):
        text = match.group(1).strip()
        if text and has_kurdish(text) and '${' not in text:
            strings.append({
                'type': 'template',
                'text': text,
                'line': content[:match.start()].count('\n') + 1
            })
    
    return strings

def main():
    """Main function to extract all hardcoded strings"""
    all_strings = {}
    
    for tsx_file in PAGES_DIR.glob("*.tsx"):
        strings = extract_hardcoded_strings(tsx_file)
        if strings:
            all_strings[tsx_file.name] = strings
    
    # Print summary
    print(f"\n{'='*60}")
    print("HARDCODED KURDISH TEXT SUMMARY")
    print(f"{'='*60}\n")
    
    total_count = 0
    for filename, strings in sorted(all_strings.items(), key=lambda x: -len(x[1])):
        count = len(strings)
        total_count += count
        print(f"{filename}: {count} hardcoded strings")
    
    print(f"\n{'='*60}")
    print(f"TOTAL: {total_count} hardcoded strings across {len(all_strings)} files")
    print(f"{'='*60}\n")
    
    # Save detailed report
    report_path = Path("/home/ubuntu/wazn-express/scripts/translation-report.json")
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(all_strings, f, ensure_ascii=False, indent=2)
    
    print(f"Detailed report saved to: {report_path}")

if __name__ == "__main__":
    main()
