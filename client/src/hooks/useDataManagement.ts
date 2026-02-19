import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { getCompanyInfoFromSettings } from "@/hooks/useCompanyInfo";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { parseCSV, convertCSVToImportFormat, detectFileFormat, generateCSVTemplate } from "@/lib/csvParser";
import type { ReactNode } from "react";

export interface DataCategory {
  id: string;
  titleKey: string;
  descKey: string;
  icon: ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  mutationKey: string;
}

export function useDataManagement(dataCategories: DataCategory[]) {
  const { t, language } = useTranslation();

  const [selectedCategory, setSelectedCategory] = useState<DataCategory | null>(null);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showOldDataDialog, setShowOldDataDialog] = useState(false);
  const [oldDataType, setOldDataType] = useState("packages");
  const [oldDataDays, setOldDataDays] = useState("30");
  const [isExporting, setIsExporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Record<string, unknown[]> | null>(null);
  const [importOverwrite, setImportOverwrite] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupType, setBackupType] = useState<"database_only" | "files_only" | "full">("database_only");
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState<number | null>(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState("");

  const { data: detailedCounts, refetch: refetchCounts, isLoading } = trpc.dataManagement.getDetailedCounts.useQuery();
  const { data: basicCounts } = trpc.dataManagement.getCounts.useQuery();
  const { data: deletionLogs, refetch: refetchLogs, isLoading: deletionLogsLoading } = trpc.dataManagement.getDeletionLogs.useQuery({ limit: 50 });
  const { data: resetHistory, refetch: refetchResetHistory, isLoading: resetHistoryLoading } = trpc.dataManagement.getResetHistory.useQuery({ limit: 20 });
  const { data: backupsList, refetch: refetchBackups, isLoading: backupsLoading } = trpc.backup.list.useQuery({ limit: 20, offset: 0 });
  const { data: scheduleConfig } = trpc.backup.getScheduleConfig.useQuery();
  const { data: settings } = trpc.settings.list.useQuery();

  const deleteCustomers = trpc.dataManagement.deleteAllCustomers.useMutation();
  const deletePackages = trpc.dataManagement.deleteAllPackages.useMutation();
  const deleteBatches = trpc.dataManagement.deleteAllBatches.useMutation();
  const deleteInvoices = trpc.dataManagement.deleteAllInvoices.useMutation();
  const deletePayments = trpc.dataManagement.deleteAllPayments.useMutation();
  const deleteExpenses = trpc.dataManagement.deleteAllExpenses.useMutation();
  const deleteLedgerTransactions = trpc.dataManagement.deleteAllLedgerTransactions.useMutation();
  const deleteFullPackages = trpc.dataManagement.deleteAllFullPackages.useMutation();
  const deleteSuppliers = trpc.dataManagement.deleteAllSuppliers.useMutation();
  const deleteScans = trpc.dataManagement.deleteAllScans.useMutation();
  const deleteStatusHistory = trpc.dataManagement.deleteAllStatusHistory.useMutation();
  const deleteAuditLogs = trpc.dataManagement.deleteAllAuditLogs.useMutation();
  const deleteBlogPosts = trpc.dataManagement.deleteAllBlogPosts.useMutation();
  const resetAllData = trpc.dataManagement.resetAllData.useMutation();
  const deleteOldData = trpc.dataManagement.deleteOldData.useMutation();
  const exportCategoryMutation = trpc.dataManagement.exportCategory.useMutation();
  const exportAllMutation = trpc.dataManagement.exportAllData.useMutation();
  const importMutation = trpc.dataManagement.importAllData.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("dataManagement.importSuccess", { count: result.totalImported }));
        setImportFile(null);
        setImportPreview(null);
        refetchCounts();
      } else {
        toast.error(t("dataManagement.importError"));
      }
    },
    onError: () => toast.error(t("dataManagement.importError")),
  });
  const importCategoryMutation = trpc.dataManagement.importCategory.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("dataManagement.importSuccess", { count: result.importedCount }));
        refetchCounts();
      } else {
        toast.error(t("dataManagement.importError"));
      }
    },
    onError: () => toast.error(t("dataManagement.importError")),
  });

  const createBackupMutation = trpc.backup.create.useMutation({
    onSuccess: () => {
      toast.success(t("dataManagement.backupCreatedSuccess"));
      refetchBackups();
      setIsCreatingBackup(false);
    },
    onError: (error) => {
      toast.error(t("dataManagement.backupError") + ": " + error.message);
      setIsCreatingBackup(false);
    },
  });
  const restoreBackupMutation = trpc.backup.restore.useMutation({
    onSuccess: () => {
      toast.success(t("dataManagement.restoreSuccess"));
      setShowRestoreDialog(false);
      setSelectedBackupId(null);
      setRestoreConfirmation("");
      refetchCounts();
    },
    onError: (error) => toast.error(t("dataManagement.restoreError") + ": " + error.message),
  });
  const deleteBackupMutation = trpc.backup.delete.useMutation({
    onSuccess: () => {
      toast.success(t("dataManagement.backupDeleted"));
      refetchBackups();
    },
    onError: () => toast.error(t("dataManagement.backupDeleteError")),
  });
  const updateScheduleMutation = trpc.backup.updateSchedule.useMutation({
    onSuccess: () => toast.success(t("dataManagement.scheduleUpdated")),
    onError: () => toast.error(t("dataManagement.scheduleError")),
  });

  const getMutation = (key: string) => {
    const mutations: Record<string, ReturnType<typeof deleteCustomers>> = {
      deleteAllCustomers: deleteCustomers,
      deleteAllPackages: deletePackages,
      deleteAllBatches: deleteBatches,
      deleteAllInvoices: deleteInvoices,
      deleteAllPayments: deletePayments,
      deleteAllExpenses: deleteExpenses,
      deleteAllLedgerTransactions: deleteLedgerTransactions,
      deleteAllFullPackages: deleteFullPackages,
      deleteAllSuppliers: deleteSuppliers,
      deleteAllScans: deleteScans,
      deleteAllStatusHistory: deleteStatusHistory,
      deleteAllAuditLogs: deleteAuditLogs,
      deleteAllBlogPosts: deleteBlogPosts,
    };
    return mutations[key];
  };

  const getCount = (categoryId: string): number => {
    if (!basicCounts) return 0;
    const countMap: Record<string, number> = {
      customers: basicCounts.customers,
      packages: basicCounts.packages,
      batches: basicCounts.batches,
      invoices: basicCounts.invoices,
      payments: basicCounts.payments,
      expenses: basicCounts.expenses,
      ledgerEntries: basicCounts.ledgerTransactions,
      fullPackages: basicCounts.fullPackages,
      suppliers: basicCounts.suppliers,
      scans: (detailedCounts as { scans?: { total?: number } })?.scans?.total ?? 0,
      statusHistory: 0,
      auditLogs: 0,
      blogPosts: 0,
    };
    return countMap[categoryId] ?? 0;
  };

  const totalRecords = basicCounts ? Object.values(basicCounts).reduce((a, b) => a + b, 0) : 0;

  const handleDelete = async () => {
    if (!selectedCategory || confirmationInput !== "DELETE") return;
    setIsDeleting(true);
    setDeleteProgress(0);
    const progressInterval = setInterval(() => setDeleteProgress((prev) => Math.min(prev + 10, 90)), 200);
    try {
      const mutation = getMutation(selectedCategory.mutationKey);
      await mutation.mutateAsync({ confirmation: "DELETE" });
      setDeleteProgress(100);
      clearInterval(progressInterval);
      toast.success(t("dataManagement.deleteSuccess"));
      refetchCounts();
      setTimeout(() => {
        setSelectedCategory(null);
        setConfirmationInput("");
        setDeleteProgress(0);
      }, 500);
    } catch {
      clearInterval(progressInterval);
      toast.error(t("dataManagement.deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteOldData = async () => {
    if (!oldDataDays || parseInt(oldDataDays, 10) < 1) return;
    setIsDeleting(true);
    try {
      const result = await deleteOldData.mutateAsync({
        confirmation: "DELETE",
        daysOld: parseInt(oldDataDays, 10),
        dataType: oldDataType as "packages" | "invoices" | "scans" | "auditLogs",
      });
      if (result.success) {
        toast.success(t("dataManagement.oldDataDeleted", { count: result.deletedCount }));
        refetchCounts();
      }
      setShowOldDataDialog(false);
    } catch {
      toast.error(t("dataManagement.deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetAll = async () => {
    if (resetConfirmation !== "RESET ALL DATA") return;
    setIsDeleting(true);
    setDeleteProgress(0);
    const progressInterval = setInterval(() => setDeleteProgress((prev) => Math.min(prev + 5, 95)), 300);
    try {
      const result = await resetAllData.mutateAsync({ confirmation: "RESET ALL DATA" });
      setDeleteProgress(100);
      clearInterval(progressInterval);
      if (result.success) {
        toast.success(t("dataManagement.resetSuccess"));
      } else {
        toast.error(result.message);
      }
      refetchCounts();
      setTimeout(() => {
        setShowResetDialog(false);
        setResetConfirmation("");
        setDeleteProgress(0);
      }, 500);
    } catch {
      clearInterval(progressInterval);
      toast.error(t("dataManagement.resetError"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCategory = async (categoryId: string) => {
    setIsExporting(true);
    try {
      const result = await exportCategoryMutation.mutateAsync({ category: categoryId });
      if (result.success && result.data.length > 0) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${categoryId}_export_${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(t("dataManagement.exportSuccess", { count: result.count }));
      } else {
        toast.info(t("dataManagement.noDataToExport"));
      }
    } catch {
      toast.error(t("dataManagement.exportError"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const result = await exportAllMutation.mutateAsync();
      if (result.success && result.totalRecords > 0) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `full_backup_${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(t("dataManagement.exportAllSuccess", { count: result.totalRecords }));
      } else {
        toast.info(t("dataManagement.noDataToExport"));
      }
    } catch {
      toast.error(t("dataManagement.exportError"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const format = detectFileFormat(content);
          if (format === "json") {
            const data = JSON.parse(content);
            setImportPreview(data);
          } else {
            toast.info(t("dataManagement.csvDetected") ?? "CSV detected. Use category import.");
            setImportFile(null);
            setImportPreview(null);
          }
        } catch {
          toast.error(t("dataManagement.invalidFile") ?? "Invalid file");
          setImportFile(null);
          setImportPreview(null);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleImport = () => {
    if (!importPreview) return;
    importMutation.mutate({ data: importPreview, overwrite: importOverwrite });
  };

  const handleCategoryFileUpload = (categoryId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const format = detectFileFormat(content);
          let data: unknown[];
          if (format === "json") {
            data = JSON.parse(content);
          } else {
            const csvData = parseCSV(content);
            data = convertCSVToImportFormat(csvData, categoryId);
            toast.success(t("dataManagement.csvParsed") ?? `${(data as unknown[]).length} rows parsed`);
          }
          if (Array.isArray(data) && data.length > 0) {
            importCategoryMutation.mutate({ category: categoryId, data, overwrite: false });
          } else {
            toast.error(t("dataManagement.noDataFound") ?? "No data found");
          }
        } catch {
          toast.error(t("dataManagement.invalidFile") ?? "Invalid file");
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDownloadTemplate = (categoryId: string) => {
    const template = generateCSVTemplate(categoryId);
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${categoryId}_template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(t("dataManagement.templateDownloaded") ?? "Template downloaded");
  };

  const handleCreateBackup = () => {
    setIsCreatingBackup(true);
    createBackupMutation.mutate({ backupType: "manual", backupContent: backupType });
  };

  const handleRestoreBackup = () => {
    if (!selectedBackupId || restoreConfirmation !== "RESTORE") return;
    restoreBackupMutation.mutate({ id: selectedBackupId });
  };

  const handleDeleteBackup = (id: number) => {
    if (window.confirm(t("dataManagement.confirmDeleteBackup"))) {
      deleteBackupMutation.mutate({ id });
    }
  };

  const handleExportStatisticsPDF = () => {
    try {
      const company = getCompanyInfoFromSettings(settings || []);
      const currentDate = new Date().toLocaleDateString(language === "ku" ? "ckb-IQ" : "en-US");
      const categories = dataCategories.slice(0, 8).map((cat) => ({
        name: t(cat.titleKey),
        count: getCount(cat.id),
        percentage: totalRecords > 0 ? ((getCount(cat.id) / totalRecords) * 100).toFixed(1) : "0",
      }));
      const totalBackupSize = (backupsList?.reduce((acc, b) => acc + (b.fileSize ?? 0), 0 as number) ?? 0) as number;
      const completedBackups = backupsList?.filter((b: { status?: string }) => b.status === "completed").length || 0;
      const lastBackupDate = backupsList?.[0]?.createdAt
        ? new Date(backupsList[0].createdAt).toLocaleDateString(language === "ku" ? "ckb-IQ" : "en-US")
        : "-";
      const printContent = `
        <!DOCTYPE html>
        <html dir="${language === "ku" ? "rtl" : "ltr"}" lang="${language}">
        <head>
          <meta charset="UTF-8">
          <title>${t("dataManagement.statisticsReport")} - ${currentDate}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: sans-serif; padding: 40px; direction: ${language === "ku" ? "rtl" : "ltr"}; background: #f8fafc; }
            .header { background: linear-gradient(135deg, #dc2626, #ea580c); color: white; padding: 30px; border-radius: 16px; margin-bottom: 30px; text-align: center; }
            .header h1 { font-size: 28px; margin-bottom: 8px; }
            .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
            .stat-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
            .stat-card h3 { color: #64748b; font-size: 14px; margin-bottom: 8px; }
            .stat-card .value { font-size: 32px; font-weight: 700; color: #1e293b; }
            .distribution { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
            .distribution h2 { margin-bottom: 20px; color: #1e293b; }
            .category-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
            .category-row:last-child { border-bottom: none; }
            .category-name { font-weight: 500; color: #334155; }
            .category-stats { display: flex; gap: 16px; align-items: center; }
            .category-count { color: #64748b; }
            .category-percent { background: #f1f5f9; padding: 4px 12px; border-radius: 20px; font-size: 13px; color: #475569; }
            .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 12px; }
            @media print { body { padding: 20px; background: white; } .header { print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${t("dataManagement.statisticsReport")}</h1>
            <p>${company.name} - ${currentDate}</p>
          </div>
          <div class="stats-grid">
            <div class="stat-card"><h3>${t("dataManagement.totalRecords")}</h3><div class="value">${totalRecords.toLocaleString()}</div></div>
            <div class="stat-card"><h3>${t("dataManagement.completedBackups")}</h3><div class="value">${completedBackups}</div></div>
            <div class="stat-card"><h3>${t("dataManagement.totalBackupSize")}</h3><div class="value">${formatFileSize(totalBackupSize)}</div></div>
            <div class="stat-card"><h3>${t("dataManagement.lastBackup")}</h3><div class="value">${lastBackupDate}</div></div>
          </div>
          <div class="distribution">
            <h2>${t("dataManagement.dataDistribution")}</h2>
            ${categories.map((cat) => `
              <div class="category-row">
                <span class="category-name">${cat.name}</span>
                <div class="category-stats">
                  <span class="category-count">${cat.count.toLocaleString()}</span>
                  <span class="category-percent">${cat.percentage}%</span>
                </div>
              </div>
            `).join("")}
          </div>
          <div class="footer">
            <p>${t("dataManagement.generatedAt")}: ${new Date().toLocaleString(language === "ku" ? "ckb-IQ" : "en-US")}</p>
          </div>
        </body>
        </html>
      `;
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
        toast.success(t("dataManagement.pdfExportSuccess"));
      } else {
        toast.error(t("dataManagement.pdfExportError"));
      }
    } catch {
      toast.error(t("dataManagement.pdfExportError"));
    }
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return "0 B";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  // ─── Health Score Calculation ───
  const calculateHealthScore = (): {
    score: number;
    status: "good" | "warning" | "critical";
    issues: string[];
  } => {
    const issues: string[] = [];
    let score = 100;

    const lastBackupTime =
      backupsList?.[0]?.createdAt
        ? new Date().getTime() - new Date(backupsList[0].createdAt).getTime()
        : Infinity;

    if (!backupsList || backupsList.length === 0) {
      score -= 40;
      issues.push(t("dataManagement.healthNoBackup"));
    } else if (lastBackupTime > 7 * 24 * 60 * 60 * 1000) {
      score -= 25;
      issues.push(t("dataManagement.healthOldBackup"));
    }

    if (totalRecords > 50000) {
      score -= 15;
      issues.push(t("dataManagement.healthLargeDB"));
    } else if (totalRecords > 20000) {
      score -= 5;
    }

    const deliveredPackages = (detailedCounts as { packages?: { delivered?: number } })?.packages?.delivered ?? 0;
    if (deliveredPackages > 1000) {
      score -= 10;
      issues.push(t("dataManagement.healthCleanupNeeded"));
    }

    const failedBackups = backupsList?.filter((b) => b.status === "failed").length ?? 0;
    if (failedBackups > 0) {
      score -= 10;
      issues.push(t("dataManagement.healthFailedBackups"));
    }

    score = Math.max(0, Math.min(100, score));
    const status = score >= 80 ? "good" : score >= 50 ? "warning" : "critical";

    return { score, status, issues };
  };

  const healthScore = calculateHealthScore();

  return {
    t,
    language,
    dataCategories,
    selectedCategory,
    setSelectedCategory,
    confirmationInput,
    setConfirmationInput,
    showResetDialog,
    setShowResetDialog,
    resetConfirmation,
    setResetConfirmation,
    isDeleting,
    deleteProgress,
    activeTab,
    setActiveTab,
    showOldDataDialog,
    setShowOldDataDialog,
    oldDataType,
    setOldDataType,
    oldDataDays,
    setOldDataDays,
    isExporting,
    importFile,
    setImportFile,
    importPreview,
    setImportPreview,
    importOverwrite,
    setImportOverwrite,
    isCreatingBackup,
    backupType,
    setBackupType,
    showRestoreDialog,
    setShowRestoreDialog,
    selectedBackupId,
    setSelectedBackupId,
    restoreConfirmation,
    setRestoreConfirmation,
    detailedCounts,
    basicCounts,
    totalRecords,
    isLoading,
    deletionLogs,
    refetchLogs,
    deletionLogsLoading,
    resetHistory,
    refetchResetHistory,
    resetHistoryLoading,
    backupsList,
    refetchBackups,
    backupsLoading,
    scheduleConfig,
    refetchCounts,
    getCount,
    getMutation,
    handleDelete,
    handleDeleteOldData,
    handleResetAll,
    handleExportCategory,
    handleExportAll,
    handleFileUpload,
    handleImport,
    handleCategoryFileUpload,
    handleDownloadTemplate,
    handleCreateBackup,
    handleRestoreBackup,
    handleDeleteBackup,
    handleExportStatisticsPDF,
    formatFileSize,
    exportCategoryMutation,
    exportAllMutation,
    importMutation,
    importCategoryMutation,
    createBackupMutation,
    restoreBackupMutation,
    deleteBackupMutation,
    updateScheduleMutation,
    healthScore,
  };
}
