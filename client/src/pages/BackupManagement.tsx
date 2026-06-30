import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Database, Download, Trash2, RefreshCw, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

export default function BackupManagement() {
  const { language } = useTranslation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [backupContent, setBackupContent] = useState<"database_only" | "files_only" | "full">("database_only");
  const [selectedStatus, setSelectedStatus] = useState<"in_progress" | "completed" | "failed" | undefined>();

  const { data: backups, isLoading, refetch } = trpc.backup.list.useQuery({
    status: selectedStatus,
    limit: 50,
    offset: 0,
  });

  const createBackup = trpc.backup.create.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "بەکاپ دەستی پێکرد", en: "Backup started", ar: "بدأ النسخ الاحتياطي", zh: "备份已开始" }));
      refetch();
    },
    onError: (error) => {
      toast.error(`${pickLang(language, { ku: "هەڵە", en: "Error", ar: "خطأ", zh: "错误" })}: ${error.message}`);
    },
  });

  const deleteBackup = trpc.backup.delete.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "بەکاپ سڕایەوە", en: "Backup deleted", ar: "تم حذف النسخة الاحتياطية", zh: "备份已删除" }));
      refetch();
    },
    onError: (error) => {
      toast.error(`${pickLang(language, { ku: "هەڵە", en: "Error", ar: "خطأ", zh: "错误" })}: ${error.message}`);
    },
  });

  const restoreBackup = trpc.backup.restore.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "داتابەیس گەڕایەوە", en: "Database restored", ar: "تمت استعادة قاعدة البيانات", zh: "数据库已恢复" }));
    },
    onError: (error) => {
      toast.error(`${pickLang(language, { ku: "هەڵە", en: "Error", ar: "خطأ", zh: "错误" })}: ${error.message}`);
    },
  });

  const handleCreateBackup = () => {
    setShowCreateDialog(true);
  };

  const confirmCreateBackup = () => {
    createBackup.mutate({ backupType: "manual", backupContent });
    setShowCreateDialog(false);
  };

  const handleDownload = (fileUrl: string) => {
    window.open(fileUrl, "_blank");
  };

  const handleDelete = (id: number) => {
    if (confirm(pickLang(language, { ku: "ئایا دڵنیایت لە سڕینەوەی ئەم بەکاپە؟", en: "Are you sure you want to delete this backup?", ar: "هل أنت متأكد من حذف هذه النسخة الاحتياطية؟", zh: "确定要删除此备份吗？" }))) {
      deleteBackup.mutate({ id });
    }
  };

  const handleRestore = (id: number) => {
    // Find the backup to check if it's a full backup
    const backup = backups?.find(b => b.id === id);
    const isFull = backup?.backupContent === "full";

    const warning = "⚠️ " + pickLang(language, { ku: "ئاگاداری گرنگ!", en: "Important warning!", ar: "تحذير هام!", zh: "重要警告！" }) + "\n\n"
      + pickLang(language, { ku: "گەڕاندنەوەی بەکاپ هەموو داتاکانی ئێستا دەسڕێتەوە و دەیگۆڕێت بە داتاکانی بەکاپ.", en: "Restoring a backup will erase all current data and replace it with the backup data.", ar: "ستؤدي استعادة النسخة الاحتياطية إلى مسح جميع البيانات الحالية واستبدالها ببيانات النسخة الاحتياطية.", zh: "恢复备份将清除所有当前数据并替换为备份数据。" }) + "\n\n"
      + (isFull ? pickLang(language, { ku: "ئەم بەکاپە بەکاپی تەواوە (داتابەیس + فایلەکان).", en: "This is a full backup (database + files).", ar: "هذه نسخة احتياطية كاملة (قاعدة البيانات + الملفات).", zh: "这是完整备份（数据库 + 文件）。" }) + "\n\n" : "")
      + pickLang(language, { ku: "پێش لە گەڕاندنەوە، دڵنیا بە لە دروستکردنی بەکاپی نوێ.", en: "Before restoring, make sure to create a new backup.", ar: "قبل الاستعادة، تأكد من إنشاء نسخة احتياطية جديدة.", zh: "恢复前，请务必创建新备份。" }) + "\n\n"
      + pickLang(language, { ku: "ئایا دڵنیایت لە بەردەوامبوون؟", en: "Are you sure you want to continue?", ar: "هل أنت متأكد من المتابعة؟", zh: "确定要继续吗？" });

    if (confirm(warning)) {
      // Second confirmation
      if (confirm(pickLang(language, { ku: "دووبارە دڵنیاکردنەوە: بچۆ بۆ گەڕاندنەوە؟", en: "Confirm again: proceed with restore?", ar: "تأكيد مرة أخرى: المتابعة بالاستعادة؟", zh: "再次确认：继续恢复？" }))) {
        restoreBackup.mutate({ id });
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 me-1" />{pickLang(language, { ku: "تەواو", en: "Completed", ar: "مكتمل", zh: "已完成" })}</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500"><Clock className="w-3 h-3 me-1" />{pickLang(language, { ku: "لە پرۆسەدایە", en: "In progress", ar: "قيد التنفيذ", zh: "进行中" })}</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 me-1" />{pickLang(language, { ku: "شکستی هێنا", en: "Failed", ar: "فشل", zh: "失败" })}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return pickLang(language, { ku: "نەزانراو", en: "Unknown", ar: "غير معروف", zh: "未知" });
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="w-8 h-8" />
            {pickLang(language, { ku: "بەڕێوەبردنی بەکاپ", en: "Backup Management", ar: "إدارة النسخ الاحتياطية", zh: "备份管理" })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {pickLang(language, { ku: "دروستکردن و گەڕاندنەوەی بەکاپەکانی داتابەیس", en: "Create and restore database backups", ar: "إنشاء واستعادة النسخ الاحتياطية لقاعدة البيانات", zh: "创建和恢复数据库备份" })}
          </p>
        </div>
        <Button onClick={handleCreateBackup} disabled={createBackup.isPending} size="lg">
          <Database className="w-4 h-4 me-2" />
          {pickLang(language, { ku: "دروستکردنی بەکاپی نوێ", en: "Create new backup", ar: "إنشاء نسخة احتياطية جديدة", zh: "创建新备份" })}
        </Button>
      </div>

      {/* Create Backup Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{pickLang(language, { ku: "دروستکردنی بەکاپی نوێ", en: "Create new backup", ar: "إنشاء نسخة احتياطية جديدة", zh: "创建新备份" })}</CardTitle>
              <CardDescription>{pickLang(language, { ku: "جۆری بەکاپ هەڵبژێرە", en: "Choose backup type", ar: "اختر نوع النسخة الاحتياطية", zh: "选择备份类型" })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center space-x-3 space-x-reverse p-3 border rounded-lg cursor-pointer hover:bg-accent">
                  <input
                    type="radio"
                    name="backupContent"
                    value="database_only"
                    checked={backupContent === "database_only"}
                    onChange={(e) => setBackupContent(e.target.value as any)}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium">{pickLang(language, { ku: "تەنها داتابەیس", en: "Database only", ar: "قاعدة البيانات فقط", zh: "仅数据库" })}</div>
                    <div className="text-sm text-muted-foreground">{pickLang(language, { ku: "بەکاپی هەموو خشتەکان و داتاکان (.sql)", en: "Backup of all tables and data (.sql)", ar: "نسخة احتياطية لجميع الجداول والبيانات (.sql)", zh: "备份所有表和数据 (.sql)" })}</div>
                  </div>
                </label>

                <label className="flex items-center space-x-3 space-x-reverse p-3 border rounded-lg cursor-pointer hover:bg-accent">
                  <input
                    type="radio"
                    name="backupContent"
                    value="files_only"
                    checked={backupContent === "files_only"}
                    onChange={(e) => setBackupContent(e.target.value as any)}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium">{pickLang(language, { ku: "تەنها فایلەکان", en: "Files only", ar: "الملفات فقط", zh: "仅文件" })}</div>
                    <div className="text-sm text-muted-foreground">{pickLang(language, { ku: "بەکاپی هەموو فایلە upload کراوەکان (.zip)", en: "Backup of all uploaded files (.zip)", ar: "نسخة احتياطية لجميع الملفات المرفوعة (.zip)", zh: "备份所有上传的文件 (.zip)" })}</div>
                  </div>
                </label>

                <label className="flex items-center space-x-3 space-x-reverse p-3 border rounded-lg cursor-pointer hover:bg-accent">
                  <input
                    type="radio"
                    name="backupContent"
                    value="full"
                    checked={backupContent === "full"}
                    onChange={(e) => setBackupContent(e.target.value as any)}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium">{pickLang(language, { ku: "بەکاپی تەواو", en: "Full backup", ar: "نسخة احتياطية كاملة", zh: "完整备份" })}</div>
                    <div className="text-sm text-muted-foreground">{pickLang(language, { ku: "داتابەیس + فایلەکان (پێشنیاری ئۆفلاین)", en: "Database + files (recommended for offline)", ar: "قاعدة البيانات + الملفات (موصى به للعمل دون اتصال)", zh: "数据库 + 文件（推荐离线使用）" })}</div>
                  </div>
                </label>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  {pickLang(language, { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
                </Button>
                <Button onClick={confirmCreateBackup} disabled={createBackup.isPending}>
                  {pickLang(language, { ku: "دروستکردن", en: "Create", ar: "إنشاء", zh: "创建" })}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{pickLang(language, { ku: "کۆی بەکاپەکان", en: "Total backups", ar: "إجمالي النسخ الاحتياطية", zh: "备份总数" })}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{backups?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{pickLang(language, { ku: "بەکاپی تەواو", en: "Completed backups", ar: "النسخ الاحتياطية المكتملة", zh: "已完成备份" })}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {backups?.filter(b => b.status === "completed").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{pickLang(language, { ku: "بەکاپی شکستخواردوو", en: "Failed backups", ar: "النسخ الاحتياطية الفاشلة", zh: "失败的备份" })}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {backups?.filter(b => b.status === "failed").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <Button
          variant={selectedStatus === undefined ? "default" : "outline"}
          onClick={() => setSelectedStatus(undefined)}
        >
          {pickLang(language, { ku: "هەموو", en: "All", ar: "الكل", zh: "全部" })}
        </Button>
        <Button
          variant={selectedStatus === "completed" ? "default" : "outline"}
          onClick={() => setSelectedStatus("completed")}
        >
          {pickLang(language, { ku: "تەواو", en: "Completed", ar: "مكتمل", zh: "已完成" })}
        </Button>
        <Button
          variant={selectedStatus === "in_progress" ? "default" : "outline"}
          onClick={() => setSelectedStatus("in_progress")}
        >
          {pickLang(language, { ku: "لە پرۆسەدایە", en: "In progress", ar: "قيد التنفيذ", zh: "进行中" })}
        </Button>
        <Button
          variant={selectedStatus === "failed" ? "default" : "outline"}
          onClick={() => setSelectedStatus("failed")}
        >
          {pickLang(language, { ku: "شکستخواردوو", en: "Failed", ar: "فشل", zh: "失败" })}
        </Button>
      </div>

      {/* Backups List */}
      <Card>
        <CardHeader>
          <CardTitle>{pickLang(language, { ku: "لیستی بەکاپەکان", en: "Backup list", ar: "قائمة النسخ الاحتياطية", zh: "备份列表" })}</CardTitle>
          <CardDescription>{pickLang(language, { ku: "هەموو بەکاپەکانی داتابەیس", en: "All database backups", ar: "جميع النسخ الاحتياطية لقاعدة البيانات", zh: "所有数据库备份" })}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">{pickLang(language, { ku: "باردەکرێت...", en: "Loading...", ar: "جارٍ التحميل...", zh: "加载中..." })}</p>
            </div>
          ) : backups && backups.length > 0 ? (
            <div className="space-y-3">
              {backups.map((backup: any) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{backup.filename}</h3>
                      {getStatusBadge(backup.status)}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>{pickLang(language, { ku: "قەبارە", en: "Size", ar: "الحجم", zh: "大小" })}: {formatFileSize(backup.fileSize)}</p>
                      <p>{pickLang(language, { ku: "دروستکراوە", en: "Created", ar: "تم الإنشاء", zh: "创建于" })}: {backup.createdAt ? formatDistanceToNow(new Date(backup.createdAt), { addSuffix: true }) : pickLang(language, { ku: "نەزانراو", en: "Unknown", ar: "غير معروف", zh: "未知" })}</p>
                      {backup.createdByName && <p>{pickLang(language, { ku: "دروستکراوە لەلایەن", en: "Created by", ar: "أنشأها", zh: "创建者" })}: {backup.createdByName}</p>}
                      {backup.errorMessage && (
                        <p className="text-red-600">{pickLang(language, { ku: "هەڵە", en: "Error", ar: "خطأ", zh: "错误" })}: {backup.errorMessage}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {backup.status === "completed" && backup.fileUrl && (
                      <>
                        {backup.backupContent === "full" && backup.filesZipUrl ? (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                handleDownload(backup.fileUrl!);
                                setTimeout(() => handleDownload(backup.filesZipUrl!), 1000);
                              }}
                              title={pickLang(language, { ku: "دابەزاندنی هەردووکیان (SQL + ZIP)", en: "Download both (SQL + ZIP)", ar: "تنزيل كليهما (SQL + ZIP)", zh: "下载两者 (SQL + ZIP)" })}
                            >
                              <Download className="w-4 h-4 me-1" />
                              {pickLang(language, { ku: "هەردووکیان", en: "Both", ar: "كلاهما", zh: "两者" })}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(backup.fileUrl!)}
                              title={pickLang(language, { ku: "تەنها داتابەیس", en: "Database only", ar: "قاعدة البيانات فقط", zh: "仅数据库" })}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(backup.filesZipUrl!)}
                              title={pickLang(language, { ku: "تەنها فایلەکان", en: "Files only", ar: "الملفات فقط", zh: "仅文件" })}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(backup.fileUrl!)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(backup.id)}
                          disabled={restoreBackup.isPending}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(backup.id)}
                      disabled={deleteBackup.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Database className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">{pickLang(language, { ku: "هیچ بەکاپێک نییە", en: "No backups", ar: "لا توجد نسخ احتياطية", zh: "暂无备份" })}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
