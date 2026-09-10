import { statusChip, statusDot } from "@/lib/statusTone";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CopyButton } from "@/components/CopyButton";
import { ZoomImage } from "@/components/ZoomImage";
import { TableSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { usePackages } from "@/hooks/usePackages";
import { Plus, Search, QrCode, Eye, Zap, Layers, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pencil, Trash2, Download, Filter, CalendarIcon, X, Package, Plane, Ship, User, CheckCircle2, Tags, FileText, Calculator, Clock, MapPin, Weight, Ruler, DollarSign, Hash, Calendar as CalendarIcon2, PackageX, Link2Off, Truck, BarChart3, ImagePlus, Loader2, Camera, PackagePlus, PackageSearch } from "lucide-react";
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
import { useLocation } from "wouter";
import { ShippingRouteFilter, useShippingRouteFilter } from "@/components/ShippingRouteFilter";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtDate } from "@/lib/numericDate";
import { chargeableWeight, DEFAULT_VOLUMETRIC_DIVISOR } from "@shared/chargeableWeight";
import { PACKAGE_STATUS_LABEL } from "@/lib/packageStatus";
import { readPackagesLink } from "@shared/listLinks";
import { FilteredByLinkBanner } from "@/components/FilteredByLinkBanner";
import { CustomerJourneyPanel } from "@/components/packages/CustomerJourneyPanel";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterChips, type FilterChip } from "@/components/ui/filter-chips";

const statusColors: Record<string, string> = {
  registered: statusChip("registered", "package"),
  in_batch: statusChip("in_batch", "package"),
  in_transit: statusChip("in_transit", "package"),
  customs_processing: statusChip("customs_processing", "package"),
  ready_for_delivery: statusChip("ready_for_delivery", "package"),
  out_for_delivery: statusChip("out_for_delivery", "package"),
  delivered: statusChip("delivered", "package"),
  cancelled: statusChip("cancelled", "package"),
  returned: statusChip("returned", "package"),
};

/**
 * The status names come from the shared map, in the reader's language.
 *
 * There were two private maps here, both English-only on a Kurdish page, and
 * they disagreed with each other on the same screen: the badge said "Customs"
 * and "Ready" while the dropdown that changes it said "Customs Processing"
 * and "Ready for Delivery". Both now read lib/packageStatus.ts, which is
 * where every other screen reads them.
 */
const statusLabel = (status: string, language: string) =>
  PACKAGE_STATUS_LABEL[status] ? pickLang(language, PACKAGE_STATUS_LABEL[status]!) : status.replace(/_/g, " ");

