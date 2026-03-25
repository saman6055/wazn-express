import { useTranslation } from "@/contexts/LanguageContext";
import { Card } from "@/components/ui/card";
import { Package, DollarSign, CheckCircle, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeliveryBox {
  id: number;
  status: string;
  totalValueUsd: string | null;
  deliveryChargeUsd: string | null;
  totalPackages: number;
  [key: string]: any;
}

interface DeliveryStatsProps {
  boxes: DeliveryBox[];
  isLoading: boolean;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  iconBg: string;
  iconColor: string;
}

function StatCard({ icon, label, value, iconBg, iconColor }: StatCardProps) {
  return (
    <Card className="flex flex-row items-center gap-4 p-4">
      <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", iconBg)}>
        <div className={iconColor}>{icon}</div>
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground truncate">{label}</p>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
      </div>
    </Card>
  );
}

export function DeliveryStats({ boxes, isLoading }: DeliveryStatsProps) {
  const { t } = useTranslation();

  const totalBoxes = boxes.length;
  const totalValue = boxes.reduce(
    (sum, b) => sum + Number(b.totalValueUsd || 0) + Number(b.deliveryChargeUsd || 0),
    0
  );
  const deliveredCount = boxes.filter((b) => b.status === "delivered").length;
  const inTransitCount = boxes.filter((b) => b.status === "in_transit").length;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="flex flex-row items-center gap-4 p-4 animate-pulse">
            <div className="h-12 w-12 rounded-xl bg-muted" />
            <div className="space-y-2">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="h-6 w-16 rounded bg-muted" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<Package className="h-6 w-6" />}
        label={t("delivery.totalBoxes")}
        value={totalBoxes}
        iconBg="bg-blue-100 dark:bg-blue-900/30"
        iconColor="text-blue-600 dark:text-blue-400"
      />
      <StatCard
        icon={<DollarSign className="h-6 w-6" />}
        label={t("delivery.totalValue")}
        value={`$${totalValue.toFixed(2)}`}
        iconBg="bg-emerald-100 dark:bg-emerald-900/30"
        iconColor="text-emerald-600 dark:text-emerald-400"
      />
      <StatCard
        icon={<CheckCircle className="h-6 w-6" />}
        label={t("delivery.statusDelivered")}
        value={deliveredCount}
        iconBg="bg-green-100 dark:bg-green-900/30"
        iconColor="text-green-600 dark:text-green-400"
      />
      <StatCard
        icon={<Truck className="h-6 w-6" />}
        label={t("delivery.statusInTransit")}
        value={inTransitCount}
        iconBg="bg-purple-100 dark:bg-purple-900/30"
        iconColor="text-purple-600 dark:text-purple-400"
      />
    </div>
  );
}
