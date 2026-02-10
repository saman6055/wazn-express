import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Users, Package, Boxes, FileText, CreditCard, Receipt, 
  BookOpen, ShoppingBag, Truck, AlertTriangle, Trash2, 
  RotateCcw, Database, Shield, CheckCircle2, Clock,
  ScanLine, History, FileWarning, Newspaper, HardDrive,
  TrendingUp, TrendingDown, Activity, Zap, Calendar,
  Download, Upload, Eye, Lock, Unlock, Save, RefreshCw,
  Server, BarChart3, PieChart, AlertCircle, Cloud, FolderArchive,
  FileSpreadsheet
} from "lucide-react";
import { parseCSV, convertCSVToImportFormat, detectFileFormat, generateCSVTemplate } from "@/lib/csvParser";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";

interface DataCategory {
  id: string;
  titleKey: string;
  descKey: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  mutationKey: string;
}

const dataCategories: DataCategory[] = [
  {
    id: 'customers',
    titleKey: 'dataManagement.customers',
    descKey: 'dataManagement.customersDesc',
    icon: <Users className="h-5 w-5" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    mutationKey: 'deleteAllCustomers'
  },
  {
    id: 'packages',
    titleKey: 'dataManagement.packages',
    descKey: 'dataManagement.packagesDesc',
    icon: <Package className="h-5 w-5" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    mutationKey: 'deleteAllPackages'
  },
  {
    id: 'batches',
    titleKey: 'dataManagement.batches',
    descKey: 'dataManagement.batchesDesc',
    icon: <Boxes className="h-5 w-5" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    mutationKey: 'deleteAllBatches'
  },
  {
    id: 'invoices',
    titleKey: 'dataManagement.invoices',
    descKey: 'dataManagement.invoicesDesc',
    icon: <FileText className="h-5 w-5" />,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    mutationKey: 'deleteAllInvoices'
  },
  {
    id: 'payments',
    titleKey: 'dataManagement.payments',
    descKey: 'dataManagement.paymentsDesc',
    icon: <CreditCard className="h-5 w-5" />,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    mutationKey: 'deleteAllPayments'
  },
  {
    id: 'expenses',
    titleKey: 'dataManagement.expenses',
    descKey: 'dataManagement.expensesDesc',
    icon: <Receipt className="h-5 w-5" />,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    mutationKey: 'deleteAllExpenses'
  },
  {
    id: 'ledgerEntries',
    titleKey: 'dataManagement.ledger',
    descKey: 'dataManagement.ledgerDesc',
    icon: <BookOpen className="h-5 w-5" />,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    mutationKey: 'deleteAllLedgerTransactions'
  },
  {
    id: 'fullPackages',
    titleKey: 'dataManagement.fullPackages',
    descKey: 'dataManagement.fullPackagesDesc',
    icon: <ShoppingBag className="h-5 w-5" />,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    mutationKey: 'deleteAllFullPackages'
  },
  {
    id: 'suppliers',
    titleKey: 'dataManagement.suppliers',
    descKey: 'dataManagement.suppliersDesc',
    icon: <Truck className="h-5 w-5" />,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    mutationKey: 'deleteAllSuppliers'
  },
  {
    id: 'scans',
    titleKey: 'dataManagement.scans',
    descKey: 'dataManagement.scansDesc',
    icon: <ScanLine className="h-5 w-5" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    mutationKey: 'deleteAllScans'
  },
  {
    id: 'statusHistory',
    titleKey: 'dataManagement.statusHistory',
    descKey: 'dataManagement.statusHistoryDesc',
    icon: <History className="h-5 w-5" />,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    mutationKey: 'deleteAllStatusHistory'
  },
  {
    id: 'auditLogs',
    titleKey: 'dataManagement.auditLogs',
    descKey: 'dataManagement.auditLogsDesc',
    icon: <FileWarning className="h-5 w-5" />,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    mutationKey: 'deleteAllAuditLogs'
  },
  {
    id: 'blogPosts',
    titleKey: 'dataManagement.blogPosts',
    descKey: 'dataManagement.blogPostsDesc',
    icon: <Newspaper className="h-5 w-5" />,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    mutationKey: 'deleteAllBlogPosts'
  }
];

