import { QrCode, Boxes, Truck, CreditCard } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ScannerModule {
  id: string;
  path: string;
  icon: LucideIcon;
  labelKey: string;
  descKey: string;
  labelKu: string;
  labelEn: string;
  labelAr: string;
  labelZh: string;
  descKu: string;
  descEn: string;
  descAr: string;
  descZh: string;
  scanType: string;
  color: string;
  lightColor: string;
  textColor: string;
  borderColor: string;
}

export const SCANNER_MODULES: ScannerModule[] = [
  {
    id: "quick-register",
    path: "/quick-register",
    icon: QrCode,
    labelKey: "nav.quickRegister",
    descKey: "scan.quickRegisterDesc",
    labelKu: "تۆماری خێرا",
    labelEn: "Quick Register",
    labelAr: "تسجيل سريع",
    labelZh: "快速登记",
    descKu: "تۆمارکردنی پاکەتی نوێ",
    descEn: "Register new packages",
    descAr: "تسجيل الطرود الجديدة",
    descZh: "登记新包裹",
    scanType: "registered",
    color: "from-blue-500 to-blue-600",
    lightColor: "bg-blue-50",
    textColor: "text-blue-600",
    borderColor: "border-blue-200",
  },
  {
    id: "batch-assignment",
    path: "/batch-assignment-scanner",
    icon: Boxes,
    labelKey: "nav.batchAssignment",
    descKey: "scan.batchAssignmentDesc",
    labelKu: "خستنە ناو باچ",
    labelEn: "Batch Assignment",
    labelAr: "تعيين الدفعة",
    labelZh: "批次分配",
    descKu: "زیادکردنی پاکەت بۆ باچ",
    descEn: "Add packages to batch",
    descAr: "إضافة الطرود إلى الدفعة",
    descZh: "将包裹添加到批次",
    scanType: "in_batch",
    color: "from-purple-500 to-purple-600",
    lightColor: "bg-purple-50",
    textColor: "text-purple-600",
    borderColor: "border-purple-200",
  },
  {
    id: "arrival-verification",
    path: "/arrival-verification-scanner",
    icon: Truck,
    labelKey: "nav.arrivalVerification",
    descKey: "scan.arrivalVerificationDesc",
    labelKu: "پشکنینی گەیشتن",
    labelEn: "Arrival Verification",
    labelAr: "التحقق من الوصول",
    labelZh: "到货核验",
    descKu: "پشکنینی پاکەتی گەیشتوو",
    descEn: "Verify arrived packages",
    descAr: "التحقق من الطرود الواصلة",
    descZh: "核验已到达的包裹",
    scanType: "received_local",
    color: "from-teal-500 to-teal-600",
    lightColor: "bg-teal-50",
    textColor: "text-teal-600",
    borderColor: "border-teal-200",
  },
  {
    id: "customer-delivery",
    path: "/customer-delivery-scanner",
    icon: CreditCard,
    labelKey: "nav.customerDelivery",
    descKey: "scan.customerDeliveryDesc",
    labelKu: "گەیاندن بە کڕیار",
    labelEn: "Customer Delivery",
    labelAr: "التسليم للعميل",
    labelZh: "客户交付",
    descKu: "گەیاندنی پاکەت بە کڕیار",
    descEn: "Deliver to customer",
    descAr: "تسليم الطرد إلى العميل",
    descZh: "交付给客户",
    scanType: "delivered",
    color: "from-emerald-500 to-emerald-600",
    lightColor: "bg-emerald-50",
    textColor: "text-emerald-600",
    borderColor: "border-emerald-200",
  },
];

/** Get module info by scan type */
export function getModuleByType(scanType: string): ScannerModule | undefined {
  return SCANNER_MODULES.find(m => m.scanType === scanType);
}

/** Get module info by ID */
export function getModuleById(id: string): ScannerModule | undefined {
  return SCANNER_MODULES.find(m => m.id === id);
}
