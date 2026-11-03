import { useState } from "react";
import { toast } from "sonner";
import { Loader2, LockOpen } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * A closed batch back to the Erbil depot, by the main admin with a reason
 * (owner, 2026-11-03: late cartons of a closed batch arrived, and the batch
 * must take them). No money moves here; the close is run again later.
 */
export function ReopenBatchDialog({ batch, onClose, onDone }: {
  batch: { id: number; batchCode: string } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { language } = useLanguage();
  const [reason, setReason] = useState("");
  const reopen = trpc.batches.reopen.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, {
        ku: `باچی ${batch?.batchCode} کرایەوە و گەڕایەوە «لە کۆگای هەولێر»`,
        en: `${batch?.batchCode} reopened, back at the Erbil depot`,
        ar: `أُعيد فتح ${batch?.batchCode}`,
        zh: `${batch?.batchCode} 已重新打开`,
      }));
      setReason("");
      onDone();
    },
    onError: (e) => toast.error(e.message, { duration: 15_000 }),
  });
  const ready = reason.trim().length >= 3;
  return (
    <Dialog open={!!batch} onOpenChange={(open) => { if (!open) { setReason(""); onClose(); } }}>
      <DialogContent className="max-w-md" data-testid="reopen-batch-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockOpen className="h-5 w-5" />
            {pickLang(language, { ku: `کردنەوەی باچی ${batch?.batchCode ?? ""}`, en: `Reopen ${batch?.batchCode ?? ""}`, ar: `إعادة فتح ${batch?.batchCode ?? ""}`, zh: `重新打开 ${batch?.batchCode ?? ""}` })}
          </DialogTitle>
          <DialogDescription>
            {pickLang(language, {
              ku: "باچەکە دەگەڕێتەوە «لە کۆگای هەولێر» و دەچێتەوە لیستی باچە چالاکەکان. هیچ پارەیەک ناجووڵێت. کە کارەکەت تەواو بوو، دووبارە دایبخەرەوە.",
              en: "The batch goes back to the Erbil depot and the active list. No money moves. Close it again when you are done.",
              ar: "تعود الدفعة إلى مستودع أربيل. لا تتحرك أي أموال. أغلقها مجدداً عند الانتهاء.",
              zh: "批次回到埃尔比勒仓库，不涉及资金。完成后请再次关闭。",
            })}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          data-no-enter-save
          data-testid="reopen-batch-reason"
          placeholder={pickLang(language, { ku: "هۆکار (نموونە: چەند پارچەیەک دوای داخستن گەیشتن)", en: "Reason (e.g. some cartons arrived after the close)", ar: "السبب", zh: "原因" })}
        />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { setReason(""); onClose(); }}>
            {pickLang(language, { ku: "وازهێنان", en: "Cancel", ar: "إلغاء", zh: "取消" })}
          </Button>
          <Button
            disabled={!ready || reopen.isPending || !batch}
            onClick={() => batch && reopen.mutate({ batchId: batch.id, reason: reason.trim() })}
            data-testid="reopen-batch-confirm"
          >
            {reopen.isPending ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <LockOpen className="h-4 w-4 me-1" />}
            {pickLang(language, { ku: "بیکەرەوە", en: "Reopen", ar: "إعادة فتح", zh: "重新打开" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
