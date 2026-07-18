import { useState, useEffect } from "react";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  User,
  Loader2,
  Warehouse,
  Home,
  Truck,
  Phone,
  MapPin,
  Building2,
  DollarSign,
  FileText,
  Pencil,
} from "lucide-react";

type DeliveryMethod = "warehouse_pickup" | "home_delivery" | "city_transfer";

interface EditBoxDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  box: any;
  onSaved?: () => void;
}

/**
 * Edit an existing delivery box's shipping price and delivery details.
 * Available while the box is still open or sealed (ready) — i.e. before it
 * ships and the customer wallet is charged. Lets staff correct the shipping
 * price (deliveryCharge) or any other detail after sealing without losing the
 * box. Backed by the `deliveryBox.update` mutation, which also recomputes the
 * delivery profit when cost/charge change.
 */
export function EditBoxDialog({ open, onOpenChange, box, onSaved }: EditBoxDialogProps) {
  const { t, language } = useTranslation();
  const isRtl = language === "ku" || language === "ar";
  const utils = trpc.useUtils();

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("warehouse_pickup");
  const [destinationCity, setDestinationCity] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryCost, setDeliveryCost] = useState("0");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [notes, setNotes] = useState("");

  // Prefill from the box only when the dialog OPENS (or switches to a
  // different box) — keyed on `box?.id`, NOT the whole `box` object.
  //
  // The detail panel polls getById every 5s, so `box` gets a fresh object
  // reference on each poll. Depending on the whole object here re-ran this
  // effect mid-edit and reset the fields back to the saved values, wiping the
  // staff member's in-progress price change — so on save the OLD price went
  // back. Keying on the stable id keeps the form seeded once per open.
  useEffect(() => {
    if (open && box) {
      setDeliveryMethod((box.deliveryMethod as DeliveryMethod) || "warehouse_pickup");
      setDestinationCity(box.destinationCity || "");
      setDestinationAddress(box.destinationAddress || "");
      setRecipientName(box.recipientName || "");
      setRecipientPhone(box.recipientPhone || "");
      setDeliveryCost(String(box.deliveryCostUsd ?? "0"));
      setDeliveryCharge(String(box.deliveryChargeUsd ?? "0"));
      setNotes(box.notes || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, box?.id]);

  const updateBox = trpc.deliveryBox.update.useMutation({
    onSuccess: () => {
      toast.success(t("delivery.toastBoxUpdated"));
      soundManager.playSuccess();
      utils.deliveryBox.getById.invalidate({ id: box.id });
      utils.deliveryBox.list.invalidate();
      onSaved?.();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err.message);
      soundManager.playError();
    },
  });

  const handleSave = () => {
    updateBox.mutate({
      id: box.id,
      deliveryMethod,
      destinationCity,
      destinationAddress,
      recipientName,
      recipientPhone,
      deliveryCostUsd: deliveryCost || "0",
      deliveryChargeUsd: deliveryCharge || "0",
      notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={isRtl ? "rtl" : "ltr"} className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Pencil className="h-4 w-4 text-primary" />
            </div>
            {t("delivery.editBox")}
          </DialogTitle>
          <DialogDescription>{t("delivery.editBoxSubtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Delivery Method */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" />
              {t("delivery.deliveryMethod")}
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {(["warehouse_pickup", "home_delivery", "city_transfer"] as const).map((method) => {
                const icons = { warehouse_pickup: Warehouse, home_delivery: Home, city_transfer: Truck };
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

          {/* Recipient + destination (hidden for warehouse pickup) */}
          {deliveryMethod !== "warehouse_pickup" && (
            <div className="space-y-3 rounded-xl border border-dashed p-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs">
                  <User className="h-3 w-3" />
                  {t("delivery.recipientName")}
                </Label>
                <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
              </div>
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
            </div>
          )}

          {/* Shipping price — the key editable fields */}
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
                className="border-primary/40 focus-visible:ring-primary"
              />
            </div>
          </div>

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
            {t("delivery.close")}
          </Button>
          <Button onClick={handleSave} disabled={updateBox.isPending}>
            {updateBox.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {t("delivery.saveChanges")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
