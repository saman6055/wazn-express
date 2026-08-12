/**
 * Plan v3, Phase 4 — compact audit-history card for an order detail page.
 *
 * Shows every create/update/delete + status change + any reason strings
 * captured during the edit/delete flow. Shown only to admin users (the
 * underlying tRPC query is adminProcedure, so non-admins would get a 403
 * anyway — we render a soft-fail message instead of a scary error toast).
 *
 * Each row compresses to: icon · action · actor · time · reason / delta.
 * Clicking a row expands the full oldValues → newValues diff as JSON.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, ChevronDown, ChevronUp, User, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

interface OrderAuditHistoryProps {
  entityType?: string; // defaults to "full_package_order"
  entityId: number;
}

function formatTime(value: unknown): string {
  if (!value) return "—";
  try {
    const d = new Date(value as any);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  } catch {
    return String(value);
  }
}

function actionColor(action: string): string {
  if (action.startsWith("delete")) return "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60";
  if (action.startsWith("create")) return "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/60";
  if (action.startsWith("update")) return "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60";
  if (action.includes("status")) return "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60";
  return "bg-gray-100 dark:bg-gray-950/40 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800/60";
}

export default function OrderAuditHistory({
  entityType = "full_package_order",
  entityId,
}: OrderAuditHistoryProps) {
  const { language } = useLanguage();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const { data: logs, isLoading, error } = trpc.auditLogs.getByEntity.useQuery(
    { entityType, entityId },
    { enabled: entityId > 0 },
  );

  if (error?.data?.code === "UNAUTHORIZED" || error?.data?.code === "FORBIDDEN") {
    // Non-admin users silently lose the card rather than see a red error.
    return null;
  }

  return (
    <Card className="shadow-sm border-0 bg-white dark:bg-card">
      <CardHeader className="border-b bg-gray-50/50 dark:bg-gray-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-950/40 rounded-lg">
            <History className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
          </div>
          <div>
            <CardTitle>{pickLang(language, { ku: "مێژووی گۆڕانکاری", en: "Audit History", ar: "سجل التعديلات", zh: "审计记录" })}</CardTitle>
            <CardDescription>
              {pickLang(language, {
                ku: "هەموو گۆڕانکاریەکانی ئەم ئۆردەرە — کێ، کەی، هۆکار.",
                en: "Every change on this order — who, when, and why.",
                ar: "كل تعديل على هذا الطلب — من ومتى ولماذا.",
                zh: "此订单的每一次更改——谁、何时、为何。",
              })}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading && (
          <div className="text-sm text-muted-foreground text-center py-4">
            {pickLang(language, { ku: "بارکردن...", en: "Loading…", ar: "جارٍ التحميل…", zh: "加载中…" })}
          </div>
        )}
        {!isLoading && (!logs || logs.length === 0) && (
          <div className="text-sm text-muted-foreground text-center py-4">
            {pickLang(language, {
              ku: "هیچ مێژوویەک نەدۆزرایەوە.",
              en: "No audit entries found.",
              ar: "لم يتم العثور على أي سجلات.",
              zh: "未找到审计记录。",
            })}
          </div>
        )}
        {!isLoading && logs && logs.length > 0 && (
          <ol className="space-y-2">
            {logs.map((log: any) => {
              const isOpen = !!expanded[log.id];
              const reason =
                log.newValues?.reason ??
                log.newValues?.deletionReason ??
                null;
              const chargeDelta = log.newValues?.chargeDeltaUsd;
              const reversedCharge = log.newValues?.reversedChargeUsd;
              const reversedAdvance = log.newValues?.reversedAdvanceUsd;

              return (
                <li
                  key={log.id}
                  className="rounded-lg border border-gray-200 dark:border-gray-800/60 hover:border-gray-300 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((p) => ({ ...p, [log.id]: !p[log.id] }))
                    }
                    className="w-full p-3 flex items-start gap-3 text-left"
                  >
                    <Badge className={`${actionColor(log.action)} shrink-0 font-mono text-xs`}>
                      {log.action}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {log.userName ?? `user #${log.userId ?? "?"}`}
                          {log.userRole ? ` · ${log.userRole}` : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(log.createdAt)}
                        </span>
                      </div>
                      {reason && (
                        <div className="mt-1 text-sm text-gray-700 dark:text-gray-300" dir="auto">
                          <span className="font-bold text-amber-800 dark:text-amber-200">{pickLang(language, { ku: "هۆکار", en: "Reason", ar: "السبب", zh: "原因" })}:</span>{" "}
                          {reason}
                        </div>
                      )}
                      {typeof chargeDelta === "number" && Math.abs(chargeDelta) > 0.005 && (
                        <div className="mt-1 text-sm">
                          <span className="font-bold">{pickLang(language, { ku: "گۆڕانکاری نرخ", en: "Charge delta", ar: "فرق الرسوم", zh: "费用变动" })}:</span>{" "}
                          <span
                            className={`font-mono font-bold ${
                              chargeDelta > 0 ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300"
                            }`}
                          >
                            {chargeDelta > 0 ? "+" : ""}${chargeDelta.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {typeof reversedCharge === "number" && reversedCharge > 0 && (
                        <div className="mt-1 text-sm">
                          <span className="font-bold">{pickLang(language, { ku: "گەڕاندنەوەی نرخ", en: "Charge reversed", ar: "إلغاء الرسوم", zh: "费用已撤销" })}:</span>{" "}
                          <span className="font-mono font-bold text-green-700 dark:text-green-300">
                            −${reversedCharge.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {typeof reversedAdvance === "number" && reversedAdvance > 0 && (
                        <div className="mt-1 text-sm">
                          <span className="font-bold">{pickLang(language, { ku: "گەڕاندنەوەی پێشەکی", en: "Advance reversed", ar: "إلغاء الدفعة المقدمة", zh: "预付款已撤销" })}:</span>{" "}
                          <span className="font-mono font-bold text-red-700 dark:text-red-300">
                            +${reversedAdvance.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-gray-400 shrink-0 mt-1" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 mt-1" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="border-t p-3 bg-gray-50 dark:bg-gray-950/40 text-xs space-y-2">
                      {log.oldValues && (
                        <div>
                          <div className="font-bold text-gray-700 dark:text-gray-300 mb-1">{pickLang(language, { ku: "پێشوو", en: "Before", ar: "قبل", zh: "之前" })}:</div>
                          <pre className="bg-white dark:bg-card border rounded p-2 overflow-auto max-h-40 text-[10px]">
                            {JSON.stringify(log.oldValues, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.newValues && (
                        <div>
                          <div className="font-bold text-gray-700 dark:text-gray-300 mb-1">{pickLang(language, { ku: "دوایی", en: "After", ar: "بعد", zh: "之后" })}:</div>
                          <pre className="bg-white dark:bg-card border rounded p-2 overflow-auto max-h-40 text-[10px]">
                            {JSON.stringify(log.newValues, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.ipAddress && (
                        <div className="text-muted-foreground">
                          IP: <span className="font-mono">{log.ipAddress}</span>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
