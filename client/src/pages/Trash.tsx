import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, RotateCcw, AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";
import { useTranslation, useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { TRASH_ENTITIES, trashEntity, type TrashItem } from "@shared/trash";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Everything that has been deleted, and the two things you can do about it.
 *
 * Deliberately one screen for the whole system rather than a bin per
 * section. Somebody looking for something they deleted rarely remembers
 * which section it was in — that is usually the same confusion that caused
 * the deletion.
 */
export default function Trash() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [purging, setPurging] = useState<TrashItem | null>(null);

  const listQuery = trpc.trash.list.useQuery();
  const restore = trpc.trash.restore.useMutation();
  const purge = trpc.trash.purge.useMutation();

  const items = (listQuery.data ?? []) as TrashItem[];

  const typeLabel = (type: string) => {
    const def = trashEntity(type);
    if (!def) return type;
    return pickLang(language, { ku: def.labelKu, en: def.label, ar: def.labelAr, zh: def.labelZh });
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter !== "all" && item.entityType !== typeFilter) return false;
      if (!q) return true;
      return (
        item.label.toLowerCase().includes(q) ||
        typeLabel(item.entityType).toLowerCase().includes(q) ||
        (item.deletedByName ?? "").toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query, typeFilter, language]);

  const handleRestore = async (item: TrashItem) => {
    try {
      await restore.mutateAsync({ entityType: item.entityType, entityId: item.entityId });
      toast.success(t("trash.restored", { label: item.label }));
      listQuery.refetch();
    } catch (error: any) {
      // The server names what is in the way — a reused code, an owner that
      // is itself gone. That message is the useful part.
      toast.error(error?.message || t("common.error"));
    }
  };

  const handlePurge = async () => {
    if (!purging) return;
    try {
      await purge.mutateAsync({ entityType: purging.entityType, entityId: purging.entityId });
      toast.success(t("trash.purged", { label: purging.label }));
      setPurging(null);
      listQuery.refetch();
    } catch (error: any) {
      toast.error(error?.message || t("common.error"));
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("trash.title")}</h1>
          <p className="text-muted-foreground">{t("trash.subtitle")}</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("trash.searchPlaceholder")}
                  className="ps-9"
                />
              </div>
              <Button
                variant={typeFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter("all")}
              >
                {t("common.all")}
              </Button>
              {TRASH_ENTITIES.map((def) => (
                <Button
                  key={def.type}
                  variant={typeFilter === def.type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTypeFilter(def.type)}
                >
                  {typeLabel(def.type)}
                </Button>
              ))}
            </div>

            {listQuery.isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t("common.loading")}</p>
            ) : visible.length === 0 ? (
              <div className="py-12 text-center">
                <Trash2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">{t("trash.empty")}</p>
                <p className="text-sm text-muted-foreground">{t("trash.emptyHint")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {visible.map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{typeLabel(item.entityType)}</Badge>
                        <span className="font-mono font-medium">{item.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("trash.deletedBy", {
                          who: item.deletedByName || t("common.unknown"),
                          when: new Date(item.deletedAt).toLocaleString(),
                        })}
                      </p>
                      {item.deletionReason && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.deletionReason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={restore.isPending}
                        onClick={() => handleRestore(item)}
                      >
                        <RotateCcw className="h-4 w-4 me-2" />
                        {t("trash.restore")}
                      </Button>
                      {/* Permanent deletion is the one thing here with no way
                          back, so it is admins only. */}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPurging(item)}
                          title={t("trash.purge")}
                        >
                          <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={!!purging} onOpenChange={(open) => !open && setPurging(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
                {t("trash.purge")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("trash.purgeWarning", { label: purging?.label ?? "" })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                disabled={purge.isPending}
                onClick={(e) => { e.preventDefault(); handlePurge(); }}
              >
                {purge.isPending ? "..." : t("trash.purge")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
