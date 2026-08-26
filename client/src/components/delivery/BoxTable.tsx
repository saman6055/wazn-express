import { useTranslation, createTranslator, getLanguageDirection, LANGUAGES, type Language } from "@/contexts/LanguageContext";
import { loadLocale } from "@/lib/i18nRegistry";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/CopyButton";
import { ZoomImage } from "@/components/ZoomImage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Eye,
  Printer,
  FileText,
  Warehouse,
  Home,
  Truck,
  ChevronLeft,
  ChevronRight,
  Package,
} from "lucide-react";
import { printBoxLabel, printBoxReceipt } from "@/lib/deliveryBoxPrintUtils";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { absoluteLogoUrl } from "@/lib/absoluteLogoUrl";
import { trpc } from "@/lib/trpc";

type BoxStatus = "open" | "ready" | "in_transit" | "delivered" | "cancelled";
type DeliveryMethod = "warehouse_pickup" | "home_delivery" | "city_transfer";

// Languages offered for the printable box receipt (KU / AR / EN), chosen at
// print time independent of the active UI language.
const RECEIPT_LANGUAGES: Language[] = ["ku", "ar", "en"];

const STATUS_CONFIG: Record<BoxStatus, { className: string; key: string }> = {
  open: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", key: "delivery.statusOpen" },
  ready: { className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", key: "delivery.statusReady" },
  in_transit: { className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", key: "delivery.statusInTransit" },
  delivered: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", key: "delivery.statusDelivered" },
  cancelled: { className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", key: "delivery.statusCancelled" },
};

const METHOD_CONFIG: Record<DeliveryMethod, { icon: typeof Warehouse; key: string }> = {
  warehouse_pickup: { icon: Warehouse, key: "delivery.methodPickup" },
  home_delivery: { icon: Home, key: "delivery.methodHomeDelivery" },
  city_transfer: { icon: Truck, key: "delivery.methodCityTransfer" },
};

interface DeliveryBox {
  id: number;
  boxCode: string;
  customerId: number;
  deliveryMethod: string;
  status: string;
  totalPackages: number;
  totalValueUsd: string | null;
  deliveryChargeUsd: string | null;
  createdAt: Date | string;
  destinationCity: string | null;
  destinationAddress: string | null;
  recipientPhone: string | null;
  deliveryCostUsd: string | null;
  deliveryProfitUsd: string | null;
  totalWeightKg: string | null;
  notes: string | null;
  isCharged: boolean;
  items?: any[];
  [key: string]: any;
}

interface Customer {
  id: number;
  fullName: string;
  customerCode: string;
  mobileNumber: string;
  address: string;
  city: string;
  [key: string]: any;
}

interface BoxTableProps {
  boxes: DeliveryBox[];
  total: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onBoxSelect: (boxId: number) => void;
  customers: Customer[];
  isLoading: boolean;
}

export function BoxTable({
  boxes,
  total,
  currentPage,
  pageSize,
  onPageChange,
  onBoxSelect,
  customers,
  isLoading,
}: BoxTableProps) {
  const { t, language } = useTranslation();
  const isRtl = language === "ku" || language === "ar";

  const totalPages = Math.ceil(total / pageSize);

  const getCustomer = (customerId: number) =>
    customers.find((c) => c.id === customerId);

  const handlePrintLabel = async (box: DeliveryBox) => {
    const customer = getCustomer(box.customerId);
    // Fetch full box with items for printing
    const fullBox = box.items
      ? box
      : await new Promise<any>(() => {
          // We'll just pass what we have - print utils handle missing items
        });
    printBoxLabel(
      {
        boxCode: box.boxCode,
        status: box.status,
        deliveryMethod: box.deliveryMethod,
        destinationCity: box.destinationCity,
        destinationAddress: box.destinationAddress,
        recipientPhone: box.recipientPhone,
        deliveryCostUsd: box.deliveryCostUsd,
        deliveryChargeUsd: box.deliveryChargeUsd,
        totalPackages: box.totalPackages,
        totalWeightKg: box.totalWeightKg,
        totalValueUsd: box.totalValueUsd,
        shippingType: (box as any).shippingType,
        notes: box.notes,
        createdAt: box.createdAt,
      },
      box.items || [],
      customer
        ? {
            fullName: customer.fullName,
            customerCode: customer.customerCode,
            mobileNumber: customer.mobileNumber,
            city: customer.city,
            address: customer.address,
          }
        : null,
      t
    );
  };

  const { logoUrl } = useCompanyInfo();

  const handlePrintReceipt = async (box: DeliveryBox, lang: Language) => {
    // Locales load on demand now; fetch the chosen one before translating.
    await loadLocale(lang);
    const customer = getCustomer(box.customerId);
    printBoxReceipt(
      {
        boxCode: box.boxCode,
        status: box.status,
        deliveryMethod: box.deliveryMethod,
        destinationCity: box.destinationCity,
        destinationAddress: box.destinationAddress,
        recipientPhone: box.recipientPhone,
        deliveryCostUsd: box.deliveryCostUsd,
        deliveryChargeUsd: box.deliveryChargeUsd,
        totalPackages: box.totalPackages,
        totalWeightKg: box.totalWeightKg,
        totalValueUsd: box.totalValueUsd,
        shippingType: (box as any).shippingType,
        notes: box.notes,
        createdAt: box.createdAt,
      },
      box.items || [],
      customer
        ? {
            fullName: customer.fullName,
            customerCode: customer.customerCode,
            mobileNumber: customer.mobileNumber,
            city: customer.city,
            address: customer.address,
          }
        : null,
      createTranslator(lang),
      { direction: getLanguageDirection(lang), logoUrl: absoluteLogoUrl(logoUrl) }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 animate-pulse">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-4 w-12 rounded bg-muted flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (boxes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm font-medium">{t("delivery.noBoxes")}</p>
      </div>
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"}>
      <Table pageSticky>
        <TableHeader>
          <TableRow>
            <TableHead>{t("delivery.boxCode")}</TableHead>
            <TableHead>{t("delivery.customer")}</TableHead>
            <TableHead>{t("delivery.deliveryMethod")}</TableHead>
            <TableHead>{t("delivery.status")}</TableHead>
            <TableHead className="text-center">{t("delivery.packages")}</TableHead>
            <TableHead className="text-end">{t("delivery.totalValue")}</TableHead>
            <TableHead className="text-end">{t("delivery.deliveryCharge")}</TableHead>
            <TableHead>{t("delivery.date")}</TableHead>
            <TableHead className="text-center">{t("delivery.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {boxes.map((box) => {
            const customer = getCustomer(box.customerId);
            const statusCfg = STATUS_CONFIG[box.status as BoxStatus] || STATUS_CONFIG.open;
            const methodCfg = METHOD_CONFIG[box.deliveryMethod as DeliveryMethod] || METHOD_CONFIG.warehouse_pickup;
            const MethodIcon = methodCfg.icon;

            return (
              <TableRow
                key={box.id}
                className="cursor-pointer transition-colors hover:bg-blue-50/60 dark:hover:bg-blue-950/30 hover:ring-2 hover:ring-inset hover:ring-blue-400/50"
                onClick={() => onBoxSelect(box.id)}
              >
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-semibold text-primary">{box.boxCode}</span>
                    <CopyButton value={box.boxCode} label="کۆپی کۆد" />
                    {/* Closed by the customer from the portal rather than by a
                        member of staff taking a signature. The two are stored
                        apart on purpose, and the day someone says they never
                        received it, this is the difference that matters. */}
                    {(box as any).customerConfirmedAt && (
                      <Badge
                        variant="outline"
                        className="ms-1 shrink-0 border-sky-300 bg-sky-50 text-[10px] font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                        title="کڕیار خۆی لە پۆرتاڵ دووپاتی کردەوە کە وەریگرتووە"
                      >
                        کڕیار دووپاتی کردەوە
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <div>
                      <p className="font-medium text-sm">{customer?.fullName || "-"}</p>
                      <p className="text-xs text-muted-foreground">{customer?.customerCode || ""}</p>
                    </div>
                    <CopyButton value={customer?.fullName} label="کۆپی ناوی کڕیار" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <MethodIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs">{t(methodCfg.key)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", statusCfg.className)}>
                    {t(statusCfg.key)}
                  </span>
                </TableCell>
                <TableCell className="text-center font-medium">{box.totalPackages}</TableCell>
                <TableCell className="text-end font-mono text-sm">
                  ${Number(box.totalValueUsd || 0).toFixed(2)}
                </TableCell>
                <TableCell className="text-end font-mono text-sm">
                  ${Number(box.deliveryChargeUsd || 0).toFixed(2)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(box.createdAt).toLocaleDateString("en-GB")}
                </TableCell>
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={isRtl ? "start" : "end"}>
                      <DropdownMenuItem onClick={() => onBoxSelect(box.id)}>
                        <Eye className="h-4 w-4 me-2" />
                        {t("delivery.view")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handlePrintLabel(box)}>
                        <Printer className="h-4 w-4 me-2" />
                        {t("delivery.printLabel")}
                      </DropdownMenuItem>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <FileText className="h-4 w-4 me-2" />
                          {t("delivery.printReceipt")}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent>
                            {RECEIPT_LANGUAGES.map((lang) => {
                              const info = LANGUAGES.find((l) => l.code === lang);
                              return (
                                <DropdownMenuItem key={lang} onClick={() => handlePrintReceipt(box, lang)}>
                                  <span className="me-2">{info?.flag}</span>
                                  {info?.nativeName}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                      </DropdownMenuSub>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {t("delivery.showing")} {currentPage * pageSize + 1}-
            {Math.min((currentPage + 1) * pageSize, total)} {t("delivery.of")} {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              {t("delivery.previous")}
            </Button>
            <span className="text-sm font-medium">
              {currentPage + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
            >
              {t("delivery.next")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
