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
  descKu: string;
  descEn: string;
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
    descKu: "تۆمارکردنی پاکەتی نوێ",
    descEn: "Register new packages",
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
    descKu: "زیادکردنی پاکەت بۆ باچ",
    descEn: "Add packages to batch",
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
    descKu: "پشکنینی پاکەتی گەیشتوو",
    descEn: "Verify arrived packages",
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
    descKu: "گەیاندنی پاکەت بە کڕیار",
    descEn: "Deliver to customer",
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
