import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Package, Plus, Wand2, Printer, FileSpreadsheet, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { exportToExcel } from "@/components/ExportUtils";
import { BoxFilters, type FilterState } from "@/components/delivery/BoxFilters";
import { BoxTable } from "@/components/delivery/BoxTable";
import { BoxDetailPanel } from "@/components/delivery/BoxDetailPanel";
import { useTranslation } from "@/contexts/LanguageContext";
import { printBoxLabel } from "@/lib/deliveryBoxPrintUtils";
import { generateLabelsHtml, openLabelPrintWindow } from "@/lib/labelPrintUtils";
import QRCode from "qrcode";

const PAGE_SIZE = 20;

interface BatchPrintBoxesSectionProps {
  batchId: number;
  batchCode: string;
}

export function BatchPrintBoxesSection({ batchId, batchCode }: BatchPrintBoxesSectionProps) {
  const { t, language } = useTranslation();
  const isRtl = language === "ku" || language === "ar";

  const [activeBoxId, setActiveBoxId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [deliveryMethod, setDeliveryMethod] = useState<"warehouse_pickup" | "home_delivery" | "city_transfer">("warehouse_pickup");
  const [labelType, setLabelType] = useState<"customer_summary" | "per_package">("customer_summary");
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const [printingAll, setPrintingAll] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "all",
    deliveryMethod: "all",
    startDate: "",
    endDate: "",
  });

  const queryParams = useMemo(() => {
    const params: any = {
      batchId,
      limit: PAGE_SIZE,
      offset: currentPage * PAGE_SIZE,
    };
    if (filters.search) params.search = filters.search;
    if (filters.status !== "all") params.status = filters.status;
    if (filters.deliveryMethod !== "all") params.deliveryMethod = filters.deliveryMethod;
    if (filters.startDate) params.startDate = new Date(filters.startDate + "T00:00:00").toISOString();
    if (filters.endDate) params.endDate = new Date(filters.endDate + "T23:59:59").toISOString();
    return params;
  }, [filters, currentPage, batchId]);

  const { data: customersData } = trpc.customers.list.useQuery();
  const {
    data: boxesData,
    isLoading: boxesLoading,
    refetch: refetchBoxes,
  } = trpc.deliveryBox.list.useQuery(queryParams);

  const customers = customersData ?? [];
  const boxes = boxesData?.boxes ?? [];
  const totalBoxes = boxesData?.total ?? 0;

  const createBoxesMutation = trpc.deliveryBox.createBoxesForBatch.useMutation({
    onSuccess: (result) => {
      toast.success(
        `${result.created} بۆکس دروستکرا • ${result.skipped} پێشتر هەبوو • ${result.totalPackages} پاکەت لە باچ`
      );
      refetchBoxes();
    },
    onError: (err) => {
      toast.error(err.message || "هەڵە لە دروستکردنی بۆکسەکان");
    },
  });

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(0);
  }, []);

  const handleCreateBoxes = useCallback(() => {
    createBoxesMutation.mutate({ batchId, deliveryMethod });
    setConfirmCreateOpen(false);
  }, [batchId, deliveryMethod, createBoxesMutation]);

  const handleExport = useCallback(() => {
    if (!boxes.length) {
      toast.error("هیچ بۆکسێک بۆ ئەکسپۆرت نییە");
      return;
    }
    const headers = ["کۆدی بۆکس", "کڕیار", "کۆدی کڕیار", "ستاتوس", "ژمارەی پاکەت", "کێشی گشتی (KG)", "نرخی گشتی ($)", "بەروار"];
    const rows = boxes.map((box: any) => {
      const customer = customers.find((c: any) => c.id === box.customerId);
      return [
        box.boxCode,
        customer?.fullName || "-",
        customer?.customerCode || "-",
        box.status,
        box.totalPackages || 0,
        Number(box.totalWeightKg || 0).toFixed(3),
        `$${Number(box.totalValueUsd || 0).toFixed(2)}`,
        new Date(box.createdAt).toLocaleDateString("en-GB"),
      ];
    });
    exportToExcel(
      { headers, rows, title: `Batch ${batchCode} Print Boxes` },
      `batch-${batchCode}-print-boxes-${new Date().toISOString().slice(0, 10)}`
    );
  }, [boxes, customers, batchCode]);

  // Print all box labels in current filter
  const utils = trpc.useUtils();
  const handlePrintAll = useCallback(async () => {
    if (!boxes.length) {
      toast.error("هیچ بۆکسێک نییە بۆ چاپکردن");
      return;
    }
    setPrintingAll(true);
    try {
      for (const box of boxes) {
        const customer = customers.find((c: any) => c.id === box.customerId);
        // fetch items
        const fullBox = await utils.deliveryBox.getById.fetch({ id: box.id });
        const items = fullBox?.items || [];

        if (labelType === "customer_summary") {
          // Print one box-level label
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
              createdAt: box.createdAt,
            },
            items,
            customer ? { fullName: customer.fullName, customerCode: customer.customerCode, mobileNumber: customer.mobileNumber } : undefined,
            t
          );
        } else {
          // Per-package: batch-generate labels for all items in this box
          const pkgs = items.map((it: any) => ({
            trackingNumber: it.trackingNumber,
            weightKg: it.weightKg ? Number(it.weightKg) : null,
            calculatedCostUsd: it.calculatedCostUsd ? Number(it.calculatedCostUsd) : null,
          }));
          const qrMap: Record<string, string> = {};
          for (const it of items) {
            const key = it.trackingNumber || `item-${it.id}`;
            qrMap[key] = await QRCode.toDataURL(key, { width: 200, margin: 1 });
          }
          const html = generateLabelsHtml({
            template: undefined,
            packages: pkgs,
            customer: {
              name: customer?.fullName || "-",
              code: customer?.customerCode,
              phone: customer?.mobileNumber,
              city: customer?.city,
            },
            batch: { batchCode },
            company: { name: "Wazn Express" },
            qrCodesMap: qrMap,
          });
          openLabelPrintWindow(html);
        }
      }
      toast.success(`${boxes.length} بۆکس چاپکرا`);
    } catch (err) {
      toast.error("هەڵە لە چاپکردن");
    } finally {
      setPrintingAll(false);
    }
  }, [boxes, customers, labelType, utils, t, batchCode]);

  const stats = useMemo(() => {
    const total = boxes.length;
    const sealed = boxes.filter((b: any) => b.status === "ready").length;
    const inTransit = boxes.filter((b: any) => b.status === "in_transit").length;
    const delivered = boxes.filter((b: any) => b.status === "delivered").length;
    return { total, sealed, inTransit, delivered };
  }, [boxes]);

  return (
    <Card dir={isRtl ? "rtl" : "ltr"}>
      <CardHeader className="border-b bg-slate-50/60">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
          <Package className="h-5 w-5 text-emerald-600" />
          بۆکسەکانی پرینت بۆ باچ
        </CardTitle>
        <CardDescription className="text-slate-500">
          خۆکارانە بۆ هەر کڕیارێک بۆکسێک دروست دەکرێت بە هەموو پاکەتەکانی لە باچدا. دەتوانی لەیبڵ بۆ هەر بۆکسێک چاپ بکەیت.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5 space-y-5">
        {/* Stats chips */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
            <div className="text-xs text-blue-600 font-medium">کۆی بۆکس</div>
            <div className="text-2xl font-bold text-blue-700">{totalBoxes}</div>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
            <div className="text-xs text-amber-600 font-medium">داخراو</div>
            <div className="text-2xl font-bold text-amber-700">{stats.sealed}</div>
          </div>
          <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
            <div className="text-xs text-purple-600 font-medium">لە ڕێگادایە</div>
            <div className="text-2xl font-bold text-purple-700">{stats.inTransit}</div>
          </div>
          <div className="p-3 rounded-xl bg-green-50 border border-green-100">
            <div className="text-xs text-green-600 font-medium">گەیشت</div>
            <div className="text-2xl font-bold text-green-700">{stats.delivered}</div>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">جۆری گەیاندن:</span>
            <Select value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as any)}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="warehouse_pickup">وەرگرتن لە کۆگا</SelectItem>
                <SelectItem value="home_delivery">گەیاندن بۆ ماڵ</SelectItem>
                <SelectItem value="city_transfer">گواستنەوە بۆ شار</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => setConfirmCreateOpen(true)}
            disabled={createBoxesMutation.isPending}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {createBoxesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            دروستکردنی بۆکس بۆ هەموو کڕیارەکان
          </Button>
          <div className="ms-auto flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">جۆری لەیبڵ:</span>
            <Select value={labelType} onValueChange={(v) => setLabelType(v as any)}>
              <SelectTrigger className="w-[200px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer_summary">پوختەی کڕیار (یەک لەیبڵ)</SelectItem>
                <SelectItem value="per_package">هەر پاکەتێک جیا</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handlePrintAll}
              disabled={printingAll || !boxes.length}
              className="gap-2"
            >
              {printingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              چاپکردنی هەموو ({totalBoxes})
            </Button>
          </div>
        </div>

        {/* Active Box Detail Panel */}
        {activeBoxId && (
          <BoxDetailPanel
            boxId={activeBoxId}
            onClose={() => setActiveBoxId(null)}
            customers={customers as any}
          />
        )}

        {/* Filters */}
        <BoxFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onExport={handleExport}
        />

        {/* Table */}
        <BoxTable
          boxes={boxes as any}
          total={totalBoxes}
          currentPage={currentPage}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          onBoxSelect={setActiveBoxId}
          customers={customers as any}
          isLoading={boxesLoading}
        />
      </CardContent>

      {/* Confirm Create Dialog */}
      <AlertDialog open={confirmCreateOpen} onOpenChange={setConfirmCreateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>دڵنیایت لە دروستکردنی بۆکسەکان؟</AlertDialogTitle>
            <AlertDialogDescription>
              بۆ هەر کڕیارێک کە پاکەتی لەم باچەدا هەبێت بۆکسێک دروست دەکرێت. ئەو کڕیارانەی پێشتر بۆکسیان هەبێت لەسەر ئەم باچە، سەرلەنوێ دروست ناکرێنەوە.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>پاشگەزبوونەوە</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateBoxes}>
              دروستی بکە
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
