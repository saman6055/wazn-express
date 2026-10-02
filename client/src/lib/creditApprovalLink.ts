import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "../../../server/routers";
import { toast } from "sonner";
import { ASK_ADMIN_MARK, creditHeldNotice } from "@shared/creditGuard";
import { confirmAction } from "@/components/ConfirmDialog";
import { pickLang } from "@/lib/lang";
import { storedLanguage } from "@/lib/networkFault";

/**
 * The admin's "yes" to an entry that would leave a customer in credit.
 *
 * The server refuses such an entry (shared/creditGuard). For an admin the
 * refusal carries a question — marked with ASK_ADMIN_MARK — and this turns
 * it into a confirm and sends the very same entry again with
 * `approveCredit: true`. It sits in the client's link chain, so every screen
 * that records a payment, lowers a balance or takes box money gets the same
 * question without knowing about it; a screen added later gets it too.
 *
 * Declined, the entry fails with a plain "nothing was recorded", which the
 * screen shows the way it shows any other refusal.
 */
export const creditApprovalLink: TRPCLink<AppRouter> = () => ({ op, next }) =>
  observable((observer) => {
    // Told once, on whichever screen took the money: the extra was not
    // posted — it is waiting for the main admin.
    const passOn = (value: Parameters<typeof observer.next>[0]) => {
      const held = Number((value as { result?: { data?: { heldCreditUsd?: number } } })?.result?.data?.heldCreditUsd ?? 0);
      if (held > 0) toast.warning(creditHeldNotice(held), { duration: 20000 });
      observer.next(value);
    };
    let sub = next(op).subscribe({
      next: passOn,
      complete: () => observer.complete(),
      error: (err) => {
        const message = String(err?.message ?? "");
        const asks =
          op.type === "mutation" &&
          (err?.data as { code?: string } | undefined)?.code === "PRECONDITION_FAILED" &&
          message.startsWith(ASK_ADMIN_MARK);
        if (!asks) {
          observer.error(err);
          return;
        }
        const language = storedLanguage();
        void confirmAction({
          title: pickLang(language, {
            ku: "ئەم کارە کار لە کریدیتی کڕیار دەکات",
            en: "This affects the customer's credit",
            ar: "هذا يمسّ رصيد العميل الدائن",
            zh: "此操作涉及客户贷方余额",
          }),
          message: message.slice(ASK_ADMIN_MARK.length),
          confirmLabel: pickLang(language, { ku: "بەڵێ، دڵنیام", en: "Yes, I am sure", ar: "نعم، متأكد", zh: "是，我确定" }),
          danger: true,
        }).then((yes) => {
          if (!yes) {
            observer.error(TRPCClientError.from(new Error(pickLang(language, {
              ku: "هەڵوەشێنرایەوە — هیچ شتێک تۆمار نەکرا.",
              en: "Cancelled — nothing was recorded.",
              ar: "أُلغي — لم يُسجَّل شيء.",
              zh: "已取消——未记录任何内容。",
            }))));
            return;
          }
          sub = next({ ...op, input: { ...(op.input as Record<string, unknown>), approveCredit: true } }).subscribe({
            next: passOn,
            complete: () => observer.complete(),
            error: (again) => observer.error(again),
          });
        });
      },
    });
    return () => sub.unsubscribe();
  });
