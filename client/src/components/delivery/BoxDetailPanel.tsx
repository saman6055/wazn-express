import { useState, useRef, useEffect } from "react";
import { useTranslation, createTranslator, getLanguageDirection, LANGUAGES, type Language } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { soundManager } from "@/lib/soundManager";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  X,
  ScanBarcode,
  Lock,
  Truck,
  CheckCircle,
  Ban,
  Printer,
  FileText,
  FileDown,
  Trash2,
  Package,
  Loader2,
  Hash,
  Weight,
  DollarSign,
  RefreshCw,
  ChevronDown,
  Pencil,
  Unlock,
} from "lucide-react";
import { EditBoxDialog } from "@/components/delivery/EditBoxDialog";

// Languages offered for the printable box receipt / PDF. Staff can print
// any one regardless of the active UI language. Chinese is intentionally
// excluded — receipts are for local (KU/AR/EN) customers.
const RECEIPT_LANGUAGES: Language[] = ["ku", "ar", "en"];

// ── Continuous scanning tuning ──
// Hardware barcode scanners "type" a whole code in a rapid burst (a few ms
// per char). We auto-submit a scan WITHOUT requiring Enter when the chars
// arrive that fast, then settle on a short trailing pause. Manual typing is
// slower, so it never auto-fires — Enter still submits it explicitly.
const SCANNER_BURST_GAP_MS = 50;   // inter-key gap below this ⇒ hardware scanner
const SCAN_AUTOSUBMIT_MS = 110;    // trailing quiet time that marks "scan done"
import { printBoxLabel, printBoxReceipt, downloadBoxReceiptPDF, normalizeCommissionDescription } from "@/lib/deliveryBoxPrintUtils";

type BoxStatus = "open" | "ready" | "in_transit" | "delivered" | "cancelled";