const statusOptionsFor = (language: string) =>
  Object.keys(PACKAGE_STATUS_LABEL).map(value => ({ value, label: statusLabel(value, language) }));

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
    color: "bg-slate-100 dark:bg-slate-950/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800/60",
    label: "Regular",
    labelKu: "ئاسایی",
    icon: "📦",
    tKey: "packages.regular"
  },
  full_package: {
    color: "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60",
    label: "Full Package",
    labelKu: "پاکێجی تەواو",
    icon: "📦",
    tKey: "packages.fullPackage"
  },

  commission: {
    color: "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/60",
    label: "Commission",
    labelKu: "کڕین بە تێچوو",
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
  /** The install's volumetric divisor, from settings — never a literal. */
  divisor: number;
  language: string;
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
  divisor,
  language,
  t,
}: PackageRowProps) {
  return (
    <TableRow className="transition-colors hover:bg-blue-50/60 dark:hover:bg-blue-950/30 hover:ring-2 hover:ring-inset hover:ring-blue-400/50">
      <TableCell>
        {/* Ordered goods carry BOTH numbers: the system's (CM-…/FP-…) and
            the platform's own (the Taobao/1688 order id) — each with its
            copy. A self-order has no order, so its system number is the
            package code, and that alone, per the owner. */}
        {(() => {
          const orderCode = (pkg as any).orderCode as string | null;
          const platformNo = ((pkg as any).platformOrderNumber || (pkg as any).supplierOrderNumber) as string | null;
          if (orderCode) {
            return (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1">
                  <span dir="ltr" className="font-mono text-sm">{orderCode}</span>
                  <CopyButton value={orderCode} label="کۆپی ئۆردەری سیستەم" />
                </div>
                {platformNo && (
                  <div className="flex items-center gap-1">
                    <span dir="ltr" className="font-mono text-[11px] text-muted-foreground">{platformNo}</span>
                    <CopyButton value={platformNo} label="کۆپی ئۆردەری پلاتفۆرم" />
                  </div>
                )}
              </div>
            );
          }
          return (
            <div className="flex items-center gap-1">
              <span dir="ltr" className="font-mono text-sm text-muted-foreground">{pkg.packageCode}</span>
              <CopyButton value={pkg.packageCode} label="کۆپی کۆدی سیستەم" />
            </div>
          );
        })()}
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
        <div className="flex items-center gap-1">
          <div>
            <p className="font-medium">{getCustomerName(pkg.customerId)}</p>
            <p dir="ltr" className="text-xs text-muted-foreground font-mono text-end">{shortCustomerCode(getCustomerCode(pkg.customerId))}</p>
          </div>
          <CopyButton value={getCustomerName(pkg.customerId)} label="کۆپی ناوی کڕیار" />
        </div>
      </TableCell>
      <TableCell className="font-mono text-sm">
        {pkg.trackingNumber ? (
          <div className="flex items-center gap-1">
            <span>{pkg.trackingNumber}</span>
            <CopyButton value={pkg.trackingNumber} label="کۆپی تراکینگ" />
          </div>
        ) : (
          <Badge variant="outline" className="text-xs bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60">
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
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs font-mono">
              {getBatchCode(pkg.batchId)}
            </Badge>
            <CopyButton value={getBatchCode(pkg.batchId)} label="کۆپی کۆدی باچ" />
          </div>
        ) : (
          <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60">
            <PackageX className="h-3 w-3 me-1" />
            {t('packages.noBatch')}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {(() => {
          // The shared rule with the configured divisor — a hardcoded 6000
          // here showed a different weight than the invoice whenever the
          // setting was changed.
          const { chargeableKg, billedOnVolume } = chargeableWeight(pkg, divisor);
          if (chargeableKg === 0) return "-";
          return (
            <div className="flex items-center gap-1">
              <span>{chargeableKg.toFixed(2)} kg</span>
              {billedOnVolume && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60">
                  {t('packages.volumetric')}
                </Badge>
              )}
            </div>
          );
        })()}
      </TableCell>
      {/* The raw decimal string printed $12.5 in one row and $12.50 in the
          next, from the same column. */}
      <TableCell className="font-mono tabular-nums">${Number(pkg.calculatedCostUsd || 0).toFixed(2)}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="inline-flex cursor-pointer items-center gap-1 rounded-full transition-all hover:ring-2 hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              title={t("packages.clickToChangeStatus")}
            >
              <StatusBadge status={pkg.status} kind="package" />
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {statusOptionsFor(language).map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => option.value !== pkg.status && onStatusChange(pkg, option.value)}
                className={pkg.status === option.value ? "bg-accent" : ""}
              >
                <span className={`w-2 h-2 rounded-full me-2 ${statusDot(option.value, "package")}`} />
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
          // A cancelled or returned parcel is not a delivered one. Grouping
          // the three together put a green ✅ "Delivered" badge on parcels
          // that were cancelled — the alert column saying the opposite of
          // the status column two cells away.
          if (pkg.status === "delivered") return <Badge variant="outline" className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/60">✅ {t("packages.delivered")}</Badge>;
          if (pkg.status === "cancelled" || pkg.status === "returned") {
            return (
              <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                {pickLang(language, PACKAGE_STATUS_LABEL[pkg.status]!)}
              </Badge>
            );
          }
          if (daysSince > 20) return <Badge variant="destructive" className="animate-pulse">🔴 {daysSince} {t("common.days")}</Badge>;
          if (daysSince > 10) return <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60">⚠️ {daysSince} {t("common.days")}</Badge>;
          return <Badge variant="outline" className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/60">✅ {daysSince} {t("common.days")}</Badge>;
        })()}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {/* Numbers, not "days ago" — 8.9.2026, LTR so digits keep their order */}
        <span dir="ltr" className="tabular-nums">{fmtDate(new Date(pkg.createdAt))}</span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" title={t("packages.viewDetails")} onClick={() => onView(pkg)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title={t("packages.editPackage")} onClick={() => onEdit(pkg)}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

/** "AZ225(Muhammad Ismail Omar)" → "AZ225" — what a person types and reads. */
const shortCustomerCode = (code?: string | null) => (code ?? "").split("(")[0]!.trim();

