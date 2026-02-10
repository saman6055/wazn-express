#!/usr/bin/env python3
"""
Safely apply translations to React components.
Only replaces text in JSX content and string literals, not in code.
"""

import re
import json
from pathlib import Path

def load_translation_keys():
    with open('/home/ubuntu/wazn-express/scripts/clean_translation_keys.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def has_use_translation(content):
    return 'const { t }' in content or 'const {t}' in content

def add_use_translation_import(content):
    if 'useTranslation' not in content:
        # Find the last import line
        lines = content.split('\n')
        last_import_idx = 0
        for i, line in enumerate(lines):
            if line.strip().startswith('import '):
                last_import_idx = i
        
        import_line = 'import { useTranslation } from "@/contexts/LanguageContext";'
        lines.insert(last_import_idx + 1, import_line)
        return '\n'.join(lines)
    return content

def add_use_translation_hook(content):
    if has_use_translation(content):
        return content
    
    # Find the component function start
    patterns = [
        r'(export default function \w+\s*\([^)]*\)\s*\{)',
        r'(export function \w+\s*\([^)]*\)\s*\{)',
        r'(function \w+\s*\([^)]*\)\s*\{)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, content)
        if match:
            insert_pos = match.end()
            hook_line = '\n  const { t } = useTranslation();'
            content = content[:insert_pos] + hook_line + content[insert_pos:]
            return content
    
    return content

def replace_in_jsx_text(content, text, key):
    """Replace Kurdish text in JSX text content (between > and <)."""
    # Pattern: >text< where text contains Kurdish
    pattern = rf'>([\s]*){re.escape(text)}([\s]*)<'
    replacement = rf'>\1{{t("{key}")}}\2<'
    return re.sub(pattern, replacement, content)

def replace_in_string_props(content, text, key):
    """Replace Kurdish text in string props like title="text" or placeholder="text"."""
    # Pattern: prop="text" where text is Kurdish
    pattern = rf'(\w+)="{re.escape(text)}"'
    replacement = rf'\1={{t("{key}")}}'
    new_content = re.sub(pattern, replacement, content)
    
    # Also handle single quotes
    pattern = rf"(\w+)='{re.escape(text)}'"
    replacement = rf'\1={{t("{key}")}}'
    return re.sub(pattern, replacement, new_content)

def replace_in_toast_calls(content, text, key):
    """Replace Kurdish text in toast.success/error/etc calls."""
    patterns = [
        rf'toast\.success\("{re.escape(text)}"\)',
        rf'toast\.error\("{re.escape(text)}"\)',
        rf'toast\.info\("{re.escape(text)}"\)',
        rf'toast\.warning\("{re.escape(text)}"\)',
    ]
    
    for pattern in patterns:
        func_name = pattern.split('\\')[0].replace('toast\\.', 'toast.')
        replacement = f'{func_name}(t("{key}"))'
        content = re.sub(pattern, replacement, content)
    
    return content

def process_file(filepath, translation_keys):
    """Process a single file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    replacements = 0
    
    # First ensure imports and hooks
    content = add_use_translation_import(content)
    content = add_use_translation_hook(content)
    
    # Apply translations
    for text, key in translation_keys.items():
        if len(text) < 2:
            continue
        
        old_content = content
        
        # Replace in JSX text
        content = replace_in_jsx_text(content, text, key)
        
        # Replace in string props
        content = replace_in_string_props(content, text, key)
        
        # Replace in toast calls
        content = replace_in_toast_calls(content, text, key)
        
        if content != old_content:
            replacements += 1
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return replacements

def main():
    translation_keys = load_translation_keys()
    pages_dir = Path('/home/ubuntu/wazn-express/client/src/pages')
    
    # Files to process
    files = [
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
        'Accounting.tsx',
        'AuditLogs.tsx',
        'Countries.tsx',
        'Warehouses.tsx',
        'Users.tsx',
        'VipCustomers.tsx',
        'ProductCategories.tsx',
        'NotificationSettings.tsx',
        'Invoices.tsx',
        'ClaimRequests.tsx',
        'QuickRegister.tsx',
        'BulkRegister.tsx',
        'UnclaimedPackages.tsx',
        'PackageRegister.tsx',
        'PackagesDashboard.tsx',
        'BatchFinancialReport.tsx',
        'Reports.tsx',
        'Settings.tsx',
        'ProfitDashboard.tsx',
        'Payments.tsx',
    ]
    
    total = 0
    for filename in files:
        filepath = pages_dir / filename
        if filepath.exists():
            count = process_file(filepath, translation_keys)
            if count > 0:
                print(f"{filename}: {count} replacements")
                total += count
    
    print(f"\nTotal: {total} replacements")

if __name__ == '__main__':
    main()
