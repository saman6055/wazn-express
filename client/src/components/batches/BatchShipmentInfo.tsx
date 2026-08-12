import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Barcode, Plus, X } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { onEnter } from "@/lib/onEnter";

/**
 * How a batch physically reached the carrier's warehouse.
 *
 * A batch is not one parcel: dozens of scanned items are packed into a few
 * cartons, and those cartons travel to the depot under their own courier
 * trackings. The piece count needs no field — every item is scanned into the
 * batch — but the trackings and the carton count were unrecorded, so "how
 * many shipments and how many cartons was this batch" had no answer.
 *
 * The same block appears in the create and the edit dialog, because the
 * numbers it holds are rarely known at creation time and almost always
 * arrive later.
 */
export function BatchShipmentInfo({
  trackings,
  onTrackingsChange,
  cartonCount,
  onCartonCountChange,
  pieceCount,
}: {
  trackings: string[];
  onTrackingsChange: (next: string[]) => void;
  cartonCount: string;
  onCartonCountChange: (next: string) => void;
  /** Items scanned into this batch. Read-only — shown for comparison. */
  pieceCount?: number;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");

  const addTracking = () => {
    const value = draft.trim();
    if (!value) return;
    // Typed by hand in the warehouse, so the same number twice is a slip.
    if (!trackings.includes(value)) onTrackingsChange([...trackings, value]);
    setDraft("");
  };

  return (
    <Card className="border-violet-100 dark:border-violet-800/60 bg-violet-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Barcode className="h-4 w-4 text-violet-600" />
          {t("batches.shipmentInfo")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-1.5">
          <Label className="text-xs">{t("batches.shipmentTrackings")}</Label>
          {trackings.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {trackings.map((tracking) => (
                <Badge
                  key={tracking}
                  variant="secondary"
                  className="gap-1 font-mono text-xs"
                >
                  {tracking}
                  <button
                    type="button"
                    aria-label={`${t("common.delete")} ${tracking}`}
                    onClick={() => onTrackingsChange(trackings.filter((x) => x !== tracking))}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              // Enter adds a tracking; without this it submits the whole dialog,
              // which is what a barcode scanner sends after every scan.
              onKeyDown={onEnter(addTracking)}
              placeholder={t("batches.addTrackingPlaceholder")}
              className="h-9 font-mono"
            />
            <Button type="button" variant="outline" size="sm" onClick={addTracking} className="h-9 shrink-0">
              <Plus className="h-4 w-4 me-1" />
              {t("common.add")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">{t("batches.cartonCount")}</Label>
            <Input
              type="number"
              min="0"
              step="1"
              value={cartonCount}
              onChange={(e) => onCartonCountChange(e.target.value)}
              placeholder="0"
              className="h-9"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">{t("batches.shipmentCount")}</Label>
            <div className="h-9 flex items-center px-3 rounded-md border bg-muted/50 text-sm">
              {trackings.length}
            </div>
          </div>
        </div>

        {pieceCount !== undefined && (
          <p className="text-xs text-muted-foreground">
            {t("batches.pieceCountHint", { count: pieceCount })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
