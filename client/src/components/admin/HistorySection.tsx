import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCcw, History, Trash2, AlertTriangle, CheckCircle2, Download, AlertCircle } from "lucide-react";

interface ResetItem {
  id: string;
  deletedByName?: string;
  backupCreated?: boolean;
  backupFileUrl?: string;
  deletedAt: string;
}

interface DeletionLog {
  id: string;
  category: string;
  recordCount: number;
  deletionType: string;
  deletedByName?: string;
  deletedAt: string;
  backupCreated?: boolean;
}

interface HistorySectionProps {
  resetHistory: { resets?: ResetItem[] } | undefined;
  resetHistoryLoading: boolean;
  deletionLogs: { logs?: DeletionLog[]; total?: number } | undefined;
  deletionLogsLoading: boolean;
  refetchResetHistory: () => void;
  refetchLogs: () => void;
  language: string;
  t: (key: string) => string;
}

export function HistorySection({
  resetHistory,
  resetHistoryLoading,
  deletionLogs,
  deletionLogsLoading,
  refetchResetHistory,
  refetchLogs,
  language,
  t,
}: HistorySectionProps) {
  const locale =
    language === "ku" ? "ckb-IQ" : language === "ar" ? "ar-IQ" : language === "zh" ? "zh-CN" : "en-US";

  return (
    <>
      <Card className="border-red-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <RotateCcw className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-red-700">{t("dataManagement.resetHistory")}</CardTitle>
                <CardDescription>{t("dataManagement.resetHistoryDesc")}</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchResetHistory()}>
              <RotateCcw className="h-4 w-4 mr-2" />
              {t("common.refresh")}
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
              {resetHistory.resets.map((reset) => (
                <Card key={reset.id} className="border-red-100 bg-red-50/30">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-red-100">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        </div>
                        <div>
                          <div className="font-medium text-red-700">{t("dataManagement.factoryReset")}</div>
                          <div className="text-sm text-muted-foreground">
                            {t("dataManagement.deletedBy")}: {reset.deletedByName ?? "Unknown"}
                          </div>
                          {reset.backupCreated && (
                            <div className="mt-2 space-y-1">
                              <span className="inline-flex items-center rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {t("dataManagement.backupCreatedBeforeReset")}
                              </span>
                              {reset.backupFileUrl && (
                                <div>
                                  <a
                                    href={reset.backupFileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    <Download className="h-3 w-3" />
                                    {t("dataManagement.downloadBackup")}
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                          {!reset.backupCreated && (
                            <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 mt-2">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              {t("dataManagement.noBackupCreated")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          {new Date(reset.deletedAt).toLocaleDateString(locale)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(reset.deletedAt).toLocaleTimeString(locale)}
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
              <p>{t("dataManagement.noResetHistory")}</p>
              <p className="text-xs mt-1">{t("dataManagement.noResetHistoryDesc")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <History className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle>{t("dataManagement.deletionHistory")}</CardTitle>
                <CardDescription>{t("dataManagement.deletionHistoryDesc")}</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchLogs()}>
              <RotateCcw className="h-4 w-4 mr-2" />
              {t("common.refresh")}
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
              {deletionLogs.logs.map((log) => (
                <Card key={log.id} className="border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            log.deletionType === "factory_reset"
                              ? "bg-red-100"
                              : log.deletionType === "old_data"
                                ? "bg-amber-100"
                                : "bg-slate-100"
                          }`}
                        >
                          <Trash2
                            className={`h-4 w-4 ${
                              log.deletionType === "factory_reset"
                                ? "text-red-600"
                                : log.deletionType === "old_data"
                                  ? "text-amber-600"
                                  : "text-slate-600"
                            }`}
                          />
                        </div>
                        <div>
                          <div className="font-medium">
                            {t(`dataManagement.${log.category}`)} - {log.recordCount}{" "}
                            {t("dataManagement.records")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t(`dataManagement.deletionType.${log.deletionType}`)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {t("dataManagement.deletedBy")}: {log.deletedByName ?? "Unknown"}
                          </div>
                          {log.backupCreated && (
                            <span className="inline-flex items-center rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 mt-2">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {t("dataManagement.backupCreated")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          {new Date(log.deletedAt).toLocaleDateString(locale)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(log.deletedAt).toLocaleTimeString(locale)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {deletionLogs.total != null && deletionLogs.total > 10 && (
                <div className="text-center text-sm text-muted-foreground">
                  {t("dataManagement.showingLogs", {
                    shown: deletionLogs.logs.length,
                    total: deletionLogs.total,
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{t("dataManagement.noHistory")}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
