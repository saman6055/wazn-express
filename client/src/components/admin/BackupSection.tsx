import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  FolderArchive,
  Database,
  Download,
  RotateCcw,
  Trash2,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Cloud,
  AlertTriangle,
} from "lucide-react";

interface BackupItem {
  id: number;
  filename: string;
  status: string;
  backupContent: string;
  backupType?: string;
  fileSize?: number | null;
  createdAt: string | Date;
  createdByName?: string;
  fileUrl?: string;
  errorMessage?: string;
}

interface ScheduleConfigItem {
  schedule: string;
  description: string;
  enabled: boolean;
}

interface BackupSectionProps {
  backupType: "database_only" | "files_only" | "full";
  setBackupType: (v: "database_only" | "files_only" | "full") => void;
  isCreatingBackup: boolean;
  showRestoreDialog: boolean;
  setShowRestoreDialog: (v: boolean) => void;
  selectedBackupId: number | null;
  setSelectedBackupId: (v: number | null) => void;
  restoreConfirmation: string;
  setRestoreConfirmation: (v: string) => void;
  backupsList: BackupItem[] | undefined;
  backupsLoading: boolean;
  scheduleConfig: ScheduleConfigItem[] | undefined;
  refetchBackups: () => void;
  formatFileSize: (bytes: number | null | undefined) => string;
  handleCreateBackup: () => void;
  handleRestoreBackup: () => void;
  handleDeleteBackup: (id: number) => void;
  updateScheduleMutation: { mutate: (opts: { schedule: "daily" | "weekly" | "monthly"; enabled: boolean }) => void };
  restoreBackupMutation: { isPending: boolean };
  language: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function getBackupStatusBadge(status: string, t: (key: string) => string) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800/60">
          <CheckCircle2 className="h-3 w-3 me-1" />
          {t("dataManagement.completed")}
        </Badge>
      );
    case "in_progress":
      return (
        <Badge className="bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800/60">
          <RefreshCw className="h-3 w-3 me-1 animate-spin" />
          {t("dataManagement.inProgress")}
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800/60">
          <AlertCircle className="h-3 w-3 me-1" />
          {t("dataManagement.failed")}
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getBackupTypeBadge(type: string, t: (key: string) => string) {
  switch (type) {
    case "database_only":
      return (
        <Badge variant="outline" className="text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-800/60">
          <Database className="h-3 w-3 me-1" />
          {t("dataManagement.databaseOnly")}
        </Badge>
      );
    case "files_only":
      return (
        <Badge variant="outline" className="text-purple-600 dark:text-purple-300 border-purple-200 dark:border-purple-800/60">
          <FolderArchive className="h-3 w-3 me-1" />
          {t("dataManagement.filesOnly")}
        </Badge>
      );
    case "full":
      return (
        <Badge variant="outline" className="text-green-600 dark:text-green-300 border-green-200 dark:border-green-800/60">
          <Cloud className="h-3 w-3 me-1" />
          {t("dataManagement.fullBackup")}
        </Badge>
      );
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}

export function BackupSection({
  backupType,
  setBackupType,
  isCreatingBackup,
  showRestoreDialog,
  setShowRestoreDialog,
  selectedBackupId,
  setSelectedBackupId,
  restoreConfirmation,
  setRestoreConfirmation,
  backupsList,
  backupsLoading,
  scheduleConfig,
  refetchBackups,
  formatFileSize,
  handleCreateBackup,
  handleRestoreBackup,
  handleDeleteBackup,
  updateScheduleMutation,
  restoreBackupMutation,
  language,
  t,
}: BackupSectionProps) {
  const locale = language === "ku" ? "ckb-IQ" : "en-US";

  return (
    <>
      <Card className="border-green-200 dark:border-green-800/60">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 dark:bg-green-950/40 rounded-lg">
              <Save className="h-5 w-5 text-green-600 dark:text-green-300" />
            </div>
            <div>
              <CardTitle>{t("dataManagement.createBackup")}</CardTitle>
              <CardDescription>{t("dataManagement.createBackupDesc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card
              className={`cursor-pointer transition-all ${
                backupType === "database_only" ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40" : "hover:border-blue-300"
              }`}
              onClick={() => setBackupType("database_only")}
            >
              <CardContent className="p-4 text-center">
                <Database className="h-8 w-8 mx-auto mb-2 text-blue-600 dark:text-blue-300" />
                <div className="font-medium">{t("dataManagement.databaseOnly")}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("dataManagement.databaseOnlyDesc")}</div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${
                backupType === "files_only" ? "border-purple-500 bg-purple-50 dark:bg-purple-950/40" : "hover:border-purple-300"
              }`}
              onClick={() => setBackupType("files_only")}
            >
              <CardContent className="p-4 text-center">
                <FolderArchive className="h-8 w-8 mx-auto mb-2 text-purple-600 dark:text-purple-300" />
                <div className="font-medium">{t("dataManagement.filesOnly")}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("dataManagement.filesOnlyDesc")}</div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${
                backupType === "full" ? "border-green-500 bg-green-50 dark:bg-green-950/40" : "hover:border-green-300"
              }`}
              onClick={() => setBackupType("full")}
            >
              <CardContent className="p-4 text-center">
                <FolderArchive className="h-8 w-8 mx-auto mb-2 text-green-600 dark:text-green-300" />
                <div className="font-medium">{t("dataManagement.fullBackup")}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("dataManagement.fullBackupDesc")}</div>
                <Badge variant="outline" className="mt-2 text-green-600 dark:text-green-300 border-green-300 dark:border-green-800/60">
                  <Download className="h-3 w-3 me-1" />
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
              <>
                <RefreshCw className="h-4 w-4 me-2 animate-spin" /> {t("dataManagement.creatingBackup")}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 me-2" /> {t("dataManagement.createBackupNow")}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
                <FolderArchive className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <CardTitle>{t("dataManagement.backupList")}</CardTitle>
                <CardDescription>{t("dataManagement.backupListDesc")}</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchBackups()}>
              <RefreshCw className="h-4 w-4 me-2" />
              {t("common.refresh")}
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
              {backupsList.map((backup) => (
                <Card key={backup.id} className="border-slate-200 dark:border-slate-800/60">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            backup.status === "completed"
                              ? "bg-green-100 dark:bg-green-950/40"
                              : backup.status === "in_progress"
                                ? "bg-blue-100 dark:bg-blue-950/40"
                                : "bg-red-100 dark:bg-red-950/40"
                          }`}
                        >
                          {backup.status === "completed" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-300" />
                          ) : backup.status === "in_progress" ? (
                            <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-300 animate-spin" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-300" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{backup.filename}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {getBackupStatusBadge(backup.status, t)}
                            {getBackupTypeBadge(backup.backupContent, t)}
                            {backup.backupType === "scheduled" && (
                              <Badge variant="outline" className="text-amber-600 dark:text-amber-300 border-amber-200 dark:border-amber-800/60">
                                <Clock className="h-3 w-3 me-1" />
                                {t("dataManagement.scheduled")}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-2">
                            {backup.fileSize != null && <span className="me-4">{formatFileSize(backup.fileSize)}</span>}
                            {backup.createdByName && (
                              <span>
                                {t("dataManagement.createdBy")}: {backup.createdByName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-sm text-muted-foreground">
                          {new Date(backup.createdAt).toLocaleDateString(locale)}
                        </div>
                        <div className="flex items-center gap-2">
                          {backup.status === "completed" && backup.fileUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`${window.location.origin}/api/backup-file/${backup.id}`, "_blank")}
                            >
                              <Download className="h-3 w-3 me-1" />
                              {t("dataManagement.download")}
                            </Button>
                          )}
                          {backup.status === "completed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-amber-600 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 hover:bg-amber-50"
                              onClick={() => {
                                setSelectedBackupId(backup.id);
                                setShowRestoreDialog(true);
                              }}
                            >
                              <RotateCcw className="h-3 w-3 me-1" />
                              {t("dataManagement.restore")}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 dark:text-red-300 hover:bg-red-50"
                            onClick={() => handleDeleteBackup(backup.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {backup.errorMessage && (
                      <div className="mt-3 p-2 bg-red-50 dark:bg-red-950/40 rounded text-sm text-red-700 dark:text-red-300">{backup.errorMessage}</div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FolderArchive className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{t("dataManagement.noBackups")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-200 dark:border-amber-800/60">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-300" />
            </div>
            <div>
              <CardTitle>{t("dataManagement.autoBackup")}</CardTitle>
              <CardDescription>{t("dataManagement.autoBackupDesc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {scheduleConfig?.map((config) => (
              <div key={config.schedule} className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-950/40 rounded-lg">
                <div>
                  <div className="font-medium">{t(`dataManagement.${config.schedule}`)}</div>
                  <div className="text-sm text-muted-foreground">
                    {config.enabled
                      ? t("dataManagement.scheduleActive", { schedule: config.description })
                      : t("dataManagement.scheduleInactive")}
                  </div>
                </div>
                <Button
                  variant={config.enabled ? "destructive" : "default"}
                  size="sm"
                  onClick={() =>
                    updateScheduleMutation.mutate({
                      schedule: config.schedule as "daily" | "weekly" | "monthly",
                      enabled: !config.enabled,
                    })
                  }
                >
                  {config.enabled ? t("dataManagement.disable") : t("dataManagement.enable")}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={showRestoreDialog}
        onOpenChange={() => {
          setShowRestoreDialog(false);
          setSelectedBackupId(null);
          setRestoreConfirmation("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-300">
              <RotateCcw className="h-5 w-5" />
              {t("dataManagement.restoreBackup")}
            </DialogTitle>
            <DialogDescription>{t("dataManagement.restoreBackupDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-medium mb-2">
                <AlertTriangle className="h-4 w-4" />
                {t("dataManagement.warning")}
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-300">{t("dataManagement.restoreWarning")}</p>
            </div>
            <div className="space-y-2">
              <Label>
                {t("dataManagement.typeToConfirm")}{" "}
                <span className="font-mono font-bold text-amber-600 dark:text-amber-300">RESTORE</span>
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
                setRestoreConfirmation("");
              }}
              disabled={restoreBackupMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="default"
              className="bg-amber-600 hover:bg-amber-700"
              onClick={handleRestoreBackup}
              disabled={restoreConfirmation !== "RESTORE" || restoreBackupMutation.isPending}
            >
              {restoreBackupMutation.isPending ? (
                <>
                  <RotateCcw className="h-4 w-4 me-2 animate-spin" />
                  {t("dataManagement.restoring")}
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 me-2" />
                  {t("dataManagement.restore")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
