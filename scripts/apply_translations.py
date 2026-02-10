#!/usr/bin/env python3
"""
Apply translations to React components by replacing hardcoded Kurdish text with t() calls.
"""

import re
import os
import json
from pathlib import Path

def load_translation_keys():
    """Load the generated translation keys."""
    with open('/home/ubuntu/wazn-express/scripts/translation_keys.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def ensure_use_translation_import(content):
    """Ensure useTranslation is imported."""
    if 'useTranslation' not in content:
        # Add import after other imports
        import_line = 'import { useTranslation } from "@/contexts/LanguageContext";\n'
        # Find the last import statement
        last_import = content.rfind('import ')
        if last_import != -1:
            # Find the end of that import line
            end_of_import = content.find('\n', last_import)
            if end_of_import != -1:
                content = content[:end_of_import+1] + import_line + content[end_of_import+1:]
    return content

def ensure_use_translation_hook(content, component_name):
    """Ensure the component has const { t } = useTranslation()."""
    # Check if t is already destructured from useTranslation
    if 'const { t }' in content or 'const {t}' in content:
        return content
    
    # Find the component function
    patterns = [
        rf'export default function {component_name}\s*\([^)]*\)\s*\{{',
        rf'function {component_name}\s*\([^)]*\)\s*\{{',
        rf'const {component_name}\s*=\s*\([^)]*\)\s*=>\s*\{{',
        rf'export function {component_name}\s*\([^)]*\)\s*\{{'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, content)
        if match:
            insert_pos = match.end()
            # Add the hook after the opening brace
            hook_line = '\n  const { t } = useTranslation();'
            content = content[:insert_pos] + hook_line + content[insert_pos:]
            break
    
    return content

def replace_kurdish_text(content, translation_keys):
    """Replace hardcoded Kurdish text with t() calls."""
    modified = content
    replacements = 0
    
    for kurdish_text, key in translation_keys.items():
        # Skip if text is too short
        if len(kurdish_text) < 2:
            continue
            
        # Pattern to match the text in quotes (not already in t())
        # Match text that is NOT preceded by t(
        patterns = [
            # Double quotes
            (rf'(?<!t\()"{re.escape(kurdish_text)}"', f'{{t("{key}")}}'),
            # Single quotes
            (rf"(?<!t\()'{re.escape(kurdish_text)}'", f"{{t('{key}')}}"),
            # In JSX text content (between > and <)
            (rf'>(\s*){re.escape(kurdish_text)}(\s*)<', rf'>\1{{t("{key}")}}\2<'),
        ]
        
        for pattern, replacement in patterns:
            new_content = re.sub(pattern, replacement, modified)
            if new_content != modified:
                replacements += 1
                modified = new_content
    
    return modified, replacements

def process_file(filepath, translation_keys):
    """Process a single file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    component_name = filepath.stem
    
    # Ensure imports and hooks
    content = ensure_use_translation_import(content)
    content = ensure_use_translation_hook(content, component_name)
    
    # Replace Kurdish text
    content, replacements = replace_kurdish_text(content, translation_keys)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return replacements
    return 0

def main():
    translation_keys = load_translation_keys()
    pages_dir = Path('/home/ubuntu/wazn-express/client/src/pages')
    
    total_replacements = 0
    
    # Process specific files that need translation
    files_to_process = [
        'DataManagement.tsx',
        'WarehouseOperations.tsx', 
        'FinancialGoals.tsx',
        'FinancialReports.tsx',
        'ScanDashboard.tsx',
        'LabelTemplateSettings.tsx',
        'ProfitLossReport.tsx',
        'CompanyFinanceDashboard.tsx',
        'TrackingAlerts.tsx',
        'FullPackageReports.tsx',
        'Home.tsx',
        'Suppliers.tsx',
        'ContinuousScan.tsx',
        'BankAccounts.tsx',
        'BlogManagement.tsx',
        'CashFlowReport.tsx',
        'Batches.tsx',
        'LabelPrinting.tsx',
        'ServiceProfitReport.tsx',
        'ScanReports.tsx',
        'CustomerFinance.tsx',
        'MobileScanner.tsx',
        'DebtReminders.tsx',
        'BalanceSheet.tsx',
        'Finance.tsx',
        'StaffLogin.tsx',
        'CustomerLogin.tsx',
        'Customers.tsx',
        'ServiceTypes.tsx',
        'DebtorsReport.tsx',
        'CustomerPricingReport.tsx',
        'RecordPayment.tsx',
        'InvoiceTemplateSettings.tsx',
    ]
    
    for filename in files_to_process:
        filepath = pages_dir / filename
        if filepath.exists():
            replacements = process_file(filepath, translation_keys)
            if replacements > 0:
                print(f"{filename}: {replacements} replacements")
                total_replacements += replacements
    
    print(f"\nTotal replacements: {total_replacements}")

if __name__ == '__main__':
    main()
