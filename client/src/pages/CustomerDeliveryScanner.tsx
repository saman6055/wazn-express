import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Package, Box, Truck, MapPin, Search, Plus, X, Check,
  Printer, Ban, ChevronDown, ScanBarcode, Weight, DollarSign,
  User, Phone, Building2, Hash, Loader2, ArrowRight, Lock,
  Eye, FileText, Home, Warehouse, Filter
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useTranslation } from "@/contexts/LanguageContext";
import { soundManager } from "@/lib/soundManager";
import { cn } from "@/lib/utils";
import { printBoxLabel, printBoxReceipt } from "@/lib/deliveryBoxPrintUtils";

// ==================== TYPES ====================

type DeliveryMethod = "warehouse_pickup" | "home_delivery" | "city_transfer";
type BoxStatus = "open" | "ready" | "in_transit" | "delivered" | "cancelled";

// ==================== STATUS HELPERS ====================

const STATUS_STYLES: Record<BoxStatus, { bg: string; text: string }> = {
  open: { bg: "bg-green-100", text: "text-green-800" },
  ready: { bg: "bg-blue-100", text: "text-blue-800" },
  in_transit: { bg: "bg-orange-100", text: "text-orange-800" },
  delivered: { bg: "bg-gray-100", text: "text-gray-800" },
  cancelled: { bg: "bg-red-100", text: "text-red-800" },
};

const STATUS_LABEL_KEYS: Record<BoxStatus, string> = {
  open: "delivery.statusOpen",
  ready: "delivery.statusReady",
  in_transit: "delivery.statusInTransit",
  delivered: "delivery.statusDelivered",
  cancelled: "delivery.statusCancelled",
};

const DELIVERY_METHOD_KEYS: Record<DeliveryMethod, string> = {
  warehouse_pickup: "delivery.methodPickup",
  home_delivery: "delivery.methodHomeDelivery",
  city_transfer: "delivery.methodCityTransfer",
};

const ITEM_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  regular: { bg: "bg-slate-100", text: "text-slate-700" },
  full_package: { bg: "bg-purple-100", text: "text-purple-700" },
  commission: { bg: "bg-amber-100", text: "text-amber-700" },
};

const ITEM_TYPE_LABEL_KEYS: Record<string, string> = {
  regular: "delivery.typeRegular",
  full_package: "delivery.typeFullPackage",
  commission: "delivery.typeCommission",
};

// ==================== STATUS BADGE ====================

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const styles = STATUS_STYLES[status as BoxStatus] || STATUS_STYLES.open;
  const labelKey = STATUS_LABEL_KEYS[status as BoxStatus] || STATUS_LABEL_KEYS.open;
  return (
    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", styles.bg, styles.text)}>
      {t(labelKey)}
    </span>
  );
}

// ==================== MAIN COMPONENT ====================

