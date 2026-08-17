// ============ PERMISSION DEFINITIONS ============
// This file defines all system modules matching sidebar navigation tabs

export type PermissionAction = "view" | "create" | "edit" | "delete";

export interface ModulePermissions {
  module: string;
  label: string;
  labelKu: string;
  actions: PermissionAction[];
  subPermissions: SubPermissionDefinition[];
}

export interface SubPermissionDefinition {
  key: string;
  label: string;
  labelKu: string;
  description: string;
  descriptionKu: string;
}

export interface PermissionGroup {
  id: string;
  label: string;
  labelKu: string;
  color: string;
  icon: string;
  modules: ModulePermissions[];
}

// ============ ALL SIDEBAR PERMISSION GROUPS ============
// Each group matches a sidebar section, each module matches a sidebar tab

export const PERMISSION_GROUPS: PermissionGroup[] = [
  // ─── 1. Main (سەرەکی) ───
  {
    id: "main",
    label: "Main",
    labelKu: "سەرەکی",
    color: "emerald",
    icon: "LayoutDashboard",
    modules: [
      {
        module: "dashboard",
        label: "Dashboard",
        labelKu: "داشبۆرد",
        actions: ["view"],
        subPermissions: [],
      },
      {
        module: "customers",
        label: "Customers",
        labelKu: "کڕیارەکان",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [
          { key: "view_financial_info", label: "View Financial Info", labelKu: "بینینی زانیاری دارایی", description: "Can view customer financial details", descriptionKu: "دەتوانێت زانیاری داراییی کڕیار ببینێت" },
          { key: "view_documents", label: "View Documents", labelKu: "بینینی بەڵگەنامەکان", description: "Can view customer documents", descriptionKu: "دەتوانێت بەڵگەنامەکانی کڕیار ببینێت" },
          { key: "edit_documents", label: "Edit Documents", labelKu: "دەستکاریکردنی بەڵگەنامەکان", description: "Can upload/modify customer documents", descriptionKu: "دەتوانێت بەڵگەنامەکانی کڕیار دەستکاری بکات" },
          { key: "deactivate_account", label: "Deactivate Account", labelKu: "ناچالاککردنی هەژمار", description: "Can deactivate customer accounts", descriptionKu: "دەتوانێت هەژماری کڕیار ناچالاک بکات" },
        ],
      },
    ],
  },

  // ─── 2. Operations (کارەکان) ───
  {
    id: "operations",
    label: "Operations",
    labelKu: "کارەکان",
    color: "blue",
    icon: "Package",
    modules: [
      {
        module: "packages",
        label: "All Packages",
        labelKu: "هەموو پاکەتەکان",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [
          { key: "view_prices", label: "View Prices", labelKu: "بینینی نرخەکان", description: "Can view package prices", descriptionKu: "دەتوانێت نرخەکانی پاکەت ببینێت" },
          { key: "edit_prices", label: "Edit Prices", labelKu: "دەستکاریکردنی نرخەکان", description: "Can modify package prices", descriptionKu: "دەتوانێت نرخەکانی پاکەت دەستکاری بکات" },
          { key: "change_status", label: "Change Status", labelKu: "گۆڕینی دۆخ", description: "Can change package status", descriptionKu: "دەتوانێت دۆخی پاکەت بگۆڕێت" },
          { key: "print_labels", label: "Print Labels", labelKu: "چاپکردنی لەیبڵ", description: "Can print package labels", descriptionKu: "دەتوانێت لەیبڵی پاکەت چاپ بکات" },
          { key: "upload_images", label: "Upload Images", labelKu: "بارکردنی وێنە", description: "Can upload package images", descriptionKu: "دەتوانێت وێنەی پاکەت باربکات" },
        ],
      },
      {
        module: "quick_register",
        label: "Quick Register",
        labelKu: "تۆمارکردنی خێرا",
        actions: ["view", "create"],
        subPermissions: [],
      },
      {
        module: "bulk_register",
        label: "Bulk Register",
        labelKu: "تۆماری کۆمەڵە",
        actions: ["view", "create"],
        subPermissions: [],
      },
      {
        module: "batches",
        label: "Batches",
        labelKu: "باچەکان",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [
          { key: "finalize_batch", label: "Finalize Batch", labelKu: "کۆتاییهێنان بە باچ", description: "Can finalize and lock batches", descriptionKu: "دەتوانێت باچ کۆتایی پێبهێنێت و قوڵف بکات" },
          { key: "print_manifest", label: "Print Manifest", labelKu: "چاپکردنی مانیفێست", description: "Can print batch manifests", descriptionKu: "دەتوانێت مانیفێستی باچ چاپ بکات" },
          { key: "assign_packages", label: "Assign Packages", labelKu: "دانانی پاکەتەکان", description: "Can add/remove packages from batches", descriptionKu: "دەتوانێت پاکەت زیاد بکات/لاببات لە باچ" },
        ],
      },
      {
        module: "unclaimed_packages",
        label: "Unclaimed Packages",
        labelKu: "پاکەتە بێ خاوەنەکان",
        actions: ["view", "edit"],
        subPermissions: [],
      },
      {
        module: "claim_requests",
        label: "Claim Requests",
        labelKu: "داواکاری خاوەنداری",
        actions: ["view", "create", "edit"],
        subPermissions: [],
      },
          {
        module: "self_orders",
        label: "Self Orders",
        labelKu: "سێلف ئۆردەر",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "awaiting_arrival",
        label: "Awaiting Arrival",
        labelKu: "نەگەیشتووەکان",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "registrations",
        label: "Registrations",
        labelKu: "تۆمارەکان",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "prohibited_register",
        label: "Prohibited Items Register",
        labelKu: "تۆماری کەلوپەلی قەدەغە",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
    ],
  },

  // ─── 3. Full Package (پاکێجی تەواو) ───
  {
    id: "fullPackage",
    label: "Full Package",
    labelKu: "پاکێجی تەواو",
    color: "violet",
    icon: "Boxes",
    modules: [
      {
        module: "unified_orders",
        label: "Unified Orders Dashboard",
        labelKu: "داشبۆردی یەکگرتوو",
        actions: ["view"],
        subPermissions: [],
      },
      {
        module: "full_package",
        label: "Full Package",
        labelKu: "پاکێجی تەواو",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "commission",
        label: "Commission Orders",
        labelKu: "کڕین بە عمولە",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "suppliers",
        label: "Suppliers",
        labelKu: "فرۆشیارەکان",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "tracking_alerts",
        label: "Tracking Alerts",
        labelKu: "ئاگاداری تراکینگ",
        actions: ["view"],
        subPermissions: [],
      },
    ],
  },

  // ─── 4. Scanning (سکان) ───
  {
    id: "scanning",
    label: "Scanning",
    labelKu: "سکان",
    color: "cyan",
    icon: "ScanLine",
    modules: [
      {
        module: "scan_quick_register",
        label: "Quick Register (Scan)",
        labelKu: "تۆماری خێرا (سکان)",
        actions: ["view", "create"],
        subPermissions: [],
      },
      {
        module: "batch_assignment_scanner",
        label: "Batch Assignment",
        labelKu: "خستنە ناو باچ",
        actions: ["view", "create"],
        subPermissions: [],
      },
      {
        module: "arrival_verification",
        label: "Arrival Verification",
        labelKu: "پشکنینی گەیشتن",
        actions: ["view", "create"],
        subPermissions: [],
      },
      {
        module: "customer_delivery_scanner",
        label: "Customer Delivery",
        labelKu: "گەیاندن بە کڕیار",
        actions: ["view", "create"],
        subPermissions: [],
      },
      {
        module: "scan_dashboard",
        label: "Scan Dashboard",
        labelKu: "داشبۆردی سکان",
        actions: ["view"],
        subPermissions: [],
      },
      {
        module: "scan_reports",
        label: "Scan Reports",
        labelKu: "ڕاپۆرتی سکان",
        actions: ["view"],
        subPermissions: [],
      },
    ],
  },

  // ─── 5. Customer Finance (دارایی کڕیار) ───
  {
    id: "customerFinance",
    label: "Customer Finance",
    labelKu: "دارایی کڕیار",
    color: "amber",
    icon: "Wallet",
    modules: [
      {
        module: "finance_management",
        label: "Finance Management",
        labelKu: "بەڕێوەبردنی دارایی",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [
          { key: "view_balances", label: "View Balances", labelKu: "بینینی باڵانسەکان", description: "Can view customer balances", descriptionKu: "دەتوانێت باڵانسی کڕیاران ببینێت" },
          { key: "adjust_balance", label: "Adjust Balance", labelKu: "ڕێکخستنی باڵانس", description: "Can manually adjust balances", descriptionKu: "دەتوانێت باڵانس بە دەستی ڕێک بخات" },
        ],
      },
      {
        module: "invoices",
        label: "Invoices",
        labelKu: "پسووڵەکان",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [
          { key: "mark_paid", label: "Mark as Paid", labelKu: "نیشانکردن وەک پارەدراو", description: "Can mark invoices as paid", descriptionKu: "دەتوانێت پسووڵە وەک پارەدراو نیشان بکات" },
          { key: "apply_discount", label: "Apply Discount", labelKu: "جێبەجێکردنی داشکاندن", description: "Can apply discounts", descriptionKu: "دەتوانێت داشکاندن جێبەجێ بکات" },
        ],
      },
      {
        module: "debtors_report",
        label: "Debtors Report",
        labelKu: "ڕاپۆرتی قەرزداران",
        actions: ["view"],
        subPermissions: [],
      },
      {
        module: "debt_reminders",
        label: "Debt Reminders",
        labelKu: "بیرهێنەرەوەی قەرز",
        actions: ["view", "create"],
        subPermissions: [],
      },
    ],
  },

  // ─── 6. Company Finance (دارایی کۆمپانیا) ───
  {
    id: "companyFinance",
    label: "Company Finance",
    labelKu: "دارایی کۆمپانیا",
    color: "rose",
    icon: "Landmark",
    modules: [
      {
        module: "company_dashboard",
        label: "Company Dashboard",
        labelKu: "داشبۆردی کۆمپانیا",
        actions: ["view"],
        subPermissions: [],
      },
      {
        module: "balance_sheet",
        label: "Balance Sheet",
        labelKu: "تەرازوی دارایی",
        actions: ["view"],
        subPermissions: [],
      },
      {
        module: "bank_accounts",
        label: "Bank Accounts",
        labelKu: "هەژمارە بانکییەکان",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "expenses",
        label: "Expenses",
        labelKu: "خەرجییەکان",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "expense_alerts",
        label: "Expense Alerts",
        labelKu: "ئاگادارکردنەوەی خەرجی",
        actions: ["view", "create", "edit"],
        subPermissions: [],
      },
      {
        module: "partners",
        label: "Partners",
        labelKu: "هاوبەشەکان",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "treasury",
        label: "Treasury",
        labelKu: "خەزنە",
        actions: ["view", "create", "edit"],
        subPermissions: [],
      },
      {
        module: "company_debts",
        label: "Company Debts",
        labelKu: "قەرزەکانی کۆمپانیا",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
    ],
  },

  // ─── 7. Services (خزمەتگوزارییەکان) ───
  {
    id: "services",
    label: "Services",
    labelKu: "خزمەتگوزارییەکان",
    color: "cyan",
    icon: "Wrench",
    modules: [
      {
        module: "all_services",
        label: "All Services",
        labelKu: "هەموو خزمەتگوزارییەکان",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "service_types",
        label: "Service Types",
        labelKu: "جۆرەکانی خزمەتگوزاری",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
    ],
  },

  // ─── 8. Reports (ڕاپۆرتەکان) ───
  {
    id: "reports",
    label: "Reports",
    labelKu: "ڕاپۆرتەکان",
    color: "indigo",
    icon: "BarChart3",
    modules: [
      {
        module: "reports_overview",
        label: "Reports Overview",
        labelKu: "پوختەی ڕاپۆرت",
        actions: ["view"],
        subPermissions: [],
      },
      {
        module: "batch_reports",
        label: "Batch Reports",
        labelKu: "ڕاپۆرتی باچەکان",
        actions: ["view"],
        subPermissions: [
          { key: "export_reports", label: "Export Reports", labelKu: "هەناردەکردنی ڕاپۆرت", description: "Can export reports to PDF/Excel", descriptionKu: "دەتوانێت ڕاپۆرت هەناردە بکات بۆ PDF/Excel" },
        ],
      },
      {
        module: "service_reports",
        label: "Service Reports",
        labelKu: "ڕاپۆرتی خزمەتگوزارییەکان",
        actions: ["view"],
        subPermissions: [],
      },
      {
        module: "profit_dashboard",
        label: "Profit Dashboard",
        labelKu: "داشبۆردی قازانج",
        actions: ["view"],
        subPermissions: [],
      },
      {
        module: "monthly_profit",
        label: "Monthly Profit Report",
        labelKu: "ڕاپۆرتی مانگانە",
        actions: ["view"],
        subPermissions: [],
      },
      {
        module: "profit_by_type",
        label: "Profit by Shipping Type",
        labelKu: "قازانج بە جۆری پەت",
        actions: ["view"],
        subPermissions: [],
      },
      {
        module: "invoice_reports",
        label: "Invoice Reports",
        labelKu: "ڕاپۆرتی ئینڤۆیسەکان",
        actions: ["view"],
        subPermissions: [],
      },
      {
        module: "business_analytics",
        label: "Business Analytics",
        labelKu: "شیکاری بازرگانی",
        actions: ["view"],
        subPermissions: [],
      },
    ],
  },

  // ─── 9. Settings (ڕێکخستنەکان) ───
  {
    id: "settings",
    label: "System Settings",
    labelKu: "ڕێکخستنەکان",
    color: "slate",
    icon: "Settings",
    modules: [
      {
        module: "system_settings",
        label: "General Settings",
        labelKu: "ڕێکخستنی گشتی",
        actions: ["view", "edit"],
        subPermissions: [
          { key: "edit_company_info", label: "Edit Company Info", labelKu: "دەستکاریکردنی زانیاری کۆمپانیا", description: "Can modify company information", descriptionKu: "دەتوانێت زانیاری کۆمپانیا دەستکاری بکات" },
        ],
      },
      {
        module: "countries",
        label: "Countries",
        labelKu: "وڵاتەکان",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "warehouses",
        label: "Warehouses",
        labelKu: "کۆگاکان",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "vip_customers",
        label: "VIP Customers",
        labelKu: "کڕیاری VIP",
        actions: ["view", "create", "edit"],
        subPermissions: [],
      },
      {
        module: "product_categories",
        label: "Product Categories",
        labelKu: "جۆری بەرهەم",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "pricing_config",
        label: "Service Types & Pricing",
        labelKu: "جۆری خزمەتگوزاری و نرخ",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "customer_code_prefixes",
        label: "Customer Code Prefixes",
        labelKu: "پشگیری کۆدی کڕیار",
        actions: ["view", "edit"],
        subPermissions: [],
      },
          {
        module: "shipping_pricing",
        label: "Shipping Pricing Rules",
        labelKu: "نرخی گواستنەوە",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "batch_label_template",
        label: "Batch Label Template",
        labelKu: "داڕشتەی لەیبڵی باچ",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "portal_price_list",
        label: "Portal Price List",
        labelKu: "لیستی نرخی پۆرتاڵ",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "store_management",
        label: "Wazn Store",
        labelKu: "وەزن ستۆر",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
    ],
  },

  // ─── 10. Users & Permissions (بەکارهێنەران) ───
  {
    id: "users",
    label: "Users & Permissions",
    labelKu: "بەکارهێنەران",
    color: "orange",
    icon: "Shield",
    modules: [
      {
        module: "users_list",
        label: "Users",
        labelKu: "بەکارهێنەران",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "staff_management",
        label: "Staff Management",
        labelKu: "بەڕێوەبردنی ستاف",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [
          { key: "assign_roles", label: "Assign Roles", labelKu: "دانانی ڕۆڵەکان", description: "Can assign roles to staff", descriptionKu: "دەتوانێت ڕۆڵ بدات بە کارمەندان" },
          { key: "manage_permissions", label: "Manage Permissions", labelKu: "بەڕێوەبردنی مۆڵەتەکان", description: "Can set staff permissions", descriptionKu: "دەتوانێت مۆڵەتەکانی کارمەندان دابنێت" },
        ],
      },
      {
        module: "permissions_management",
        label: "Permissions Management",
        labelKu: "بەڕێوەبردنی مۆڵەتەکان",
        actions: ["view", "edit"],
        subPermissions: [],
      },
      {
        module: "trash",
        label: "Recycle Bin",
        labelKu: "سەبەتەی سڕاوەکان",
        actions: ["view", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "audit_sweep",
        label: "System Sweep",
        labelKu: "پشکنینی سیستەم",
        actions: ["view"],
        subPermissions: [],
      },
      {
        module: "audit_logs",
        label: "Audit Logs",
        labelKu: "لۆگی چاودێری",
        actions: ["view"],
        subPermissions: [
          { key: "export_logs", label: "Export Logs", labelKu: "هەناردەکردنی لۆگەکان", description: "Can export audit logs", descriptionKu: "دەتوانێت لۆگەکان هەناردە بکات" },
        ],
      },
          {
        module: "portal_center",
        label: "Customer Portal Center",
        labelKu: "سەنتەری پۆرتاڵی موشتەری",
        actions: ["view"],
        subPermissions: [],
      },
      {
        module: "push_notifications",
        label: "Push Notifications",
        labelKu: "ناردنی ئاگادارکردنەوە",
        actions: ["view", "create"],
        subPermissions: [],
      },
    ],
  },

  // ─── 11. Data & Print (داتا و چاپ) ───
  {
    id: "data",
    label: "Data & Print",
    labelKu: "داتا و چاپ",
    color: "teal",
    icon: "Database",
    modules: [
      {
        module: "label_templates",
        label: "Label Templates",
        labelKu: "داڕشتەی لەیبڵ",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
      {
        module: "label_printing",
        label: "Label Printing",
        labelKu: "چاپکردنی لەیبڵ",
        actions: ["view", "create"],
        subPermissions: [],
      },
      {
        module: "invoice_template",
        label: "Invoice Template",
        labelKu: "داڕشتەی پسووڵە",
        actions: ["view", "edit"],
        subPermissions: [],
      },
      {
        module: "notification_settings",
        label: "Notification Settings",
        labelKu: "ئاگادارکردنەوەکان",
        actions: ["view", "edit"],
        subPermissions: [],
      },
      {
        module: "data_management",
        label: "Data Management",
        labelKu: "بەڕێوەبردنی داتا",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [
          { key: "manage_backup", label: "Manage Backups", labelKu: "بەڕێوەبردنی پاڵپشت", description: "Can create and restore backups", descriptionKu: "دەتوانێت پاڵپشت دروست بکات و بگەڕێنێتەوە" },
        ],
      },
      {
        module: "backup_management",
        label: "Backup Management",
        labelKu: "بەڕێوەبردنی بەکاپ",
        actions: ["view", "create"],
        subPermissions: [],
      },
      {
        module: "scheduled_backups",
        label: "Scheduled Backups",
        labelKu: "بەکاپی خۆکار",
        actions: ["view", "create", "edit"],
        subPermissions: [],
      },
      {
        module: "customer_messages",
        label: "Customer Messages",
        labelKu: "پەیامەکانی کڕیار",
        actions: ["view", "create", "edit", "delete"],
        subPermissions: [],
      },
    ],
  },
];

// Flatten all modules from all groups for backward compatibility
export const SYSTEM_MODULES: ModulePermissions[] = PERMISSION_GROUPS.flatMap(g => g.modules);

// ============ HELPER FUNCTIONS ============

export function getAllModules(): string[] {
  return SYSTEM_MODULES.map(m => m.module);
}

export function getModuleDefinition(moduleName: string): ModulePermissions | undefined {
  return SYSTEM_MODULES.find(m => m.module === moduleName);
}

export function getModuleSubPermissions(moduleName: string): SubPermissionDefinition[] {
  const module = getModuleDefinition(moduleName);
  return module?.subPermissions || [];
}

export function isValidSubPermission(moduleName: string, permissionKey: string): boolean {
  const subPerms = getModuleSubPermissions(moduleName);
  return subPerms.some(sp => sp.key === permissionKey);
}

// Map sidebar paths to permission module names
export const PATH_TO_MODULE: Record<string, string> = {
  "/dashboard": "dashboard",
  "/customers": "customers",
  "/packages/all": "packages",
  "/packages/quick-register": "quick_register",
  "/packages/bulk-register": "bulk_register",
  "/batches": "batches",
  "/batches/customer-pricing": "pricing_config",
  "/packages/unclaimed": "unclaimed_packages",
  "/packages/claim-requests": "claim_requests",
  "/unified-orders": "unified_orders",
  "/full-package": "full_package",
  "/commission": "commission",
  "/suppliers": "suppliers",
  "/tracking-alerts": "tracking_alerts",
  "/quick-register": "scan_quick_register",
  "/batch-assignment-scanner": "batch_assignment_scanner",
  "/arrival-verification-scanner": "arrival_verification",
  "/customer-delivery-scanner": "customer_delivery_scanner",
  "/scan-dashboard": "scan_dashboard",
  "/scan-reports": "scan_reports",
  "/finance": "finance_management",
  "/invoices": "invoices",
  "/finance/debtors": "debtors_report",
  "/finance/debt-reminders": "debt_reminders",
  "/finance/company-dashboard": "company_dashboard",
  "/finance/balance-sheet": "balance_sheet",
  "/finance/bank-accounts": "bank_accounts",
  "/company/expenses": "expenses",
  "/company/expense-alerts": "expense_alerts",
  "/company/partners": "partners",
  "/company/treasury": "treasury",
  "/company/debts": "company_debts",
  "/services": "all_services",
  "/service-types": "service_types",
  "/reports": "reports_overview",
  "/reports/batches": "batch_reports",
  "/reports/services": "service_reports",
  "/reports/profit": "profit_dashboard",
  "/reports/monthly-profit": "monthly_profit",
  "/profit-by-type": "profit_by_type",
  "/invoice-reports": "invoice_reports",
  "/business-analytics": "business_analytics",
  "/settings": "system_settings",
  "/countries": "countries",
  "/warehouses": "warehouses",
  "/vip-customers": "vip_customers",
  "/product-categories": "product_categories",
  "/settings/code-prefixes": "customer_code_prefixes",
  "/users": "users_list",
  "/staff-management": "staff_management",
  "/permissions-management": "permissions_management",
  "/audit-logs": "audit_logs",
  "/audit-sweep": "audit_sweep",
  "/trash": "trash",
  "/settings/label-templates": "label_templates",
  "/label-printing": "label_printing",
  "/settings/invoice-template": "invoice_template",
  "/settings/notifications": "notification_settings",
  "/settings/data-management": "data_management",
  "/backup-management": "backup_management",
  "/scheduled-backups": "scheduled_backups",
  "/customer-messages": "customer_messages",
  "/self-orders": "self_orders",
  "/packages/awaiting": "awaiting_arrival",
  "/packages/registrations": "registrations",
  "/packages/prohibited-register": "prohibited_register",
  "/settings/pricing": "shipping_pricing",
  "/settings/batch-label-template": "batch_label_template",
  "/settings/portal-price-list": "portal_price_list",
  "/store-management": "store_management",
  "/portal-center": "portal_center",
  "/admin/push-notifications": "push_notifications",
  // The create screens are the create action of the dashboard that owns them.
  "/commission/new": "commission",
  "/full-package/new": "full_package",
};
