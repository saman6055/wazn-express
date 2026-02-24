import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Database, Download, Trash2, RefreshCw, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function BackupManagement() {
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
      toast.success("بەکاپ دەستی پێکرد");
      refetch();
    },
    onError: (error) => {
      toast.error(`هەڵە: ${error.message}`);
    },
  });

  const deleteBackup = trpc.backup.delete.useMutation({
    onSuccess: () => {
      toast.success("بەکاپ سڕایەوە");
      refetch();
    },
    onError: (error) => {
      toast.error(`هەڵە: ${error.message}`);
    },
  });

  const restoreBackup = trpc.backup.restore.useMutation({
    onSuccess: () => {
      toast.success("داتابەیس گەڕایەوە");
    },
    onError: (error) => {
      toast.error(`هەڵە: ${error.message}`);
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
    if (confirm("ئایا دڵنیایت لە سڕینەوەی ئەم بەکاپە؟")) {
      deleteBackup.mutate({ id });
    }
  };

  const handleRestore = (id: number) => {
    // Find the backup to check if it's a full backup
    const backup = backups?.find(b => b.id === id);
    const isFull = backup?.backupContent === "full";
    
    const warning = "⚠️ ئاگاداری گرنگ!\n\n"
      + "گەڕاندنەوەی بەکاپ هەموو داتاکانی ئێستا دەسڕێتەوە و دەیگۆڕێت بە داتاکانی بەکاپ.\n\n"
      + (isFull ? "ئەم بەکاپە بەکاپی تەواوە (داتابەیس + فایلەکان).\n\n" : "")
      + "پێش لە گەڕاندنەوە، دڵنیا بە لە دروستکردنی بەکاپی نوێ.\n\n"
      + "ئایا دڵنیایت لە بەردەوامبوون؟";
    
    if (confirm(warning)) {
      // Second confirmation
      if (confirm("دووبارە دڵنیاکردنەوە: بچۆ بۆ گەڕاندنەوە؟")) {
        restoreBackup.mutate({ id });
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 me-1" />تەواو</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500"><Clock className="w-3 h-3 me-1" />لە پرۆسەدایە</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 me-1" />شکستی هێنا</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "نەزانراو";
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
            بەڕێوەبردنی بەکاپ
          </h1>
          <p className="text-muted-foreground mt-1">
            دروستکردن و گەڕاندنەوەی بەکاپەکانی داتابەیس
          </p>
        </div>
        <Button onClick={handleCreateBackup} disabled={createBackup.isPending} size="lg">
          <Database className="w-4 h-4 me-2" />
          دروستکردنی بەکاپی نوێ
        </Button>
      </div>

      {/* Create Backup Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>دروستکردنی بەکاپی نوێ</CardTitle>
              <CardDescription>جۆری بەکاپ هەڵبژێرە</CardDescription>
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
                    <div className="font-medium">تەنها داتابەیس</div>
                    <div className="text-sm text-muted-foreground">بەکاپی هەموو خشتەکان و داتاکان (.sql)</div>
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
                    <div className="font-medium">تەنها فایلەکان</div>
                    <div className="text-sm text-muted-foreground">بەکاپی هەموو فایلە upload کراوەکان (.zip)</div>
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
                    <div className="font-medium">بەکاپی تەواو</div>
                    <div className="text-sm text-muted-foreground">داتابەیس + فایلەکان (پێشنیاری ئۆفلاین)</div>
                  </div>
                </label>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  پاشگەزبوونەوە
                </Button>
                <Button onClick={confirmCreateBackup} disabled={createBackup.isPending}>
                  دروستکردن
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
            <CardTitle className="text-sm font-medium text-muted-foreground">کۆی بەکاپەکان</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{backups?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">بەکاپی تەواو</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {backups?.filter(b => b.status === "completed").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">بەکاپی شکستخواردوو</CardTitle>
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
          هەموو
        </Button>
        <Button
          variant={selectedStatus === "completed" ? "default" : "outline"}
          onClick={() => setSelectedStatus("completed")}
        >
          تەواو
        </Button>
        <Button
          variant={selectedStatus === "in_progress" ? "default" : "outline"}
          onClick={() => setSelectedStatus("in_progress")}
        >
          لە پرۆسەدایە
        </Button>
        <Button
          variant={selectedStatus === "failed" ? "default" : "outline"}
          onClick={() => setSelectedStatus("failed")}
        >
          شکستخواردوو
        </Button>
      </div>

      {/* Backups List */}
      <Card>
        <CardHeader>
          <CardTitle>لیستی بەکاپەکان</CardTitle>
          <CardDescription>هەموو بەکاپەکانی داتابەیس</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">باردەکرێت...</p>
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
                      <p>قەبارە: {formatFileSize(backup.fileSize)}</p>
                      <p>دروستکراوە: {backup.createdAt ? formatDistanceToNow(new Date(backup.createdAt), { addSuffix: true }) : "نەزانراو"}</p>
                      {backup.createdByName && <p>دروستکراوە لەلایەن: {backup.createdByName}</p>}
                      {backup.errorMessage && (
                        <p className="text-red-600">هەڵە: {backup.errorMessage}</p>
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
                              title="دابەزاندنی هەردووکیان (SQL + ZIP)"
                            >
                              <Download className="w-4 h-4 me-1" />
                              هەردووکیان
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(backup.fileUrl!)}
                              title="تەنها داتابەیس"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(backup.filesZipUrl!)}
                              title="تەنها فایلەکان"
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
              <p className="text-muted-foreground">هیچ بەکاپێک نییە</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
