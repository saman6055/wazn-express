#!/usr/bin/env python3
"""
Fix incomplete ternary operators where the : part was removed.
"""

import re
from pathlib import Path

# Known patterns that need fixing - map the incomplete pattern to the complete one
FIXES = {
    # BankAccounts.tsx
    '{account.isActive ? t("auto.text_8e238e")}': '{account.isActive ? t("status.active") : t("status.inactive")}',
    # BlogManagement.tsx  
    '{uploading ? t("auto.text_fed701")}': '{uploading ? t("auto.text_fed701") : t("common.upload")}',
    # CustomerFinance.tsx
    '{recordPayment.isPending ? t("auto.text_8f8738")}': '{recordPayment.isPending ? t("auto.text_8f8738") : t("common.save")}',
    # DebtReminders.tsx
    '{isSending ? t("auto.text_68b67e")}': '{isSending ? t("auto.text_68b67e") : t("common.send")}',
    '{selectedCustomers.length === debtors?.length ? t("auto.text_005981")}': '{selectedCustomers.length === debtors?.length ? t("auto.text_005981") : t("common.selectAll")}',
    # FullPackageReports.tsx
    '{item.status === "returned" ? t("auto.text_448008")}': '{item.status === "returned" ? t("auto.text_448008") : t("common.delivered")}',
    # LabelTemplateSettings.tsx
    '{isCreating ? t("auto.text_92328a")}': '{isCreating ? t("auto.text_92328a") : t("common.create")}',
    '{createMutation.isPending || updateMutation.isPending ? t("auto.text_f7ce12")}': '{createMutation.isPending || updateMutation.isPending ? t("auto.text_f7ce12") : t("common.save")}',
    # RecordPayment.tsx
    '{recordPayment.isPending ? t("auto.text_b4f1e0")}': '{recordPayment.isPending ? t("auto.text_b4f1e0") : t("common.save")}',
    # ServiceProfitReport.tsx
    '{service.isPaid ? t("auto.text_045bc6")}': '{service.isPaid ? t("auto.text_045bc6") : t("common.unpaid")}',
    # ServiceTypes.tsx
    '{createMutation.isPending ? t("auto.text_d46bdf")}': '{createMutation.isPending ? t("auto.text_d46bdf") : t("common.create")}',
    '{updateMutation.isPending ? t("auto.text_bd4492")}': '{updateMutation.isPending ? t("auto.text_bd4492") : t("common.save")}',
    # Suppliers.tsx
    '{supplier.isActive ? t("auto.text_8e238e")}': '{supplier.isActive ? t("status.active") : t("status.inactive")}',
    '{editingSupplier ? t("auto.text_b37162")}': '{editingSupplier ? t("auto.text_b37162") : t("common.add")}',
    '{editingSupplier ? t("auto.text_19d86a")}': '{editingSupplier ? t("auto.text_19d86a") : t("common.addNew")}',
    '{isPending ? t("auto.text_e4b28f")}': '{isPending ? t("auto.text_e4b28f") : t("common.save")}',
}

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    for old, new in FIXES.items():
        content = content.replace(old, new)
    
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
