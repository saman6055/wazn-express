import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Users,
  Package,
  Boxes,
  FileText,
  CreditCard,
  Shield,
  Database,
  Save,
  HardDrive,
  Clock,
  Download,
  AlertCircle,
  CheckCircle2,
  Activity,
  TrendingUp,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { DataCategory } from "@/hooks/useDataManagement";

interface DetailedCounts {
  customers?: { total?: number; active?: number; withPackages?: number };
  packages?: { total?: number; delivered?: number; inTransit?: number; pending?: number };
  batches?: { total?: number; active?: number; completed?: number };
  invoices?: { total?: number; paid?: number; unpaid?: number };
  payments?: { total?: number; totalAmount?: number };
  users?: { total?: number; staff?: number; customers?: number };
}

interface DashboardTabProps {
  detailedCounts: DetailedCounts | null | undefined;
  totalRecords: number;
  backupsList: { status?: string; fileSize?: number | null; createdAt?: string | Date }[] | undefined;
  dataCategories: DataCategory[];
  getCount: (id: string) => number;
  formatFileSize: (bytes: number | null | undefined) => string;
  handleExportStatisticsPDF: () => void;
  healthScore: { score: number; status: "good" | "warning" | "critical"; issues: string[] };
  language: string;
  t: (key: string) => string;
}

const PIE_COLORS = [
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f97316",
  "#14b8a6",
  "#ec4899",
  "#6366f1",
  "#f43f5e",
  "#06b6d4",
  "#84cc16",
  "#eab308",
  "#a855f7",
  "#22c55e",
];

export function DashboardTab({
  detailedCounts,
  totalRecords,
  backupsList,
  dataCategories,
  getCount,
  formatFileSize,
  handleExportStatisticsPDF,
  healthScore,
  language,
  t,
}: DashboardTabProps) {
  const completedBackups = backupsList?.filter((b) => b.status === "completed").length ?? 0;
  const totalBackupSize = backupsList?.reduce((acc, b) => acc + (b.fileSize ?? 0), 0) ?? 0;

  const pieData = dataCategories
    .slice(0, 8)
    .map((cat, i) => ({
      name: t(cat.titleKey),
      value: getCount(cat.id),
      color: PIE_COLORS[i % PIE_COLORS.length],
    }))
    .filter((d) => d.value > 0);

  const healthColorMap = {
    good: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-200 dark:border-emerald-800/60",
      text: "text-emerald-700 dark:text-emerald-300",
      ring: "text-emerald-500",
    },
    warning: {
      bg: "bg-amber-50 dark:bg-amber-950/40",
      border: "border-amber-200 dark:border-amber-800/60",
      text: "text-amber-700 dark:text-amber-300",
      ring: "text-amber-500",
    },
    critical: {
      bg: "bg-red-50 dark:bg-red-950/40",
      border: "border-red-200 dark:border-red-800/60",
      text: "text-red-700 dark:text-red-300",
      ring: "text-red-500",
    },
  };
  const hc = healthColorMap[healthScore.status];

  return (
    <div className="space-y-6">
      {/* Row 1: Health Score + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className={`lg:col-span-2 ${hc.border} ${hc.bg}`}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className={hc.ring}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${healthScore.score}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-xl font-bold ${hc.text}`}>{healthScore.score}</span>
                </div>
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${hc.text}`}>{t("dataManagement.systemHealth")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {healthScore.status === "good" && t("dataManagement.healthGood")}
                  {healthScore.status === "warning" && t("dataManagement.healthWarning")}
                  {healthScore.status === "critical" && t("dataManagement.healthCritical")}
                </p>
                {healthScore.issues.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {healthScore.issues.slice(0, 2).map((issue, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-950/40 rounded-xl">
                <Database className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalRecords.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{t("dataManagement.totalRecords")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-100 dark:bg-green-950/40 rounded-xl">
                <Save className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{completedBackups}</div>
                <div className="text-xs text-muted-foreground">{t("dataManagement.completedBackups")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-100 dark:bg-purple-950/40 rounded-xl">
                <HardDrive className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{formatFileSize(totalBackupSize)}</div>
                <div className="text-xs text-muted-foreground">{t("dataManagement.totalBackupSize")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Detailed Counts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-blue-100 dark:border-blue-800/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
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

        <Card className="border-emerald-100 dark:border-emerald-800/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg">
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

        <Card className="border-purple-100 dark:border-purple-800/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-50 dark:bg-purple-950/40 rounded-lg">
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

        <Card className="border-orange-100 dark:border-orange-800/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-50 dark:bg-orange-950/40 rounded-lg">
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

        <Card className="border-teal-100 dark:border-teal-800/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-50 dark:bg-teal-950/40 rounded-lg">
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

        <Card className="border-indigo-100 dark:border-indigo-800/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg">
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

      {/* Row 3: Pie Chart + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <CardTitle>{t("dataManagement.dataDistribution")}</CardTitle>
                  <CardDescription>{t("dataManagement.dataDistributionDesc")}</CardDescription>
                </div>
              </div>
              <Button onClick={handleExportStatisticsPDF} variant="outline" size="sm">
                <Download className="h-4 w-4 me-1" />
                PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="w-48 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [value.toLocaleString(), ""]}
                        contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {pieData.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span>{entry.name}</span>
                      </div>
                      <span className="font-medium">{entry.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{t("dataManagement.noDataYet")}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg">
                <Activity className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle>{t("dataManagement.alertsRecommendations")}</CardTitle>
                <CardDescription>{t("dataManagement.alertsRecommendationsDesc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(!backupsList || backupsList.length === 0) && (
              <Alert className="border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/40">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800 dark:text-red-200">{t("dataManagement.noRecentBackup")}</AlertTitle>
                <AlertDescription className="text-red-700 dark:text-red-300">{t("dataManagement.noRecentBackupDesc")}</AlertDescription>
              </Alert>
            )}
            {backupsList &&
              backupsList.length > 0 &&
              (() => {
                const lastTime =
                  new Date().getTime() - new Date(backupsList[0].createdAt ?? 0).getTime();
                return lastTime > 7 * 24 * 60 * 60 * 1000;
              })() && (
              <Alert className="border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40">
                <Clock className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800 dark:text-amber-200">{t("dataManagement.noRecentBackup")}</AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-300">{t("dataManagement.noRecentBackupDesc")}</AlertDescription>
              </Alert>
            )}
            {totalRecords > 10000 && (
              <Alert className="border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/40">
                <Database className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800 dark:text-blue-200">{t("dataManagement.largeDatabase")}</AlertTitle>
                <AlertDescription className="text-blue-700 dark:text-blue-300">{t("dataManagement.largeDatabaseDesc")}</AlertDescription>
              </Alert>
            )}
            {(detailedCounts?.packages?.delivered ?? 0) > 500 && (
              <Alert className="border-green-200 dark:border-green-800/60 bg-green-50 dark:bg-green-950/40">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800 dark:text-green-200">{t("dataManagement.cleanupSuggestion")}</AlertTitle>
                <AlertDescription className="text-green-700 dark:text-green-300">{t("dataManagement.cleanupSuggestionDesc")}</AlertDescription>
              </Alert>
            )}
            {healthScore.status === "good" && (
              <Alert className="border-green-200 dark:border-green-800/60 bg-green-50 dark:bg-green-950/40">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800 dark:text-green-200">{t("dataManagement.allGood")}</AlertTitle>
                <AlertDescription className="text-green-700 dark:text-green-300">{t("dataManagement.allGoodDesc")}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
