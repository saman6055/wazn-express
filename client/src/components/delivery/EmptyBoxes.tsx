import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { toast } from "sonner";
import { useFailure } from "@/hooks/useFailure";
import { Loader2, PackageX, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtDate } from "@/lib/numericDate";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/CopyButton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Words = { ku: string; en: string; ar: string; zh: string };

export interface EmptyBoxRef {
  id: number;
  boxCode: string;
}

/**
 * Empty delivery boxes — flagged, and deletable where they are seen
 * (owner, 2026-09-17).
 *
 * "Empty" is shared/emptyBox: nothing in it, not sent, nothing charged, no
 * payment. Deleting goes to the recycle bin (deliveryBox.delete) with
 * `onlyIfEmpty`, so the server checks again at that moment: a parcel scanned in
 * since the list was drawn saves its box. Deleting a box is an admin's, as it
 * always was; everyone else still sees the flag.
 */

const DELETE_WORD: Words = { ku: "سڕینەوە", en: "Delete", ar: "حذف", zh: "删除" };

/** Asks once, then deletes an empty box into the recycle bin. */
export function DeleteEmptyBoxDialog({ box, onClose }: { box: EmptyBoxRef | null; onClose: () => void }) {
  const { language } = useTranslation();
  const L = (words: Words) => pickLang(language, words);
  // A refusal that carries steps is read, not glimpsed (hooks/useFailure).
  const showFailure = useFailure();
  const utils = trpc.useUtils();
  const remove = trpc.deliveryBox.delete.useMutation({
    onSuccess: (data) => {
      toast.success(
        L({
          ku: `بۆکسی ${data.boxCode} سڕایەوە — لە سەبەتەی سڕاوەکاندایە`,
          en: `Box ${data.boxCode} deleted — it is in the recycle bin`,
          ar: `حُذف الصندوق ${data.boxCode} — موجود في سلة المحذوفات`,
          zh: `箱子 ${data.boxCode} 已删除 — 在回收站中`,
        }),
      );
      void utils.deliveryBox.emptyBoxes.invalidate();
      void utils.deliveryBox.list.invalidate();
      void utils.dashboard.risks.invalidate();
      onClose();
    },
    onError: (err) => showFailure(err),
  });

  return (
    <AlertDialog open={!!box} onOpenChange={(open) => { if (!open && !remove.isPending) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
            {L({ ku: "سڕینەوەی بۆکسی بەتاڵ", en: "Delete an empty box", ar: "حذف صندوق فارغ", zh: "删除空箱子" })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            <bdi dir="ltr" className="font-mono">{box?.boxCode}</bdi>{" "}
            {L({
              ku: "هیچی تێدا نییە و دەچێتە سەبەتەی سڕاوەکان؛ لەوێ دەتوانرێت بگەڕێندرێتەوە.",
              en: "has nothing in it and goes to the recycle bin, where it can be restored.",
              ar: "لا يحتوي على شيء وسينتقل إلى سلة المحذوفات، ويمكن استعادته من هناك.",
              zh: "里面没有任何物品，将移至回收站，可从回收站恢复。",
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>
            {L({ ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 text-white hover:bg-red-700"
            disabled={remove.isPending}
            onClick={(e) => {
              e.preventDefault();
              if (box) remove.mutate({ id: box.id, onlyIfEmpty: true, reason: "بۆکسی بەتاڵ" });
            }}
          >
            {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : L(DELETE_WORD)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The flag above the box list, and the list of empty boxes behind it. */
export function EmptyBoxesAlert({ canDelete }: { canDelete: boolean }) {
  const { language, isRTL } = useTranslation();
  const L = (words: Words) => pickLang(language, words);
  const search = useSearch();
  const { data } = trpc.deliveryBox.emptyBoxes.useQuery(undefined, { staleTime: 60_000 });
  const boxes = data ?? [];
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<EmptyBoxRef | null>(null);

  // Arriving from the bell (?empty=1): the list opens by itself.
  const fromBell = new URLSearchParams(search).get("empty") === "1";
  useEffect(() => {
    if (fromBell && boxes.length > 0) setOpen(true);
  }, [fromBell, boxes.length]);

  if (boxes.length === 0) return null;

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        <PackageX className="h-4 w-4 shrink-0" />
        <span>
          {L({
            ku: `${boxes.length} بۆکسی بەتاڵ هەیە — هیچ پاکەتێکیان تێدا نییە.`,
            en: `${boxes.length} empty box(es) — nothing has been put in them.`,
            ar: `${boxes.length} صندوق فارغ — لم يوضع فيها شيء.`,
            zh: `${boxes.length} 个空箱子 — 里面没有任何包裹。`,
          })}
        </span>
        <Button variant="outline" size="sm" className="ms-auto h-7" onClick={() => setOpen(true)} data-testid="empty-boxes-open">
          {canDelete
            ? L({ ku: "بینین و سڕینەوە", en: "Review and delete", ar: "مراجعة وحذف", zh: "查看并删除" })
            : L({ ku: "بینین", en: "Review", ar: "مراجعة", zh: "查看" })}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir={isRTL ? "rtl" : "ltr"} className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageX className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              {L({ ku: "بۆکسە بەتاڵەکان", en: "Empty boxes", ar: "الصناديق الفارغة", zh: "空箱子" })}
            </DialogTitle>
            <DialogDescription>
              {canDelete
                ? L({
                    ku: "هیچیان تێدا نییە، نەنێردراون و پارەیان لەسەر نییە. سڕینەوە دەیانباتە سەبەتەی سڕاوەکان.",
                    en: "Nothing is in them, they were never sent and no money is against them. Deleting moves them to the recycle bin.",
                    ar: "لا شيء فيها، ولم تُرسل، ولا مبالغ عليها. الحذف ينقلها إلى سلة المحذوفات.",
                    zh: "里面没有物品、从未发出、也没有任何款项。删除会将其移至回收站。",
                  })
                : L({
                    ku: "تەنها بەڕێوەبەر دەتوانێت بۆکس بسڕێتەوە.",
                    en: "Only an admin can delete a box.",
                    ar: "لا يحذف الصناديق إلا المسؤول.",
                    zh: "只有管理员可以删除箱子。",
                  })}
            </DialogDescription>
          </DialogHeader>
          <ul className="divide-y rounded-lg border">
            {boxes.map((b) => (
              <li key={b.id} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <bdi dir="ltr" className="font-mono text-sm font-medium">{b.boxCode}</bdi>
                    <CopyButton
                      value={b.boxCode}
                      label={L({ ku: "کۆپی کۆدی بۆکس", en: "Copy box code", ar: "نسخ رمز الصندوق", zh: "复制箱号" })}
                    />
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    <bdi dir="ltr" className="font-mono">{b.customerCode ?? "—"}</bdi> · {b.customerName ?? "—"} ·{" "}
                    <bdi dir="ltr">{fmtDate(new Date(b.createdAt))}</bdi>
                  </div>
                </div>
                {canDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                    onClick={() => setDeleting({ id: b.id, boxCode: b.boxCode })}
                  >
                    <Trash2 className="me-1 h-4 w-4" />
                    {L(DELETE_WORD)}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <DeleteEmptyBoxDialog box={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
