import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Edit, Trash2, DollarSign, RotateCcw } from "lucide-react";

interface ActivityLog {
  id: string;
  action: string;
  userRole?: string;
  createdAt: string;
  newValues?: string | Record<string, unknown>;
}

interface CustomerActivityTabProps {
  activityLogs: ActivityLog[] | undefined;
  t: (key: string) => string;
}

export function CustomerActivityTab({ activityLogs, t }: CustomerActivityTabProps) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{t("customers.activityHistory")}</CardTitle>
            <CardDescription>{t("customers.allChangesForCustomer")}</CardDescription>
          </div>
          <Badge variant="secondary">{activityLogs?.length ?? 0} {t("common.activities")}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {activityLogs && activityLogs.length > 0 ? (
          <div className="space-y-4">
            {activityLogs.slice(0, 20).map((log) => (
              <div
                key={log.id}
                className="flex gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                    log.action.includes("create")
                      ? "bg-green-100 text-green-600"
                      : log.action.includes("update") || log.action.includes("edit")
                        ? "bg-blue-100 text-blue-600"
                        : log.action.includes("delete") || log.action.includes("remove")
                          ? "bg-red-100 text-red-600"
                          : log.action.includes("payment")
                            ? "bg-emerald-100 text-emerald-600"
                            : log.action.includes("reset")
                              ? "bg-amber-100 text-amber-600"
                              : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {log.action.includes("create") ? (
                    <Plus className="h-5 w-5" />
                  ) : log.action.includes("update") || log.action.includes("edit") ? (
                    <Edit className="h-5 w-5" />
                  ) : log.action.includes("delete") || log.action.includes("remove") ? (
                    <Trash2 className="h-5 w-5" />
                  ) : log.action.includes("payment") ? (
                    <DollarSign className="h-5 w-5" />
                  ) : log.action.includes("reset") ? (
                    <RotateCcw className="h-5 w-5" />
                  ) : (
                    <Clock className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm capitalize">
                      {log.action.replace(/_/g, " ")}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {log.userRole ?? "system"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {log.newValues != null && (
                    <div className="mt-2 text-xs bg-background p-2 rounded border">
                      <pre className="whitespace-pre-wrap break-all text-muted-foreground">
                        {typeof log.newValues === "string"
                          ? log.newValues
                          : JSON.stringify(log.newValues, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">{t("customers.noActivityFound")}</p>
            <p className="text-xs text-muted-foreground mt-1">No activity logs found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
