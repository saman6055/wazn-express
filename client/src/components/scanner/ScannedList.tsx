import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  AlertTriangle,
  Package,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ScannedItem {
  id: number;
  trackingNumber: string;
  customerCode: string;
  customerName?: string;
  weight?: number | null;
  cbm?: number | null;
  hasCompleteData: boolean;
  scannedAt: Date;
  status?: "success" | "warning" | "moved";
  statusText?: string;
}

interface ScannedListProps {
  items: ScannedItem[];
  title?: string;
  emptyMessage?: string;
  maxHeight?: string;
  className?: string;
}

export function ScannedList({
  items,
  title,
  emptyMessage = "No scans yet",
  maxHeight = "400px",
  className,
}: ScannedListProps) {
  if (items.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">{title}</h3>
          <Badge variant="secondary">{items.length}</Badge>
        </div>
      )}
      <ScrollArea style={{ maxHeight }}>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div
              key={`${item.id}-${i}`}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-all",
                item.status === "warning"
                  ? "border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-900/20"
                  : item.status === "moved"
                    ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/20"
                    : "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20"
              )}
            >
              {/* Status icon */}
              <div
                className={cn(
                  "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                  item.hasCompleteData ? "bg-green-100 dark:bg-green-900/30" : "bg-yellow-100 dark:bg-yellow-900/30"
                )}
              >
                {item.hasCompleteData ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium truncate">
                    {item.trackingNumber}
                  </span>
                  {item.statusText && (
                    <Badge variant="outline" className="text-xs shrink-0">
                      {item.statusText}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span>{item.customerCode}</span>
                  {item.weight != null && <span>{item.weight.toFixed(1)} kg</span>}
                  {item.cbm != null && <span>{item.cbm.toFixed(3)} CBM</span>}
                </div>
              </div>

              {/* Time */}
              <div className="shrink-0 text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {item.scannedAt.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
