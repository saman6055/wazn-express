import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Database,
  Users,
  Package,
  Save,
  HardDrive,
  AlertTriangle,
  Eye,
  Download,
  Upload,
  History,
  Trash2,
  Zap,
  BarChart3,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useDataManagement } from "@/hooks/useDataManagement";
import { dataCategories } from "@/constants/dataManagementCategories";
import { DataCountsCard } from "@/components/admin/DataCountsCard";
import { DeleteDataSection } from "@/components/admin/DeleteDataSection";
import { ImportExportSection } from "@/components/admin/ImportExportSection";
import { BackupSection } from "@/components/admin/BackupSection";
import { StatisticsSection } from "@/components/admin/StatisticsSection";
import { HistorySection } from "@/components/admin/HistorySection";

export default function DataManagement() {
  const dm = useDataManagement(dataCategories);
  const {
    t,
    language,
    activeTab,
    setActiveTab,
    totalRecords,
    basicCounts,
    backupsList,
    detailedCounts,
    isLoading,
    deletionLogs,
    deletionLogsLoading,
    resetHistory,
    resetHistoryLoading,
    refetchLogs,
    refetchResetHistory,
  } = dm;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 via-red-500 to-orange-500 p-6 md:p-8 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">{t("dataManagement.title")}</h1>
                <p className="text-white/80 text-sm md:text-base">{t("dataManagement.subtitle")}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <div className="flex items-center gap-2 text-white/70 text-xs mb-1">
                  <HardDrive className="h-3 w-3" />
                  {t("dataManagement.totalRecords")}
                </div>
                <div className="text-2xl font-bold">{totalRecords.toLocaleString()}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <div className="flex items-center gap-2 text-white/70 text-xs mb-1">
                  <Users className="h-3 w-3" />
                  {t("dataManagement.customers")}
                </div>
                <div className="text-2xl font-bold">{basicCounts?.customers ?? 0}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <div className="flex items-center gap-2 text-white/70 text-xs mb-1">
                  <Package className="h-3 w-3" />
                  {t("dataManagement.packages")}
                </div>
                <div className="text-2xl font-bold">{basicCounts?.packages ?? 0}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <div className="flex items-center gap-2 text-white/70 text-xs mb-1">
                  <Save className="h-3 w-3" />
                  {t("dataManagement.backupsCount")}
                </div>
                <div className="text-2xl font-bold">{backupsList?.length ?? 0}</div>
              </div>
            </div>
          </div>
        </div>

        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="text-red-800 font-semibold">{t("dataManagement.warning")}</AlertTitle>
          <AlertDescription className="text-red-700">{t("dataManagement.warningDesc")}</AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="gap-2">
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">{t("dataManagement.overview")}</span>
            </TabsTrigger>
            <TabsTrigger value="backup" className="gap-2">
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">{t("dataManagement.backup")}</span>
            </TabsTrigger>
            <TabsTrigger value="statistics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">{t("dataManagement.statistics")}</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t("dataManagement.deleteByCategory")}</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="gap-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">{t("dataManagement.advanced")}</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{t("dataManagement.export")}</span>
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">{t("dataManagement.import")}</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">{t("dataManagement.history")}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {isLoading ? null : <DataCountsCard detailedCounts={detailedCounts} t={t} />}
          </TabsContent>

          <TabsContent value="backup" className="space-y-6">
            <BackupSection
              backupType={dm.backupType}
              setBackupType={dm.setBackupType}
              isCreatingBackup={dm.isCreatingBackup}
              showRestoreDialog={dm.showRestoreDialog}
              setShowRestoreDialog={dm.setShowRestoreDialog}
              selectedBackupId={dm.selectedBackupId}
              setSelectedBackupId={dm.setSelectedBackupId}
              restoreConfirmation={dm.restoreConfirmation}
              setRestoreConfirmation={dm.setRestoreConfirmation}
              backupsList={backupsList}
              backupsLoading={dm.backupsLoading}
              scheduleConfig={dm.scheduleConfig}
              refetchBackups={dm.refetchBackups}
              formatFileSize={dm.formatFileSize}
              handleCreateBackup={dm.handleCreateBackup}
              handleRestoreBackup={dm.handleRestoreBackup}
              handleDeleteBackup={dm.handleDeleteBackup}
              updateScheduleMutation={dm.updateScheduleMutation}
              restoreBackupMutation={dm.restoreBackupMutation}
              language={language}
              t={t}
            />
          </TabsContent>

          <TabsContent value="statistics" className="space-y-6">
            <StatisticsSection
              totalRecords={totalRecords}
              backupsList={backupsList}
              detailedCounts={detailedCounts}
              dataCategories={dataCategories}
              getCount={dm.getCount}
              formatFileSize={dm.formatFileSize}
              handleExportStatisticsPDF={dm.handleExportStatisticsPDF}
              language={language}
              t={t}
            />
          </TabsContent>

          <TabsContent value="categories" className="space-y-6">
            <DeleteDataSection tab="categories" {...dm} />
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6">
            <DeleteDataSection tab="advanced" {...dm} />
          </TabsContent>

          <TabsContent value="export" className="space-y-6">
            <ImportExportSection
              mode="export"
              dataCategories={dataCategories}
              isExporting={dm.isExporting}
              importFile={dm.importFile}
              importPreview={dm.importPreview}
              importOverwrite={dm.importOverwrite}
              setImportOverwrite={dm.setImportOverwrite}
              isImportPending={dm.importMutation.isPending}
              getCount={dm.getCount}
              handleExportCategory={dm.handleExportCategory}
              handleExportAll={dm.handleExportAll}
              handleFileUpload={dm.handleFileUpload}
              handleImport={dm.handleImport}
              handleCategoryFileUpload={dm.handleCategoryFileUpload}
              handleDownloadTemplate={dm.handleDownloadTemplate}
              t={t}
            />
          </TabsContent>

          <TabsContent value="import" className="space-y-6">
            <ImportExportSection
              mode="import"
              dataCategories={dataCategories}
              isExporting={dm.isExporting}
              importFile={dm.importFile}
              importPreview={dm.importPreview}
              importOverwrite={dm.importOverwrite}
              setImportOverwrite={dm.setImportOverwrite}
              isImportPending={dm.importMutation.isPending}
              getCount={dm.getCount}
              handleExportCategory={dm.handleExportCategory}
              handleExportAll={dm.handleExportAll}
              handleFileUpload={dm.handleFileUpload}
              handleImport={dm.handleImport}
              handleCategoryFileUpload={dm.handleCategoryFileUpload}
              handleDownloadTemplate={dm.handleDownloadTemplate}
              t={t}
            />
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <HistorySection
              resetHistory={resetHistory}
              resetHistoryLoading={resetHistoryLoading}
              deletionLogs={deletionLogs}
              deletionLogsLoading={deletionLogsLoading}
              refetchResetHistory={dm.refetchResetHistory}
              refetchLogs={refetchLogs}
              language={language}
              t={t}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
