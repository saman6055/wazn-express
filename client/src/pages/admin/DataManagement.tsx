import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Database,
  LayoutDashboard,
  Save,
  Trash2,
  ArrowLeftRight,
  History,
  HardDrive,
  Users,
  Package,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useDataManagement } from "@/hooks/useDataManagement";
import { dataCategories } from "@/constants/dataManagementCategories";
import { DashboardTab } from "@/components/admin/DashboardTab";
import { DeleteDataSection } from "@/components/admin/DeleteDataSection";
import { ImportExportSection } from "@/components/admin/ImportExportSection";
import { BackupSection } from "@/components/admin/BackupSection";
import { ActivityLogTab } from "@/components/admin/ActivityLogTab";

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
    healthScore,
  } = dm;

  const headerStats = (
    <>
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
    </>
  );

  return (
    <DashboardLayout>
      <div className="pro-page">
        <PageHeader
          icon={Database}
          title={t("dataManagement.title")}
          subtitle={t("dataManagement.subtitle")}
          variant="gradient"
          stats={headerStats}
          className="bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 dark:from-blue-700 dark:via-blue-600 dark:to-indigo-700 shadow-xl"
        />

        {/* 5 Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="inline-flex w-auto min-w-full md:min-w-0 md:grid md:grid-cols-5 md:w-full">
              <TabsTrigger value="dashboard" className="gap-2 whitespace-nowrap">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">{t("dataManagement.dashboard")}</span>
              </TabsTrigger>
              <TabsTrigger value="backup" className="gap-2 whitespace-nowrap">
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">{t("dataManagement.backupRestore")}</span>
              </TabsTrigger>
              <TabsTrigger value="delete" className="gap-2 whitespace-nowrap">
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">{t("dataManagement.deleteData")}</span>
              </TabsTrigger>
              <TabsTrigger value="importExport" className="gap-2 whitespace-nowrap">
                <ArrowLeftRight className="h-4 w-4" />
                <span className="hidden sm:inline">{t("dataManagement.importExport")}</span>
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-2 whitespace-nowrap">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">{t("dataManagement.activityLog")}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard">
            {!isLoading && (
              <DashboardTab
                detailedCounts={detailedCounts}
                totalRecords={totalRecords}
                backupsList={backupsList}
                dataCategories={dataCategories}
                getCount={dm.getCount}
                formatFileSize={dm.formatFileSize}
                handleExportStatisticsPDF={dm.handleExportStatisticsPDF}
                healthScore={healthScore}
                language={language}
                t={t}
              />
            )}
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
              backupsList={backupsList as { id: number; filename: string; status: string; backupContent: string; backupType?: string; fileSize?: number | null; createdAt: string | Date; createdByName?: string; fileUrl?: string; errorMessage?: string }[] | undefined}
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

          <TabsContent value="delete" className="space-y-6">
            <DeleteDataSection {...dm} />
          </TabsContent>

          <TabsContent value="importExport" className="space-y-6">
            <ImportExportSection
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

          <TabsContent value="activity" className="space-y-6">
            <ActivityLogTab
              resetHistory={resetHistory as { resets?: { id: string | number; deletedByName?: string; backupCreated?: boolean; backupFileUrl?: string; deletedAt: string | Date }[]; total?: number } | undefined}
              resetHistoryLoading={resetHistoryLoading}
              deletionLogs={deletionLogs as { logs?: { id: string | number; category: string; recordCount: number; deletionType: string; deletedByName?: string; deletedAt: string | Date; backupCreated?: boolean }[]; total?: number } | undefined}
              deletionLogsLoading={deletionLogsLoading}
              refetchResetHistory={refetchResetHistory}
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
