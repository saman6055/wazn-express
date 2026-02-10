import os
import re

files_to_fix = [
    "client/src/pages/ContinuousScan.tsx",
    "client/src/pages/SmartScanner.tsx",
    "client/src/pages/portal/PortalBatchDetail.tsx",
    "client/src/pages/portal/PortalBlog.tsx",
    "client/src/pages/portal/PortalBlogDetail.tsx",
    "client/src/pages/portal/PortalFinancial.tsx",
    "client/src/pages/portal/PortalFullPackage.tsx",
    "client/src/pages/portal/PortalHome.tsx",
    "client/src/pages/portal/PortalProfile.tsx",
    "client/src/pages/portal/PortalSearch.tsx",
    "client/src/pages/portal/PortalAddresses.tsx",
    "client/src/pages/portal/PortalMessages.tsx",
    "client/src/pages/portal/PortalNotifications.tsx",
    "client/src/pages/portal/PortalServices.tsx",
    "client/src/pages/portal/PortalTerms.tsx",
]

base_path = "/home/ubuntu/wazn-express"

for file_path in files_to_fix:
    full_path = os.path.join(base_path, file_path)
    if not os.path.exists(full_path):
        print(f"File not found: {full_path}")
        continue
    
    with open(full_path, 'r') as f:
        content = f.read()
    
    # Remove duplicate import
    content = re.sub(r'import { useTranslation } from "@/contexts/LanguageContext";\n', '', content)
    
    # Remove duplicate const { t } = useTranslation(); line
    content = re.sub(r'\s*const { t } = useTranslation\(\);\n', '\n', content)
    
    with open(full_path, 'w') as f:
        f.write(content)
    
    print(f"Fixed: {file_path}")

print("Done!")
