import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { soundManager } from "@/lib/soundManager";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Search,
  Loader2,
  Warehouse,
  Home,
  Truck,
  Phone,
  MapPin,
  Building2,
  DollarSign,
  FileText,
} from "lucide-react";

interface CreateBoxDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onBoxCreated: (boxId: number) => void;
}

type DeliveryMethod = "warehouse_pickup" | "home_delivery" | "city_transfer";

export function CreateBoxDialog({ open, onOpenChange, onBoxCreated }: CreateBoxDialogProps) {
  const { t, language } = useTranslation();
  const isRtl = language === "ku" || language === "ar";
  const utils = trpc.useUtils();

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("warehouse_pickup");
  const [destinationCity, setDestinationCity] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryCost, setDeliveryCost] = useState("0");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [notes, setNotes] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Customers query
  const { data: customers } = trpc.customers.list.useQuery();

  // Filtered customers for autocomplete
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (!customerSearch) return customers.slice(0, 15);
    const q = customerSearch.toLowerCase();
    return customers
      .filter(
        (c: any) =>
          c.fullName?.toLowerCase().includes(q) ||
          c.customerCode?.toLowerCase().includes(q) ||
          c.mobileNumber?.includes(q)
      )
      .slice(0, 15);
  }, [customers, customerSearch]);

  const selectedCustomer = useMemo(
    () => (customers ?? []).find((c: any) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  // Auto-fill from selected customer when method changes
  useEffect(() => {
    if (selectedCustomer && deliveryMethod !== "warehouse_pickup") {
      setRecipientPhone(selectedCustomer.mobileNumber || "");
      setDestinationAddress(selectedCustomer.address || "");
      if (deliveryMethod === "city_transfer") {
        setDestinationCity(selectedCustomer.city || "");
      }
    }
  }, [selectedCustomerId, deliveryMethod, selectedCustomer]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedCustomerId(null);
      setCustomerSearch("");
      setShowDropdown(false);
      setDeliveryMethod("warehouse_pickup");
      setDestinationCity("");
      setDestinationAddress("");
      setRecipientPhone("");
      setDeliveryCost("0");
      setDeliveryCharge("0");
      setNotes("");
    }
  }, [open]);

  // Create mutation
  const createBox = trpc.deliveryBox.create.useMutation({
    onSuccess: (box: any) => {
      toast.success(t("delivery.toastBoxCreated") + " " + box.boxCode);
      soundManager.playSuccess();
      onBoxCreated(box.id);
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err.message);
      soundManager.playError();
    },
  });

  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomerId(customer.id);
    setCustomerSearch(customer.fullName || customer.customerCode || "");
    setShowDropdown(false);
  };

  const handleSubmit = () => {
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
      deliveryCostUsd: deliveryMethod !== "warehouse_pickup" ? deliveryCost : undefined,
      deliveryChargeUsd: deliveryMethod !== "warehouse_pickup" ? deliveryCharge : undefined,
      notes: notes || undefined,
    });
  };

  const showDeliveryFields = deliveryMethod !== "warehouse_pickup";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={isRtl ? "rtl" : "ltr"} className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Truck className="h-4 w-4 text-primary" />
            </div>
            {t("delivery.createBox")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Customer Search */}
          <div className="space-y-2" ref={dropdownRef}>
            <Label className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {t("delivery.customer")}
            </Label>
            <div className="relative">
              <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder={t("delivery.searchCustomer")}
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowDropdown(true);
                  if (!e.target.value) setSelectedCustomerId(null);
                }}
                onFocus={() => setShowDropdown(true)}
                className="ps-9"
              />
            </div>
            {showDropdown && filteredCustomers.length > 0 && (
              <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border bg-popover shadow-lg">
                {filteredCustomers.map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCustomer(c)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-accent transition-colors",
                      selectedCustomerId === c.id && "bg-accent"
                    )}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {c.fullName?.charAt(0) || "?"}
                    </div>
                    <div className="text-start">
                      <p className="font-medium">{c.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.customerCode} - {c.mobileNumber}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedCustomer && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 p-2 text-sm text-green-700 dark:text-green-400">
                <User className="h-4 w-4" />
                <span className="font-medium">{selectedCustomer.fullName}</span>
                <span className="text-xs text-muted-foreground">({selectedCustomer.customerCode})</span>
              </div>
            )}
          </div>

          {/* Delivery Method */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" />
              {t("delivery.deliveryMethod")}
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {(["warehouse_pickup", "home_delivery", "city_transfer"] as const).map((method) => {
                const icons = {
                  warehouse_pickup: Warehouse,
                  home_delivery: Home,
                  city_transfer: Truck,
                };
                const Icon = icons[method];
                const labels = {
                  warehouse_pickup: "delivery.methodPickup",
                  home_delivery: "delivery.methodHomeDelivery",
                  city_transfer: "delivery.methodCityTransfer",
                };
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setDeliveryMethod(method)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-xs font-medium transition-all",
                      deliveryMethod === method
                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                        : "border-border hover:border-primary/30 hover:bg-accent/50"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {t(labels[method])}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conditional delivery fields */}
          {showDeliveryFields && (
            <div className="space-y-3 rounded-xl border border-dashed p-4">
              {/* Phone */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs">
                  <Phone className="h-3 w-3" />
                  {t("delivery.phone")}
                </Label>
                <Input
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder={t("delivery.phonePlaceholder")}
                  dir="ltr"
                />
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs">
                  <MapPin className="h-3 w-3" />
                  {t("delivery.address")}
                </Label>
                <Input
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  placeholder={t("delivery.addressPlaceholder")}
                />
              </div>

              {/* City (only for city_transfer) */}
              {deliveryMethod === "city_transfer" && (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs">
                    <Building2 className="h-3 w-3" />
                    {t("delivery.city")}
                  </Label>
                  <Input
                    value={destinationCity}
                    onChange={(e) => setDestinationCity(e.target.value)}
                    placeholder={t("delivery.cityPlaceholder")}
                  />
                </div>
              )}

              {/* Cost / Charge */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs">
                    <DollarSign className="h-3 w-3" />
                    {t("delivery.deliveryCost")}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={deliveryCost}
                    onChange={(e) => setDeliveryCost(e.target.value)}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs">
                    <DollarSign className="h-3 w-3" />
                    {t("delivery.deliveryCharge")}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={deliveryCharge}
                    onChange={(e) => setDeliveryCharge(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <FileText className="h-3 w-3" />
              {t("delivery.notes")}
            </Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("delivery.notesPlaceholder")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("delivery.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={createBox.isPending || !selectedCustomerId}>
            {createBox.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {t("delivery.createBox")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