export default function CustomerDeliveryScanner() {
  const { t, language } = useTranslation();
  const isRtl = language === "ku" || language === "ar";
  const utils = trpc.useUtils();

  // ---- State ----
  const [activeBoxId, setActiveBoxId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Create form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("warehouse_pickup");
  const [destinationCity, setDestinationCity] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryCost, setDeliveryCost] = useState("0");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [notes, setNotes] = useState("");

  // Scan state
  const [scanInput, setScanInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  // Sidebar filter state
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [sidebarStatusFilter, setSidebarStatusFilter] = useState<"all" | BoxStatus>("all");

  // ---- Queries ----
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: todayBoxes, refetch: refetchBoxes } = trpc.deliveryBox.list.useQuery({
    startDate: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
    endDate: new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
    limit: 100,
  });
  const { data: activeBoxData, refetch: refetchActiveBox } = trpc.deliveryBox.getById.useQuery(
    { id: activeBoxId! },
    { enabled: !!activeBoxId, refetchInterval: 5000 }
  );

  // ---- Mutations ----
  const createBox = trpc.deliveryBox.create.useMutation({
    onSuccess: (box) => {
      toast.success(t("delivery.toastBoxCreated") + " " + box.boxCode);
      soundManager.playSuccess();
      setActiveBoxId(box.id);
      setShowCreateForm(false);
      resetCreateForm();
      refetchBoxes();
    },
    onError: (err) => {
      toast.error(err.message);
      soundManager.playError();
    },
  });

  const addItem = trpc.deliveryBox.addItem.useMutation({
    onSuccess: (data) => {
      toast.success(`${t("delivery.toastItemAdded")} ${data.item.trackingNumber}`);
      soundManager.playBeep();
      setScanInput("");
      refetchActiveBox();
      refetchBoxes();
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
      refetchActiveBox();
      refetchBoxes();
    },
    onError: (err) => toast.error(err.message),
  });

  const sealBox = trpc.deliveryBox.seal.useMutation({
    onSuccess: () => {
      toast.success(t("delivery.toastBoxSealed"));
      soundManager.playComplete();
      refetchActiveBox();
      refetchBoxes();
    },
    onError: (err) => toast.error(err.message),
  });

  const markInTransit = trpc.deliveryBox.markInTransit.useMutation({
    onSuccess: () => {
      toast.success(t("delivery.toastBoxInTransit"));
      soundManager.playSuccess();
      refetchActiveBox();
      refetchBoxes();
    },
    onError: (err) => toast.error(err.message),
  });

  const markDelivered = trpc.deliveryBox.markDelivered.useMutation({
    onSuccess: () => {
      toast.success(t("delivery.toastBoxDelivered"));
      soundManager.playComplete();
      refetchActiveBox();
      refetchBoxes();
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelBox = trpc.deliveryBox.cancel.useMutation({
    onSuccess: () => {
      toast.success(t("delivery.toastBoxCancelled"));
      setActiveBoxId(null);
      refetchBoxes();
    },
    onError: (err) => toast.error(err.message),
  });

  // ---- Helpers ----
  const resetCreateForm = useCallback(() => {
    setSelectedCustomerId(null);
    setCustomerSearch("");
    setDeliveryMethod("warehouse_pickup");
    setDestinationCity("");
    setDestinationAddress("");
    setRecipientPhone("");
    setDeliveryCost("0");
    setDeliveryCharge("0");
    setNotes("");
  }, []);

  const filteredCustomers = (customers ?? []).filter((c: any) => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return (
      c.fullName?.toLowerCase().includes(q) ||
      c.customerCode?.toLowerCase().includes(q) ||
      c.mobileNumber?.includes(q)
    );
  }).slice(0, 15);

  const selectedCustomer = (customers ?? []).find((c: any) => c.id === selectedCustomerId);

  const handleCreateBox = () => {
    if (!selectedCustomerId) {
      toast.error(t("delivery.toastSelectCustomer"));
      return;
    }
    createBox.mutate({
      customerId: selectedCustomerId,
      deliveryMethod,
      destinationCity: deliveryMethod === "city_transfer" ? destinationCity : undefined,
      destinationAddress: deliveryMethod !== "warehouse_pickup" ? destinationAddress : undefined,
      recipientPhone: deliveryMethod !== "warehouse_pickup" ? recipientPhone : undefined,
      deliveryCostUsd: deliveryCost,
      deliveryChargeUsd: deliveryCharge,
      notes: notes || undefined,
    });
  };

  const handleScan = () => {
    const tracking = scanInput.trim();
    if (!tracking || !activeBoxId) return;
    setIsScanning(true);
    addItem.mutate(
      { boxId: activeBoxId, trackingNumber: tracking },
      { onSettled: () => setIsScanning(false) }
    );
  };

  const handleScanKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan();
    }
  };

  // Auto-focus scan input when active box changes
  useEffect(() => {
    if (activeBoxId && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [activeBoxId]);

  // ---- Computed stats ----
  const boxes = todayBoxes?.boxes ?? [];
  const totalBoxesToday = boxes.length;
  const packagesDelivered = boxes
    .filter((b: any) => b.status === "delivered")
    .reduce((sum: number, b: any) => sum + (b.totalPackages || 0), 0);
  const totalValue = boxes.reduce(
    (sum: number, b: any) => sum + Number(b.totalValueUsd || 0) + Number(b.deliveryChargeUsd || 0),
    0
  );

  const box = activeBoxData;
  const boxItems = box?.items ?? [];
  const boxStatus = (box?.status ?? "open") as BoxStatus;
  const isBoxOpen = boxStatus === "open";
  const isBoxReady = boxStatus === "ready";
  const isBoxInTransit = boxStatus === "in_transit";
  const isBoxDelivered = boxStatus === "delivered";
  const isBoxCancelled = boxStatus === "cancelled";
  const isViewOnly = isBoxDelivered || isBoxCancelled;

  // Helper: resolve customer name from customers list
  const getCustomerName = useCallback((customerId: number) => {
    const c = (customers ?? []).find((c: any) => c.id === customerId);
    return c ? c.fullName : null;
  }, [customers]);

  const getCustomerObj = useCallback((customerId: number) => {
    return (customers ?? []).find((c: any) => c.id === customerId) ?? null;
  }, [customers]);

  // Filtered sidebar boxes
  const filteredSidebarBoxes = useMemo(() => {
    let result = boxes;
    // Status filter
    if (sidebarStatusFilter !== "all") {
      result = result.filter((b: any) => b.status === sidebarStatusFilter);
    }
    // Search filter
    if (sidebarSearch.trim()) {
      const q = sidebarSearch.toLowerCase();
      result = result.filter((b: any) => {
        const customerName = getCustomerName(b.customerId)?.toLowerCase() || "";
        return (
          b.boxCode?.toLowerCase().includes(q) ||
          customerName.includes(q) ||
          b.destinationCity?.toLowerCase().includes(q)
        );
      });
    }
    return result;
  }, [boxes, sidebarStatusFilter, sidebarSearch, getCustomerName]);

  // Sidebar status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: boxes.length };
    for (const b of boxes) {
      counts[(b as any).status] = (counts[(b as any).status] || 0) + 1;
    }
    return counts;
  }, [boxes]);

  // Delivery method icon component
  const DeliveryMethodIcon = ({ method, className }: { method: string; className?: string }) => {
    if (method === "home_delivery") return <Home className={className} />;
    if (method === "city_transfer") return <Truck className={className} />;
    return <Warehouse className={className} />;
  };

  // Print handlers
  const handlePrintLabel = useCallback(() => {
    if (!box) return;
    const customer = getCustomerObj(box.customerId);
    printBoxLabel(box as any, boxItems, customer, t);
  }, [box, boxItems, getCustomerObj, t]);

  const handlePrintReceipt = useCallback(() => {
    if (!box) return;
    const customer = getCustomerObj(box.customerId);
    printBoxReceipt(box as any, boxItems, customer, t);
  }, [box, boxItems, getCustomerObj, t]);

  // ==================== RENDER ====================

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6" dir="rtl">
        {/* Page Header */}
        <PageHeader
          icon={Truck}
          title={t("delivery.pageTitle")}
          subtitle={t("delivery.pageSubtitle")}
          variant="gradient"
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-white shadow-sm p-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Box className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t("delivery.todayBoxes")}</p>
              <p className="text-2xl font-bold">{totalBoxesToday}</p>
            </div>
          </div>
          <div className="rounded-xl bg-white shadow-sm p-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t("delivery.packagesDelivered")}</p>
              <p className="text-2xl font-bold">{packagesDelivered}</p>
            </div>
          </div>
          <div className="rounded-xl bg-white shadow-sm p-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t("delivery.totalValue")}</p>
              <p className="text-2xl font-bold">${totalValue.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Two Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ======== LEFT PANEL: Active Box ======== */}
          <div className="lg:col-span-2 space-y-4">
            {/* Create Box or Active Box */}
            {!activeBoxId && !showCreateForm && (
              <div className="rounded-xl bg-white shadow-sm p-8 text-center space-y-4">
                <Box className="h-16 w-16 mx-auto text-gray-300" />
                <p className="text-gray-500 text-lg">{t("delivery.noActiveBox")}</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 inline-flex items-center gap-2 font-medium"
                >
                  <Plus className="h-5 w-5" />
                  {t("delivery.createNewBox")}
                </button>
              </div>
            )}

            {/* ---- CREATE BOX FORM ---- */}
            {showCreateForm && !activeBoxId && (
              <div className="rounded-xl bg-white shadow-sm p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Plus className="h-5 w-5 text-emerald-600" />
                    {t("delivery.createBoxTitle")}
                  </h3>
                  <button onClick={() => { setShowCreateForm(false); resetCreateForm(); }} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Customer Search */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("delivery.customer")}</label>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={selectedCustomer ? `${selectedCustomer.customerCode} - ${selectedCustomer.fullName}` : customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setSelectedCustomerId(null);
                        setShowCustomerDropdown(true);
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      placeholder={t("delivery.searchCustomerPlaceholder")}
                      className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  {showCustomerDropdown && filteredCustomers.length > 0 && !selectedCustomerId && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredCustomers.map((c: any) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomerId(c.id);
                            setCustomerSearch("");
                            setShowCustomerDropdown(false);
                            // Auto-fill from customer profile
                            if (c.mobileNumber) setRecipientPhone(c.mobileNumber);
                            if (c.address) setDestinationAddress(c.address);
                            if (c.city) setDestinationCity(c.city);
                          }}
                          className="w-full text-right px-4 py-2.5 hover:bg-emerald-50 flex items-center gap-3 border-b border-gray-50 last:border-0"
                        >
                          <User className="h-4 w-4 text-gray-400 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-medium text-sm">{c.customerCode}</span>
                            <span className="text-gray-500 text-sm mx-2">-</span>
                            <span className="text-sm">{c.fullName}</span>
                            {c.mobileNumber && (
                              <span className="text-xs text-gray-400 mr-2">{c.mobileNumber}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Delivery Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t("delivery.deliveryMethod")}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["warehouse_pickup", "home_delivery", "city_transfer"] as DeliveryMethod[]).map((method) => (
                      <button
                        key={method}
                        onClick={() => {
                          setDeliveryMethod(method);
                          if (method === "warehouse_pickup") {
                            setDeliveryCost("0");
                            setDeliveryCharge("0");
                          }
                        }}
                        className={cn(
                          "px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                          deliveryMethod === method
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                        )}
                      >
                        {t(DELIVERY_METHOD_KEYS[method])}
                      </button>
                    ))}
                  </div>
                </div>

                {/* City Transfer Fields */}
                {deliveryMethod === "city_transfer" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("delivery.city")}</label>
                      <div className="relative">
                        <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={destinationCity}
                          onChange={(e) => setDestinationCity(e.target.value)}
                          placeholder={t("delivery.cityPlaceholder")}
                          className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("delivery.phoneNumber")}</label>
                      <div className="relative">
                        <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(e.target.value)}
                          placeholder="07xxxxxxxxx"
                          className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("delivery.address")}</label>
                      <input
                        type="text"
                        value={destinationAddress}
                        onChange={(e) => setDestinationAddress(e.target.value)}
                        placeholder={t("delivery.fullAddressPlaceholder")}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Home delivery fields */}
                {deliveryMethod === "home_delivery" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("delivery.phoneNumber")}</label>
                      <div className="relative">
                        <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(e.target.value)}
                          placeholder="07xxxxxxxxx"
                          className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("delivery.address")}</label>
                      <input
                        type="text"
                        value={destinationAddress}
                        onChange={(e) => setDestinationAddress(e.target.value)}
                        placeholder={t("delivery.homeAddressPlaceholder")}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Cost & Charge - only for non-warehouse pickup */}
                {deliveryMethod !== "warehouse_pickup" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("delivery.costForCompany")}</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={deliveryCost}
                        onChange={(e) => setDeliveryCost(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("delivery.chargeForCustomer")}</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={deliveryCharge}
                        onChange={(e) => setDeliveryCharge(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("delivery.notes")}</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("delivery.notesPlaceholder")}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                  />
                </div>

                {/* Create Button */}
                <button
                  onClick={handleCreateBox}
                  disabled={!selectedCustomerId || createBox.isPending}
                  className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                >
                  {createBox.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                  {t("delivery.createBox")}
                </button>
              </div>
            )}

            {/* ---- ACTIVE BOX VIEW ---- */}
            {activeBoxId && box && (
              <div className="space-y-4">
                {/* Box Info Card */}
                <div className="rounded-xl bg-white shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <Box className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{box.boxCode}</h3>
                        <p className="text-sm text-gray-500">
                          {t(DELIVERY_METHOD_KEYS[box.deliveryMethod as DeliveryMethod] || "delivery.methodPickup")}
                          {box.destinationCity && ` - ${box.destinationCity}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={box.status} />
                      <button
                        onClick={() => setActiveBoxId(null)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                        title={t("delivery.close")}
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Customer info row */}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                    <span className="flex items-center gap-1.5">
                      <User className="h-4 w-4 text-gray-400" />
                      {(box as any).customerName || `${t("delivery.customer")} #${box.customerId}`}
                    </span>
                    {box.recipientPhone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-4 w-4 text-gray-400" />
                        {box.recipientPhone}
                      </span>
                    )}
                    {box.destinationAddress && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        {box.destinationAddress}
                      </span>
                    )}
                  </div>
                </div>

                {/* Scan Input */}
                {isBoxOpen && (
                  <div className="rounded-xl bg-white shadow-sm p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t("delivery.scanPackage")}</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <ScanBarcode className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          ref={scanInputRef}
                          type="text"
                          value={scanInput}
                          onChange={(e) => setScanInput(e.target.value)}
                          onKeyDown={handleScanKeyDown}
                          placeholder={t("delivery.scanPlaceholder")}
                          disabled={isScanning}
                          className="w-full pr-11 pl-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-lg"
                          autoFocus
                        />
                      </div>
                      <button
                        onClick={handleScan}
                        disabled={!scanInput.trim() || isScanning}
                        className="px-5 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isScanning ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Plus className="h-5 w-5" />
                        )}
                        {t("delivery.add")}
                      </button>
                    </div>
                  </div>
                )}

                {/* Items Table */}
                <div className="rounded-xl bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h4 className="font-medium text-gray-700 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      {t("delivery.packages")} ({boxItems.length})
                    </h4>
                    {!isViewOnly && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handlePrintLabel}
                          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                          title={t("delivery.printLabel")}
                        >
                          <Printer className="h-4 w-4" />
                          {t("delivery.printLabel")}
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={handlePrintReceipt}
                          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                          title={t("delivery.receipt")}
                        >
                          <FileText className="h-4 w-4" />
                          {t("delivery.receipt")}
                        </button>
                      </div>
                    )}
                  </div>
                  {boxItems.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>{t("delivery.noItems")}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">#</th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">{t("delivery.tracking")}</th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">{t("delivery.type")}</th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">{t("delivery.weight")}</th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">{t("delivery.price")}</th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">{t("delivery.source")}</th>
                            {isBoxOpen && (
                              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 w-12"></th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {boxItems.map((item: any, idx: number) => {
                            const typeStyles = ITEM_TYPE_STYLES[item.itemType] || ITEM_TYPE_STYLES.regular;
                            const typeLabelKey = ITEM_TYPE_LABEL_KEYS[item.itemType] || ITEM_TYPE_LABEL_KEYS.regular;
                            return (
                              <tr key={item.id} className="hover:bg-gray-50/50">
                                <td className="px-4 py-2.5 text-sm text-gray-500">{idx + 1}</td>
                                <td className="px-4 py-2.5 text-sm font-mono font-medium">{item.trackingNumber}</td>
                                <td className="px-4 py-2.5">
                                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", typeStyles.bg, typeStyles.text)}>
                                    {t(typeLabelKey)}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-sm">{Number(item.weightKg || 0).toFixed(2)} kg</td>
                                <td className="px-4 py-2.5 text-sm font-medium">${Number(item.calculatedCostUsd || 0).toFixed(2)}</td>
                                <td className="px-4 py-2.5 text-sm text-gray-500">{item.sourceInfo || "-"}</td>
                                {isBoxOpen && (
                                  <td className="px-4 py-2.5">
                                    <button
                                      onClick={() => removeItem.mutate({ itemId: item.id })}
                                      className="text-red-400 hover:text-red-600 p-1"
                                      title={t("delivery.remove")}
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Box Totals */}
                <div className="rounded-xl bg-white shadow-sm p-5">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">{t("delivery.packageCount")}</p>
                      <p className="text-xl font-bold text-gray-800">{box.totalPackages || 0}</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">{t("delivery.totalWeight")}</p>
                      <p className="text-xl font-bold text-gray-800">{Number(box.totalWeightKg || 0).toFixed(2)}<span className="text-xs font-normal mr-1">kg</span></p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">{t("delivery.packageValue")}</p>
                      <p className="text-xl font-bold text-gray-800">${Number(box.totalValueUsd || 0).toFixed(2)}</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">{t("delivery.deliveryCharge")}</p>
                      <p className="text-xl font-bold text-emerald-600">${Number(box.deliveryChargeUsd || 0).toFixed(2)}</p>
                    </div>
                    <div className="text-center p-3 bg-emerald-50 rounded-lg sm:col-span-1 col-span-2">
                      <p className="text-xs text-emerald-600 mb-1">{t("delivery.grandTotal")}</p>
                      <p className="text-xl font-bold text-emerald-700">
                        ${(Number(box.totalValueUsd || 0) + Number(box.deliveryChargeUsd || 0)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="rounded-xl bg-white shadow-sm p-5">
                  <div className="flex flex-wrap gap-3">
                    {/* Seal Button - only when open */}
                    {isBoxOpen && (
                      <button
                        onClick={() => {
                          if (boxItems.length === 0) {
                            toast.error(t("delivery.toastBoxEmpty"));
                            return;
                          }
                          sealBox.mutate({ id: activeBoxId! });
                        }}
                        disabled={sealBox.isPending}
                        className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-medium"
                      >
                        {sealBox.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                        {t("delivery.seal")}
                      </button>
                    )}

                    {/* In Transit Button - only when ready */}
                    {isBoxReady && (
                      <button
                        onClick={() => markInTransit.mutate({ id: activeBoxId! })}
                        disabled={markInTransit.isPending}
                        className="px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2 font-medium"
                      >
                        {markInTransit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                        {t("delivery.sendInTransit")}
                      </button>
                    )}

                    {/* Delivered Button - when in_transit */}
                    {isBoxInTransit && (
                      <button
                        onClick={() => markDelivered.mutate({ id: activeBoxId! })}
                        disabled={markDelivered.isPending}
                        className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 font-medium"
                      >
                        {markDelivered.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {t("delivery.markDelivered")}
                      </button>
                    )}

                    {/* Cancel Button - when not delivered/cancelled */}
                    {!isViewOnly && (
                      <button
                        onClick={() => {
                          if (window.confirm(t("delivery.confirmCancel"))) {
                            cancelBox.mutate({ id: activeBoxId! });
                          }
                        }}
                        disabled={cancelBox.isPending}
                        className="px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 flex items-center gap-2 font-medium"
                      >
                        {cancelBox.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                        {t("delivery.cancel")}
                      </button>
                    )}

                    {/* Print buttons */}
                    <div className="flex items-center gap-2 mr-auto">
                      <button
                        onClick={handlePrintLabel}
                        className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 font-medium"
                      >
                        <Printer className="h-4 w-4" />
                        {t("delivery.printLabel")}
                      </button>
                      <button
                        onClick={handlePrintReceipt}
                        className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 font-medium"
                      >
                        <FileText className="h-4 w-4" />
                        {t("delivery.receipt")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ======== RIGHT PANEL: Today's Boxes Dashboard ======== */}
          <div className="space-y-4">
            <div className="rounded-xl bg-white shadow-sm overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Box className="h-5 w-5 text-emerald-600" />
                  {t("delivery.todayBoxes")}
                  <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {boxes.length}
                  </span>
                </h3>
                <button
                  onClick={() => {
                    setActiveBoxId(null);
                    setShowCreateForm(true);
                  }}
                  className="text-emerald-600 hover:text-emerald-700 p-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                  title={t("delivery.newBox")}
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="px-4 pt-3 pb-2">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                    placeholder={t("delivery.searchBoxes")}
                    className="w-full pr-9 pl-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-gray-50 placeholder:text-gray-400"
                  />
                  {sidebarSearch && (
                    <button
                      onClick={() => setSidebarSearch("")}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="px-4 pb-3">
                <div className="flex gap-1 overflow-x-auto no-scrollbar">
                  {(["all", "open", "ready", "in_transit", "delivered"] as const).map((status) => {
                    const count = statusCounts[status] || 0;
                    const isActive = sidebarStatusFilter === status;
                    const labelKey = status === "all" ? "delivery.all" : STATUS_LABEL_KEYS[status as BoxStatus];
                    return (
                      <button
                        key={status}
                        onClick={() => setSidebarStatusFilter(status)}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1",
                          isActive
                            ? "bg-emerald-100 text-emerald-700 shadow-sm"
                            : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        )}
                      >
                        {t(labelKey)}
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                          isActive ? "bg-emerald-200 text-emerald-800" : "bg-gray-200 text-gray-600"
                        )}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Box List */}
              {filteredSidebarBoxes.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Box className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{sidebarSearch || sidebarStatusFilter !== "all" ? t("delivery.noMatchingBoxes") : t("delivery.noBoxes")}</p>
                </div>
              ) : (
                <div className="max-h-[calc(100vh-28rem)] overflow-y-auto">
                  {filteredSidebarBoxes.map((b: any) => {
                    const isSelected = activeBoxId === b.id;
                    const customerName = getCustomerName(b.customerId);
                    return (
                      <button
                        key={b.id}
                        onClick={() => {
                          setActiveBoxId(b.id);
                          setShowCreateForm(false);
                        }}
                        className={cn(
                          "w-full text-right px-4 py-3 transition-all border-b border-gray-50 last:border-b-0 group",
                          isSelected
                            ? "bg-emerald-50 border-r-3 border-r-emerald-500"
                            : "hover:bg-gray-50/80"
                        )}
                      >
                        {/* Row 1: Box code + Status */}
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={cn(
                            "font-mono font-bold text-sm",
                            isSelected ? "text-emerald-700" : "text-gray-800"
                          )}>
                            {b.boxCode}
                          </span>
                          <StatusBadge status={b.status} />
                        </div>

                        {/* Row 2: Customer name */}
                        {customerName && (
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <span className="text-sm text-gray-700 truncate">{customerName}</span>
                          </div>
                        )}

                        {/* Row 3: Stats row */}
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {b.totalPackages || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ${Number(b.totalValueUsd || 0).toFixed(2)}
                          </span>
                          <span className="flex items-center gap-1">
                            <DeliveryMethodIcon method={b.deliveryMethod} className="h-3 w-3" />
                            <span className="truncate max-w-[80px]">
                              {t(DELIVERY_METHOD_KEYS[b.deliveryMethod as DeliveryMethod] || "delivery.methodPickup")}
                            </span>
                          </span>
                        </div>

                        {/* Row 4: Destination city (if exists) */}
                        {b.destinationCity && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{b.destinationCity}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
