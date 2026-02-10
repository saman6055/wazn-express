import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  Database,
  Save,
  HardDrive,
  Clock,
  PieChart,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import type { DataCategory } from "@/hooks/useDataManagement";

interface StatisticsSectionProps {
  totalRecords: number;
  backupsList: { status?: string; fileSize?: number; createdAt?: string }[] | undefined;
  detailedCounts: { packages?: { delivered?: number } } | null | undefined;
  dataCategories: DataCategory[];
  getCount: (id: string) => number;
  formatFileSize: (bytes: number | null | undefined) => string;
  handleExportStatisticsPDF: () => void;
  language: string;
  t: (key: string) => string;
}

export function StatisticsSection(props: StatisticsSectionProps) {
  const {
    totalRecords,
    backupsList,
    detailedCounts,
    dataCategories,
    getCount,
    formatFileSize,
    handleExportStatisticsPDF,
    language,
    t,
  } = props;
  const locale = language === "ku" ? "ckb-IQ" : "en-US";
  const lastBackupTime = backupsList?.[0]?.createdAt
    ? new Date().getTime() - new Date(backupsList[0].createdAt).getTime()
    : Infinity;
  const hasRecentBackup = backupsList && backupsList.length > 0 && lastBackupTime < 7 * 24 * 60 * 60 * 1000;

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={handleExportStatisticsPDF} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          {t("dataManagement.exportPDF")}
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalRecords.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">{t("dataManagement.totalRecords")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-xl">
                <Save className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {backupsList?.filter((b) => b.status === "completed").length ?? 0}
                </div>
                <div className="text-sm text-muted-foreground">{t("dataManagement.completedBackups")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-xl">
                <HardDrive className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {formatFileSize(backupsList?.reduce((acc, b) => acc + (b.fileSize ?? 0), 0) ?? 0)}
                </div>
                <div className="text-sm text-muted-foreground">{t("dataManagement.totalBackupSize")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 rounded-xl">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {backupsList?.[0]?.createdAt ? new Date(backupsList[0].createdAt).toLocaleDateString(locale) : "-"}
                </div>
                <div className="text-sm text-muted-foreground">{t("dataManagement.lastBackup")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <PieChart className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <CardTitle>{t("dataManagement.dataDistribution")}</CardTitle>
              <CardDescription>{t("dataManagement.dataDistributionDesc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dataCategories.slice(0, 8).map((category) => {
              const count = getCount(category.id);
              const percentage = totalRecords > 0 ? (count / totalRecords) * 100 : 0;
              return (
                <div key={category.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={category.color}>{category.icon}</span>
                      <span className="font-medium">{t(category.titleKey)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{count.toLocaleString()}</span>
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <Card className="border-amber-200">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle>{t("dataManagement.alertsRecommendations")}</CardTitle>
              <CardDescription>{t("dataManagement.alertsRecommendationsDesc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(!backupsList || backupsList.length === 0 || !hasRecentBackup) && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">{t("dataManagement.noRecentBackup")}</AlertTitle>
              <AlertDescription className="text-amber-700">{t("dataManagement.noRecentBackupDesc")}</AlertDescription>
            </Alert>
          )}
          {totalRecords > 10000 && (
            <Alert className="border-blue-200 bg-blue-50">
              <Database className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">{t("dataManagement.largeDatabase")}</AlertTitle>
              <AlertDescription className="text-blue-700">{t("dataManagement.largeDatabaseDesc")}</AlertDescription>
            </Alert>
          )}
          {(detailedCounts?.packages?.delivered ?? 0) > 500 && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">{t("dataManagement.cleanupSuggestion")}</AlertTitle>
              <AlertDescription className="text-green-700">{t("dataManagement.cleanupSuggestionDesc")}</AlertDescription>
            </Alert>
          )}
          {hasRecentBackup && totalRecords <= 10000 && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">{t("dataManagement.allGood")}</AlertTitle>
              <AlertDescription className="text-green-700">{t("dataManagement.allGoodDesc")}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </>
  );
}
