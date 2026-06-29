import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { usePackages } from "@/hooks/usePackages";
import { Plus, Search, QrCode, Eye, Zap, Layers, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pencil, Printer, Trash2, Download, Filter, CalendarIcon, X, Package, Plane, Ship, User, CheckCircle2, Tags, FileText, Calculator, Clock, MapPin, Weight, Ruler, DollarSign, Hash, Calendar as CalendarIcon2, PackageX, Link2Off, Truck, BarChart3, ImagePlus, Loader2, Camera } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useState, useMemo, useEffect, useCallback, memo } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getCompanyInfoFromSettings } from "@/hooks/useCompanyInfo";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";

const statusColors: Record<string, string> = {
  registered: "bg-blue-100 text-blue-800",
  in_batch: "bg-purple-100 text-purple-800",
  in_transit: "bg-amber-100 text-amber-800",
  customs_processing: "bg-orange-100 text-orange-800",
  ready_for_delivery: "bg-cyan-100 text-cyan-800",
  out_for_delivery: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  returned: "bg-gray-100 text-gray-800",
};

const statusLabels: Record<string, string> = {
  registered: "Registered",
  in_batch: "In Batch",
  in_transit: "In Transit",
  customs_processing: "Customs",
  ready_for_delivery: "Ready",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

const statusOptions = [
  { value: "registered", label: "Registered" },
  { value: "in_batch", label: "In Batch" },
  { value: "in_transit", label: "In Transit" },
  { value: "customs_processing", label: "Customs Processing" },
  { value: "ready_for_delivery", label: "Ready for Delivery" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
];

const shippingTypeOptions = [
  { value: "air_regular", label: "Air Regular", labelKu: "فڕۆکەی ئاسایی" },
  { value: "air_irregular", label: "Air Irregular", labelKu: "فڕۆکەی نائاسایی" },
  { value: "sea", label: "Sea", labelKu: "دەریایی" },
];

type Package = {
  id: number;
  packageCode: string;
  trackingNumber: string | null;
  status: string;
  shippingType: string;
  weightKg: string | null;
  calculatedCostUsd: string | null;
  customerId: number | null;
  createdAt: Date;
  description: string | null;
  lengthCm: string | null;
  widthCm: string | null;
  heightCm: string | null;
  volumeCbm: string | null;
  batchId: number | null;
  categoryId: number | null;
  isUnclaimed: boolean | null;
  photos: string | null;
  fullPackageOrderId: number | null;
  orderType: 'full_package' | 'commission' | null;
};

// Package type colors and labels
const packageTypeConfig: Record<string, { color: string; label: string; labelKu: string; icon: string; tKey: string }> = {
  regular: {
    color: "bg-slate-100 text-slate-700 border-slate-200",
    label: "Regular",
    labelKu: "ئاسایی",
    icon: "📦",
    tKey: "packages.regular"
  },
  full_package: {
    color: "bg-purple-100 text-purple-700 border-purple-200",
    label: "Full Package",
    labelKu: "فول پاکێج",
    icon: "📦",
    tKey: "packages.fullPackage"
  },

  commission: {
    color: "bg-orange-100 text-orange-700 border-orange-200",
    label: "Commission",
    labelKu: "کڕین بە عمولە",
    icon: "💰",
    tKey: "packages.commission"
  }
};

type PackageRowProps = {
  pkg: Package;
  getCustomerName: (id: number | null) => string;
  getCustomerCode: (id: number | null) => string;
  getBatchCode: (id: number) => string;
  onStatusChange: (pkg: Package, newStatus: string) => void;
  onView: (pkg: Package) => void;
  onEdit: (pkg: Package) => void;
  onPrintLabel: (pkg: Package) => void;
  t: (key: string, opts?: Record<string, string | number>) => string;
};

const PackageTableRow = memo(function PackageTableRow({
  pkg,
  getCustomerName,
  getCustomerCode,
  getBatchCode,
  onStatusChange,
  onView,
  onEdit,
  onPrintLabel,
  t,
}: PackageRowProps) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-sm">{pkg.packageCode}</span>
        </div>
      </TableCell>
      <TableCell>
        {(() => {
          const pkgType = (pkg as any).orderType || "regular";
          const config = packageTypeConfig[pkgType] || packageTypeConfig.regular;
          return (
            <Badge variant="outline" className={`text-xs ${config.color}`}>
              <span className="me-1">{config.icon}</span>
              {t(config.tKey)}
            </Badge>
          );
        })()}
      </TableCell>
      <TableCell>
        <div>
          <p className="font-medium">{getCustomerName(pkg.customerId)}</p>
          <p className="text-xs text-muted-foreground font-mono">{getCustomerCode(pkg.customerId)}</p>
        </div>
      </TableCell>
      <TableCell className="font-mono text-sm">
        {pkg.trackingNumber ? (
          <span>{pkg.trackingNumber}</span>
        ) : (
          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
            <Link2Off className="h-3 w-3 me-1" />
            {t('packages.noTracking')}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize text-xs">
          {pkg.shippingType.replace(/_/g, " ")}
        </Badge>
      </TableCell>
      <TableCell>
        {pkg.batchId ? (
          <Badge variant="secondary" className="text-xs font-mono">
            {getBatchCode(pkg.batchId)}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
            <PackageX className="h-3 w-3 me-1" />
            {t('packages.noBatch')}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {(() => {
          const actualWeight = parseFloat(pkg.weightKg || "0");
          const volumetricWeight =
            pkg.lengthCm && pkg.widthCm && pkg.heightCm
              ? (parseFloat(pkg.lengthCm) * parseFloat(pkg.widthCm) * parseFloat(pkg.heightCm)) / 6000
              : 0;
          const chargeableWeight = Math.max(actualWeight, volumetricWeight);
          const isVolumetric = volumetricWeight > actualWeight && volumetricWeight > 0;
          if (chargeableWeight === 0) return "-";
          return (
            <div className="flex items-center gap-1">
              <span>{chargeableWeight.toFixed(2)} kg</span>
              {isVolumetric && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 text-purple-700 border-purple-200">
                  {t('packages.volumetric')}
                </Badge>
              )}
            </div>
          );
        })()}
      </TableCell>
      <TableCell className="font-mono">${pkg.calculatedCostUsd || "0.00"}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all flex items-center gap-1 ${statusColors[pkg.status] || "bg-gray-100"}`}
              title={t("packages.clickToChangeStatus")}
            >
              {pkg.status.replace(/_/g, " ")}
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {statusOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => option.value !== pkg.status && onStatusChange(pkg, option.value)}
                className={pkg.status === option.value ? "bg-accent" : ""}
              >
                <span className={`w-2 h-2 rounded-full me-2 ${statusColors[option.value]?.split(" ")[0] || "bg-gray-300"}`} />
                {option.label}
                {pkg.status === option.value && " ✓"}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
      <TableCell>
        {(() => {
          const registeredAt = new Date(pkg.createdAt);
          const now = new Date();
          const daysSince = Math.floor((now.getTime() - registeredAt.getTime()) / (1000 * 60 * 60 * 24));
          const isDelivered = pkg.status === "delivered" || pkg.status === "cancelled" || pkg.status === "returned";
          if (isDelivered) return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">✅ {t("packages.delivered")}</Badge>;
          if (daysSince > 20) return <Badge variant="destructive" className="animate-pulse">🔴 {daysSince} {t("common.days")}</Badge>;
          if (daysSince > 10) return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">⚠️ {daysSince} {t("common.days")}</Badge>;
          return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">✅ {daysSince} {t("common.days")}</Badge>;
        })()}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {new Date(pkg.createdAt).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" title={t("packages.viewDetails")} onClick={() => onView(pkg)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title={t("packages.editPackage")} onClick={() => onEdit(pkg)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title={t("packages.printLabel")} onClick={() => onPrintLabel(pkg)}>
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

export default function Packages() {
    const { t } = useTranslation();
const [, setLocation] = useLocation();
  const [searchInput, setSearchInput] = useState("");
  const [minWeight, setMinWeight] = useState<string>("");
  const [maxWeight, setMaxWeight] = useState<string>("");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [alertFilter, setAlertFilter] = useState<string>("all");
  const [packageTypeFilter, setPackageTypeFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");

  const {
    packages: packagesFromHook,
    total: totalPackages,
    totalPages,
    page: currentPage,
    pageSize,
    setPage: setCurrentPage,
    setPageSize,
    goToPage,
    search,
    setSearch,
    status: statusFilter,
    setStatus: setStatusFilter,
    shippingType: shippingTypeFilter,
    setShippingType: setShippingTypeFilter,
    batchId,
    setBatchId,
    dateFrom: dateFromStr,
    setDateFrom: setDateFromStr,
    dateTo: dateToStr,
    setDateTo: setDateToStr,
    setFilters,
    isLoading: isLoadingPackages,
    refetch,
    updateStatusMutation,
    updatePackageMutation,
    deletePackageMutation,
  } = usePackages();

  const { data: settings } = trpc.settings.list.useQuery();

  const dateFrom = dateFromStr ? new Date(dateFromStr) : undefined;
  const dateTo = dateToStr ? new Date(dateToStr) : undefined;
  const setDateFrom = (d: Date | undefined) => setDateFromStr(d?.toISOString());
  const setDateTo = (d: Date | undefined) => setDateToStr(d?.toISOString());

  // Sync batch filter UI to hook (batchId only sent to API when numeric)
  const setBatchFilterWithHook = (v: string) => {
    setBatchFilter(v);
    setBatchId(v === "all" || v === "no_batch" ? undefined : parseInt(v, 10));
  };

  const debouncedSearch = useDebouncedValue(searchInput, 300);
  useEffect(() => {
    setSearch(debouncedSearch);
    setCurrentPage(1);
  }, [debouncedSearch, setSearch, setCurrentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, shippingTypeFilter, batchFilter, dateFromStr, dateToStr, setCurrentPage]);
  
  // Status update dialog
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  
  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editCustomerId, setEditCustomerId] = useState<number | null>(null);
  const [editCustomerSearch, setEditCustomerSearch] = useState("");
  const [editShippingType, setEditShippingType] = useState<"air_regular" | "air_irregular" | "sea">("air_regular");
  const [editTrackingNumber, setEditTrackingNumber] = useState("");
  const [editWeightKg, setEditWeightKg] = useState("");
  const [editLengthCm, setEditLengthCm] = useState("");
  const [editWidthCm, setEditWidthCm] = useState("");
  const [editHeightCm, setEditHeightCm] = useState("");
  const [editBatchId, setEditBatchId] = useState<string>("");
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editDescription, setEditDescription] = useState("");
  const [editDirectCbm, setEditDirectCbm] = useState(""); // Direct CBM input for sea shipping
  const [editPhotos, setEditPhotos] = useState<string[]>([]); // Package photos
  const [editIsUploading, setEditIsUploading] = useState(false);
  const [editVolumetricDivisor, setEditVolumetricDivisor] = useState("6000"); // Divisor for volumetric weight
  const [showEditCustomerDropdown, setShowEditCustomerDropdown] = useState(false);
  
  // View Details dialog
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewPackage, setViewPackage] = useState<Package | null>(null);
  
  // Delete confirmation
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const packages = packagesFromHook;
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: batchesRaw } = trpc.batches.list.useQuery();
  const batches = Array.isArray(batchesRaw) ? batchesRaw : batchesRaw?.data;
  const { data: categories } = trpc.productCategories.list.useQuery();
  const { data: labelTemplates } = trpc.labelTemplates.list.useQuery();

  const onStatusSuccess = () => {
    toast.success(t("packages.statusUpdated"));
    setShowStatusDialog(false);
    setSelectedPackage(null);
    setNewStatus("");
    refetch();
  };
  const onPackageUpdateSuccess = () => {
    toast.success(t("packages.packageUpdated"));
    setShowEditDialog(false);
    setSelectedPackage(null);
    refetch();
  };
  const onDeleteSuccess = () => {
    toast.success(t("packages.packageDeleted"));
    setShowDeleteDialog(false);
    setShowEditDialog(false);
    setSelectedPackage(null);
    refetch();
  };
  const onMutationError = (error: { message: string }) => toast.error(error.message);

  const onStatusChange = useCallback(
    (pkg: Package, newStatus: string) => {
      setSelectedPackage(pkg);
      setNewStatus(newStatus);
      updateStatusMutation.mutate(
        { id: pkg.id, status: newStatus as any },
        { onSuccess: onStatusSuccess, onError: onMutationError }
      );
    },
    [updateStatusMutation, onStatusSuccess, onMutationError]
  );

  const getCustomerName = (customerId: number | null) => {
    if (!customerId) return t("packages.unclaimed");
    return customers?.find(c => c.id === customerId)?.fullName || t("common.unknown");
  };

  const getCustomerCode = (customerId: number | null) => {
    if (!customerId) return "UNC";
    return customers?.find(c => c.id === customerId)?.customerCode || "";
  };

  const getCustomerPhone = (customerId: number | null) => {
    if (!customerId) return "-";
    return customers?.find(c => c.id === customerId)?.mobileNumber || "-";
  };

  const getBatchCode = (batchId: number | null) => {
    if (!batchId) return "-";
    return batches?.find((b: any) => b.id === batchId)?.batchCode || "-";
  };

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return "-";
    const cat = categories?.find(c => c.id === categoryId);
    return cat ? `${cat.icon} ${cat.nameEn}` : "-";
  };

  // Filter customers by search for edit dialog
  const filteredEditCustomers = useMemo(() => {
    if (!customers || !editCustomerSearch) return [];
    const search = editCustomerSearch.toLowerCase();
    return customers.filter(c => 
      c.customerCode?.toLowerCase().includes(search) ||
      c.fullName?.toLowerCase().includes(search) ||
      c.mobileNumber?.includes(search)
    ).slice(0, 10);
  }, [customers, editCustomerSearch]);

  // Filter batches by shipping type for edit dialog
  const filteredEditBatches = useMemo(() => {
    if (!batches) return [];
    return batches.filter((b: any) => {
      const batchType = b.shippingType as string;
      if (editShippingType === "air_regular" || editShippingType === "air_irregular") {
        return batchType === "air" || batchType.startsWith("air");
      }
      return batchType === "sea";
    }).filter((b: any) => b.status === "preparing" || b.status === "in_transit");
  }, [batches, editShippingType]);

  // Calculate CBM for edit dialog
  const editCalculatedCbm = useMemo(() => {
    if (editLengthCm && editWidthCm && editHeightCm) {
      return (parseFloat(editLengthCm) * parseFloat(editWidthCm) * parseFloat(editHeightCm)) / 1000000;
    }
    return 0;
  }, [editLengthCm, editWidthCm, editHeightCm]);
  
  // Final CBM - use direct input if provided for sea, otherwise use calculated
  const editCbm = useMemo(() => {
    if (editShippingType === "sea" && editDirectCbm) {
      return parseFloat(editDirectCbm) || 0;
    }
    return editCalculatedCbm;
  }, [editCalculatedCbm, editDirectCbm, editShippingType]);
  
  // Calculate volumetric weight for air shipping: (L × W × H) ÷ divisor
  const editVolumetricWeight = useMemo(() => {
    if (editLengthCm && editWidthCm && editHeightCm) {
      const divisor = parseFloat(editVolumetricDivisor) || 6000;
      return (parseFloat(editLengthCm) * parseFloat(editWidthCm) * parseFloat(editHeightCm)) / divisor;
    }
    return 0;
  }, [editLengthCm, editWidthCm, editHeightCm, editVolumetricDivisor]);
  
  // Chargeable weight for air shipping - the greater of actual weight or volumetric weight
  const editChargeableWeight = useMemo(() => {
    const actualWeight = parseFloat(editWeightKg) || 0;
    if (editShippingType === "air_regular" || editShippingType === "air_irregular") {
      return Math.max(actualWeight, editVolumetricWeight);
    }
    return actualWeight;
  }, [editWeightKg, editVolumetricWeight, editShippingType]);

  // Calculate estimated price for edit dialog
  const editEstimatedPrice = useMemo(() => {
    const selectedBatch = batches?.find((b: any) => b.id === parseInt(editBatchId));
    if (!selectedBatch) return 0;
    
    if ((editShippingType === "air_regular" || editShippingType === "air_irregular") && selectedBatch.pricePerKg && editWeightKg) {
      return parseFloat(selectedBatch.pricePerKg) * parseFloat(editWeightKg);
    } else if (editShippingType === "sea" && selectedBatch.pricePerCbm && editCbm > 0) {
      return parseFloat(selectedBatch.pricePerCbm) * editCbm;
    }
    return 0;
  }, [batches, editBatchId, editShippingType, editWeightKg, editCbm]);

  // Client-side filtering (memoized)
  const filteredPackages = useMemo(() => {
    if (!packages) return undefined;
    return packages.filter(pkg => {
      const matchesBatch = batchFilter === "all" || batchFilter !== "no_batch" || (batchFilter === "no_batch" && !pkg.batchId);
      const registeredAt = new Date(pkg.createdAt);
      const now = new Date();
      const daysSince = Math.floor((now.getTime() - registeredAt.getTime()) / (1000 * 60 * 60 * 24));
      const isDelivered = pkg.status === "delivered" || pkg.status === "cancelled" || pkg.status === "returned";
      let matchesAlert = true;
      if (alertFilter === "delivered") matchesAlert = isDelivered;
      else if (alertFilter === "0-10") matchesAlert = !isDelivered && daysSince <= 10;
      else if (alertFilter === "10-20") matchesAlert = !isDelivered && daysSince > 10 && daysSince <= 20;
      else if (alertFilter === "20+") matchesAlert = !isDelivered && daysSince > 20;
      const weight = parseFloat(pkg.weightKg || "0");
      const matchesMinWeight = !minWeight || weight >= parseFloat(minWeight);
      const matchesMaxWeight = !maxWeight || weight <= parseFloat(maxWeight);
      const pkgType = (pkg as any).orderType || 'regular';
      const matchesPackageType = packageTypeFilter === "all" || pkgType === packageTypeFilter;
      return matchesBatch && matchesAlert && matchesMinWeight && matchesMaxWeight && matchesPackageType;
    });
  }, [packages, batchFilter, alertFilter, minWeight, maxWeight, packageTypeFilter]);

  // Stats calculations - use totalPackages from server for total count
  const stats = useMemo(() => {
    if (!packages) return { 
      total: totalPackages, 
      noBatch: 0, 
      noTracking: 0, 
      pendingDelivery: 0, 
      delivered: 0,
      regular: 0,
      fullPackage: 0,
      commission: 0
    };
    return {
      total: totalPackages, // Use server-side total
      noBatch: packages.filter(p => !p.batchId && p.status !== 'delivered' && p.status !== 'cancelled').length,
      noTracking: packages.filter(p => !p.trackingNumber && p.status !== 'delivered' && p.status !== 'cancelled').length,
      pendingDelivery: packages.filter(p => p.status === 'ready_for_delivery' || p.status === 'out_for_delivery').length,
      delivered: packages.filter(p => p.status === 'delivered').length,
      // Package type counts
      regular: packages.filter(p => !(p as any).orderType || (p as any).orderType === 'regular').length,
      fullPackage: packages.filter(p => (p as any).orderType === 'full_package').length,
      commission: packages.filter(p => (p as any).orderType === 'commission').length,
    };
  }, [packages, totalPackages]);

  // Tab-based filtering
  const tabFilteredPackages = useMemo(() => {
    if (!filteredPackages) return [];
    switch (activeTab) {
      case 'no_batch':
        return filteredPackages.filter(p => !p.batchId && p.status !== 'delivered' && p.status !== 'cancelled');
      case 'no_tracking':
        return filteredPackages.filter(p => !p.trackingNumber && p.status !== 'delivered' && p.status !== 'cancelled');
      case 'pending_delivery':
        return filteredPackages.filter(p => p.status === 'ready_for_delivery' || p.status === 'out_for_delivery');
      case 'delivered':
        return filteredPackages.filter(p => p.status === 'delivered');
      default:
        return filteredPackages;
    }
  }, [filteredPackages, activeTab]);

  const activeFiltersCount = [
    statusFilter !== "all",
    shippingTypeFilter !== "all",
    batchFilter !== "all",
    alertFilter !== "all",
    packageTypeFilter !== "all",
    dateFrom !== undefined,
    dateTo !== undefined,
    minWeight !== "",
    maxWeight !== "",
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setStatusFilter("all");
    setShippingTypeFilter("all");
    setBatchFilter("all");
    setBatchId(undefined);
    setAlertFilter("all");
    setPackageTypeFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setMinWeight("");
    setMaxWeight("");
    setSearchInput("");
    setSearch("");
    setCurrentPage(1);
  };

  const handleStatusUpdate = () => {
    if (!selectedPackage || !newStatus) return;
    updateStatusMutation.mutate(
      { id: selectedPackage.id, status: newStatus as any },
      { onSuccess: onStatusSuccess, onError: onMutationError }
    );
  };

  const handleEditClick = (pkg: Package) => {
    setSelectedPackage(pkg);
    setEditCustomerId(pkg.customerId);
    setEditCustomerSearch(pkg.customerId ? getCustomerCode(pkg.customerId) : "");
    setEditShippingType(pkg.shippingType as any);
    setEditTrackingNumber(pkg.trackingNumber || "");
    setEditWeightKg(pkg.weightKg || "");
    setEditLengthCm(pkg.lengthCm || "");
    setEditWidthCm(pkg.widthCm || "");
    setEditHeightCm(pkg.heightCm || "");
    setEditBatchId(pkg.batchId?.toString() || "");
    setEditCategoryId(pkg.categoryId?.toString() || "");
    setEditDescription(pkg.description || "");
    setEditDirectCbm(pkg.volumeCbm || "");
    setEditPhotos(pkg.photos ? (typeof pkg.photos === 'string' ? JSON.parse(pkg.photos) : pkg.photos) : []);
    setEditVolumetricDivisor("6000");
    setShowEditDialog(true);
  };

  const handleEditSave = () => {
    if (!selectedPackage) return;
    updatePackageMutation.mutate(
      {
        id: selectedPackage.id,
        customerId: editCustomerId || undefined,
        weightKg: editWeightKg || undefined,
        shippingType: editShippingType,
        description: editDescription || undefined,
        lengthCm: editLengthCm || undefined,
        widthCm: editWidthCm || undefined,
        heightCm: editHeightCm || undefined,
        trackingNumber: editTrackingNumber || undefined,
        batchId: editBatchId && editBatchId !== "none" ? parseInt(editBatchId) : null,
        categoryId: editCategoryId && editCategoryId !== "none" ? parseInt(editCategoryId) : null,
        volumeCbm: editCbm > 0 ? editCbm.toString() : undefined,
        photos: editPhotos.length > 0 ? editPhotos : undefined,
      },
      { onSuccess: onPackageUpdateSuccess, onError: onMutationError }
    );
  };

  const handleViewClick = (pkg: Package) => {
    setViewPackage(pkg);
    setShowViewDialog(true);
  };

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedPackage) return;
    deletePackageMutation.mutate(
      { id: selectedPackage.id },
      { onSuccess: onDeleteSuccess, onError: onMutationError }
    );
  };

  const selectEditCustomer = (customer: NonNullable<typeof customers>[0]) => {
    setEditCustomerId(customer.id);
    setEditCustomerSearch(customer.customerCode || customer.fullName || "");
    setShowEditCustomerDropdown(false);
  };

  const handlePrintLabel = (pkg: Package) => {
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) {
      toast.error(t("packages.allowPopups"));
      return;
    }

    const company = getCompanyInfoFromSettings(settings || []);
    const customer = customers?.find(c => c.id === pkg.customerId);
    const template = labelTemplates?.[0];

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Label - ${pkg.packageCode}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 10mm; }
          .label { 
            width: ${template?.widthMm || 100}mm; 
            height: ${template?.heightMm || 150}mm; 
            border: 1px solid #000; 
            padding: 5mm;
            position: relative;
          }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5mm; }
          .logo { font-size: 16pt; font-weight: bold; color: #0066cc; }
          .qr { width: 25mm; height: 25mm; }
          .tracking { 
            font-size: 14pt; 
            font-weight: bold; 
            text-align: center; 
            padding: 3mm; 
            background: #e8f5e9; 
            border-radius: 2mm;
            margin: 3mm 0;
          }
          .info { font-size: 10pt; margin: 2mm 0; }
          .info strong { display: inline-block; width: 25mm; }
          .barcode { text-align: center; margin-top: 5mm; font-family: monospace; font-size: 12pt; }
          @media print {
            body { padding: 0; }
            .label { border: none; }
          }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="header">
            <div class="logo">${company.name}</div>
            <img class="qr" src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(pkg.trackingNumber || pkg.packageCode)}" />
          </div>
          <div class="tracking">${pkg.trackingNumber || pkg.packageCode}</div>
          <div class="info"><strong>Customer:</strong> ${customer?.fullName || "Unclaimed"}</div>
          <div class="info"><strong>Code:</strong> ${customer?.customerCode || "UNC"}</div>
          <div class="info"><strong>Weight:</strong> ${pkg.weightKg || "-"} kg</div>
          <div class="info"><strong>Type:</strong> ${pkg.shippingType.replace(/_/g, " ")}</div>
          <div class="info"><strong>Date:</strong> ${new Date(pkg.createdAt).toLocaleDateString()}</div>
          <div class="barcode">||||| ${pkg.packageCode} |||||</div>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const exportToExcel = () => {
    if (!filteredPackages || filteredPackages.length === 0) {
      toast.error(t("packages.noPackagesToExport"));
      return;
    }

    // Create CSV content
    const headers = [
      "Package Code",
      "Customer",
      "Customer Code",
      "Tracking Number",
      "Shipping Type",
      "Weight (KG)",
      "Cost (USD)",
      "Status",
      "Date",
      "Description"
    ];

    const rows = filteredPackages.map(pkg => [
      pkg.packageCode,
      getCustomerName(pkg.customerId),
      getCustomerCode(pkg.customerId),
      pkg.trackingNumber || "",
      pkg.shippingType.replace(/_/g, " "),
      pkg.weightKg || "0",
      pkg.calculatedCostUsd || "0",
      pkg.status.replace(/_/g, " "),
      new Date(pkg.createdAt).toLocaleDateString(),
      pkg.description || ""
    ]);

    // Add BOM for Excel UTF-8 compatibility
    const BOM = "\uFEFF";
    const csvContent = BOM + [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `packages_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(t("packages.exportSuccess", { count: filteredPackages.length }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Professional Header with Gradient */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 p-6 text-white">
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-white/10" />
          <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-white/10" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Package className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{t('packages.title')}</h1>
                <p className="text-white/80">{t('packages.subtitle')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0" onClick={exportToExcel}>
                <Download className="h-4 w-4 me-2" />
                {t('common.exportExcel')}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-white text-blue-600 hover:bg-white/90">
                    <Plus className="h-4 w-4 me-2" />
                    {t('packages.registerPackage')}
                    <ChevronDown className="h-4 w-4 ms-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => setLocation("/packages/quick-register")}>
                    <Zap className="h-4 w-4 me-2 text-amber-500" />
                    <div>
                      <div className="font-medium">{t('packages.quickRegister')}</div>
                      <div className="text-xs text-muted-foreground">{t('packages.quickRegisterDescription')}</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation("/packages/bulk-register")}>
                    <Layers className="h-4 w-4 me-2 text-purple-500" />
                    <div>
                      <div className="font-medium">{t('packages.bulkRegister')}</div>
                      <div className="text-xs text-muted-foreground">{t('packages.bulkRegisterDescription')}</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLocation("/packages/unclaimed")}>
                    <AlertTriangle className="h-4 w-4 me-2 text-amber-500" />
                    <div>
                      <div className="font-medium">{t('packages.unclaimedPackages')}</div>
                      <div className="text-xs text-muted-foreground">{t('packages.unclaimedDescription')}</div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {/* Stats Cards in Header */}
          <div className="relative mt-6 grid grid-cols-5 gap-4">
            <div 
              className={`bg-white/10 backdrop-blur rounded-xl p-4 cursor-pointer transition-all hover:bg-white/20 ${activeTab === 'all' ? 'ring-2 ring-white' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-white/70" />
                <p className="text-white/70 text-sm">{t('common.all')}</p>
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div 
              className={`bg-white/10 backdrop-blur rounded-xl p-4 cursor-pointer transition-all hover:bg-white/20 ${activeTab === 'no_batch' ? 'ring-2 ring-white' : ''}`}
              onClick={() => setActiveTab('no_batch')}
            >
              <div className="flex items-center gap-2 mb-1">
                <PackageX className="h-4 w-4 text-amber-300" />
                <p className="text-white/70 text-sm">{t('packages.noBatch')}</p>
              </div>
              <p className="text-2xl font-bold">{stats.noBatch}</p>
              {stats.noBatch > 0 && <p className="text-xs text-amber-300 mt-1">⚠️ {t('packages.needsBatch')}</p>}
            </div>
            <div 
              className={`bg-white/10 backdrop-blur rounded-xl p-4 cursor-pointer transition-all hover:bg-white/20 ${activeTab === 'no_tracking' ? 'ring-2 ring-white' : ''}`}
              onClick={() => setActiveTab('no_tracking')}
            >
              <div className="flex items-center gap-2 mb-1">
                <Link2Off className="h-4 w-4 text-red-300" />
                <p className="text-white/70 text-sm">{t('packages.noTracking')}</p>
              </div>
              <p className="text-2xl font-bold">{stats.noTracking}</p>
              {stats.noTracking > 0 && <p className="text-xs text-red-300 mt-1">❓ {t('packages.noTrackingWarning')}</p>}
            </div>
            <div 
              className={`bg-white/10 backdrop-blur rounded-xl p-4 cursor-pointer transition-all hover:bg-white/20 ${activeTab === 'pending_delivery' ? 'ring-2 ring-white' : ''}`}
              onClick={() => setActiveTab('pending_delivery')}
            >
              <div className="flex items-center gap-2 mb-1">
                <Truck className="h-4 w-4 text-cyan-300" />
                <p className="text-white/70 text-sm">{t('packages.pendingDelivery')}</p>
              </div>
              <p className="text-2xl font-bold">{stats.pendingDelivery}</p>
            </div>
            <div 
              className={`bg-white/10 backdrop-blur rounded-xl p-4 cursor-pointer transition-all hover:bg-white/20 ${activeTab === 'delivered' ? 'ring-2 ring-white' : ''}`}
              onClick={() => setActiveTab('delivered')}
            >
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-300" />
                <p className="text-white/70 text-sm">{t('packages.delivered')}</p>
              </div>
              <p className="text-2xl font-bold">{stats.delivered}</p>
            </div>
          </div>
          
          {/* Package Type Stats Cards */}
          <div className="relative mt-4 grid grid-cols-4 gap-3">
            <div 
              className={`bg-slate-600/30 backdrop-blur rounded-lg p-3 cursor-pointer transition-all hover:bg-slate-600/50 ${packageTypeFilter === 'regular' ? 'ring-2 ring-slate-300' : ''}`}
              onClick={() => setPackageTypeFilter(packageTypeFilter === 'regular' ? 'all' : 'regular')}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">📦</span>
                <p className="text-white/70 text-xs">{t('packages.regular')}</p>
              </div>
              <p className="text-xl font-bold">{stats.regular}</p>
            </div>
            <div 
              className={`bg-purple-600/30 backdrop-blur rounded-lg p-3 cursor-pointer transition-all hover:bg-purple-600/50 ${packageTypeFilter === 'full_package' ? 'ring-2 ring-purple-300' : ''}`}
              onClick={() => setPackageTypeFilter(packageTypeFilter === 'full_package' ? 'all' : 'full_package')}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">📦</span>
                <p className="text-white/70 text-xs">{t('packages.fullPackage')}</p>
              </div>
              <p className="text-xl font-bold">{stats.fullPackage}</p>
            </div>

            <div 
              className={`bg-orange-600/30 backdrop-blur rounded-lg p-3 cursor-pointer transition-all hover:bg-orange-600/50 ${packageTypeFilter === 'commission' ? 'ring-2 ring-orange-300' : ''}`}
              onClick={() => setPackageTypeFilter(packageTypeFilter === 'commission' ? 'all' : 'commission')}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">💰</span>
                <p className="text-white/70 text-xs">{t('packages.commission')}</p>
              </div>
              <p className="text-xl font-bold">{stats.commission}</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="space-y-4">
              {/* Search and Filter Toggle Row */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("packages.searchPlaceholder")}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button 
                  variant={showFilters ? "default" : "outline"} 
                  onClick={() => setShowFilters(!showFilters)}
                  className="relative"
                >
                  <Filter className="h-4 w-4 me-2" />
                  {t("common.filters")}
                  {activeFiltersCount > 0 && (
                    <Badge className="ms-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                    <X className="h-4 w-4 me-1" />
                    {t("common.clear")}
                  </Button>
                )}
              </div>

              {/* Advanced Filters Panel */}
              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                  {/* Status Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm">{t("common.status")}</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("packages.allStatuses")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("common.all")}</SelectItem>
                        {statusOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Shipping Type Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm">{t("packages.shippingType")}</Label>
                    <Select value={shippingTypeFilter} onValueChange={setShippingTypeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("packages.allTypes")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("common.all")}</SelectItem>
                        {shippingTypeOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Batch Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm">{t("batches.title")}</Label>
                    <Select value={batchFilter} onValueChange={setBatchFilterWithHook}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("batches.allBatches")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("common.all")}</SelectItem>
                        <SelectItem value="no_batch">{t("packages.noBatch")}</SelectItem>
                        {batches?.map((batch: any) => (
                          <SelectItem key={batch.id} value={batch.id.toString()}>
                            {batch.batchCode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Package Type Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm">{t('packages.packageType')}</Label>
                    <Select value={packageTypeFilter} onValueChange={setPackageTypeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('packages.allTypes')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("common.all")}</SelectItem>
                        <SelectItem value="regular">
                          <span className="flex items-center gap-2">
                            <span>📦</span>
                            <span>{t('packages.regular')}</span>
                          </span>
                        </SelectItem>
                        <SelectItem value="full_package">
                          <span className="flex items-center gap-2">
                            <span>📦</span>
                            <span>{t('packages.fullPackage')}</span>
                          </span>
                        </SelectItem>

                        <SelectItem value="commission">
                          <span className="flex items-center gap-2">
                            <span>💰</span>
                            <span>{t('packages.commission')}</span>
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Alert Filter (Days) */}
                  <div className="space-y-2">
                    <Label className="text-sm">{t("packages.alertDays")}</Label>
                    <Select value={alertFilter} onValueChange={setAlertFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("packages.allAlerts")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("common.all")}</SelectItem>
                        <SelectItem value="0-10">✅ 0-10 {t("common.days")}</SelectItem>
                        <SelectItem value="10-20">⚠️ 10-20 {t("common.days")}</SelectItem>
                        <SelectItem value="20+">🔴 20+ {t("common.days")}</SelectItem>
                        <SelectItem value="delivered">✅ {t("packages.delivered")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date From */}
                  <div className="space-y-2">
                    <Label className="text-sm">{t("common.fromDate")}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="me-2 h-4 w-4" />
                          {dateFrom ? format(dateFrom, "yyyy-MM-dd") : t("common.select")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent variant="compact" className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateFrom}
                          onSelect={setDateFrom}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Date To */}
                  <div className="space-y-2">
                    <Label className="text-sm">{t("common.toDate")}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="me-2 h-4 w-4" />
                          {dateTo ? format(dateTo, "yyyy-MM-dd") : t("common.select")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent variant="compact" className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateTo}
                          onSelect={setDateTo}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Min Weight */}
                  <div className="space-y-2">
                    <Label className="text-sm">{t("packages.minWeight")}</Label>
                    <Input
                      type="number"
                      step="0.001"
                      placeholder="0"
                      value={minWeight}
                      onChange={(e) => setMinWeight(e.target.value)}
                    />
                  </div>

                  {/* Max Weight */}
                  <div className="space-y-2">
                    <Label className="text-sm">{t("packages.maxWeight")}</Label>
                    <Input
                      type="number"
                      step="0.001"
                      placeholder="∞"
                      value={maxWeight}
                      onChange={(e) => setMaxWeight(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Results count and pagination info */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {isLoadingPackages ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('common.loading')}
                    </span>
                  ) : (
                    <span>
                      پیشاندانی {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalPackages)} لە {totalPackages} پاکەت
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t('packages.itemsPerPage')}</span>
                  <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1); }}>
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("packages.packageCode")}</TableHead>
                  <TableHead>{t('packages.packageType')}</TableHead>
                  <TableHead>{t("customers.title")}</TableHead>
                  <TableHead>{t("packages.trackingNumber")}</TableHead>
                  <TableHead>{t("common.type")}</TableHead>
                  <TableHead>{t("batches.title")}</TableHead>
                  <TableHead>{t("packages.weight")}</TableHead>
                  <TableHead>{t("packages.cost")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("common.alert")}</TableHead>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tabFilteredPackages?.map((pkg) => (
                  <PackageTableRow
                    key={pkg.id}
                    pkg={pkg as Package}
                    getCustomerName={getCustomerName}
                    getCustomerCode={getCustomerCode}
                    getBatchCode={getBatchCode}
                    onStatusChange={onStatusChange}
                    onView={handleViewClick}
                    onEdit={handleEditClick}
                    onPrintLabel={handlePrintLabel}
                    t={t}
                  />
                ))}
                {(!filteredPackages || filteredPackages.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {t("packages.noPackages")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t pt-4 mt-4">
                <div className="text-sm text-muted-foreground">
                  پەڕەی {currentPage} لە {totalPages}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1 || isLoadingPackages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || isLoadingPackages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  
                  {/* Page numbers */}
                  <div className="flex items-center gap-1 mx-2">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(pageNum)}
                          disabled={isLoadingPackages}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || isLoadingPackages}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages || isLoadingPackages}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Update Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("packages.updateStatus")}</DialogTitle>
            <DialogDescription>
              {t("packages.package")}: {selectedPackage?.packageCode}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">{t("packages.newStatus")}</label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder={t("packages.selectStatus")} />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${statusColors[option.value]?.split(" ")[0] || "bg-gray-300"}`} />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPackage && newStatus && newStatus !== selectedPackage.status && (
              <p className="text-sm text-muted-foreground mt-2">
                {t("packages.changingFrom")} <span className="font-medium">{selectedPackage.status.replace(/_/g, " ")}</span> {t("common.to")}{" "}
                <span className="font-medium text-primary">{newStatus.replace(/_/g, " ")}</span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button 
              onClick={handleStatusUpdate} 
              disabled={!newStatus || newStatus === selectedPackage?.status || updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? "..." : t("common.update")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Package Dialog - Quick Register Style */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[92vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              {t("packages.editPackage")}
            </DialogTitle>
            <DialogDescription>
              {t("packages.package")}: {selectedPackage?.packageCode}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-5 py-2">
            {/* Summary strip — full width, always visible, never cramped */}
            <div className="rounded-xl border bg-muted/30 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="flex items-center gap-1.5 text-sm">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{t("customers.title")}:</span>
                  <span className="font-medium">{editCustomerId ? customers?.find(c => c.id === editCustomerId)?.customerCode : "-"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  {editShippingType === "sea" ? <Ship className="h-3.5 w-3.5 text-cyan-500" /> : <Plane className="h-3.5 w-3.5 text-blue-500" />}
                  <span className="text-muted-foreground">{t("packages.shippingType")}:</span>
                  <span className="font-medium capitalize">{editShippingType.replace("_", " ")}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Weight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{t("common.weight")}:</span>
                  <span className="font-medium">{editWeightKg || "0"} kg</span>
                </div>
                {editCbm > 0 && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{t("common.volume")}:</span>
                    <span className="font-medium font-mono">{editCbm.toFixed(4)} m³</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-sm">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{t("batches.title")}:</span>
                  <span className="font-medium">{editBatchId && editBatchId !== "none" ? batches?.find((b: any) => b.id === parseInt(editBatchId))?.batchCode : "-"}</span>
                </div>
                {editEstimatedPrice > 0 && (
                  <div className="ms-auto flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">{t("packages.estimatedPrice")}</span>
                    <span className="text-lg font-bold text-primary">${editEstimatedPrice.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Customer */}
            <section className="rounded-xl border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold">{t("packages.customer")}</h3>
              </div>
              <div className="p-4">
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("customers.searchPlaceholder")}
                    value={editCustomerSearch}
                    onChange={(e) => {
                      setEditCustomerSearch(e.target.value);
                      setShowEditCustomerDropdown(true);
                      if (e.target.value === "") setEditCustomerId(null);
                    }}
                    onFocus={() => setShowEditCustomerDropdown(true)}
                    className="ps-9 h-11"
                  />
                  {showEditCustomerDropdown && filteredEditCustomers.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredEditCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          className="w-full px-3 py-2 text-start hover:bg-accent flex items-center justify-between"
                          onClick={() => selectEditCustomer(customer)}
                        >
                          <div>
                            <div className="font-medium">{customer.customerCode}</div>
                            <div className="text-sm text-muted-foreground">{customer.fullName}</div>
                          </div>
                          <div className="text-xs text-muted-foreground">{customer.mobileNumber}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {editCustomerId && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded-md mt-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <span className="text-sm text-green-700 dark:text-green-400">
                      {t("packages.customerSelected")}: {customers?.find(c => c.id === editCustomerId)?.customerCode}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Shipping Type */}
            <section className="rounded-xl border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <Truck className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold">{t("packages.shippingType")}</h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {[
                    { value: "air_regular", label: t("packages.airRegular"), labelEn: "Air", icon: Plane, color: "text-blue-500" },
                    { value: "air_irregular", label: t("packages.airIrregular"), labelEn: "Air Irregular", icon: Plane, color: "text-purple-500" },
                    { value: "sea", label: t("packages.sea"), labelEn: "Sea", icon: Ship, color: "text-cyan-500" },
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => {
                        setEditShippingType(type.value as any);
                        setEditBatchId(""); // Reset batch when type changes
                      }}
                      className={cn(
                        "p-3 sm:p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-1.5 text-center",
                        editShippingType === type.value
                          ? "border-primary bg-primary/5"
                          : "border-transparent bg-muted/50 hover:bg-muted"
                      )}
                    >
                      <type.icon className={cn("h-5 w-5 sm:h-6 sm:w-6", type.color)} />
                      <span className="text-xs sm:text-sm font-medium leading-tight">{type.label}</span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{type.labelEn}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Package Details */}
            <section className="rounded-xl border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold">{t("packages.packageDetails")}</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">{t("packages.trackingNumber")}</Label>
                  <Input
                    placeholder={t("packages.enterTrackingNumber")}
                    value={editTrackingNumber}
                    onChange={(e) => setEditTrackingNumber(e.target.value)}
                    className="mt-1 h-11 font-mono"
                    dir="ltr"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">{t("packages.weight")} ({t("common.kg")})</Label>
                    <Input
                      type="number"
                      step="0.001"
                      placeholder="0.000"
                      value={editWeightKg}
                      onChange={(e) => setEditWeightKg(e.target.value)}
                      className="mt-1 h-11"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">{t("packages.batch")}</Label>
                    <Select value={editBatchId || "none"} onValueChange={setEditBatchId}>
                      <SelectTrigger className="mt-1 h-11">
                        <SelectValue placeholder={t("batches.selectBatch")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("packages.noBatch")}</SelectItem>
                        {filteredEditBatches.map((batch: any) => (
                          <SelectItem key={batch.id} value={batch.id.toString()}>
                            {batch.batchCode} - {batch.pricePerKg ? `$${batch.pricePerKg}/kg` : batch.pricePerCbm ? `$${batch.pricePerCbm}/cbm` : "No price"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Dimensions */}
                <div>
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                    <Ruler className="h-3.5 w-3.5" />
                    {t("packages.length")} / {t("packages.width")} / {t("packages.height")} ({t("common.cm")})
                  </Label>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <Input
                      type="number"
                      step="0.1"
                      placeholder={t("packages.length")}
                      value={editLengthCm}
                      onChange={(e) => setEditLengthCm(e.target.value)}
                      className="h-11"
                    />
                    <Input
                      type="number"
                      step="0.1"
                      placeholder={t("packages.width")}
                      value={editWidthCm}
                      onChange={(e) => setEditWidthCm(e.target.value)}
                      className="h-11"
                    />
                    <Input
                      type="number"
                      step="0.1"
                      placeholder={t("packages.height")}
                      value={editHeightCm}
                      onChange={(e) => setEditHeightCm(e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>

                {/* CBM for Sea Shipping */}
                {editShippingType === "sea" && (
                  <div className="p-4 bg-cyan-50 dark:bg-cyan-950 rounded-lg border border-cyan-200 dark:border-cyan-800">
                    <Label className="text-cyan-700 dark:text-cyan-300 flex items-center gap-2 mb-2 text-sm font-medium">
                      <Ship className="h-4 w-4" />
                      {t('packages.cbmVolume')}
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('packages.enterDirectly')}</Label>
                        <Input
                          type="number"
                          step="0.0001"
                          placeholder="0.0000"
                          value={editDirectCbm}
                          onChange={(e) => setEditDirectCbm(e.target.value)}
                          className="mt-1 h-11"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('packages.calculatedFromDimensions')}</Label>
                        <div className="mt-1 h-11 px-3 py-2 bg-muted rounded-md flex items-center font-mono">
                          {editCalculatedCbm.toFixed(4)} m³
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-2">
                      {t('packages.finalCbm')} <span className="font-bold">{editCbm.toFixed(4)} m³</span>
                    </p>
                  </div>
                )}

                {/* Volumetric Weight for Air Shipping */}
                {(editShippingType === "air_regular" || editShippingType === "air_irregular") && editVolumetricWeight > 0 && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Label className="text-blue-700 dark:text-blue-300 flex items-center gap-2 mb-2 text-sm font-medium">
                      <Plane className="h-4 w-4" />
                      {t('packages.volumetricWeight')}
                    </Label>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">{t('packages.actualWeight')}</span>
                        <p className="font-bold">{editWeightKg || "0"} kg</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">{t('packages.volumetricWeight')}</span>
                        <p className="font-bold">{editVolumetricWeight.toFixed(2)} kg</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">{t('packages.chargeableWeight')}</span>
                        <p className="font-bold text-primary">{editChargeableWeight.toFixed(2)} kg</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Label className="text-xs">{t('packages.divisor')}</Label>
                      <Input
                        type="number"
                        className="w-20 h-7 text-xs"
                        value={editVolumetricDivisor}
                        onChange={(e) => setEditVolumetricDivisor(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Tags className="h-3.5 w-3.5" />
                      {t("packages.productCategory")}
                    </Label>
                    <Select value={editCategoryId || "none"} onValueChange={setEditCategoryId}>
                      <SelectTrigger className="mt-1 h-11">
                        <SelectValue placeholder={t("packages.selectCategory")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("packages.noCategory")}</SelectItem>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            {cat.icon} {cat.nameEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      {t("common.description")}
                    </Label>
                    <Input
                      placeholder={t("packages.descriptionPlaceholder")}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="mt-1 h-11"
                    />
                  </div>
                </div>

                {/* Photo Upload Section */}
                <div>
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                    <ImagePlus className="h-3.5 w-3.5" />
                    {t('packages.packagePhotos')}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {editPhotos.map((photo, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={photo}
                          alt={`Photo ${index + 1}`}
                          className="w-20 h-20 object-cover rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={() => setEditPhotos(editPhotos.filter((_, i) => i !== index))}
                          className="absolute -top-2 -end-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <label className="w-20 h-20 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (!files) return;
                          setEditIsUploading(true);
                          try {
                            for (const file of Array.from(files)) {
                              const formData = new FormData();
                              formData.append("file", file);
                              const response = await fetch("/api/upload", {
                                method: "POST",
                                body: formData,
                              });
                              if (response.ok) {
                                const { url } = await response.json();
                                setEditPhotos(prev => [...prev, url]);
                              }
                            }
                          } catch (error) {
                            toast.error(t("toast.imageUploadError"));
                          } finally {
                            setEditIsUploading(false);
                          }
                        }}
                      />
                      {editIsUploading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : (
                        <Camera className="h-5 w-5 text-muted-foreground" />
                      )}
                    </label>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="flex justify-between border-t pt-4">
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleDeleteClick}
            >
              <Trash2 className="h-4 w-4 me-2" />
              {t("common.delete")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                {t("common.cancel")}
              </Button>
              <Button 
                onClick={handleEditSave} 
                disabled={updatePackageMutation.isPending}
              >
                {updatePackageMutation.isPending ? "..." : t("common.save")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              {t("packages.packageDetails")}
            </DialogTitle>
            <DialogDescription>
              {t("packages.allPackageInfo")}
            </DialogDescription>
          </DialogHeader>
          
          {viewPackage && (
            <div className="space-y-6 py-4">
              {/* Package Code & Status Header */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <QrCode className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-mono">{viewPackage.packageCode}</p>
                    <p className="text-sm text-muted-foreground">{t("packages.packageCode")}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge className={`${statusColors[viewPackage.status]} text-sm px-3 py-1`}>
                    {statusLabels[viewPackage.status] || viewPackage.status}
                  </Badge>
                  {(() => {
                    const pkgType = (viewPackage as any).orderType || 'regular';
                    const config = packageTypeConfig[pkgType] || packageTypeConfig.regular;
                    return (
                      <Badge variant="outline" className={`text-xs ${config.color}`}>
                        <span className="me-1">{config.icon}</span>
                        {t(config.tKey)}
                      </Badge>
                    );
                  })()}
                </div>
              </div>

              {/* Customer Information */}
              <Card>
                <CardHeader className="pb-2">
                  <Label className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-500" />
                    {t("packages.customerInfo")}
                  </Label>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{t("common.name")}</p>
                      <p className="font-medium">{getCustomerName(viewPackage.customerId)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("common.code")}</p>
                      <p className="font-medium font-mono">{getCustomerCode(viewPackage.customerId)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("common.phone")}</p>
                      <p className="font-medium">{getCustomerPhone(viewPackage.customerId)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("packages.unclaimed")}?</p>
                      <p className="font-medium">{viewPackage.isUnclaimed ? t("common.yes") : t("common.no")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tracking & Shipping */}
              <Card>
                <CardHeader className="pb-2">
                  <Label className="text-base flex items-center gap-2">
                    <Hash className="h-4 w-4 text-green-500" />
                    {t("packages.trackingAndShipping")}
                  </Label>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{t("packages.trackingNumber")}</p>
                      <p className="font-medium font-mono">{viewPackage.trackingNumber || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("packages.shippingType")}</p>
                      <div className="flex items-center gap-2">
                        {viewPackage.shippingType.includes("air") ? (
                          <Plane className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Ship className="h-4 w-4 text-cyan-500" />
                        )}
                        <span className="font-medium capitalize">{viewPackage.shippingType.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("packages.batch")}</p>
                      <p className="font-medium">{getBatchCode(viewPackage.batchId)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("packages.productCategory")}</p>
                      <p className="font-medium">{getCategoryName(viewPackage.categoryId)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Weight & Dimensions */}
              <Card>
                <CardHeader className="pb-2">
                  <Label className="text-base flex items-center gap-2">
                    <Weight className="h-4 w-4 text-amber-500" />
                    {t("packages.weightAndDimensions")}
                  </Label>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{t("packages.weight")}</p>
                      <p className="font-medium text-lg">{viewPackage.weightKg || "0"} <span className="text-sm text-muted-foreground">kg</span></p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("packages.volume")} (CBM)</p>
                      <p className="font-medium text-lg">{viewPackage.volumeCbm ? parseFloat(viewPackage.volumeCbm).toFixed(4) : "0"} <span className="text-sm text-muted-foreground">m³</span></p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground mb-2">{t("packages.dimensions")} (L × W × H)</p>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 px-3 py-2 bg-muted rounded-md">
                          <Ruler className="h-4 w-4 text-muted-foreground" />
                          <span>{viewPackage.lengthCm || "0"}</span>
                        </div>
                        <span className="text-muted-foreground">×</span>
                        <div className="flex items-center gap-1 px-3 py-2 bg-muted rounded-md">
                          <span>{viewPackage.widthCm || "0"}</span>
                        </div>
                        <span className="text-muted-foreground">×</span>
                        <div className="flex items-center gap-1 px-3 py-2 bg-muted rounded-md">
                          <span>{viewPackage.heightCm || "0"}</span>
                        </div>
                        <span className="text-muted-foreground text-sm">cm</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cost & Dates */}
              <Card>
                <CardHeader className="pb-2">
                  <Label className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    {t("packages.costAndDates")}
                  </Label>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{t("packages.calculatedCost")}</p>
                      <p className="font-bold text-xl text-green-600">${viewPackage.calculatedCostUsd || "0.00"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("packages.registrationDate")}</p>
                      <div className="flex items-center gap-2">
                        <CalendarIcon2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{format(new Date(viewPackage.createdAt), "yyyy-MM-dd HH:mm")}</span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">{t("packages.daysSinceRegistration")}</p>
                      {(() => {
                        const daysSince = Math.floor((new Date().getTime() - new Date(viewPackage.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                        const isDelivered = viewPackage.status === "delivered" || viewPackage.status === "cancelled" || viewPackage.status === "returned";
                        
                        if (isDelivered) {
                          return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 mt-1">✅ {t("packages.delivered")}</Badge>;
                        } else if (daysSince > 20) {
                          return <Badge variant="destructive" className="mt-1">🔴 {t("packages.danger")} - {daysSince} {t("common.days")}</Badge>;
                        } else if (daysSince > 10) {
                          return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 mt-1">⚠️ {t("packages.warning")} - {daysSince} {t("common.days")}</Badge>;
                        } else {
                          return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 mt-1">✅ {t("packages.normal")} - {daysSince} {t("common.days")}</Badge>;
                        }
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Description */}
              {viewPackage.description && (
                <Card>
                  <CardHeader className="pb-2">
                    <Label className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-500" />
                      {t("common.description")}
                    </Label>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{viewPackage.description}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              {t("common.close")}
            </Button>
            <Button onClick={() => {
              setShowViewDialog(false);
              if (viewPackage) handleEditClick(viewPackage);
            }}>
              <Pencil className="h-4 w-4 me-2" />
              {t("common.edit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("packages.deleteWarning", { code: selectedPackage?.packageCode || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.no")}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePackageMutation.isPending ? "..." : t("common.yesDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
