import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Words = { ku: string; en: string; ar: string; zh: string };

const TXT = {
  withdraw: { ku: "لابردنی ئەم داشکانە", en: "Take this discount back", ar: "إلغاء هذا الخصم", zh: "撤回该折扣" },
  why: { ku: "هۆکاری لابردن — تەنها لای ئێمە دەمێنێتەوە، کڕیار نایبینێت", en: "Why — kept in the office only, never shown to the customer", ar: "السبب — يبقى لدينا فقط، لا يراه الزبون", zh: "原因 — 仅内部保存，客户看不到" },
  go: { ku: "لابردن", en: "Take back", ar: "إلغاء", zh: "撤回" },
  cancel: { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" },
  done: { ku: "داشکانەکە لابرا", en: "Discount taken back", ar: "تم إلغاء الخصم", zh: "已撤回折扣" },
} satisfies Record<string, Words>;

/**
 * Take back a discount an earlier receipt promised (owner, 2026-11-04: «با قفل
 * نەبێ لابردنی بە هۆکارەوە بێت و لە سیستەمی خۆمان لە شوێنێ خەزن بێت لەلای
 * کڕیار نا»). The main admin's alone; the reason stays in the office.
 */
export function PledgeWithdraw({ boxId, lineId, onWithdrawn }: { boxId: number; lineId: number | null; onWithdrawn: (lineId: number | null) => void }) {
  const { language } = useLanguage();
  const L = (w: Words) => pickLang(language, w);
  const isMainAdmin = useAuth().user?.role === "super_admin";
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const utils = trpc.useUtils();
  const withdraw = trpc.deliveryBox.withdrawPledge.useMutation({
    onSuccess: () => {
      onWithdrawn(lineId);
      setOpen(false);
      setReason("");
      void utils.deliveryBox.invalidate();
      toast.success(L(TXT.done));
    },
    onError: (e) => toast.error(e.message),
  });
  if (!isMainAdmin) return null;

  if (!open) {
    return (
      <button type="button" className="text-xs font-medium text-red-700 underline underline-offset-2 dark:text-red-300" onClick={() => setOpen(true)} data-testid="receipt-discount-withdraw">
        {L(TXT.withdraw)}
      </button>
    );
  }
  return (
    <div className="space-y-1.5" data-testid="receipt-discount-withdraw-form">
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={L(TXT.why)} className="h-9 text-xs" />
      <div className="flex gap-2">
        <Button
          type="button" size="sm" variant="destructive" className="h-8"
          disabled={reason.trim().length < 3 || withdraw.isPending}
          onClick={() => withdraw.mutate({ boxId, lineId, reason: reason.trim() })}
          data-testid="receipt-discount-withdraw-go"
        >
          {L(TXT.go)}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => { setOpen(false); setReason(""); }}>
          {L(TXT.cancel)}
        </Button>
      </div>
    </div>
  );
}