export default function DataManagement() {
  const { t, language } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<DataCategory | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [showOldDataDialog, setShowOldDataDialog] = useState(false);
  const [oldDataType, setOldDataType] = useState('packages');
  const [oldDataDays, setOldDataDays] = useState('30');
  const [isExporting, setIsExporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Record<string, any[]> | null>(null);
  const [importOverwrite, setImportOverwrite] = useState(false);
  
  // Backup states
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupType, setBackupType] = useState<'database_only' | 'files_only' | 'full'>('database_only');
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState<number | null>(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState('');

  // Fetch detailed data counts
  const { data: detailedCounts, refetch: refetchCounts, isLoading } = trpc.dataManagement.getDetailedCounts.useQuery();
  const { data: basicCounts } = trpc.dataManagement.getCounts.useQuery();
  
  // Fetch deletion logs
  const { data: deletionLogs, refetch: refetchLogs, isLoading: deletionLogsLoading } = trpc.dataManagement.getDeletionLogs.useQuery({ limit: 50 });
  
  // Fetch reset history
  const { data: resetHistory, refetch: refetchResetHistory, isLoading: resetHistoryLoading } = trpc.dataManagement.getResetHistory.useQuery({ limit: 20 });

  // Fetch backups
  const { data: backupsList, refetch: refetchBackups, isLoading: backupsLoading } = trpc.backup.list.useQuery({ limit: 20, offset: 0 });
  
  // Fetch backup schedule
  const { data: scheduleConfig } = trpc.backup.getScheduleConfig.useQuery();

  // Delete mutations
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
  
  // Backup mutations
  const createBackupMutation = trpc.backup.create.useMutation({
    onSuccess: (result) => {
      toast.success(t('dataManagement.backupCreatedSuccess'));
      refetchBackups();
      setIsCreatingBackup(false);
    },
    onError: (error) => {
      toast.error(t('dataManagement.backupError') + ': ' + error.message);
      setIsCreatingBackup(false);
    }
  });

  const restoreBackupMutation = trpc.backup.restore.useMutation({
    onSuccess: () => {
      toast.success(t('dataManagement.restoreSuccess'));
      setShowRestoreDialog(false);
      setSelectedBackupId(null);
      setRestoreConfirmation('');
      refetchCounts();
    },
    onError: (error) => {
      toast.error(t('dataManagement.restoreError') + ': ' + error.message);
    }
  });

  const deleteBackupMutation = trpc.backup.delete.useMutation({
    onSuccess: () => {
      toast.success(t('dataManagement.backupDeleted'));
      refetchBackups();
    },
    onError: () => {
      toast.error(t('dataManagement.backupDeleteError'));
    }
  });

  const updateScheduleMutation = trpc.backup.updateSchedule.useMutation({
    onSuccess: () => {
      toast.success(t('dataManagement.scheduleUpdated'));
    },
    onError: () => {
      toast.error(t('dataManagement.scheduleError'));
    }
  });
  
  // Import mutations
  const importMutation = trpc.dataManagement.importAllData.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('dataManagement.importSuccess', { count: result.totalImported }));
        setImportFile(null);
        setImportPreview(null);
        refetchCounts();
      } else {
        toast.error(t('dataManagement.importError'));
      }
    },
    onError: () => {
      toast.error(t('dataManagement.importError'));
    }
  });
  
  const importCategoryMutation = trpc.dataManagement.importCategory.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('dataManagement.importSuccess', { count: result.importedCount }));
        refetchCounts();
      } else {
        toast.error(t('dataManagement.importError'));
      }
    },
    onError: () => {
      toast.error(t('dataManagement.importError'));
    }
  });

  const getMutation = (key: string) => {
    const mutations: Record<string, any> = {
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
      scans: detailedCounts?.scans?.total || 0,
      statusHistory: 0,
      auditLogs: 0,
      blogPosts: 0,
    };
    return countMap[categoryId] || 0;
  };

  const handleDelete = async () => {
    if (!selectedCategory || confirmationInput !== 'DELETE') return;
    
    setIsDeleting(true);
    setDeleteProgress(0);
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setDeleteProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const mutation = getMutation(selectedCategory.mutationKey);
      await mutation.mutateAsync({ confirmation: 'DELETE' });
      
      setDeleteProgress(100);
      clearInterval(progressInterval);
      
      toast.success(t('dataManagement.deleteSuccess'));
      
      refetchCounts();
      setTimeout(() => {
        setSelectedCategory(null);
        setConfirmationInput('');
        setDeleteProgress(0);
      }, 500);
    } catch (error) {
      clearInterval(progressInterval);
      toast.error(t('dataManagement.deleteError'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteOldData = async () => {
    if (!oldDataDays || parseInt(oldDataDays) < 1) return;
    
    setIsDeleting(true);
    try {
      const result = await deleteOldData.mutateAsync({
        confirmation: 'DELETE',
        daysOld: parseInt(oldDataDays),
        dataType: oldDataType as any
      });
      
      if (result.success) {
        toast.success(t('dataManagement.oldDataDeleted', { count: result.deletedCount }));
        refetchCounts();
      }
      setShowOldDataDialog(false);
    } catch (error) {
      toast.error(t('dataManagement.deleteError'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetAll = async () => {
    if (resetConfirmation !== 'RESET ALL DATA') return;
    
    setIsDeleting(true);
    setDeleteProgress(0);
    
    const progressInterval = setInterval(() => {
      setDeleteProgress(prev => Math.min(prev + 5, 95));
    }, 300);

    try {
      const result = await resetAllData.mutateAsync({ confirmation: 'RESET ALL DATA' });
      
      setDeleteProgress(100);
      clearInterval(progressInterval);
      
      if (result.success) {
        toast.success(t('dataManagement.resetSuccess'));
      } else {
        toast.error(result.message);
      }
      
      refetchCounts();
      setTimeout(() => {
        setShowResetDialog(false);
        setResetConfirmation('');
        setDeleteProgress(0);
      }, 500);
    } catch (error) {
      clearInterval(progressInterval);
      toast.error(t('dataManagement.resetError'));
    } finally {
      setIsDeleting(false);
    }
  };

  const totalRecords = basicCounts ? Object.values(basicCounts).reduce((a, b) => a + b, 0) : 0;

  // Export mutations
  const exportCategoryMutation = trpc.dataManagement.exportCategory.useMutation();
  const exportAllMutation = trpc.dataManagement.exportAllData.useMutation();

  // Export handlers
  const handleExportCategory = async (categoryId: string) => {
    setIsExporting(true);
    try {
      const result = await exportCategoryMutation.mutateAsync({ category: categoryId });
      if (result.success && result.data.length > 0) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${categoryId}_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(t('dataManagement.exportSuccess', { count: result.count }));
      } else {
        toast.info(t('dataManagement.noDataToExport'));
      }
    } catch (error) {
      toast.error(t('dataManagement.exportError'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const result = await exportAllMutation.mutateAsync();
      if (result.success && result.totalRecords > 0) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `full_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(t('dataManagement.exportAllSuccess', { count: result.totalRecords }));
      } else {
        toast.info(t('dataManagement.noDataToExport'));
      }
    } catch (error) {
      toast.error(t('dataManagement.exportError'));
    } finally {
      setIsExporting(false);
    }
  };

  // Import handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const format = detectFileFormat(content);
          
          if (format === 'json') {
            const data = JSON.parse(content);
            setImportPreview(data);
          } else {
            // CSV file - show category selection dialog
            toast.info(t('dataManagement.csvDetected') || 'فایلی CSV دۆزرایەوە. تکایە لە بەشی هاوردەکردن بە کاتەگۆری بیکە');
            setImportFile(null);
            setImportPreview(null);
          }
        } catch (error) {
          toast.error(t('dataManagement.invalidFile') || 'فایلەکە نادروستە');
          setImportFile(null);
          setImportPreview(null);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    if (!importPreview) return;
    importMutation.mutate({
      data: importPreview,
      overwrite: importOverwrite
    });
  };

  const handleCategoryFileUpload = (categoryId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const format = detectFileFormat(content);
          
          let data: any[];
          if (format === 'json') {
            data = JSON.parse(content);
          } else {
            // Parse CSV and convert to import format
            const csvData = parseCSV(content);
            data = convertCSVToImportFormat(csvData, categoryId);
            toast.success(t('dataManagement.csvParsed') || `${data.length} ڕیز لە CSV خوێندرایەوە`);
          }
          
          if (Array.isArray(data) && data.length > 0) {
            importCategoryMutation.mutate({
              category: categoryId,
              data: data,
              overwrite: false
            });
          } else {
            toast.error(t('dataManagement.noDataFound') || 'هیچ داتایەک نەدۆزرایەوە');
          }
        } catch (error) {
          toast.error(t('dataManagement.invalidFile') || 'فایلەکە نادروستە');
        }
      };
      reader.readAsText(file);
    }
  };

  // Download CSV template for a category
  const handleDownloadTemplate = (categoryId: string) => {
    const template = generateCSVTemplate(categoryId);
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${categoryId}_template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(t('dataManagement.templateDownloaded') || 'نموونەی CSV دابەزی');
  };

  // Backup handlers
  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    createBackupMutation.mutate({
      backupType: 'manual',
      backupContent: backupType
    });
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackupId || restoreConfirmation !== 'RESTORE') return;
    restoreBackupMutation.mutate({ id: selectedBackupId });
  };

  const handleDeleteBackup = async (id: number) => {
    if (confirm(t('dataManagement.confirmDeleteBackup'))) {
      deleteBackupMutation.mutate({ id });
    }
  };

  // Export Statistics as PDF
  const handleExportStatisticsPDF = async () => {
    try {
      // Create a simple HTML content for PDF
      const currentDate = new Date().toLocaleDateString(language === 'ku' ? 'ckb-IQ' : 'en-US');
      const categories = dataCategories.slice(0, 8).map(cat => ({
        name: t(cat.titleKey),
        count: getCount(cat.id),
        percentage: totalRecords > 0 ? ((getCount(cat.id) / totalRecords) * 100).toFixed(1) : '0'
      }));

      // Create printable content
      const printContent = `
        <!DOCTYPE html>
        <html dir="${language === 'ku' ? 'rtl' : 'ltr'}" lang="${language}">
        <head>
          <meta charset="UTF-8">
          <title>${t('dataManagement.statisticsReport')} - ${currentDate}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Noto Sans Arabic', sans-serif; 
              padding: 40px; 
              direction: ${language === 'ku' ? 'rtl' : 'ltr'};
              background: #f8fafc;
            }
            .header {
              background: linear-gradient(135deg, #dc2626, #ea580c);
              color: white;
              padding: 30px;
              border-radius: 16px;
              margin-bottom: 30px;
              text-align: center;
            }
            .header h1 { font-size: 28px; margin-bottom: 8px; }
            .header p { opacity: 0.9; }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              margin-bottom: 30px;
            }
            .stat-card {
              background: white;
              padding: 20px;
              border-radius: 12px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.08);
              border: 1px solid #e2e8f0;
            }
            .stat-card h3 { color: #64748b; font-size: 14px; margin-bottom: 8px; }
            .stat-card .value { font-size: 32px; font-weight: 700; color: #1e293b; }
            .distribution {
              background: white;
              padding: 24px;
              border-radius: 12px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.08);
              border: 1px solid #e2e8f0;
            }
            .distribution h2 { margin-bottom: 20px; color: #1e293b; }
            .category-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 12px 0;
              border-bottom: 1px solid #f1f5f9;
            }
            .category-row:last-child { border-bottom: none; }
            .category-name { font-weight: 500; color: #334155; }
            .category-stats { display: flex; gap: 16px; align-items: center; }
            .category-count { color: #64748b; }
            .category-percent { 
              background: #f1f5f9; 
              padding: 4px 12px; 
              border-radius: 20px; 
              font-size: 13px;
              color: #475569;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              color: #94a3b8;
              font-size: 12px;
            }
            @media print {
              body { padding: 20px; background: white; }
              .header { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${t('dataManagement.statisticsReport')}</h1>
            <p>Wazn Express - ${currentDate}</p>
          </div>
          
          <div class="stats-grid">
            <div class="stat-card">
              <h3>${t('dataManagement.totalRecords')}</h3>
              <div class="value">${totalRecords.toLocaleString()}</div>
            </div>
            <div class="stat-card">
              <h3>${t('dataManagement.completedBackups')}</h3>
              <div class="value">${backupsList?.filter((b: any) => b.status === 'completed').length || 0}</div>
            </div>
            <div class="stat-card">
              <h3>${t('dataManagement.totalBackupSize')}</h3>
              <div class="value">${formatFileSize(backupsList?.reduce((acc: number, b: any) => acc + (b.fileSize || 0), 0) || 0)}</div>
            </div>
            <div class="stat-card">
              <h3>${t('dataManagement.lastBackup')}</h3>
              <div class="value">${backupsList?.[0]?.createdAt ? new Date(backupsList[0].createdAt).toLocaleDateString(language === 'ku' ? 'ckb-IQ' : 'en-US') : '-'}</div>
            </div>
          </div>
          
          <div class="distribution">
            <h2>${t('dataManagement.dataDistribution')}</h2>
            ${categories.map(cat => `
              <div class="category-row">
                <span class="category-name">${cat.name}</span>
                <div class="category-stats">
                  <span class="category-count">${cat.count.toLocaleString()}</span>
                  <span class="category-percent">${cat.percentage}%</span>
                </div>
              </div>
            `).join('')}
          </div>
          
          <div class="footer">
            <p>${t('dataManagement.generatedAt')}: ${new Date().toLocaleString(language === 'ku' ? 'ckb-IQ' : 'en-US')}</p>
          </div>
        </body>
        </html>
      `;

      // Open print dialog
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
        toast.success(t('dataManagement.pdfExportSuccess'));
      } else {
        toast.error(t('dataManagement.pdfExportError'));
      }
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error(t('dataManagement.pdfExportError'));
    }
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getBackupStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />{t('dataManagement.completed')}</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />{t('dataManagement.inProgress')}</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 border-red-200"><AlertCircle className="h-3 w-3 mr-1" />{t('dataManagement.failed')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getBackupTypeBadge = (type: string) => {
    switch (type) {
      case 'database_only':
        return <Badge variant="outline" className="text-blue-600 border-blue-200"><Database className="h-3 w-3 mr-1" />{t('dataManagement.databaseOnly')}</Badge>;
      case 'files_only':
        return <Badge variant="outline" className="text-purple-600 border-purple-200"><FolderArchive className="h-3 w-3 mr-1" />{t('dataManagement.filesOnly')}</Badge>;
      case 'full':
        return <Badge variant="outline" className="text-green-600 border-green-200"><Cloud className="h-3 w-3 mr-1" />{t('dataManagement.fullBackup')}</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Professional Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 via-red-500 to-orange-500 p-6 md:p-8 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">{t('dataManagement.title')}</h1>
                <p className="text-white/80 text-sm md:text-base">{t('dataManagement.subtitle')}</p>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <div className="flex items-center gap-2 text-white/70 text-xs mb-1">
                  <HardDrive className="h-3 w-3" />
                  {t('dataManagement.totalRecords')}
                </div>
                <div className="text-2xl font-bold">{totalRecords.toLocaleString()}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <div className="flex items-center gap-2 text-white/70 text-xs mb-1">
                  <Users className="h-3 w-3" />
                  {t('dataManagement.customers')}
                </div>
                <div className="text-2xl font-bold">{basicCounts?.customers || 0}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <div className="flex items-center gap-2 text-white/70 text-xs mb-1">
                  <Package className="h-3 w-3" />
                  {t('dataManagement.packages')}
                </div>
                <div className="text-2xl font-bold">{basicCounts?.packages || 0}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <div className="flex items-center gap-2 text-white/70 text-xs mb-1">
                  <Save className="h-3 w-3" />
                  {t('dataManagement.backupsCount')}
                </div>
                <div className="text-2xl font-bold">{backupsList?.length || 0}</div>
              </div>
            </div>
          </div>
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -right-20 -bottom-20 h-60 w-60 rounded-full bg-white/5 blur-3xl" />
        </div>

        {/* Warning Alert */}
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="text-red-800 font-semibold">{t('dataManagement.warning')}</AlertTitle>
          <AlertDescription className="text-red-700">
            {t('dataManagement.warningDesc')}
          </AlertDescription>
        </Alert>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="gap-2">
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">{t('dataManagement.overview')}</span>
            </TabsTrigger>
            <TabsTrigger value="backup" className="gap-2">
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">{t('dataManagement.backup')}</span>
            </TabsTrigger>
            <TabsTrigger value="statistics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">{t('dataManagement.statistics')}</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t('dataManagement.deleteByCategory')}</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="gap-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">{t('dataManagement.advanced')}</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{t('dataManagement.export')}</span>
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">{t('dataManagement.import')}</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">{t('dataManagement.history')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Detailed Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Customers Card */}
              <Card className="border-blue-100">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Users className="h-4 w-4 text-blue-600" />
                      </div>
                      <CardTitle className="text-base">{t('dataManagement.customers')}</CardTitle>
                    </div>
                    <Badge variant="secondary">{detailedCounts?.customers?.total || 0}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('dataManagement.active')}</span>
                      <span className="font-medium text-green-600">{detailedCounts?.customers?.active || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('dataManagement.withPackages')}</span>
                      <span className="font-medium">{detailedCounts?.customers?.withPackages || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Packages Card */}
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-50 rounded-lg">
                        <Package className="h-4 w-4 text-emerald-600" />
                      </div>
                      <CardTitle className="text-base">{t('dataManagement.packages')}</CardTitle>
                    </div>
                    <Badge variant="secondary">{detailedCounts?.packages?.total || 0}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('dataManagement.delivered')}</span>
                      <span className="font-medium text-green-600">{detailedCounts?.packages?.delivered || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('dataManagement.inTransit')}</span>
                      <span className="font-medium text-blue-600">{detailedCounts?.packages?.inTransit || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('dataManagement.pending')}</span>
                      <span className="font-medium text-amber-600">{detailedCounts?.packages?.pending || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Batches Card */}
              <Card className="border-purple-100">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-purple-50 rounded-lg">
                        <Boxes className="h-4 w-4 text-purple-600" />
                      </div>
                      <CardTitle className="text-base">{t('dataManagement.batches')}</CardTitle>
                    </div>
                    <Badge variant="secondary">{detailedCounts?.batches?.total || 0}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('dataManagement.active')}</span>
                      <span className="font-medium text-green-600">{detailedCounts?.batches?.active || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('dataManagement.completed')}</span>
                      <span className="font-medium">{detailedCounts?.batches?.completed || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Invoices Card */}
              <Card className="border-orange-100">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-orange-50 rounded-lg">
                        <FileText className="h-4 w-4 text-orange-600" />
                      </div>
                      <CardTitle className="text-base">{t('dataManagement.invoices')}</CardTitle>
                    </div>
                    <Badge variant="secondary">{detailedCounts?.invoices?.total || 0}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('dataManagement.paid')}</span>
                      <span className="font-medium text-green-600">{detailedCounts?.invoices?.paid || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('dataManagement.unpaid')}</span>
                      <span className="font-medium text-red-600">{detailedCounts?.invoices?.unpaid || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payments Card */}
              <Card className="border-teal-100">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-teal-50 rounded-lg">
                        <CreditCard className="h-4 w-4 text-teal-600" />
                      </div>
                      <CardTitle className="text-base">{t('dataManagement.payments')}</CardTitle>
                    </div>
                    <Badge variant="secondary">{detailedCounts?.payments?.total || 0}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('dataManagement.totalAmount')}</span>
                      <span className="font-medium text-green-600">${(detailedCounts?.payments?.totalAmount || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Users Card */}
              <Card className="border-indigo-100">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-50 rounded-lg">
                        <Shield className="h-4 w-4 text-indigo-600" />
                      </div>
                      <CardTitle className="text-base">{t('dataManagement.users')}</CardTitle>
                    </div>
                    <Badge variant="secondary">{detailedCounts?.users?.total || 0}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('dataManagement.staff')}</span>
                      <span className="font-medium">{detailedCounts?.users?.staff || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('dataManagement.customerUsers')}</span>
                      <span className="font-medium">{detailedCounts?.users?.customers || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Backup & Restore Tab */}
          <TabsContent value="backup" className="space-y-6">
            {/* Create Backup Section */}
            <Card className="border-green-200">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <Save className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>{t('dataManagement.createBackup')}</CardTitle>
                    <CardDescription>{t('dataManagement.createBackupDesc')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card 
                    className={`cursor-pointer transition-all ${backupType === 'database_only' ? 'border-blue-500 bg-blue-50' : 'hover:border-blue-300'}`}
                    onClick={() => setBackupType('database_only')}
                  >
                    <CardContent className="p-4 text-center">
                      <Database className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                      <div className="font-medium">{t('dataManagement.databaseOnly')}</div>
                      <div className="text-xs text-muted-foreground mt-1">{t('dataManagement.databaseOnlyDesc')}</div>
                    </CardContent>
                  </Card>
                  <Card 
                    className={`cursor-pointer transition-all ${backupType === 'files_only' ? 'border-purple-500 bg-purple-50' : 'hover:border-purple-300'}`}
                    onClick={() => setBackupType('files_only')}
                  >
                    <CardContent className="p-4 text-center">
                      <FolderArchive className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                      <div className="font-medium">{t('dataManagement.filesOnly')}</div>
                      <div className="text-xs text-muted-foreground mt-1">{t('dataManagement.filesOnlyDesc')}</div>
                    </CardContent>
                  </Card>
                  <Card 
                    className={`cursor-pointer transition-all ${backupType === 'full' ? 'border-green-500 bg-green-50' : 'hover:border-green-300'}`}
                    onClick={() => setBackupType('full')}
                  >
                    <CardContent className="p-4 text-center">
                      <FolderArchive className="h-8 w-8 mx-auto mb-2 text-green-600" />
                      <div className="font-medium">{t('dataManagement.fullBackup')}</div>
                      <div className="text-xs text-muted-foreground mt-1">{t('dataManagement.fullBackupDesc')}</div>
                      <Badge variant="outline" className="mt-2 text-green-600 border-green-300">
                        <Download className="h-3 w-3 mr-1" />
                        ZIP
                      </Badge>
                    </CardContent>
                  </Card>
                </div>

                <Button 
                  onClick={handleCreateBackup}
                  disabled={isCreatingBackup}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isCreatingBackup ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> {t('dataManagement.creatingBackup')}</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> {t('dataManagement.createBackupNow')}</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Backup List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <FolderArchive className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle>{t('dataManagement.backupList')}</CardTitle>
                      <CardDescription>{t('dataManagement.backupListDesc')}</CardDescription>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => refetchBackups()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t('common.refresh')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {backupsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : backupsList && backupsList.length > 0 ? (
                  <div className="space-y-3">
                    {backupsList.map((backup: any) => (
                      <Card key={backup.id} className="border-slate-200">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${
                                backup.status === 'completed' ? 'bg-green-100' :
                                backup.status === 'in_progress' ? 'bg-blue-100' :
                                'bg-red-100'
                              }`}>
                                {backup.status === 'completed' ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                                ) : backup.status === 'in_progress' ? (
                                  <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                                ) : (
                                  <AlertCircle className="h-5 w-5 text-red-600" />
                                )}
                              </div>
                              <div>
                                <div className="font-medium">{backup.filename}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  {getBackupStatusBadge(backup.status)}
                                  {getBackupTypeBadge(backup.backupContent)}
                                  {backup.backupType === 'scheduled' && (
                                    <Badge variant="outline" className="text-amber-600 border-amber-200">
                                      <Clock className="h-3 w-3 mr-1" />
                                      {t('dataManagement.scheduled')}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground mt-2">
                                  {backup.fileSize && (
                                    <span className="mr-4">{formatFileSize(backup.fileSize)}</span>
                                  )}
                                  {backup.createdByName && (
                                    <span>{t('dataManagement.createdBy')}: {backup.createdByName}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className="text-sm text-muted-foreground">
                                {new Date(backup.createdAt).toLocaleDateString(language === 'ku' ? 'ckb-IQ' : 'en-US')}
                              </div>
                              <div className="flex items-center gap-2">
                                {backup.status === 'completed' && backup.fileUrl && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(backup.fileUrl, '_blank')}
                                  >
                                    <Download className="h-3 w-3 mr-1" />
                                    {t('dataManagement.download')}
                                  </Button>
                                )}
                                {backup.status === 'completed' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                    onClick={() => {
                                      setSelectedBackupId(backup.id);
                                      setShowRestoreDialog(true);
                                    }}
                                  >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    {t('dataManagement.restore')}
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:bg-red-50"
                                  onClick={() => handleDeleteBackup(backup.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          {backup.errorMessage && (
                            <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-700">
                              {backup.errorMessage}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FolderArchive className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>{t('dataManagement.noBackups')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Auto Backup Schedule */}
            <Card className="border-amber-200">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle>{t('dataManagement.autoBackup')}</CardTitle>
                    <CardDescription>{t('dataManagement.autoBackupDesc')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {scheduleConfig?.map((config) => (
                    <div key={config.schedule} className="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
                      <div>
                        <div className="font-medium">{t(`dataManagement.${config.schedule}`)}</div>
                        <div className="text-sm text-muted-foreground">
                          {config.enabled 
                            ? t('dataManagement.scheduleActive', { schedule: config.description })
                            : t('dataManagement.scheduleInactive')}
                        </div>
                      </div>
                      <Button
                        variant={config.enabled ? "destructive" : "default"}
                        size="sm"
                        onClick={() => updateScheduleMutation.mutate({ 
                          schedule: config.schedule, 
                          enabled: !config.enabled 
                        })}
                      >
                        {config.enabled ? t('dataManagement.disable') : t('dataManagement.enable')}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="statistics" className="space-y-6">
            {/* Export PDF Button */}
            <div className="flex justify-end">
              <Button 
                onClick={handleExportStatisticsPDF}
                variant="outline"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {t('dataManagement.exportPDF')}
              </Button>
            </div>

            {/* Database Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-xl">
                      <Database className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{totalRecords.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">{t('dataManagement.totalRecords')}</div>
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
                      <div className="text-2xl font-bold">{backupsList?.filter((b: any) => b.status === 'completed').length || 0}</div>
                      <div className="text-sm text-muted-foreground">{t('dataManagement.completedBackups')}</div>
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
                        {formatFileSize(backupsList?.reduce((acc: number, b: any) => acc + (b.fileSize || 0), 0) || 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">{t('dataManagement.totalBackupSize')}</div>
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
                        {backupsList?.[0]?.createdAt 
                          ? new Date(backupsList[0].createdAt).toLocaleDateString(language === 'ku' ? 'ckb-IQ' : 'en-US')
                          : '-'}
                      </div>
                      <div className="text-sm text-muted-foreground">{t('dataManagement.lastBackup')}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Data Distribution */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <PieChart className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle>{t('dataManagement.dataDistribution')}</CardTitle>
                    <CardDescription>{t('dataManagement.dataDistributionDesc')}</CardDescription>
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
                            <Badge variant="secondary">{percentage.toFixed(1)}%</Badge>
                          </div>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Alerts & Recommendations */}
            <Card className="border-amber-200">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle>{t('dataManagement.alertsRecommendations')}</CardTitle>
                    <CardDescription>{t('dataManagement.alertsRecommendationsDesc')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* No recent backup alert */}
                {(!backupsList || backupsList.length === 0 || 
                  (backupsList[0]?.createdAt && new Date().getTime() - new Date(backupsList[0].createdAt).getTime() > 7 * 24 * 60 * 60 * 1000)) && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">{t('dataManagement.noRecentBackup')}</AlertTitle>
                    <AlertDescription className="text-amber-700">
                      {t('dataManagement.noRecentBackupDesc')}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Large data alert */}
                {totalRecords > 10000 && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <Database className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-800">{t('dataManagement.largeDatabase')}</AlertTitle>
                    <AlertDescription className="text-blue-700">
                      {t('dataManagement.largeDatabaseDesc')}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Old data cleanup suggestion */}
                {(detailedCounts?.packages?.delivered || 0) > 500 && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">{t('dataManagement.cleanupSuggestion')}</AlertTitle>
                    <AlertDescription className="text-green-700">
                      {t('dataManagement.cleanupSuggestionDesc')}
                    </AlertDescription>
                  </Alert>
                )}

                {/* All good message */}
                {backupsList && backupsList.length > 0 && 
                  backupsList[0]?.createdAt && 
                  new Date().getTime() - new Date(backupsList[0].createdAt).getTime() < 7 * 24 * 60 * 60 * 1000 &&
                  totalRecords <= 10000 && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">{t('dataManagement.allGood')}</AlertTitle>
                    <AlertDescription className="text-green-700">
                      {t('dataManagement.allGoodDesc')}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Delete by Category Tab */}
          <TabsContent value="categories" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dataCategories.map((category) => (
                <Card 
                  key={category.id} 
                  className={`${category.borderColor} hover:shadow-md transition-all cursor-pointer group`}
                  onClick={() => setSelectedCategory(category)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 ${category.bgColor} rounded-lg group-hover:scale-110 transition-transform`}>
                          <span className={category.color}>{category.icon}</span>
                        </div>
                        <div>
                          <div className="font-medium">{t(category.titleKey)}</div>
                          <div className="text-sm text-muted-foreground mt-1">{t(category.descKey)}</div>
                        </div>
                      </div>
                      <Badge variant="secondary">{getCount(category.id)}</Badge>
                    </div>
                    <div className="mt-4 flex items-center justify-end">
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="h-4 w-4 mr-1" />
                        {t('dataManagement.delete')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Delete Old Data */}
              <Card className="border-amber-200">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 rounded-lg">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-amber-800">{t('dataManagement.deleteOldData')}</CardTitle>
                      <CardDescription className="text-amber-700">{t('dataManagement.deleteOldDataDesc')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('dataManagement.dataType')}</Label>
                    <Select value={oldDataType} onValueChange={setOldDataType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="packages">{t('dataManagement.deliveredPackages')}</SelectItem>
                        <SelectItem value="invoices">{t('dataManagement.paidInvoices')}</SelectItem>
                        <SelectItem value="scans">{t('dataManagement.scans')}</SelectItem>
                        <SelectItem value="auditLogs">{t('dataManagement.auditLogs')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('dataManagement.olderThan')}</Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="number" 
                        value={oldDataDays} 
                        onChange={(e) => setOldDataDays(e.target.value)}
                        min="1"
                        className="w-24"
                      />
                      <span className="text-muted-foreground">{t('dataManagement.days')}</span>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                    onClick={() => setShowOldDataDialog(true)}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    {t('dataManagement.deleteOldRecords')}
                  </Button>
                </CardContent>
              </Card>

              {/* Factory Reset */}
              <Card className="border-red-200">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-50 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-red-800">{t('dataManagement.factoryReset')}</CardTitle>
                      <CardDescription className="text-red-700">{t('dataManagement.factoryResetDesc')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-red-100 rounded-lg mb-4">
                    <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      {t('dataManagement.dangerZone')}
                    </div>
                    <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                      <li>{t('dataManagement.resetWarning1')}</li>
                      <li>{t('dataManagement.resetWarning2')}</li>
                      <li>{t('dataManagement.resetWarning3')}</li>
                    </ul>
                  </div>
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={() => setShowResetDialog(true)}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {t('dataManagement.resetAllData')}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Download className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>{t('dataManagement.exportData')}</CardTitle>
                    <CardDescription>{t('dataManagement.exportDataDesc')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dataCategories.map((category) => (
                    <Card key={category.id} className={`${category.borderColor} border`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 ${category.bgColor} rounded-lg`}>
                              <span className={category.color}>{category.icon}</span>
                            </div>
                            <div>
                              <div className="font-medium">{t(category.titleKey)}</div>
                              <div className="text-sm text-muted-foreground">
                                {getCount(category.id)} {t('dataManagement.records')}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleExportCategory(category.id)}
                            disabled={isExporting}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Separator />

                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Database className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <div className="font-medium text-green-800">{t('dataManagement.exportAll')}</div>
                          <div className="text-sm text-green-700">
                            {t('dataManagement.exportAllDesc')}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="default"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={handleExportAll}
                        disabled={isExporting}
                      >
                        {isExporting ? (
                          <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        {t('dataManagement.exportAll')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <Upload className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>{t('dataManagement.importData')}</CardTitle>
                    <CardDescription>{t('dataManagement.importDataDesc')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Import Warning */}
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">{t('dataManagement.importWarningTitle')}</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    {t('dataManagement.importWarningDesc')}
                  </AlertDescription>
                </Alert>

                {/* File Upload */}
                <div className="space-y-4">
                  <Label>{t('dataManagement.selectBackupFile')}</Label>
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-green-300 transition-colors">
                    <input
                      type="file"
                      accept=".json,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="import-file"
                    />
                    <label htmlFor="import-file" className="cursor-pointer">
                      <Upload className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-sm text-muted-foreground">
                        {importFile ? importFile.name : t('dataManagement.clickToSelectFile')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('dataManagement.jsonAndCsvFiles') || 'JSON یان CSV فایل'}
                      </p>
                    </label>
                  </div>
                </div>

                {/* Import Preview */}
                {importPreview && (
                  <Card className="border-green-200 bg-green-50/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        {t('dataManagement.importPreview')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.entries(importPreview).map(([category, records]) => (
                          <div key={category} className="flex items-center justify-between p-2 bg-white rounded border">
                            <span className="text-sm font-medium">{t(`dataManagement.${category}`)}</span>
                            <Badge variant="secondary">{(records as any[]).length}</Badge>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="overwrite-mode"
                            checked={importOverwrite}
                            onChange={(e) => setImportOverwrite(e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <Label htmlFor="overwrite-mode" className="text-sm cursor-pointer">
                            {t('dataManagement.overwriteExisting')}
                          </Label>
                        </div>
                        <Button
                          onClick={handleImport}
                          disabled={importMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {importMutation.isPending ? (
                            <><RotateCcw className="h-4 w-4 mr-2 animate-spin" /> {t('dataManagement.importing')}</>
                          ) : (
                            <><Upload className="h-4 w-4 mr-2" /> {t('dataManagement.startImport')}</>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Import by Category */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    {t('dataManagement.importByCategory')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('dataManagement.importByCategoryDesc') || 'پشتگیری فایلی JSON و CSV دەکات. بۆ دابەزاندنی نموونەی CSV کلیک لە آیکۆنی فایل بکە.'}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dataCategories.slice(0, 10).map((category) => (
                      <Card key={category.id} className={`${category.borderColor} hover:shadow-md transition-shadow`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 ${category.bgColor} rounded-lg`}>
                                <span className={category.color}>{category.icon}</span>
                              </div>
                              <span className="font-medium">{t(category.titleKey)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Download CSV Template */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadTemplate(category.id)}
                                title={t('dataManagement.downloadTemplate') || 'دابەزاندنی نموونەی CSV'}
                              >
                                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                              </Button>
                              {/* Import File */}
                              <input
                                type="file"
                                accept=".json,.csv"
                                onChange={(e) => handleCategoryFileUpload(category.id, e)}
                                className="hidden"
                                id={`import-${category.id}`}
                              />
                              <label htmlFor={`import-${category.id}`}>
                                <Button variant="outline" size="sm" className="cursor-pointer" asChild>
                                  <span><Upload className="h-3 w-3 mr-1" /> {t('dataManagement.import')}</span>
                                </Button>
                              </label>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            {/* Reset History Card */}
            <Card className="border-red-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-50 rounded-lg">
                      <RotateCcw className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <CardTitle className="text-red-700">{t('dataManagement.resetHistory')}</CardTitle>
                      <CardDescription>{t('dataManagement.resetHistoryDesc')}</CardDescription>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => refetchResetHistory()}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {t('common.refresh')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {resetHistoryLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RotateCcw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : resetHistory?.resets && resetHistory.resets.length > 0 ? (
                  <div className="space-y-4">
                    {resetHistory.resets.map((reset: any) => (
                      <Card key={reset.id} className="border-red-100 bg-red-50/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-red-100">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                              </div>
                              <div>
                                <div className="font-medium text-red-700">{t('dataManagement.factoryReset')}</div>
                                <div className="text-sm text-muted-foreground">{t('dataManagement.deletedBy')}: {reset.deletedByName || 'Unknown'}</div>
                                {reset.backupCreated && (
                                  <div className="mt-2 space-y-1">
                                    <Badge variant="outline" className="text-green-600 border-green-200">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      {t('dataManagement.backupCreatedBeforeReset')}
                                    </Badge>
                                    {reset.backupFileUrl && (
                                      <div>
                                        <a href={reset.backupFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                          <Download className="h-3 w-3" />
                                          {t('dataManagement.downloadBackup')}
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {!reset.backupCreated && (
                                  <Badge variant="outline" className="mt-2 text-amber-600 border-amber-200">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    {t('dataManagement.noBackupCreated')}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">
                                {new Date(reset.deletedAt).toLocaleDateString(language === 'ku' ? 'ckb-IQ' : language === 'ar' ? 'ar-IQ' : language === 'zh' ? 'zh-CN' : 'en-US')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(reset.deletedAt).toLocaleTimeString(language === 'ku' ? 'ckb-IQ' : language === 'ar' ? 'ar-IQ' : language === 'zh' ? 'zh-CN' : 'en-US')}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50 text-green-500" />
                    <p>{t('dataManagement.noResetHistory')}</p>
                    <p className="text-xs mt-1">{t('dataManagement.noResetHistoryDesc')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Deletion History Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <History className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle>{t('dataManagement.deletionHistory')}</CardTitle>
                      <CardDescription>{t('dataManagement.deletionHistoryDesc')}</CardDescription>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => refetchLogs()}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {t('common.refresh')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {deletionLogsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RotateCcw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : deletionLogs?.logs && deletionLogs.logs.length > 0 ? (
                  <div className="space-y-4">
                    {deletionLogs.logs.map((log: any) => (
                      <Card key={log.id} className="border-slate-200">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${
                                log.deletionType === 'factory_reset' ? 'bg-red-100' :
                                log.deletionType === 'old_data' ? 'bg-amber-100' :
                                'bg-slate-100'
                              }`}>
                                <Trash2 className={`h-4 w-4 ${
                                  log.deletionType === 'factory_reset' ? 'text-red-600' :
                                  log.deletionType === 'old_data' ? 'text-amber-600' :
                                  'text-slate-600'
                                }`} />
                              </div>
                              <div>
                                <div className="font-medium">
                                  {t(`dataManagement.${log.category}`)} - {log.recordCount} {t('dataManagement.records')}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {t(`dataManagement.deletionType.${log.deletionType}`)}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {t('dataManagement.deletedBy')}: {log.deletedByName || 'Unknown'}
                                </div>
                                {log.backupCreated && (
                                  <Badge variant="outline" className="mt-2 text-green-600 border-green-200">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    {t('dataManagement.backupCreated')}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">
                                {new Date(log.deletedAt).toLocaleDateString(language === 'ku' ? 'ckb-IQ' : language === 'ar' ? 'ar-IQ' : language === 'zh' ? 'zh-CN' : 'en-US')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(log.deletedAt).toLocaleTimeString(language === 'ku' ? 'ckb-IQ' : language === 'ar' ? 'ar-IQ' : language === 'zh' ? 'zh-CN' : 'en-US')}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {deletionLogs.total > 10 && (
                      <div className="text-center text-sm text-muted-foreground">
                        {t('dataManagement.showingLogs', { shown: deletionLogs.logs.length, total: deletionLogs.total })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>{t('dataManagement.noHistory')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!selectedCategory} onOpenChange={() => {
          setSelectedCategory(null);
          setConfirmationInput('');
          setDeleteProgress(0);
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                {t('dataManagement.confirmDelete')}
              </DialogTitle>
              <DialogDescription>
                {t('dataManagement.confirmDeleteDesc', { type: selectedCategory ? t(selectedCategory.titleKey) : '' })}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t('dataManagement.warning')}
                </div>
                <p className="text-sm text-amber-700">
                  {getCount(selectedCategory?.id || '')} {t('dataManagement.recordsWillBeDeleted')}
                </p>
              </div>

              {isDeleting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{t('dataManagement.deleting')}</span>
                    <span>{deleteProgress}%</span>
                  </div>
                  <Progress value={deleteProgress} className="h-2" />
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  {t('dataManagement.typeToConfirm')} <span className="font-mono font-bold text-red-600">DELETE</span>
                </Label>
                <Input
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder="DELETE"
                  className="font-mono text-center"
                  dir="ltr"
                  disabled={isDeleting}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSelectedCategory(null);
                  setConfirmationInput('');
                }}
                disabled={isDeleting}
              >
                {t('common.cancel')}
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDelete}
                disabled={confirmationInput !== 'DELETE' || isDeleting}
              >
                {isDeleting ? (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                    {t('dataManagement.deleting')}
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('dataManagement.delete')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Old Data Dialog */}
        <Dialog open={showOldDataDialog} onOpenChange={setShowOldDataDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <Clock className="h-5 w-5" />
                {t('dataManagement.deleteOldData')}
              </DialogTitle>
              <DialogDescription>
                {t('dataManagement.deleteOldDataConfirm', { days: oldDataDays })}
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-700">
                  {t('dataManagement.oldDataWarning')}
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowOldDataDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button 
                variant="default"
                className="bg-amber-600 hover:bg-amber-700"
                onClick={handleDeleteOldData}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                {t('dataManagement.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Full Reset Dialog */}
        <Dialog open={showResetDialog} onOpenChange={() => {
          setShowResetDialog(false);
          setResetConfirmation('');
          setDeleteProgress(0);
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                {t('dataManagement.factoryReset')}
              </DialogTitle>
              <DialogDescription>
                {t('dataManagement.factoryResetConfirm')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t('dataManagement.dangerZone')}
                </div>
                <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                  <li>{t('dataManagement.allCustomers')}</li>
                  <li>{t('dataManagement.allPackages')}</li>
                  <li>{t('dataManagement.allBatches')}</li>
                  <li>{t('dataManagement.allFinancial')}</li>
                  <li>{t('dataManagement.allScans')}</li>
                  <li>{t('dataManagement.allLogs')}</li>
                </ul>
              </div>

              {isDeleting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{t('dataManagement.resetting')}</span>
                    <span>{deleteProgress}%</span>
                  </div>
                  <Progress value={deleteProgress} className="h-2" />
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  {t('dataManagement.typeToConfirm')} <span className="font-mono font-bold text-red-600">RESET ALL DATA</span>
                </Label>
                <Input
                  value={resetConfirmation}
                  onChange={(e) => setResetConfirmation(e.target.value)}
                  placeholder="RESET ALL DATA"
                  className="font-mono text-center"
                  dir="ltr"
                  disabled={isDeleting}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowResetDialog(false);
                  setResetConfirmation('');
                }}
                disabled={isDeleting}
              >
                {t('common.cancel')}
              </Button>
              <Button 
                variant="destructive"
                onClick={handleResetAll}
                disabled={resetConfirmation !== 'RESET ALL DATA' || isDeleting}
              >
                {isDeleting ? (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                    {t('dataManagement.resetting')}
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {t('dataManagement.resetAllData')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Restore Backup Dialog */}
        <Dialog open={showRestoreDialog} onOpenChange={() => {
          setShowRestoreDialog(false);
          setSelectedBackupId(null);
          setRestoreConfirmation('');
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <RotateCcw className="h-5 w-5" />
                {t('dataManagement.restoreBackup')}
              </DialogTitle>
              <DialogDescription>
                {t('dataManagement.restoreBackupDesc')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t('dataManagement.warning')}
                </div>
                <p className="text-sm text-amber-700">
                  {t('dataManagement.restoreWarning')}
                </p>
              </div>

              <div className="space-y-2">
                <Label>
                  {t('dataManagement.typeToConfirm')} <span className="font-mono font-bold text-amber-600">RESTORE</span>
                </Label>
                <Input
                  value={restoreConfirmation}
                  onChange={(e) => setRestoreConfirmation(e.target.value)}
                  placeholder="RESTORE"
                  className="font-mono text-center"
                  dir="ltr"
                  disabled={restoreBackupMutation.isPending}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowRestoreDialog(false);
                  setSelectedBackupId(null);
                  setRestoreConfirmation('');
                }}
                disabled={restoreBackupMutation.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button 
                variant="default"
                className="bg-amber-600 hover:bg-amber-700"
                onClick={handleRestoreBackup}
                disabled={restoreConfirmation !== 'RESTORE' || restoreBackupMutation.isPending}
              >
                {restoreBackupMutation.isPending ? (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                    {t('dataManagement.restoring')}
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {t('dataManagement.restore')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
