import re
import os

# Files with t() calls outside components
files_to_fix = [
    "client/src/pages/CompanyFinanceDashboard.tsx",
    "client/src/pages/FinancialGoals.tsx",
    "client/src/pages/FullPackageDashboard.tsx",
    "client/src/pages/MobileScanner.tsx",
    "client/src/pages/Packages.tsx"
]

# Translation mappings for common keys
translations = {
    # Finance
    't("finance.revenue")': '"داهات"',
    't("finance.profit")': '"قازانج"',
    't("status.active")': '"چالاک"',
    
    # Auto translations
    't("auto.text_27fdc3")': '"سنووری خەرجی"',
    't("auto.text_e12e4a")': '"پاکەتەکان"',
    't("auto.text_059df3")': '"کڕیارەکان"',
    't("auto.text_b82a46")': '"کۆکردنەوەی قەرز"',
    't("auto.text_476505")': '"هەفتانە"',
    't("auto.text_c6fb40")': '"مانگانە"',
    't("auto.text_08cc72")': '"سێ مانگی"',
    't("auto.text_536ece")': '"ساڵانە"',
    't("auto.text_fa7a3d")': '"تەواوبوو"',
    't("auto.text_117a16")': '"شکستخواردوو"',
    't("auto.text_7fa280")': '"هەڵوەشێنراوەتەوە"',
    't("auto.text_172d95")': '"ئامانجی داهاتی مانگی ١٢"',
    't("auto.text_a55a62")': '"گەیشتن بە ٥٠,٠٠٠ دۆلار داهات لە مانگی ١٢"',
    't("auto.text_964885")': '"ئامانجی پاکەتەکان"',
}

for filepath in files_to_fix:
    full_path = os.path.join("/home/ubuntu/wazn-express", filepath)
    if not os.path.exists(full_path):
        print(f"File not found: {filepath}")
        continue
    
    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Replace known t() calls with static strings
    for t_call, replacement in translations.items():
        content = content.replace(t_call, replacement)
    
    # For any remaining t() calls outside of components, replace with Kurdish text
    # Find t("...") patterns and extract the key
    pattern = r't\("([^"]+)"\)'
    
    def replace_t_call(match):
        key = match.group(1)
        # Return the key as a placeholder string
        if key.startswith("auto."):
            return f'"{key}"'  # Keep as placeholder
        return match.group(0)  # Keep original if not auto
    
    if content != original_content:
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed: {filepath}")
    else:
        print(f"No changes needed: {filepath}")

print("Done!")
