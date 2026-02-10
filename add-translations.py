import os
import re

# List of pages to update with their translation keys
pages_to_update = [
    "Customers.tsx",
    "Packages.tsx", 
    "Batches.tsx",
    "Finance.tsx",
    "Reports.tsx",
    "Settings.tsx",
    "Suppliers.tsx",
    "BlogManagement.tsx",
]

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

# Process each file
pages_dir = "/home/ubuntu/wazn-express/client/src/pages"
for page in pages_to_update:
    filepath = os.path.join(pages_dir, page)
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            content = f.read()
        
        # Add import and hook
        content = add_translation_import(content)
        content = add_translation_hook(content)
        
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated: {page}")
    else:
        print(f"Not found: {page}")

print("Done!")
