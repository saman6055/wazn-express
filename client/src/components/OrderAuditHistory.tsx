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
  if (action.startsWith("delete")) return "bg-red-100 text-red-700 border-red-200";
  if (action.startsWith("create")) return "bg-green-100 text-green-700 border-green-200";
  if (action.startsWith("update")) return "bg-blue-100 text-blue-700 border-blue-200";
  if (action.includes("status")) return "bg-purple-100 text-purple-700 border-purple-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

export default function OrderAuditHistory({
  entityType = "full_package_order",
  entityId,
}: OrderAuditHistoryProps) {
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
    <Card className="shadow-sm border-0 bg-white">
      <CardHeader className="border-b bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <History className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <CardTitle>مێژووی گۆڕانکاری | Audit History</CardTitle>
            <CardDescription>
              هەموو گۆڕانکاریەکانی ئەم ئۆردەرە — کێ، کەی، هۆکار. | Every change on this
              order — who, when, and why.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading && (
          <div className="text-sm text-muted-foreground text-center py-4">
            بارکردن... | Loading…
          </div>
        )}
        {!isLoading && (!logs || logs.length === 0) && (
          <div className="text-sm text-muted-foreground text-center py-4">
            هیچ مێژوویەک نەدۆزرایەوە. | No audit entries found.
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
                  className="rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
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
                        <div className="mt-1 text-sm text-gray-700" dir="auto">
                          <span className="font-bold text-amber-800">هۆکار | Reason:</span>{" "}
                          {reason}
                        </div>
                      )}
                      {typeof chargeDelta === "number" && Math.abs(chargeDelta) > 0.005 && (
                        <div className="mt-1 text-sm">
                          <span className="font-bold">گۆڕانکاری نرخ | Charge delta:</span>{" "}
                          <span
                            className={`font-mono font-bold ${
                              chargeDelta > 0 ? "text-red-700" : "text-green-700"
                            }`}
                          >
                            {chargeDelta > 0 ? "+" : ""}${chargeDelta.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {typeof reversedCharge === "number" && reversedCharge > 0 && (
                        <div className="mt-1 text-sm">
                          <span className="font-bold">گەڕاندنەوەی نرخ | Charge reversed:</span>{" "}
                          <span className="font-mono font-bold text-green-700">
                            −${reversedCharge.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {typeof reversedAdvance === "number" && reversedAdvance > 0 && (
                        <div className="mt-1 text-sm">
                          <span className="font-bold">گەڕاندنەوەی پێشەکی | Advance reversed:</span>{" "}
                          <span className="font-mono font-bold text-red-700">
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
                    <div className="border-t p-3 bg-gray-50 text-xs space-y-2">
                      {log.oldValues && (
                        <div>
                          <div className="font-bold text-gray-700 mb-1">پێشوو | Before:</div>
                          <pre className="bg-white border rounded p-2 overflow-auto max-h-40 text-[10px]">
                            {JSON.stringify(log.oldValues, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.newValues && (
                        <div>
                          <div className="font-bold text-gray-700 mb-1">دوایی | After:</div>
                          <pre className="bg-white border rounded p-2 overflow-auto max-h-40 text-[10px]">
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
