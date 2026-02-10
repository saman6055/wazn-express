import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Package,
  Boxes,
  FileText,
  CreditCard,
  Shield,
} from "lucide-react";

interface DetailedCounts {
  customers?: { total?: number; active?: number; withPackages?: number };
  packages?: { total?: number; delivered?: number; inTransit?: number; pending?: number };
  batches?: { total?: number; active?: number; completed?: number };
  invoices?: { total?: number; paid?: number; unpaid?: number };
  payments?: { total?: number; totalAmount?: number };
  users?: { total?: number; staff?: number; customers?: number };
}

interface DataCountsCardProps {
  detailedCounts: DetailedCounts | null | undefined;
  t: (key: string) => string;
}

export function DataCountsCard({ detailedCounts, t }: DataCountsCardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card className="border-blue-100">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <CardTitle className="text-base">{t("dataManagement.customers")}</CardTitle>
            </div>
            <Badge variant="secondary">{detailedCounts?.customers?.total ?? 0}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("dataManagement.active")}</span>
              <span className="font-medium text-green-600">{detailedCounts?.customers?.active ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("dataManagement.withPackages")}</span>
              <span className="font-medium">{detailedCounts?.customers?.withPackages ?? 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-100">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Package className="h-4 w-4 text-emerald-600" />
              </div>
              <CardTitle className="text-base">{t("dataManagement.packages")}</CardTitle>
            </div>
            <Badge variant="secondary">{detailedCounts?.packages?.total ?? 0}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("dataManagement.delivered")}</span>
              <span className="font-medium text-green-600">{detailedCounts?.packages?.delivered ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("dataManagement.inTransit")}</span>
              <span className="font-medium text-blue-600">{detailedCounts?.packages?.inTransit ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("dataManagement.pending")}</span>
              <span className="font-medium text-amber-600">{detailedCounts?.packages?.pending ?? 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-purple-100">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Boxes className="h-4 w-4 text-purple-600" />
              </div>
              <CardTitle className="text-base">{t("dataManagement.batches")}</CardTitle>
            </div>
            <Badge variant="secondary">{detailedCounts?.batches?.total ?? 0}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("dataManagement.active")}</span>
              <span className="font-medium text-green-600">{detailedCounts?.batches?.active ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("dataManagement.completed")}</span>
              <span className="font-medium">{detailedCounts?.batches?.completed ?? 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-100">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-50 rounded-lg">
                <FileText className="h-4 w-4 text-orange-600" />
              </div>
              <CardTitle className="text-base">{t("dataManagement.invoices")}</CardTitle>
            </div>
            <Badge variant="secondary">{detailedCounts?.invoices?.total ?? 0}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("dataManagement.paid")}</span>
              <span className="font-medium text-green-600">{detailedCounts?.invoices?.paid ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("dataManagement.unpaid")}</span>
              <span className="font-medium text-red-600">{detailedCounts?.invoices?.unpaid ?? 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-teal-100">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-teal-50 rounded-lg">
                <CreditCard className="h-4 w-4 text-teal-600" />
              </div>
              <CardTitle className="text-base">{t("dataManagement.payments")}</CardTitle>
            </div>
            <Badge variant="secondary">{detailedCounts?.payments?.total ?? 0}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("dataManagement.totalAmount")}</span>
              <span className="font-medium text-green-600">
                ${(detailedCounts?.payments?.totalAmount ?? 0).toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-indigo-100">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Shield className="h-4 w-4 text-indigo-600" />
              </div>
              <CardTitle className="text-base">{t("dataManagement.users")}</CardTitle>
            </div>
            <Badge variant="secondary">{detailedCounts?.users?.total ?? 0}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("dataManagement.staff")}</span>
              <span className="font-medium">{detailedCounts?.users?.staff ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("dataManagement.customerUsers")}</span>
              <span className="font-medium">{detailedCounts?.users?.customers ?? 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
