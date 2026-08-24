import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

/**
 * What the office means to spend each month.
 *
 * One figure for everything still a decision, and a figure per category for
 * anyone who wants to be more specific. Recurring categories — rent,
 * salaries, water, electricity — are shown but not editable here and are
 * marked as such: they arrive whether anybody watches or not, and a budget
 * that counts them is breached on the same day every month by the same
 * amount. A warning that fires every month is one nobody reads by the third.
 *
 * Clearing a figure removes the budget rather than setting it to nothing.
 * "No budget" and "a budget of zero" are different statements and only the
 * first is ever meant.
 */
export function BudgetDialog({
  open,
  onOpenChange,
  categories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: { id: number; nameEn: string; nameKu: string | null; isRecurring: boolean }[];
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const budgetsQuery = trpc.expenses.listBudgets.useQuery(undefined, { enabled: open });
  const setBudget = trpc.expenses.setBudget.useMutation();

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Fill from what is stored each time the dialog opens, so a cancelled edit
  // does not linger into the next one.
  useEffect(() => {
    if (!open || !budgetsQuery.data) return;
    const next: Record<string, string> = {};
    for (const b of budgetsQuery.data) {
      next[b.categoryId === null ? "overall" : String(b.categoryId)] = String(Number(b.monthlyAmountUsd));
    }
    setDraft(next);
  }, [open, budgetsQuery.data]);

  const variableCategories = categories.filter((c) => !c.isRecurring);
  const recurringCategories = categories.filter((c) => c.isRecurring);

  const value = (key: string) => draft[key] ?? "";
  const setValue = (key: string, v: string) => setDraft((d) => ({ ...d, [key]: v }));

  const handleSave = async () => {
    const stored = new Map<string, number>();
    for (const b of budgetsQuery.data ?? []) {
      stored.set(b.categoryId === null ? "overall" : String(b.categoryId), Number(b.monthlyAmountUsd));
    }

    // Only what actually moved. Writing every row on every save would stamp
    // an edit on budgets nobody touched.
    const changes: { categoryId: number | null; monthlyAmountUsd: number }[] = [];
    const keys = Array.from(new Set(Object.keys(draft).concat(Array.from(stored.keys()))));
    for (const key of keys) {
      const raw = (draft[key] ?? "").trim();
      const next = raw === "" ? 0 : Number(raw);
      if (!Number.isFinite(next) || next < 0) {
        toast.error(t("expenses.amountMustBePositive"));
        return;
      }
      const before = stored.get(key) ?? 0;
      if (Math.abs(next - before) < 0.005) continue;
      changes.push({ categoryId: key === "overall" ? null : Number(key), monthlyAmountUsd: next });
    }

    if (changes.length === 0) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    try {
      for (const change of changes) await setBudget.mutateAsync(change);
      toast.success(t("expenses.budgetSaved"));
      await budgetsQuery.refetch();
      onSaved();
      onOpenChange(false);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("expenses.setBudget")}</DialogTitle>
          <DialogDescription>{t("expenses.setBudgetDesc")}</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto py-2">
          <div className="grid gap-2 rounded-lg border p-3">
            <Label htmlFor="budget-overall">{t("expenses.variableSpending")}</Label>
            <Input
              id="budget-overall"
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              value={value("overall")}
              onChange={(e) => setValue("overall", e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">{t("expenses.overallBudgetHint")}</p>
          </div>

          <div className="grid gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              {t("expenses.perCategoryBudget")}
            </span>
            {variableCategories.map((category) => (
              <div key={category.id} className="grid grid-cols-[1fr_140px] items-center gap-3">
                <Label htmlFor={`budget-${category.id}`} className="truncate font-normal">
                  {category.nameKu || category.nameEn}
                </Label>
                <Input
                  id={`budget-${category.id}`}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={value(String(category.id))}
                  onChange={(e) => setValue(String(category.id), e.target.value)}
                  placeholder="0"
                />
              </div>
            ))}
          </div>

          {recurringCategories.length > 0 && (
            <div className="grid gap-2 rounded-lg border border-dashed p-3">
              <span className="text-xs font-medium text-muted-foreground">
                {t("expenses.recurringExcluded")}
              </span>
              <div className="flex flex-wrap gap-2">
                {recurringCategories.map((category) => (
                  <Badge key={category.id} variant="secondary">
                    {category.nameKu || category.nameEn}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t("expenses.recurringExcludedHint")}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("forms.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("common.loading") : t("forms.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
