import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "../../../server/routers";
import { ASK_ADMIN_MARK } from "@shared/creditGuard";
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
    let sub = next(op).subscribe({
      next: (value) => observer.next(value),
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
            ku: "ئەم تۆمارە کریدیت بۆ کڕیار دروست دەکات",
            en: "This entry leaves the customer in credit",
            ar: "هذا القيد يترك للعميل رصيداً دائناً",
            zh: "此记录会使客户产生贷方余额",
          }),
          message: message.slice(ASK_ADMIN_MARK.length),
          confirmLabel: pickLang(language, { ku: "بەڵێ، تۆماری بکە", en: "Yes, record it", ar: "نعم، سجّله", zh: "是，记录" }),
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
            next: (value) => observer.next(value),
            complete: () => observer.complete(),
            error: (again) => observer.error(again),
          });
        });
      },
    });
    return () => sub.unsubscribe();
  });
