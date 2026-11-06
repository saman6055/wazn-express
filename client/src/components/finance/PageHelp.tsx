import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

/**
 * «ئەم پەڕەیە بۆ چییە؟» (owner, 2026-11-05, points 9/15/17/26-29): every
 * finance page says in three plain lines what it is, how its figures are
 * worked out, and what to do with it. Closed by default after the first
 * visit on this device, so it never stands in the way.
 */
export type HelpWords = { ku: string; en: string; ar: string; zh: string };
export type PageHelpText = { what: HelpWords; how: HelpWords; use: HelpWords };

export function PageHelp({ id, text }: { id: string; text: PageHelpText }) {
  const { language } = useTranslation();
  const L = (w: HelpWords) => pickLang(language, w);
  const key = `wazn-help-seen-${id}`;
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(key) !== "1"; } catch { return true; }
  });
  const toggle = () => {
    setOpen((o) => {
      if (o) { try { localStorage.setItem(key, "1"); } catch { /* private window */ } }
      return !o;
    });
  };
  const rows: Array<[HelpWords, HelpWords]> = [
    [{ ku: "چییە", en: "What it is", ar: "ما هو", zh: "是什么" }, text.what],
    [{ ku: "چۆن دەژمێردرێت", en: "How it is worked out", ar: "كيف يُحسب", zh: "如何计算" }, text.how],
    [{ ku: "چی بکەیت", en: "What to do", ar: "ماذا تفعل", zh: "如何使用" }, text.use],
  ];
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/60 text-sm dark:border-sky-900/60 dark:bg-sky-950/30" data-testid={`page-help-${id}`}>
      <button type="button" onClick={toggle} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sky-900 dark:text-sky-100">
        <span className="flex items-center gap-2 font-medium"><HelpCircle className="h-4 w-4" />{L({ ku: "ئەم پەڕەیە بۆ چییە؟", en: "What is this page for?", ar: "لماذا هذه الصفحة؟", zh: "此页面的用途？" })}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <dl className="space-y-1.5 px-3 pb-3 text-sky-950 dark:text-sky-100">
          {rows.map(([label, body], i) => (
            <div key={i} className="grid grid-cols-[auto_1fr] gap-2">
              <dt className="font-semibold">{L(label)}:</dt>
              <dd className="leading-relaxed">{L(body)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
