import os
import re
import glob

def add_translation_import(content):
    """Add useTranslation import if not present"""
    if "useTranslation" not in content:
        # Find the last import statement
        import_pattern = r'(import .* from ["\'].*["\'];?\n)'
        imports = list(re.finditer(import_pattern, content))
        if imports:
            last_import = imports[-1]
            insert_pos = last_import.end()
            new_import = 'import { useTranslation } from "@/contexts/LanguageContext";\n'
            content = content[:insert_pos] + new_import + content[insert_pos:]
    return content

def add_translation_hook(content):
    """Add useTranslation hook call if not present"""
    if "const { t }" not in content and "const {t}" not in content:
        # Find the function component start
        pattern = r'(export default function \w+\([^)]*\) \{[\s\n]*)'
        match = re.search(pattern, content)
        if match:
            insert_pos = match.end()
            hook_call = '  const { t } = useTranslation();\n'
            content = content[:insert_pos] + hook_call + content[insert_pos:]
    return content

# Get all .tsx files in pages directory
pages_dir = "/home/ubuntu/wazn-express/client/src/pages"
all_pages = glob.glob(os.path.join(pages_dir, "**/*.tsx"), recursive=True)

updated = 0
skipped = 0
for filepath in all_pages:
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        # Skip if already has useTranslation
        if "useTranslation" in content:
            skipped += 1
            continue
        
        # Add import and hook
        new_content = add_translation_import(content)
        new_content = add_translation_hook(new_content)
        
        if new_content != content:
            with open(filepath, 'w') as f:
                f.write(new_content)
            print(f"Updated: {os.path.basename(filepath)}")
            updated += 1
    except Exception as e:
        print(f"Error with {filepath}: {e}")

print(f"\nTotal: {updated} updated, {skipped} already had translations")
