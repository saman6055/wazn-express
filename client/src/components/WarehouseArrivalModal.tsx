import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calculator, Plane, Ship, AlertTriangle, Weight, Ruler, Layers } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

interface WarehouseArrivalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: WarehouseArrivalData) => void;
  isLoading?: boolean;
  batches?: Array<{ id: number; batchCode: string; shippingType: string }>;
}

export interface WarehouseArrivalData {
  trackingNumber: string;
  shippingType: "air_regular" | "air_irregular" | "sea";
  weightKg?: string;
  lengthCm?: string;
  widthCm?: string;
  heightCm?: string;
  cbm?: string;
  batchId?: string;
}

export default function WarehouseArrivalModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  batches = [],
}: WarehouseArrivalModalProps) {
  const { t } = useTranslation();
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingType, setShippingType] = useState<"air_regular" | "air_irregular" | "sea">("air_regular");
  const [weightKg, setWeightKg] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");

  // Calculate CBM from dimensions
  const calculatedCbm = useMemo(() => {
    if (!lengthCm || !widthCm || !heightCm) return null;
    const cbm = (parseFloat(lengthCm) * parseFloat(widthCm) * parseFloat(heightCm)) / 1000000;
    return cbm.toFixed(6);
  }, [lengthCm, widthCm, heightCm]);

  // Filter batches by shipping type
  const filteredBatches = useMemo(() => {
    return batches.filter(b => b.shippingType === shippingType);
  }, [batches, shippingType]);

  const handleSubmit = () => {
    if (!trackingNumber.trim()) {
      toast.error(t('warehouse.enterTrackingNumber'));
      return;
    }

    if (shippingType !== "sea" && !weightKg.trim()) {
      toast.error(t('warehouse.enterWeight'));
      return;
    }

    if (shippingType === "sea" && (!lengthCm.trim() || !widthCm.trim() || !heightCm.trim())) {
      toast.error(t('warehouse.enterAllDimensions'));
      return;
    }

    const data: WarehouseArrivalData = {
      trackingNumber: trackingNumber.trim(),
      shippingType,
      batchId: selectedBatchId || undefined,
    };

    if (shippingType === "sea") {
      data.lengthCm = lengthCm;
      data.widthCm = widthCm;
      data.heightCm = heightCm;
      data.cbm = calculatedCbm || undefined;
    } else {
      data.weightKg = weightKg;
    }

    onSubmit(data);
    resetForm();
  };

  const resetForm = () => {
    setTrackingNumber("");
    setShippingType("air_regular");
    setWeightKg("");
    setLengthCm("");
    setWidthCm("");
    setHeightCm("");
    setSelectedBatchId("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('warehouse.arrivalTitle')}</DialogTitle>
          <DialogDescription>
            {t('warehouse.arrivalDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tracking Number */}
          <div className="space-y-2">
            <Label htmlFor="tracking">{t('warehouse.trackingNumberLabel')}</Label>
            <Input
              id="tracking"
              placeholder={t('warehouse.trackingNumberPlaceholder')}
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              dir="ltr"
            />
          </div>

          {/* Shipping Type */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">{t('warehouse.shippingTypeLabel')}</Label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "air_regular" as const, label: t('warehouse.airRegular'), icon: Plane, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/40" },
                { value: "air_irregular" as const, label: t('warehouse.airIrregular'), icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/40" },
                { value: "sea" as const, label: t('warehouse.sea'), icon: Ship, color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-950/40" },
              ].map(type => (
                <div
                  key={type.value}
                  onClick={() => setShippingType(type.value)}
                  className={`
                    p-3 rounded-lg border cursor-pointer transition-all text-center
                    ${shippingType === type.value 
                      ? `border-primary ${type.bg} ring-2 ring-primary/20` 
                      : "hover:border-primary/50"
                    }
                  `}
                >
                  <type.icon className={`h-6 w-6 mx-auto mb-1 ${type.color}`} />
                  <p className="font-medium text-sm">{type.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Weight for Air Shipping */}
          {shippingType !== "sea" && (
            <div className="space-y-2">
              <Label htmlFor="weight" className="flex items-center gap-2">
                <Weight className="h-4 w-4" />
                {t('warehouse.weightLabel')}
              </Label>
              <Input
                id="weight"
                type="number"
                step="0.001"
                min="0"
                placeholder={t('warehouse.weightPlaceholder')}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
              />
            </div>
          )}

          {/* Dimensions for Sea Shipping */}
          {shippingType === "sea" && (
            <>
              <div className="space-y-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  {t('warehouse.dimensionsLabel')}
                </Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="length" className="text-sm text-muted-foreground">{t('warehouse.length')}</Label>
                    <Input
                      id="length"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="L"
                      value={lengthCm}
                      onChange={(e) => setLengthCm(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="width" className="text-sm text-muted-foreground">{t('warehouse.width')}</Label>
                    <Input
                      id="width"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="W"
                      value={widthCm}
                      onChange={(e) => setWidthCm(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height" className="text-sm text-muted-foreground">{t('warehouse.height')}</Label>
                    <Input
                      id="height"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="H"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* CBM Calculation */}
              {calculatedCbm && (
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="h-4 w-4 text-primary" />
                    <Label className="font-semibold">{t('warehouse.calculatedVolume')}</Label>
                  </div>
                  <p className="text-2xl font-bold">{calculatedCbm} CBM</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {lengthCm} × {widthCm} × {heightCm} cm = {calculatedCbm} m³
                  </p>
                </div>
              )}
            </>
          )}

          {/* Batch Selection */}
          <div className="space-y-2">
            <Label htmlFor="batch" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              {t('warehouse.batchOptional')}
            </Label>
            <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
              <SelectTrigger id="batch">
                <SelectValue placeholder={t('warehouse.selectBatch')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('warehouse.noBatch')}</SelectItem>
                {filteredBatches.map(batch => (
                  <SelectItem key={batch.id} value={batch.id.toString()}>
                    {batch.batchCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filteredBatches.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-300">
                {t('warehouse.noBatchesAvailable')}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? t('common.loading') : t('warehouse.registerBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
