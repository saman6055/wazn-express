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
import { pickLang } from "@/lib/lang";
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
        pickLang(language, {
          ku: `${result.created} بۆکس دروستکرا • ${result.skipped} پێشتر هەبوو • ${result.totalPackages} پاکەت لە باچ`,
          en: `${result.created} boxes created • ${result.skipped} already existed • ${result.totalPackages} packages in batch`,
          ar: `${result.created} صندوق تم إنشاؤه • ${result.skipped} موجود مسبقاً • ${result.totalPackages} طرد في الدفعة`,
          zh: `已创建 ${result.created} 个箱子 • ${result.skipped} 个已存在 • 批次共 ${result.totalPackages} 个包裹`,
        })
      );
      refetchBoxes();
    },
    onError: (err) => {
      toast.error(
        err.message ||
          pickLang(language, {
            ku: "هەڵە لە دروستکردنی بۆکسەکان",
            en: "Error creating boxes",
            ar: "خطأ في إنشاء الصناديق",
            zh: "创建箱子时出错",
          })
      );
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
      toast.error(
        pickLang(language, {
          ku: "هیچ بۆکسێک بۆ ئەکسپۆرت نییە",
          en: "No boxes to export",
          ar: "لا توجد صناديق للتصدير",
          zh: "没有可导出的箱子",
        })
      );
      return;
    }
    const headers = [
      pickLang(language, { ku: "کۆدی بۆکس", en: "Box Code", ar: "رمز الصندوق", zh: "箱子编号" }),
      pickLang(language, { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" }),
      pickLang(language, { ku: "کۆدی کڕیار", en: "Customer Code", ar: "رمز العميل", zh: "客户编号" }),
      pickLang(language, { ku: "ستاتوس", en: "Status", ar: "الحالة", zh: "状态" }),
      pickLang(language, { ku: "ژمارەی پاکەت", en: "Packages", ar: "عدد الطرود", zh: "包裹数" }),
      pickLang(language, { ku: "کێشی گشتی (KG)", en: "Total Weight (KG)", ar: "الوزن الإجمالي (كغ)", zh: "总重量 (KG)" }),
      pickLang(language, { ku: "نرخی گشتی ($)", en: "Total Value ($)", ar: "القيمة الإجمالية ($)", zh: "总价值 ($)" }),
      pickLang(language, { ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" }),
    ];
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
  }, [boxes, customers, batchCode, language]);

  // Print all box labels in current filter
  const utils = trpc.useUtils();
  const handlePrintAll = useCallback(async () => {
    if (!boxes.length) {
      toast.error(
        pickLang(language, {
          ku: "هیچ بۆکسێک نییە بۆ چاپکردن",
          en: "No boxes to print",
          ar: "لا توجد صناديق للطباعة",
          zh: "没有可打印的箱子",
        })
      );
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
      toast.success(
        pickLang(language, {
          ku: `${boxes.length} بۆکس چاپکرا`,
          en: `${boxes.length} boxes printed`,
          ar: `تمت طباعة ${boxes.length} صندوق`,
          zh: `已打印 ${boxes.length} 个箱子`,
        })
      );
    } catch (err) {
      toast.error(
        pickLang(language, {
          ku: "هەڵە لە چاپکردن",
          en: "Error printing",
          ar: "خطأ في الطباعة",
          zh: "打印时出错",
        })
      );
    } finally {
      setPrintingAll(false);
    }
  }, [boxes, customers, labelType, utils, t, batchCode, language]);

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
          {pickLang(language, {
            ku: "بۆکسەکانی پرینت بۆ باچ",
            en: "Print Boxes for Batch",
            ar: "صناديق الطباعة للدفعة",
            zh: "批次打印箱子",
          })}
        </CardTitle>
        <CardDescription className="text-slate-500">
          {pickLang(language, {
            ku: "خۆکارانە بۆ هەر کڕیارێک بۆکسێک دروست دەکرێت بە هەموو پاکەتەکانی لە باچدا. دەتوانی لەیبڵ بۆ هەر بۆکسێک چاپ بکەیت.",
            en: "A box is created automatically for each customer with all their packages in the batch. You can print a label for each box.",
            ar: "يتم إنشاء صندوق تلقائياً لكل عميل يحتوي على جميع طروده في الدفعة. يمكنك طباعة ملصق لكل صندوق.",
            zh: "系统会自动为每位客户创建一个包含其批次内所有包裹的箱子。您可以为每个箱子打印标签。",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5 space-y-5">
        {/* Stats chips */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
            <div className="text-xs text-blue-600 font-medium">{pickLang(language, { ku: "کۆی بۆکس", en: "Total Boxes", ar: "إجمالي الصناديق", zh: "箱子总数" })}</div>
            <div className="text-2xl font-bold text-blue-700">{totalBoxes}</div>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
            <div className="text-xs text-amber-600 font-medium">{pickLang(language, { ku: "داخراو", en: "Sealed", ar: "مغلق", zh: "已封箱" })}</div>
            <div className="text-2xl font-bold text-amber-700">{stats.sealed}</div>
          </div>
          <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
            <div className="text-xs text-purple-600 font-medium">{pickLang(language, { ku: "لە ڕێگادایە", en: "In Transit", ar: "قيد النقل", zh: "运输中" })}</div>
            <div className="text-2xl font-bold text-purple-700">{stats.inTransit}</div>
          </div>
          <div className="p-3 rounded-xl bg-green-50 border border-green-100">
            <div className="text-xs text-green-600 font-medium">{pickLang(language, { ku: "گەیشت", en: "Delivered", ar: "تم التسليم", zh: "已送达" })}</div>
            <div className="text-2xl font-bold text-green-700">{stats.delivered}</div>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">{pickLang(language, { ku: "جۆری گەیاندن:", en: "Delivery type:", ar: "نوع التوصيل:", zh: "配送类型：" })}</span>
            <Select value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as any)}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="warehouse_pickup">{pickLang(language, { ku: "وەرگرتن لە کۆگا", en: "Warehouse Pickup", ar: "الاستلام من المستودع", zh: "仓库自提" })}</SelectItem>
                <SelectItem value="home_delivery">{pickLang(language, { ku: "گەیاندن بۆ ماڵ", en: "Home Delivery", ar: "التوصيل إلى المنزل", zh: "送货上门" })}</SelectItem>
                <SelectItem value="city_transfer">{pickLang(language, { ku: "گواستنەوە بۆ شار", en: "City Transfer", ar: "النقل إلى المدينة", zh: "城市转运" })}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => setConfirmCreateOpen(true)}
            disabled={createBoxesMutation.isPending}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {createBoxesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {pickLang(language, {
              ku: "دروستکردنی بۆکس بۆ هەموو کڕیارەکان",
              en: "Create Boxes for All Customers",
              ar: "إنشاء صناديق لجميع العملاء",
              zh: "为所有客户创建箱子",
            })}
          </Button>
          <div className="ms-auto flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">{pickLang(language, { ku: "جۆری لەیبڵ:", en: "Label type:", ar: "نوع الملصق:", zh: "标签类型：" })}</span>
            <Select value={labelType} onValueChange={(v) => setLabelType(v as any)}>
              <SelectTrigger className="w-[200px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer_summary">{pickLang(language, { ku: "پوختەی کڕیار (یەک لەیبڵ)", en: "Customer Summary (one label)", ar: "ملخص العميل (ملصق واحد)", zh: "客户汇总（单标签）" })}</SelectItem>
                <SelectItem value="per_package">{pickLang(language, { ku: "هەر پاکەتێک جیا", en: "Each Package Separately", ar: "كل طرد على حدة", zh: "每个包裹单独" })}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handlePrintAll}
              disabled={printingAll || !boxes.length}
              className="gap-2"
            >
              {printingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              {pickLang(language, { ku: "چاپکردنی هەموو", en: "Print All", ar: "طباعة الكل", zh: "全部打印" })} ({totalBoxes})
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
            <AlertDialogTitle>{pickLang(language, {
              ku: "دڵنیایت لە دروستکردنی بۆکسەکان؟",
              en: "Are you sure you want to create the boxes?",
              ar: "هل أنت متأكد من إنشاء الصناديق؟",
              zh: "确定要创建这些箱子吗？",
            })}</AlertDialogTitle>
            <AlertDialogDescription>
              {pickLang(language, {
                ku: "بۆ هەر کڕیارێک کە پاکەتی لەم باچەدا هەبێت بۆکسێک دروست دەکرێت. ئەو کڕیارانەی پێشتر بۆکسیان هەبێت لەسەر ئەم باچە، سەرلەنوێ دروست ناکرێنەوە.",
                en: "A box is created for each customer who has packages in this batch. Customers who already have a box for this batch will not have one created again.",
                ar: "يتم إنشاء صندوق لكل عميل لديه طرود في هذه الدفعة. العملاء الذين لديهم صندوق مسبقاً لهذه الدفعة لن يتم إنشاء صندوق جديد لهم.",
                zh: "系统会为本批次中有包裹的每位客户创建一个箱子。本批次中已有箱子的客户不会再次创建。",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{pickLang(language, { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateBoxes}>
              {pickLang(language, { ku: "دروستی بکە", en: "Create", ar: "إنشاء", zh: "创建" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
