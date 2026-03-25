import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, FileSpreadsheet } from "lucide-react";

export interface FilterState {
  search: string;
  status: string;
  deliveryMethod: string;
  startDate: string;
  endDate: string;
}

interface BoxFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onExport: () => void;
}

export function BoxFilters({ filters, onFilterChange, onExport }: BoxFiltersProps) {
  const { t, language } = useTranslation();
  const isRtl = language === "ku" || language === "ar";
  const [localSearch, setLocalSearch] = useState(filters.search);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.search) {
        onFilterChange({ ...filters, search: localSearch });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch]);

  // Sync external filter changes
  useEffect(() => {
    setLocalSearch(filters.search);
  }, [filters.search]);

  const handleClear = useCallback(() => {
    setLocalSearch("");
    onFilterChange({
      search: "",
      status: "all",
      deliveryMethod: "all",
      startDate: "",
      endDate: "",
    });
  }, [onFilterChange]);

  const hasActiveFilters =
    filters.search ||
    filters.status !== "all" ||
    filters.deliveryMethod !== "all" ||
    filters.startDate ||
    filters.endDate;

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative min-w-[200px] flex-1 max-w-xs">
        <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("delivery.searchPlaceholder")}
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      {/* Status filter */}
      <Select
        value={filters.status}
        onValueChange={(value) => onFilterChange({ ...filters, status: value })}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder={t("delivery.status")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("delivery.allStatuses")}</SelectItem>
          <SelectItem value="open">{t("delivery.statusOpen")}</SelectItem>
          <SelectItem value="ready">{t("delivery.statusReady")}</SelectItem>
          <SelectItem value="in_transit">{t("delivery.statusInTransit")}</SelectItem>
          <SelectItem value="delivered">{t("delivery.statusDelivered")}</SelectItem>
          <SelectItem value="cancelled">{t("delivery.statusCancelled")}</SelectItem>
        </SelectContent>
      </Select>

      {/* Method filter */}
      <Select
        value={filters.deliveryMethod}
        onValueChange={(value) => onFilterChange({ ...filters, deliveryMethod: value })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t("delivery.deliveryMethod")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("delivery.allMethods")}</SelectItem>
          <SelectItem value="warehouse_pickup">{t("delivery.methodPickup")}</SelectItem>
          <SelectItem value="home_delivery">{t("delivery.methodHomeDelivery")}</SelectItem>
          <SelectItem value="city_transfer">{t("delivery.methodCityTransfer")}</SelectItem>
        </SelectContent>
      </Select>

      {/* Date range */}
      <Input
        type="date"
        value={filters.startDate}
        onChange={(e) => onFilterChange({ ...filters, startDate: e.target.value })}
        className="w-[150px]"
        placeholder={t("delivery.fromDate")}
      />
      <Input
        type="date"
        value={filters.endDate}
        onChange={(e) => onFilterChange({ ...filters, endDate: e.target.value })}
        className="w-[150px]"
        placeholder={t("delivery.toDate")}
      />

      {/* Clear */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={handleClear}>
          <X className="h-4 w-4 me-1" />
          {t("delivery.clearFilters")}
        </Button>
      )}

      {/* Export */}
      <Button variant="outline" size="sm" onClick={onExport}>
        <FileSpreadsheet className="h-4 w-4 me-1" />
        {t("delivery.export")}
      </Button>
    </div>
  );
}
