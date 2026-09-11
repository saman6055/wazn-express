import { useEffect, useState } from "react";
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
import { buttonVariants } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

/**
 * "Are you sure?" in the app's own words and look.
 *
 * The browser's confirm() box took its language from the phone, not from the
 * language chosen in the app, showed the site's address as its heading, and
 * after a few repeats offered "don't ask again" — one tired tap, and every
 * delete after it went through unasked. This one speaks the chosen language
 * (Kurdish first), puts the focus on Cancel so a stray Enter does not delete,
 * and treats Esc as a No.
 *
 *   if (!(await confirmDanger(message))) return;     // delete, restore, reverse
 *   if (!(await confirmAction(message))) return;     // anything else
 *
 * <ConfirmHost /> is mounted once, in App.tsx. Asked before it is (the first
 * moments of a page load), the browser's own box answers instead of a
 * question nobody can see.
 */
export interface ConfirmOptions {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Deleting, restoring over data, anything that cannot be taken back. */
  danger?: boolean;
}

interface Request extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

let ask: ((request: Request) => void) | null = null;

export function confirmAction(options: ConfirmOptions | string): Promise<boolean> {
  const request: ConfirmOptions = typeof options === "string" ? { message: options } : options;
  if (!ask) {
    return Promise.resolve(typeof window !== "undefined" && typeof window.confirm === "function" && window.confirm(request.message));
  }
  const show = ask;
  return new Promise((resolve) => show({ ...request, resolve }));
}

/** The same question, for something that cannot be undone. */
export function confirmDanger(options: ConfirmOptions | string): Promise<boolean> {
  const request: ConfirmOptions = typeof options === "string" ? { message: options } : options;
  return confirmAction({ ...request, danger: true });
}

export function ConfirmHost() {
  const { language } = useTranslation();
  const [queue, setQueue] = useState<Request[]>([]);

  useEffect(() => {
    ask = (request) => setQueue((waiting) => [...waiting, request]);
    return () => {
      ask = null;
    };
  }, []);

  const current = queue[0];

  // Answered once: the button's click and the dialog closing both report in,
  // and only the first may count or take the next question off the queue.
  const answer = (request: Request | undefined, ok: boolean) => {
    if (!request) return;
    request.resolve(ok);
    setQueue((waiting) => (waiting[0] === request ? waiting.slice(1) : waiting));
  };

  const title = current?.title ?? pickLang(language, { ku: "دڵنیایت؟", en: "Are you sure?", ar: "هل أنت متأكد؟", zh: "确定吗？" });
  const confirmLabel =
    current?.confirmLabel ??
    (current?.danger
      ? pickLang(language, { ku: "بەڵێ، بەردەوام بە", en: "Yes, go ahead", ar: "نعم، تابِع", zh: "是，继续" })
      : pickLang(language, { ku: "بەڵێ", en: "Yes", ar: "نعم", zh: "是" }));
  const cancelLabel = current?.cancelLabel ?? pickLang(language, { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" });

  return (
    <AlertDialog
      open={Boolean(current)}
      onOpenChange={(open) => {
        if (!open) answer(current, false);
      }}
    >
      {/* Radix puts the focus on Cancel when this opens. */}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">{current?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => answer(current, false)}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            className={cn(current?.danger && buttonVariants({ variant: "destructive" }))}
            onClick={() => answer(current, true)}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
