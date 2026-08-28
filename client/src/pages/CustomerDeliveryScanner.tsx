import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { partitionBoxes } from "@shared/archive";
import { toast } from "sonner";
import { Package, Plus, Archive, Users, Percent, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useTranslation } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pickLang } from "@/lib/lang";
import { QuickSettleDialog } from "@/components/delivery/QuickSettleDialog";
import { Button } from "@/components/ui/button";
import { exportToExcel } from "@/components/ExportUtils";
import { DeliveryStats } from "@/components/delivery/DeliveryStats";
import { BoxFilters, type FilterState } from "@/components/delivery/BoxFilters";
import { BoxTable } from "@/components/delivery/BoxTable";
import { BoxDetailPanel } from "@/components/delivery/BoxDetailPanel";
import { CreateBoxDialog } from "@/components/delivery/CreateBoxDialog";
import { CustomerBoxCodes } from "@/components/delivery/CustomerBoxCodes";
import { DiscountReport } from "@/components/delivery/DiscountReport";

const PAGE_SIZE = 20;

export default function CustomerDeliveryScanner() {
  const { t, language } = useTranslation();
  /** For the few labels added here; the page's own `t` takes keys, not objects. */
  const L = (k: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, k);
  const isRtl = language === "ku" || language === "ar";

  // State
  const [activeBoxId, setActiveBoxId] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  /** The customer code drilled into from the codes window, if any. */
  const [drilledCustomerId, setDrilledCustomerId] = useState<number | null>(null);
  const [codesOpen, setCodesOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  /** The box whose money is being taken, if any. */
  const [payingBoxId, setPayingBoxId] = useState<number | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "all",
    deliveryMethod: "all",
    startDate: "",
    endDate: "",
  });

  // Build query params from filters
  const queryParams = useMemo(() => {
    const params: Record<string, any> = {
      limit: PAGE_SIZE,
      offset: currentPage * PAGE_SIZE,
    };
    if (drilledCustomerId) params.customerId = drilledCustomerId;
    if (filters.search) params.search = filters.search;
    if (filters.status !== "all") params.status = filters.status;
    if (filters.deliveryMethod !== "all") params.deliveryMethod = filters.deliveryMethod;
    if (filters.startDate) {
      params.startDate = new Date(filters.startDate + "T00:00:00").toISOString();
    }
    if (filters.endDate) {
      params.endDate = new Date(filters.endDate + "T23:59:59").toISOString();
    }
    return params;
  }, [filters, currentPage, drilledCustomerId]);

  // Queries
  const { data: customersData } = trpc.customers.list.useQuery();
  const { data: customerBoxRows, isLoading: customerBoxRowsLoading } =
    trpc.deliveryBox.customerSummary.useQuery();
  const {
    data: boxesData,
    isLoading: boxesLoading,
    refetch: refetchBoxes,
  } = trpc.deliveryBox.list.useQuery(queryParams);

  const customers = customersData ?? [];
  /** On the icon, so the page says how many people are waiting without a panel. */
  const waitingCodes = (customerBoxRows ?? []).filter((r) => r.openBoxes > 0).length;
  const [showArchivedBoxes, setShowArchivedBoxes] = useState(false);
  const allBoxes = boxesData?.boxes ?? [];
  const totalBoxes = boxesData?.total ?? 0;

  // A box drops out once the money for it is in — immediately, whatever its
  // age — and stays while it is not, however old. Sealed and unpaid is the
  // most important row on this screen, and the one carrying the button that
  // collects it. Cancelled goes at once; there was never anything to collect.
  // See isBoxArchived in shared/archive.ts.
  const { current: currentBoxes, archived: archivedBoxes } = useMemo(
    () => partitionBoxes(allBoxes as any[]),
    [allBoxes]
  );
  const boxes = showArchivedBoxes ? allBoxes : currentBoxes;

  // Handlers
  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(0);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  /**
   * Drilling into a code always starts at the first page. Staying on page
   * three of the old list would show an empty table and read as "no boxes".
   */
  const handleDrillToCustomer = useCallback((customerId: number | null) => {
    setDrilledCustomerId(customerId);
    setCurrentPage(0);
    // Their finished boxes are part of "everything of theirs", and the
    // customer at the counter may be asking about one of them.
    if (customerId !== null) setShowArchivedBoxes(true);
  }, []);

  const handleBoxSelect = useCallback((boxId: number) => {
    setActiveBoxId(boxId);
  }, []);

  const handleBoxCreated = useCallback(
    (boxId: number) => {
      setActiveBoxId(boxId);
      refetchBoxes();
    },
    [refetchBoxes]
  );

  const handleExport = useCallback(() => {
    if (!boxes.length) {
      toast.error(t("delivery.noBoxes"));
      return;
    }

    const headers = [
      t("delivery.boxCode"),
      t("delivery.customer"),
      t("delivery.deliveryMethod"),
      t("delivery.status"),
      t("delivery.packages"),
      t("delivery.totalValue"),
      t("delivery.deliveryCharge"),
      t("delivery.date"),
    ];

    const rows = boxes.map((box: any) => {
      const customer = customers.find((c: any) => c.id === box.customerId);
      return [
        box.boxCode,
        customer?.fullName || "-",
        t(`delivery.method${box.deliveryMethod === "warehouse_pickup" ? "Pickup" : box.deliveryMethod === "home_delivery" ? "HomeDelivery" : "CityTransfer"}`),
        t(`delivery.status${box.status.charAt(0).toUpperCase() + box.status.slice(1).replace("_", "")}`),
        box.totalPackages || 0,
        `$${Number(box.totalValueUsd || 0).toFixed(2)}`,
        `$${Number(box.deliveryChargeUsd || 0).toFixed(2)}`,
        new Date(box.createdAt).toLocaleDateString("en-GB"),
      ];
    });

    exportToExcel(
      {
        headers,
        rows,
        title: t("delivery.pageTitle"),
      },
      `delivery-boxes-${new Date().toISOString().slice(0, 10)}`
    );
  }, [boxes, customers, t]);

  return (
    <DashboardLayout>
      <div dir={isRtl ? "rtl" : "ltr"} className="space-y-6 p-4 md:p-6">
        {/* Page Header */}
        <PageHeader
          title={t("delivery.pageTitle")}
          subtitle={t("delivery.pageDescription")}
          icon={Package}
          variant="gradient"
        />

        {/* Stats */}
        <DeliveryStats boxes={boxes} isLoading={boxesLoading} />

        {/* The open box, back on the page where it was. The window it moved
            into was worse: narrower, and it hid the list behind it. */}
        {activeBoxId && (
          <BoxDetailPanel
            boxId={activeBoxId}
            onClose={() => setActiveBoxId(null)}
            customers={customers as any}
          />
        )}

        {/* Boxes Card */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            {/* Filters + Create Button Row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <BoxFilters
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  onExport={handleExport}
                />
              </div>
              {/* Two doors, not two panels. Both used to sit open on this
                  page and between them they buried the list of boxes, which
                  is what the screen is for. */}
              <Button
                variant="outline" size="icon" className="shrink-0 relative"
                onClick={() => setCodesOpen(true)}
                title={L({ ku: "کۆدی کڕیارەکان", en: "Customer codes", ar: "أكواد العملاء", zh: "客户代码" })}
                data-testid="open-customer-codes"
              >
                <Users className="h-4 w-4" />
                {waitingCodes > 0 && (
                  <span className="absolute -top-1.5 -end-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
                    {waitingCodes}
                  </span>
                )}
              </Button>
              <Button
                variant="outline" size="icon" className="shrink-0"
                onClick={() => setReportOpen(true)}
                title={L({ ku: "ڕاپۆرتی داشکاندن", en: "Discount report", ar: "تقرير الخصومات", zh: "折扣报表" })}
                data-testid="open-discount-report"
              >
                <Percent className="h-4 w-4" />
              </Button>
              <Button onClick={() => setCreateDialogOpen(true)} className="shrink-0">
                <Plus className="h-4 w-4 me-1" />
                {t("delivery.createBox")}
              </Button>
            </div>

            {/* Which code the list is narrowed to, if any — a filter with no
                visible handle is one somebody forgets is on. */}
            {drilledCustomerId && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-900 dark:bg-blue-950/40">
                <Users className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span className="font-medium" dir="ltr">
                  {customerBoxRows?.find((r) => r.customerId === drilledCustomerId)?.customerCode}
                </span>
                <Button variant="ghost" size="sm" className="ms-auto h-7"
                        onClick={() => handleDrillToCustomer(null)}
                        data-testid="clear-customer-drill">
                  <X className="h-4 w-4 me-1" />
                  {L({ ku: "هەموو بۆکسەکان", en: "All boxes", ar: "كل الصناديق", zh: "全部箱子" })}
                </Button>
              </div>
            )}

            {archivedBoxes.length > 0 && (
              <div className="flex items-center justify-between gap-2 mb-4 text-sm">
                <span className="text-muted-foreground">
                  {t("delivery.archivedHidden", { count: archivedBoxes.length })}
                </span>
                <Button variant="outline" size="sm" onClick={() => setShowArchivedBoxes((v) => !v)}>
                  <Archive className="h-4 w-4 me-2" />
                  {showArchivedBoxes ? t("batches.hideArchived") : t("batches.showArchived")}
                </Button>
              </div>
            )}

            {/* Table */}
            <BoxTable
              boxes={boxes}
              total={totalBoxes}
              currentPage={currentPage}
              pageSize={PAGE_SIZE}
              onPageChange={handlePageChange}
              onBoxSelect={handleBoxSelect}
              onTakePayment={setPayingBoxId}
              customers={customers as any}
              isLoading={boxesLoading}
            />
          </CardContent>
        </Card>

        {/* ── who has goods waiting ─────────────────────────────────── */}
        <Dialog open={codesOpen} onOpenChange={setCodesOpen}>
          <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {L({ ku: "کۆدی کڕیارەکان", en: "Customer codes", ar: "أكواد العملاء", zh: "客户代码" })}
              </DialogTitle>
            </DialogHeader>
            <CustomerBoxCodes
              rows={customerBoxRows ?? []}
              isLoading={customerBoxRowsLoading}
              selectedCustomerId={drilledCustomerId}
              onSelect={(id) => { handleDrillToCustomer(id); setCodesOpen(false); }}
              inDialog
            />
          </DialogContent>
        </Dialog>

        {/* ── money that left through this same door, and why ───────── */}
        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {L({ ku: "ڕاپۆرتی داشکاندن", en: "Discount report", ar: "تقرير الخصومات", zh: "折扣报表" })}
              </DialogTitle>
            </DialogHeader>
            <DiscountReport alwaysOpen />
          </DialogContent>
        </Dialog>

        {/* Money for one box, in one press */}
        <QuickSettleDialog
          boxId={payingBoxId}
          onOpenChange={(o) => !o && setPayingBoxId(null)}
          onSettled={() => refetchBoxes()}
        />

        {/* Create Dialog */}
        <CreateBoxDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onBoxCreated={handleBoxCreated}
        />
      </div>
    </DashboardLayout>
  );
}
