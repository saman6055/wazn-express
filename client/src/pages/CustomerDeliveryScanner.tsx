import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Package, Plus } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useTranslation } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { exportToExcel } from "@/components/ExportUtils";
import { DeliveryStats } from "@/components/delivery/DeliveryStats";
import { BoxFilters, type FilterState } from "@/components/delivery/BoxFilters";
import { BoxTable } from "@/components/delivery/BoxTable";
import { BoxDetailPanel } from "@/components/delivery/BoxDetailPanel";
import { CreateBoxDialog } from "@/components/delivery/CreateBoxDialog";

const PAGE_SIZE = 20;

export default function CustomerDeliveryScanner() {
  const { t, language } = useTranslation();
  const isRtl = language === "ku" || language === "ar";

  // State
  const [activeBoxId, setActiveBoxId] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
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
  }, [filters, currentPage]);

  // Queries
  const { data: customersData } = trpc.customers.list.useQuery();
  const {
    data: boxesData,
    isLoading: boxesLoading,
    refetch: refetchBoxes,
  } = trpc.deliveryBox.list.useQuery(queryParams);

  const customers = customersData ?? [];
  const boxes = boxesData?.boxes ?? [];
  const totalBoxes = boxesData?.total ?? 0;

  // Handlers
  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(0);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
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

        {/* Active Box Detail Panel */}
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
              <Button onClick={() => setCreateDialogOpen(true)} className="shrink-0">
                <Plus className="h-4 w-4 me-1" />
                {t("delivery.createBox")}
              </Button>
            </div>

            {/* Table */}
            <BoxTable
              boxes={boxes}
              total={totalBoxes}
              currentPage={currentPage}
              pageSize={PAGE_SIZE}
              onPageChange={handlePageChange}
              onBoxSelect={handleBoxSelect}
              customers={customers as any}
              isLoading={boxesLoading}
            />
          </CardContent>
        </Card>

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