export default function Packages() {
    const { t, language } = useTranslation();
const [, setLocation] = useLocation();
  // Deep link: /packages/all?search=PKG-XYZ opens the table already looking
  // for that parcel. Anything that used to link to /packages/:id — which has
  // never been a route — now points here instead of at a 404.
  // The whole link, read once. `search` was already honoured here; the tab and
  // the batch come in the same way now, so a dashboard figure can open the
  // rows it counted rather than the whole table.
  const [linkFilters] = useState(() =>
    typeof window === "undefined" ? {} : readPackagesLink(window.location.search),
  );
  const [searchInput, setSearchInput] = useState(() => linkFilters.search ?? "");
  // Cleared by the banner rather than by a control: there is no day picker on
  // this table, so without a way out a reader would be stuck on one day.
  const [dayFilter, setDayFilter] = useState<string | undefined>(() => linkFilters.day);
  const [minWeight, setMinWeight] = useState<string>("");
  const [maxWeight, setMaxWeight] = useState<string>("");
  const [batchFilter, setBatchFilter] = useState<string>(() => linkFilters.batch ?? "all");
  const [alertFilter, setAlertFilter] = useState<string>("all");
  const [packageTypeFilter, setPackageTypeFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(() => linkFilters.tab ?? "all");

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
  // Seeded from the setting below, not the literal: the row behind this
  // dialog already uses the configured divisor, so a hardcoded 6000 here
  // showed two different chargeable weights for one parcel on one screen.
  const [editVolumetricDivisor, setEditVolumetricDivisor] = useState("");
  const [showEditCustomerDropdown, setShowEditCustomerDropdown] = useState(false);
  
  // View Details dialog
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewPackage, setViewPackage] = useState<Package | null>(null);
  
  // Delete confirmation
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const packages = packagesFromHook;
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: divisorData } = trpc.packages.getCbmDivisor.useQuery();
  const volumetricDivisor = divisorData?.divisor || DEFAULT_VOLUMETRIC_DIVISOR;

  /**
   * Typing a customer code into the ordinary search opens the journey panel
   * above the table — the "how many of my pieces are missing?" answer. The
   * table below keeps filtering as it always has; closing the panel only
   * hides it until a different code is typed. /packages/all?customer=AZ002
   * deep-links straight into it.
   */
  // Codes are stored as "AZ225(Muhammad Ismail Omar)" — name and all — so
  // the match accepts what a person actually types: the short code before
  // the parenthesis, or the full stored string pasted whole.
  const searchMatchedCustomer = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q || !customers) return null;
    return customers.find(c => {
      const full = (c.customerCode ?? "").toLowerCase();
      if (!full) return false;
      return full === q || shortCustomerCode(full) === q;
    }) ?? null;
  }, [customers, debouncedSearch]);

  // The named door: the «بارودۆخی پاکەتەکان» button with its own little picker.
  const [journeyPickerOpen, setJourneyPickerOpen] = useState(false);
  const [journeyPickerQuery, setJourneyPickerQuery] = useState("");
  const [pickedJourneyCustomerId, setPickedJourneyCustomerId] = useState<number | null>(null);

  // The codes looked up most recently float to the top of the picker — the
  // owner's ask: the same few customers get checked again and again. Kept in
  // this browser only; storage that throws (private windows) costs nothing.
  const [recentJourneyIds, setRecentJourneyIds] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem("wazn-journey-recent");
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((n): n is number => typeof n === "number").slice(0, 6) : [];
    } catch {
      return [];
    }
  });
  const rememberJourney = useCallback((id: number) => {
    setRecentJourneyIds(prev => {
      const next = [id, ...prev.filter(x => x !== id)].slice(0, 6);
      try { localStorage.setItem("wazn-journey-recent", JSON.stringify(next)); } catch { /* per-browser convenience only */ }
      return next;
    });
  }, []);

  const journeyPickerList = useMemo(() => {
    if (!customers) return [] as Array<{ customer: NonNullable<typeof customers>[number]; isRecent: boolean }>;
    const q = journeyPickerQuery.trim().toLowerCase();
    if (q) {
      return customers
        .filter(c =>
          (c.customerCode ?? "").toLowerCase().includes(q) ||
          (c.fullName ?? "").toLowerCase().includes(q))
        .slice(0, 8)
        .map(customer => ({ customer, isRecent: false }));
    }
    const recents = recentJourneyIds
      .map(id => customers.find(c => c.id === id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map(customer => ({ customer, isRecent: true }));
    const rest = customers
      .filter(c => !recentJourneyIds.includes(c.id))
      .slice(0, Math.max(0, 8 - recents.length))
      .map(customer => ({ customer, isRecent: false }));
    return [...recents, ...rest];
  }, [customers, journeyPickerQuery, recentJourneyIds]);

  const pickedJourneyCustomer = useMemo(
    () => customers?.find(c => c.id === pickedJourneyCustomerId) ?? null,
    [customers, pickedJourneyCustomerId],
  );
  const journeyCustomer = pickedJourneyCustomer ?? searchMatchedCustomer;
  const [journeyDismissedFor, setJourneyDismissedFor] = useState<number | null>(null);
  // However the panel was opened — picked or typed — the code joins the
  // recents, so tomorrow it is one tap away.
  useEffect(() => {
    if (journeyCustomer) rememberJourney(journeyCustomer.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyCustomer?.id]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const code = new URLSearchParams(window.location.search).get("customer");
    if (code) setSearchInput(code);
  }, []);

  const { data: batchesRaw } = trpc.batches.list.useQuery();
  const batches = Array.isArray(batchesRaw) ? batchesRaw : batchesRaw?.data;
  const { data: categories } = trpc.productCategories.list.useQuery();

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
      const divisor = parseFloat(editVolumetricDivisor) || volumetricDivisor;
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
      // One day, when a point on the dashboard's daily chart was clicked.
      // Compared in local time, because the chart's days are local days.
      let matchesDay = true;
      if (dayFilter) {
        const d = registeredAt;
        const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        matchesDay = local === dayFilter;
      }
      return matchesBatch && matchesAlert && matchesMinWeight && matchesMaxWeight && matchesPackageType && matchesDay;
    });
  }, [packages, batchFilter, alertFilter, minWeight, maxWeight, packageTypeFilter, dayFilter]);

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
      // Everything taken in at Quick Register and not yet shipped out — the
      // day's intake. Keyed off registration rather than status so a parcel
      // stays in this view while it is being weighed, priced and batched.
      case 'registered':
        return filteredPackages.filter(p => p.status === 'registered');
      default:
        return filteredPackages;
    }
  }, [filteredPackages, activeTab]);

  // Applied after the tab split, so the counts on the control describe the tab
  // in front of you rather than the whole table.
  const {
    route: routeFilter,
    setRoute: setRouteFilter,
    counts: routeCounts,
    filtered: routedPackages,
  } = useShippingRouteFilter(tabFilteredPackages ?? [], (p: any) => p.shippingType);

  /**
   * Registrations taken in today, and the ones that cannot go any further
   * until somebody fills a gap.
   *
   * A parcel with no weight cannot be priced or batched, and one with no
   * customer sits in the depot belonging to nobody. Counting them here turns
   * the tab from a log into a list of work.
   */
  const registrationSummary = useMemo(() => {
    const all = filteredPackages ?? [];
    const registered = all.filter(p => p.status === 'registered');

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const isToday = (value: unknown) => {
      if (!value) return false;
      const d = new Date(value as string);
      return !isNaN(d.getTime()) && d >= startOfToday;
    };

    return {
      total: registered.length,
      today: registered.filter(p => isToday((p as any).registeredAt ?? p.createdAt)).length,
      missingWeight: registered.filter(p => !p.weightKg || Number(p.weightKg) <= 0).length,
      unclaimed: registered.filter(p => (p as any).isUnclaimed || !p.customerId).length,
    };
  }, [filteredPackages]);

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

  // Active-filter pills shown above the table. Each removal reuses an existing setter.
  const filterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    if (statusFilter !== "all") {
      const opt = statusOptionsFor(language).find(o => o.value === statusFilter);
      chips.push({
        id: "status",
        label: `${t("common.status")}: ${t(`status.${statusFilter}`) || opt?.label || statusFilter}`,
        onRemove: () => setStatusFilter("all"),
      });
    }
    if (shippingTypeFilter !== "all") {
      const opt = shippingTypeOptions.find(o => o.value === shippingTypeFilter);
      chips.push({
        id: "shippingType",
        label: `${t("packages.shippingType")}: ${opt?.label || shippingTypeFilter}`,
        onRemove: () => setShippingTypeFilter("all"),
      });
    }
    if (batchFilter !== "all") {
      const label = batchFilter === "no_batch"
        ? t("packages.noBatch")
        : getBatchCode(parseInt(batchFilter, 10));
      chips.push({
        id: "batch",
        label: `${t("batches.title")}: ${label}`,
        onRemove: () => setBatchFilterWithHook("all"),
      });
    }
    if (packageTypeFilter !== "all") {
      const cfg = packageTypeConfig[packageTypeFilter];
      chips.push({
        id: "packageType",
        label: `${t("packages.packageType")}: ${cfg ? t(cfg.tKey) : packageTypeFilter}`,
        onRemove: () => setPackageTypeFilter("all"),
      });
    }
    if (alertFilter !== "all") {
      const label = alertFilter === "delivered"
        ? t("packages.delivered")
        : `${alertFilter} ${t("common.days")}`;
      chips.push({
        id: "alert",
        label: `${t("packages.alertDays")}: ${label}`,
        onRemove: () => setAlertFilter("all"),
      });
    }
    if (dateFrom) {
      chips.push({
        id: "dateFrom",
        label: `${t("common.fromDate")}: ${format(dateFrom, "yyyy-MM-dd")}`,
        onRemove: () => setDateFrom(undefined),
      });
    }
    if (dateTo) {
      chips.push({
        id: "dateTo",
        label: `${t("common.toDate")}: ${format(dateTo, "yyyy-MM-dd")}`,
        onRemove: () => setDateTo(undefined),
      });
    }
    if (minWeight !== "") {
      chips.push({
        id: "minWeight",
        label: `${t("packages.minWeight")}: ${minWeight}`,
        onRemove: () => setMinWeight(""),
      });
    }
    if (maxWeight !== "") {
      chips.push({
        id: "maxWeight",
        label: `${t("packages.maxWeight")}: ${maxWeight}`,
        onRemove: () => setMaxWeight(""),
      });
    }
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, shippingTypeFilter, batchFilter, packageTypeFilter, alertFilter, dateFrom, dateTo, minWeight, maxWeight, t, batches]);

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
    setEditVolumetricDivisor(String(volumetricDivisor));
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

  // The per-row label print left with its button — the owner's call: not
  // needed on this table for now. Git remembers the label HTML if it comes
  // back as its own feature.

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
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 p-4 text-white">
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-white/10" />
          <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-white/10" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white/20 rounded-xl">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">{t('packages.title')}</h1>
                <p className="text-white/75 text-xs">{t('packages.subtitle')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0" onClick={exportToExcel}>
                <Download className="h-4 w-4 me-2" />
                {t('common.exportExcel')}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-white dark:bg-card text-blue-600 dark:text-blue-300 hover:bg-white/90">
                    <Plus className="h-4 w-4 me-2" />
                    {t('packages.registerPackage')}
                    <ChevronDown className="h-4 w-4 ms-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => setLocation("/packages/quick-register")}>
                    <Zap className="h-4 w-4 me-2 text-amber-500 dark:text-amber-400" />
                    <div>
                      <div className="font-medium">{t('packages.quickRegister')}</div>
                      <div className="text-xs text-muted-foreground">{t('packages.quickRegisterDescription')}</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation("/packages/bulk-register")}>
                    <Layers className="h-4 w-4 me-2 text-purple-500 dark:text-purple-400" />
                    <div>
                      <div className="font-medium">{t('packages.bulkRegister')}</div>
                      <div className="text-xs text-muted-foreground">{t('packages.bulkRegisterDescription')}</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLocation("/packages/unclaimed")}>
                    <AlertTriangle className="h-4 w-4 me-2 text-amber-500 dark:text-amber-400" />
                    <div>
                      <div className="font-medium">{t('packages.unclaimedPackages')}</div>
                      <div className="text-xs text-muted-foreground">{t('packages.unclaimedDescription')}</div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {/* One slim chip row instead of two grids of tiles — the owner's
              note: the header ate a third of the screen. Every old tile's
              action and warning colour survives as a chip; only the bulk is
              gone. Wraps on narrow screens. */}
          <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs backdrop-blur transition-all hover:bg-white/20 ${activeTab === 'all' ? 'ring-2 ring-white' : ''}`}
            >
              <Package className="h-3.5 w-3.5 text-white/70" />
              <span className="text-white/80">{t('common.all')}</span>
              <span className="text-sm font-bold tabular-nums">{stats.total}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('no_batch')}
              title={stats.noBatch > 0 ? t('packages.needsBatch') : undefined}
              className={`flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs backdrop-blur transition-all hover:bg-white/20 ${activeTab === 'no_batch' ? 'ring-2 ring-white' : ''}`}
            >
              <PackageX className="h-3.5 w-3.5 text-amber-300" />
              <span className="text-white/80">{t('packages.noBatch')}</span>
              <span className={`text-sm font-bold tabular-nums ${stats.noBatch > 0 ? 'text-amber-300' : ''}`}>{stats.noBatch}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('no_tracking')}
              title={stats.noTracking > 0 ? t('packages.noTrackingWarning') : undefined}
              className={`flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs backdrop-blur transition-all hover:bg-white/20 ${activeTab === 'no_tracking' ? 'ring-2 ring-white' : ''}`}
            >
              <Link2Off className="h-3.5 w-3.5 text-red-300" />
              <span className="text-white/80">{t('packages.noTracking')}</span>
              <span className={`text-sm font-bold tabular-nums ${stats.noTracking > 0 ? 'text-red-300' : ''}`}>{stats.noTracking}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pending_delivery')}
              className={`flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs backdrop-blur transition-all hover:bg-white/20 ${activeTab === 'pending_delivery' ? 'ring-2 ring-white' : ''}`}
            >
              <Truck className="h-3.5 w-3.5 text-cyan-300" />
              <span className="text-white/80">{t('packages.pendingDelivery')}</span>
              <span className="text-sm font-bold tabular-nums">{stats.pendingDelivery}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('delivered')}
              className={`flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs backdrop-blur transition-all hover:bg-white/20 ${activeTab === 'delivered' ? 'ring-2 ring-white' : ''}`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-green-300" />
              <span className="text-white/80">{t('packages.delivered')}</span>
              <span className="text-sm font-bold tabular-nums">{stats.delivered}</span>
            </button>
            {/* Sends you to the registrations page rather than switching a
                tab here: that page has the photos and who-entered-what. */}
            <button
              type="button"
              onClick={() => setLocation('/packages/registrations')}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs backdrop-blur transition-all hover:bg-white/20"
            >
              <PackagePlus className="h-3.5 w-3.5 text-teal-300" />
              <span className="text-white/80">{t('packages.registrations')}</span>
              <span className="text-sm font-bold tabular-nums">{registrationSummary.total}</span>
              <span className="text-[10px] text-white/60">
                {t('packages.registeredToday')} {registrationSummary.today}
              </span>
              {registrationSummary.missingWeight > 0 && (
                <span className="text-[10px] text-amber-300">
                  {t('packages.noWeightShort')} {registrationSummary.missingWeight}
                </span>
              )}
              {registrationSummary.unclaimed > 0 && (
                <span className="text-[10px] text-amber-300">
                  {t('packages.unclaimedShort')} {registrationSummary.unclaimed}
                </span>
              )}
            </button>

            <span className="mx-1 h-5 w-px bg-white/20" />

            <button
              type="button"
              onClick={() => setPackageTypeFilter(packageTypeFilter === 'regular' ? 'all' : 'regular')}
              className={`flex items-center gap-1.5 rounded-lg bg-slate-600/30 px-3 py-1.5 text-xs backdrop-blur transition-all hover:bg-slate-600/50 ${packageTypeFilter === 'regular' ? 'ring-2 ring-slate-300' : ''}`}
            >
              <span>📦</span>
              <span className="text-white/80">{t('packages.regular')}</span>
              <span className="text-sm font-bold tabular-nums">{stats.regular}</span>
            </button>
            <button
              type="button"
              onClick={() => setPackageTypeFilter(packageTypeFilter === 'full_package' ? 'all' : 'full_package')}
              className={`flex items-center gap-1.5 rounded-lg bg-purple-600/30 px-3 py-1.5 text-xs backdrop-blur transition-all hover:bg-purple-600/50 ${packageTypeFilter === 'full_package' ? 'ring-2 ring-purple-300' : ''}`}
            >
              <span>📦</span>
              <span className="text-white/80">{t('packages.fullPackage')}</span>
              <span className="text-sm font-bold tabular-nums">{stats.fullPackage}</span>
            </button>
            <button
              type="button"
              onClick={() => setPackageTypeFilter(packageTypeFilter === 'commission' ? 'all' : 'commission')}
              className={`flex items-center gap-1.5 rounded-lg bg-orange-600/30 px-3 py-1.5 text-xs backdrop-blur transition-all hover:bg-orange-600/50 ${packageTypeFilter === 'commission' ? 'ring-2 ring-orange-300' : ''}`}
            >
              <span>💰</span>
              <span className="text-white/80">{t('packages.commission')}</span>
              <span className="text-sm font-bold tabular-nums">{stats.commission}</span>
            </button>
          </div>
        </div>

        {/* The customer-journey lookup: search a customer code and the five
            stations answer before the table does. */}
        {journeyCustomer && journeyDismissedFor !== journeyCustomer.id && (
          <CustomerJourneyPanel
            customerId={journeyCustomer.id}
            customerCode={shortCustomerCode(journeyCustomer.customerCode)}
            customerName={journeyCustomer.fullName ?? null}
            onClose={() => {
              setPickedJourneyCustomerId(null);
              setJourneyDismissedFor(journeyCustomer.id);
            }}
          />
        )}

        <Card>
          <CardHeader>
            <div className="space-y-4">
              {/* Why the table arrived short, when it came from a chart point */}
              <FilteredByLinkBanner
                filters={dayFilter ? [{ ku: `تۆمارکراو لە ${dayFilter}`, en: `Registered on ${dayFilter}`, ar: `مسجلة في ${dayFilter}`, zh: `登记于 ${dayFilter}` }] : []}
                onClear={() => {
                  setDayFilter(undefined);
                  if (typeof window !== "undefined") {
                    history.replaceState(null, "", window.location.pathname);
                  }
                }}
              />

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
                {/* The journey lookup's named, visible door — beside the
                    filters, not hidden inside the search box's behaviour. */}
                <div className="relative">
                  <Button
                    variant={journeyCustomer ? "default" : "outline"}
                    onClick={() => setJourneyPickerOpen(o => !o)}
                    className="relative"
                  >
                    <PackageSearch className="h-4 w-4 me-2" />
                    {pickLang(language, { ku: "بارودۆخی پاکەتەکان", en: "Package status", ar: "حالة الطرود", zh: "包裹状态" })}
                    {journeyCustomer && (
                      <Badge className="ms-2" variant="secondary">
                        <span dir="ltr">{shortCustomerCode(journeyCustomer.customerCode)}</span>
                      </Badge>
                    )}
                  </Button>
                  {journeyPickerOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setJourneyPickerOpen(false)} />
                      <div className="absolute start-0 top-full z-50 mt-2 w-80 rounded-xl border bg-card p-2 shadow-xl">
                        <Input
                          autoFocus
                          placeholder={pickLang(language, { ku: "کۆد یان ناوی کڕیار بنووسە…", en: "Type a customer code or name…", ar: "اكتب كود أو اسم العميل…", zh: "输入客户代码或姓名…" })}
                          value={journeyPickerQuery}
                          onChange={(e) => setJourneyPickerQuery(e.target.value)}
                        />
                        <div className="mt-1 max-h-64 overflow-y-auto">
                          {journeyPickerList.length === 0 ? (
                            <p className="p-3 text-center text-sm text-muted-foreground">
                              {pickLang(language, { ku: "هیچ کڕیارێک نەدۆزرایەوە", en: "No customer found", ar: "لم يُعثر على عميل", zh: "未找到客户" })}
                            </p>
                          ) : (
                            <>
                              {journeyPickerList[0]?.isRecent && (
                                <p className="px-3 pb-1 pt-2 text-[10px] font-bold text-muted-foreground">
                                  {pickLang(language, { ku: "دوایین گەڕانەکان", en: "Recent lookups", ar: "آخر عمليات البحث", zh: "最近查询" })}
                                </p>
                              )}
                              {journeyPickerList.map(({ customer: c, isRecent }, i) => (
                                <div key={c.id}>
                                  {/* The line between yesterday's codes and the rest */}
                                  {i > 0 && isRecent === false && journeyPickerList[i - 1]?.isRecent && (
                                    <div className="mx-3 my-1 h-px bg-border" />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPickedJourneyCustomerId(c.id);
                                      setJourneyDismissedFor(null);
                                      setJourneyPickerOpen(false);
                                      setJourneyPickerQuery("");
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm hover:bg-muted"
                                  >
                                    {isRecent && <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                                    <span dir="ltr" className="font-mono font-semibold">{shortCustomerCode(c.customerCode)}</span>
                                    <span className="truncate text-muted-foreground">{c.fullName}</span>
                                  </button>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <ShippingRouteFilter
                  value={routeFilter}
                  onChange={setRouteFilter}
                  counts={routeCounts}
                />
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
                        {statusOptionsFor(language).map(opt => (
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
            {filterChips.length > 0 && (
              <FilterChips chips={filterChips} onClearAll={clearAllFilters} className="mb-4" />
            )}
            {/* Dense on purpose: every column visible without a horizontal
                scroll — the owner's ask off the live screen. */}
            <Table className="text-xs [&_th]:px-2 [&_th]:whitespace-nowrap [&_td]:px-2 [&_td]:py-2">
              <TableHeader>
                <TableRow>
                  <TableHead>{pickLang(language, { ku: "ئۆردەر نەمبەر", en: "Order no.", ar: "رقم الطلب", zh: "订单号" })}</TableHead>
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
                {isLoadingPackages ? (
                  <TableRow>
                    <TableCell colSpan={12} className="p-4">
                      <TableSkeleton rows={6} cols={6} />
                    </TableCell>
                  </TableRow>
                ) : (
                  routedPackages.map((pkg) => (
                    <PackageTableRow
                      key={pkg.id}
                      pkg={pkg as Package}
                      getCustomerName={getCustomerName}
                      getCustomerCode={getCustomerCode}
                      getBatchCode={getBatchCode}
                      onStatusChange={onStatusChange}
                      onView={handleViewClick}
                      onEdit={handleEditClick}
                      divisor={volumetricDivisor}
                      language={language}
                      t={t}
                    />
                  ))
                )}
                {!isLoadingPackages && routedPackages.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="p-4">
                      <EmptyState
                        icon={<Package />}
                        title={t("packages.noPackages") || "هیچ پاکەتێک نییە"}
                        description={
                          activeFiltersCount > 0
                            ? t("common.tryClearingFilters") || "هەوڵبدە فلتەرەکان پاک بکەیتەوە"
                            : undefined
                        }
                        action={
                          activeFiltersCount > 0 ? (
                            <Button variant="outline" onClick={clearAllFilters}>
                              <X className="h-4 w-4 me-1" />
                              {t("common.clear") || "پاککردنەوە"}
                            </Button>
                          ) : (
                            <Button variant="outline" onClick={() => setLocation("/packages/quick-register")}>
                              <Plus className="h-4 w-4 me-2" />
                              {t("packages.registerPackage") || "تۆمارکردنی پاکەت"}
                            </Button>
                          )
                        }
                      />
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
                {statusOptionsFor(language).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${statusDot(option.value, "package")}`} />
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
                  {editShippingType === "sea" ? <Ship className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" /> : <Plane className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />}
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
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-300 shrink-0" />
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
                        step="1"
                        className="w-28 h-7 text-xs"
                        placeholder={String(volumetricDivisor)}
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
                    {statusLabel(viewPackage.status, language)}
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
                    <User className="h-4 w-4 text-blue-500 dark:text-blue-400" />
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
                    <Hash className="h-4 w-4 text-green-500 dark:text-green-400" />
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
                          <Plane className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                        ) : (
                          <Ship className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
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
                    <Weight className="h-4 w-4 text-amber-500 dark:text-amber-400" />
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
                    <DollarSign className="h-4 w-4 text-green-500 dark:text-green-400" />
                    {t("packages.costAndDates")}
                  </Label>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{t("packages.calculatedCost")}</p>
                      <p className="font-bold text-xl text-green-600 dark:text-green-300 tabular-nums">${Number(viewPackage.calculatedCostUsd || 0).toFixed(2)}</p>
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
                          return <Badge variant="outline" className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/60 mt-1">✅ {t("packages.delivered")}</Badge>;
                        } else if (daysSince > 20) {
                          return <Badge variant="destructive" className="mt-1">🔴 {t("packages.danger")} - {daysSince} {t("common.days")}</Badge>;
                        } else if (daysSince > 10) {
                          return <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 mt-1">⚠️ {t("packages.warning")} - {daysSince} {t("common.days")}</Badge>;
                        } else {
                          return <Badge variant="outline" className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/60 mt-1">✅ {t("packages.normal")} - {daysSince} {t("common.days")}</Badge>;
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
                      <FileText className="h-4 w-4 text-purple-500 dark:text-purple-400" />
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