const STATUS_CONFIG: Record<BoxStatus, { className: string; key: string }> = {
  open: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", key: "delivery.statusOpen" },
  ready: { className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", key: "delivery.statusReady" },
  in_transit: { className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", key: "delivery.statusInTransit" },
  delivered: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", key: "delivery.statusDelivered" },
  cancelled: { className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", key: "delivery.statusCancelled" },
};

const METHOD_KEYS: Record<string, string> = {
  warehouse_pickup: "delivery.methodPickup",
  home_delivery: "delivery.methodHomeDelivery",
  city_transfer: "delivery.methodCityTransfer",
};

const ITEM_TYPE_STYLES: Record<string, string> = {
  regular: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  full_package: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  commission: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const ITEM_TYPE_KEYS: Record<string, string> = {
  regular: "delivery.typeRegular",
  full_package: "delivery.typeFullPackage",
  commission: "delivery.typeCommission",
};

interface Customer {
  id: number;
  fullName: string;
  customerCode: string;
  mobileNumber: string;
  address: string;
  city: string;
  [key: string]: any;
}

interface BoxDetailPanelProps {
  boxId: number;
  onClose: () => void;
  customers: Customer[];
}

export function BoxDetailPanel({ boxId, onClose, customers }: BoxDetailPanelProps) {
  const { t, language } = useTranslation();
  const isRtl = language === "ku" || language === "ar";
  const utils = trpc.useUtils();

  const [scanInput, setScanInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  // Latest input value kept in a ref so submit reads the COMPLETE code even
  // when a scanner's trailing Enter fires before React re-renders (avoids the
  // classic stale-closure that drops the last char of a scan).
  const scanValueRef = useRef("");
  // Pending auto-submit timer + timestamp of the previous keystroke, used to
  // detect scanner-speed bursts (see SCANNER_BURST_GAP_MS).
  const scanDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyAtRef = useRef(0);

  // Fetch box data
  const { data: box, refetch: refetchBox } = trpc.deliveryBox.getById.useQuery(
    { id: boxId },
    { refetchInterval: 5000 }
  );

  // Mutations
  const addItem = trpc.deliveryBox.addItem.useMutation({
    onSuccess: (data: any) => {
      toast.success(`${t("delivery.toastItemAdded")} ${data.item.trackingNumber}`);
      soundManager.playBeep();
      setScanInput("");
      refetchBox();
      scanInputRef.current?.focus();
    },
    onError: (err) => {
      toast.error(err.message);
      soundManager.playError();
      setScanInput("");
      scanInputRef.current?.focus();
    },
  });

  const removeItem = trpc.deliveryBox.removeItem.useMutation({
    onSuccess: () => {
      toast.success(t("delivery.toastItemRemoved"));
      refetchBox();
    },
    onError: (err) => toast.error(err.message),
  });

  const sealBox = trpc.deliveryBox.seal.useMutation({
    onSuccess: () => {
      toast.success(t("delivery.toastBoxSealed"));
      soundManager.playComplete();
      refetchBox();
    },
    onError: (err) => toast.error(err.message),
  });

  const reopenBox = trpc.deliveryBox.reopen.useMutation({
    onSuccess: () => {
      toast.success(t("delivery.toastBoxReopened"));
      soundManager.playSuccess();
      refetchBox();
    },
    onError: (err) => toast.error(err.message),
  });

  const markInTransit = trpc.deliveryBox.markInTransit.useMutation({
    onSuccess: () => {
      toast.success(t("delivery.toastBoxInTransit"));
      soundManager.playSuccess();
      refetchBox();
    },
    onError: (err) => toast.error(err.message),
  });

  const markDelivered = trpc.deliveryBox.markDelivered.useMutation({
    onSuccess: () => {
      toast.success(t("delivery.toastBoxDelivered"));
      soundManager.playComplete();
      refetchBox();
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelBox = trpc.deliveryBox.cancel.useMutation({
    onSuccess: () => {
      toast.success(t("delivery.toastBoxCancelled"));
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  // Recompute every package-linked item against current batch state. Used
  // to pull in packages added to the batch after the box was created and
  // to apply pricing/shared-tracking fixes that landed after the original
  // box build (the historical "missing sibling orders" issue).
  const recomputeItems = trpc.deliveryBox.recomputeItems.useMutation({
    onSuccess: (data: any) => {
      const parts: string[] = [];
      if (data.added > 0) parts.push(`+${data.added}`);
      if (data.updated > 0) parts.push(`✎${data.updated}`);
      if (data.removed > 0) parts.push(`−${data.removed}`);
      const summary = parts.length > 0 ? ` (${parts.join(" / ")})` : "";
      toast.success(`${t("delivery.toastBoxRefreshed")}${summary}`);
      soundManager.playSuccess();
      refetchBox();
    },
    onError: (err) => {
      toast.error(err.message);
      soundManager.playError();
    },
  });

  // Keep the cursor in the scan field for the whole open-box session so the
  // staff can scan one package after another without clicking back in — and so
  // no package is missed. Keyed on the item count too: every successful scan
  // triggers a box refetch that re-renders the items table, and that re-render
  // can drop the cursor. We restore it afterwards, but only when focus isn't on
  // another control (a button, a menu) — we must never steal focus the user
  // deliberately moved elsewhere.
  useEffect(() => {
    if (box?.status !== "open") return;
    const active = document.activeElement;
    const focusMovedElsewhere =
      active && active !== document.body && active !== scanInputRef.current;
    if (focusMovedElsewhere) return;
    scanInputRef.current?.focus();
  }, [box?.status, box?.items?.length]);

  const clearScanDebounce = () => {
    if (scanDebounceRef.current) {
      clearTimeout(scanDebounceRef.current);
      scanDebounceRef.current = null;
    }
  };

  // Submit whatever is currently in the input. Reads the ref (not state) so a
  // scanner's instant Enter can't fire before the last char lands. Clears the
  // field immediately so the next scan starts clean and the same code can't be
  // submitted twice from one burst (Enter + debounce both call this).
  const submitScan = () => {
    clearScanDebounce();
    const tracking = (scanValueRef.current || "").trim();
    if (!tracking) return;
    scanValueRef.current = "";
    setScanInput("");
    setIsScanning(true);
    addItem.mutate(
      { boxId, trackingNumber: tracking },
      { onSettled: () => setIsScanning(false) }
    );
  };

  const handleScanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    scanValueRef.current = val;
    setScanInput(val);

    const now = performance.now();
    const gap = now - lastKeyAtRef.current;
    lastKeyAtRef.current = now;

    clearScanDebounce();
    // Arm auto-submit ONLY for scanner-speed input. Manual typing (slow gaps)
    // never arms it, so it won't fire mid-typing — Enter handles that case.
    if (val.trim().length > 0 && gap < SCANNER_BURST_GAP_MS) {
      scanDebounceRef.current = setTimeout(submitScan, SCAN_AUTOSUBMIT_MS);
    }
  };

  const handleScanKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitScan();
    }
  };

  // Cancel any pending auto-submit if the panel unmounts mid-scan.
  useEffect(() => () => clearScanDebounce(), []);

  if (!box) {
    return (
      <Card className="animate-pulse">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const customer = customers.find((c) => c.id === box.customerId);
  const items = box.items ?? [];
  const status = box.status as BoxStatus;
  const isOpen = status === "open";
  const isReady = status === "ready";
  const isInTransit = status === "in_transit";
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;

  const totalWeight = items.reduce((sum: number, i: any) => sum + Number(i.weightKg || 0), 0);
  const totalItemValue = items.reduce((sum: number, i: any) => sum + Number(i.calculatedCostUsd || 0), 0);
  const deliveryCharge = Number(box.deliveryChargeUsd || 0);
  const grandTotal = totalItemValue + deliveryCharge;
  // Advance / prepaid sum across commission and full-package items (the
  // server enriches each item with `advanceAppliedUsd`). Shown as a
  // negative chip next to the grand total + a separate "remaining due"
  // chip so the staff member knows what to actually collect.
  const advanceTotal = items.reduce((sum: number, i: any) => sum + (Number(i.advanceAppliedUsd || 0) || 0), 0);
  const hasAdvance = advanceTotal > 0;
  const remainingDue = Math.max(0, grandTotal - advanceTotal);

  const handlePrintLabel = () => {
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
        notes: box.notes,
        createdAt: box.createdAt,
      },
      items.map((i: any) => ({
        trackingNumber: i.trackingNumber,
        itemType: i.itemType,
        weightKg: i.weightKg,
        calculatedCostUsd: i.calculatedCostUsd,
        description: i.description,
        sourceInfo: i.sourceInfo,
      })),
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

  // Receipt and PDF share the same data payload. The language is chosen at
  // print time (createTranslator + getLanguageDirection), independent of the
  // active UI language, so staff can hand each customer a receipt in ku/ar/en.
  const buildReceiptPayload = () =>
    [
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
        notes: box.notes,
        createdAt: box.createdAt,
      },
      items.map((i: any) => ({
        trackingNumber: i.trackingNumber,
        itemType: i.itemType,
        weightKg: i.weightKg,
        calculatedCostUsd: i.calculatedCostUsd,
        description: i.description,
        sourceInfo: i.sourceInfo,
        advanceAppliedUsd: i.advanceAppliedUsd,
      })),
      customer
        ? {
            fullName: customer.fullName,
            customerCode: customer.customerCode,
            mobileNumber: customer.mobileNumber,
            city: customer.city,
            address: customer.address,
          }
        : null,
    ] as const;

  const handlePrintReceipt = (lang: Language) => {
    const [b, its, c] = buildReceiptPayload();
    printBoxReceipt(b, its, c, createTranslator(lang), { direction: getLanguageDirection(lang) });
  };

  const handleDownloadReceiptPDF = (lang: Language) => {
    const [b, its, c] = buildReceiptPayload();
    downloadBoxReceiptPDF(b, its, c, createTranslator(lang), { direction: getLanguageDirection(lang) });
  };

  return (
    <Card dir={isRtl ? "rtl" : "ltr"} className="border-primary/20 shadow-md">
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="font-mono text-lg">{box.boxCode}</CardTitle>
                <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", statusCfg.className)}>
                  {t(statusCfg.key)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {customer?.fullName || "-"} ({customer?.customerCode || ""}) &middot;{" "}
                {t(METHOD_KEYS[box.deliveryMethod] || METHOD_KEYS.warehouse_pickup)}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Scan Input (only when box is open) */}
        {isOpen && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanBarcode className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
              <Input
                ref={scanInputRef}
                placeholder={t("delivery.scanPlaceholder")}
                value={scanInput}
                onChange={handleScanChange}
                onKeyDown={handleScanKeyDown}
                onBlur={() => {
                  // Keep focus on the field during a scanning session so the
                  // next scan always lands here — unless focus moved to another
                  // control (button/menu), which we must not steal.
                  if (box?.status === "open") {
                    setTimeout(() => {
                      if (!document.activeElement || document.activeElement === document.body) {
                        scanInputRef.current?.focus();
                      }
                    }, 0);
                  }
                }}
                className="ps-9 font-mono"
                dir="ltr"
                autoFocus
              />
            </div>
            <Button onClick={submitScan} disabled={isScanning || !scanInput.trim()}>
              {isScanning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanBarcode className="h-4 w-4 me-1" />
              )}
              {t("delivery.scan")}
            </Button>
          </div>
        )}

        {/* Items Table — Rich detail per item type */}
        {items.length > 0 ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead>{t("delivery.type")}</TableHead>
                  <TableHead>{t("delivery.tracking")}</TableHead>
                  <TableHead>{t("delivery.details")}</TableHead>
                  <TableHead>{t("delivery.source")}</TableHead>
                  <TableHead className="text-end">{t("delivery.weight")}</TableHead>
                  <TableHead className="text-end">{t("delivery.price")}</TableHead>
                  {isOpen && <TableHead className="w-[50px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any, idx: number) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                    {/* Type Badge */}
                    <TableCell>
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", ITEM_TYPE_STYLES[item.itemType] || ITEM_TYPE_STYLES.regular)}>
                        {t(ITEM_TYPE_KEYS[item.itemType] || ITEM_TYPE_KEYS.regular)}
                      </span>
                    </TableCell>
                    {/* Tracking Number */}
                    <TableCell className="font-mono text-xs" dir="ltr">
                      {item.trackingNumber || "-"}
                    </TableCell>
                    {/* Details — varies by item type. Commission descriptions
                        are normalized so legacy 3-part breakdowns show in
                        the new combined shape (item+commission as a single
                        "نرخی بەرهەم"). */}
                    <TableCell className="text-xs max-w-[200px]">
                      {(() => {
                        const displayDesc = item.itemType === 'commission'
                          ? normalizeCommissionDescription(item.description)
                          : (item.description || '');
                        return displayDesc ? (
                          <p className="font-medium truncate" title={displayDesc}>{displayDesc}</p>
                        ) : null;
                      })()}
                      {item.itemType === 'commission' && item.calculatedCostUsd && (
                        <p className="text-muted-foreground">{t("delivery.totalWithCommission")}: <span className="font-mono font-semibold text-amber-600">${Number(item.calculatedCostUsd || 0).toFixed(2)}</span></p>
                      )}
                      {item.itemType === 'full_package' && item.calculatedCostUsd && (
                        <p className="text-muted-foreground">{t("delivery.sellingPrice")}: <span className="font-mono font-semibold text-purple-600">${Number(item.calculatedCostUsd || 0).toFixed(2)}</span></p>
                      )}
                    </TableCell>
                    {/* Source (batch code / order code) */}
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {item.sourceInfo || "-"}
                    </TableCell>
                    {/* Weight */}
                    <TableCell className="text-end font-mono text-xs">
                      {Number(item.weightKg || 0).toFixed(2)} kg
                    </TableCell>
                    {/* Price */}
                    <TableCell className="text-end font-mono text-sm font-semibold">
                      ${Number(item.calculatedCostUsd || 0).toFixed(2)}
                    </TableCell>
                    {isOpen && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => removeItem.mutate({ itemId: item.id })}
                          disabled={removeItem.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-muted-foreground">
            <Package className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">{t("delivery.noItems")}</p>
          </div>
        )}

        {/* Totals */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Hash className="h-3 w-3" />
              {t("delivery.packageCount")}
            </p>
            <p className="text-lg font-bold">{box.totalPackages || items.length}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Weight className="h-3 w-3" />
              {t("delivery.totalWeight")}
            </p>
            <p className="text-lg font-bold">{totalWeight.toFixed(2)} kg</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <DollarSign className="h-3 w-3" />
              {t("delivery.packageValue")}
            </p>
            <p className="text-lg font-bold">${totalItemValue.toFixed(2)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Truck className="h-3 w-3" />
              {t("delivery.deliveryCharge")}
            </p>
            <p className="text-lg font-bold text-primary">${deliveryCharge.toFixed(2)}</p>
          </div>
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-center col-span-2 sm:col-span-1">
            <p className="text-xs text-primary font-medium">{t("delivery.grandTotal")}</p>
            <p className="text-xl font-extrabold text-primary">${grandTotal.toFixed(2)}</p>
          </div>
        </div>

        {/* Advance / prepaid summary — only rendered when at least one
            commission or full-package item in the box was prepaid. Keeps
            the staff member from collecting twice. */}
        {hasAdvance && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
              <p className="text-xs text-emerald-700 font-medium">💰 {pickLang(language, { ku: "پارەی پێشەکی دراو", en: "Advance paid", ar: "الدفعة المقدمة المدفوعة", zh: "已付预付款" })}</p>
              <p className="text-lg font-bold text-emerald-700">−${advanceTotal.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 border-2 border-amber-300 p-3 text-center">
              <p className="text-xs text-amber-800 font-medium">{pickLang(language, { ku: "ماوە بۆ دان", en: "Remaining due", ar: "المبلغ المتبقي", zh: "应付余额" })}</p>
              <p className="text-xl font-extrabold text-amber-700">${remainingDue.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          {isOpen && (
            <Button
              onClick={() => sealBox.mutate({ id: boxId })}
              disabled={sealBox.isPending || items.length === 0}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {sealBox.isPending ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Lock className="h-4 w-4 me-1" />}
              {t("delivery.sealBox")}
            </Button>
          )}

          {isReady && (
            <Button
              onClick={() => markInTransit.mutate({ id: boxId })}
              disabled={markInTransit.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {markInTransit.isPending ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Truck className="h-4 w-4 me-1" />}
              {t("delivery.markInTransit")}
            </Button>
          )}

          {/* Reopen a sealed (but not-yet-shipped) box so staff can add/remove
              packages or fix the shipping price, then re-seal. */}
          {isReady && (
            <Button
              variant="outline"
              onClick={() => {
                if (window.confirm(t("delivery.confirmReopen"))) {
                  reopenBox.mutate({ id: boxId });
                }
              }}
              disabled={reopenBox.isPending}
              className="text-amber-700 hover:text-amber-800 hover:bg-amber-50 hover:border-amber-200"
            >
              {reopenBox.isPending ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Unlock className="h-4 w-4 me-1" />}
              {t("delivery.reopenBox")}
            </Button>
          )}

          {/* Edit shipping price + delivery details. Available while the box is
              still open or sealed — i.e. before it ships and the wallet is charged. */}
          {(isOpen || isReady) && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 me-1" />
              {t("delivery.editBox")}
            </Button>
          )}

          {isInTransit && (
            <Button
              onClick={() => markDelivered.mutate({ id: boxId })}
              disabled={markDelivered.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {markDelivered.isPending ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <CheckCircle className="h-4 w-4 me-1" />}
              {t("delivery.markDelivered")}
            </Button>
          )}

          {(isOpen || isReady) && (
            <Button
              variant="destructive"
              onClick={() => cancelBox.mutate({ id: boxId })}
              disabled={cancelBox.isPending}
            >
              {cancelBox.isPending ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Ban className="h-4 w-4 me-1" />}
              {t("delivery.cancelBox")}
            </Button>
          )}

          <div className="flex-1" />

          {(isOpen || isReady) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (window.confirm(t("delivery.confirmRefresh"))) {
                  recomputeItems.mutate({ id: boxId });
                }
              }}
              disabled={recomputeItems.isPending}
              className="text-blue-700 hover:text-blue-800 hover:bg-blue-50 hover:border-blue-200"
              title={t("delivery.refreshBoxTooltip")}
            >
              {recomputeItems.isPending ? (
                <Loader2 className="h-4 w-4 me-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 me-1" />
              )}
              {t("delivery.refreshBox")}
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={handlePrintLabel}>
            <Printer className="h-4 w-4 me-1" />
            {t("delivery.printLabel")}
          </Button>
          {/* Print receipt — pick language (KU / AR / EN) at print time */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 me-1" />
                {t("delivery.printReceipt")}
                <ChevronDown className="h-3 w-3 ms-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("delivery.printReceipt")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {RECEIPT_LANGUAGES.map((lang) => {
                const info = LANGUAGES.find((l) => l.code === lang);
                return (
                  <DropdownMenuItem key={lang} onClick={() => handlePrintReceipt(lang)}>
                    <span className="me-2">{info?.flag}</span>
                    {info?.nativeName}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Download PDF — same language choice */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-red-700 hover:text-red-800 hover:bg-red-50 hover:border-red-200"
              >
                <FileDown className="h-4 w-4 me-1" />
                PDF
                <ChevronDown className="h-3 w-3 ms-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>PDF</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {RECEIPT_LANGUAGES.map((lang) => {
                const info = LANGUAGES.find((l) => l.code === lang);
                return (
                  <DropdownMenuItem key={lang} onClick={() => handleDownloadReceiptPDF(lang)}>
                    <span className="me-2">{info?.flag}</span>
                    {info?.nativeName}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>

      <EditBoxDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        box={box}
        onSaved={() => refetchBox()}
      />
    </Card>
  );
}
