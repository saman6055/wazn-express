import { Wallet, Sparkles, Clock, Truck, Archive, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { BOX_UNPAID_ALERT_DAYS } from "@shared/boxAging";

/**
 * The chips above the box list: what is still unpaid, sliced the ways the
 * owner asked for on 2026-09-10 (new, old, handed over), and what is paid.
 *
 * Each chip is a slice the server makes (getAllDeliveryBoxes `archive` and
 * `segment`), so a page is always a full page, and every count comes from the
 * same query as the list. "Old" is the same five days as the red badge on a
 * row (shared/boxAging.ts), so the chip and the badge name the same boxes.
 */

export type BoxView = "unpaid" | "new" | "old" | "handed" | "paid";

export interface BoxSegmentCountsLike {
  unpaid: number;
  new: number;
  old: number;
  handed: number;
  paid: number;
}

type Words = { ku: string; en: string; ar: string; zh: string };
const N = BOX_UNPAID_ALERT_DAYS;

const CHIPS: Array<{ key: BoxView; icon: LucideIcon; label: Words; hint: Words; urgent?: boolean }> = [
  {
    key: "unpaid", icon: Wallet,
    label: { ku: "پارە نەدراو", en: "Unpaid", ar: "غير مدفوع", zh: "未付款" },
    hint: { ku: "هەموو ئەو بۆکسانەی پارەیان ماوە.", en: "Every box with money still to take.", ar: "كل الصناديق التي لم يُستلم مبلغها بعد.", zh: "所有仍待收款的箱子。" },
  },
  {
    key: "new", icon: Sparkles,
    label: { ku: `تازە · ${N} ڕۆژ`, en: `New · ${N} days`, ar: `جديد · ${N} أيام`, zh: `新 · ${N} 天` },
    hint: { ku: `بۆکسی پارە نەدراو کە ${N} ڕۆژ یان کەمتر لەمەوبەر کراونەتەوە. هێشتا کاتیان ماوە.`, en: `Unpaid boxes opened ${N} days ago or less. They still have time.`, ar: `صناديق غير مدفوعة فُتحت منذ ${N} أيام أو أقل. ما زال لديها وقت.`, zh: `${N} 天内开箱且未付款的箱子，还有时间。` },
  },
  {
    key: "old", icon: Clock,
    label: { ku: "کۆن و پارە نەدراو", en: "Old and unpaid", ar: "قديم وغير مدفوع", zh: "逾期未付" },
    hint: { ku: `بۆکسی پارە نەدراو کە زیاتر لە ${N} ڕۆژ لەمەوبەر کراونەتەوە. هەمان سنووری نیشانە سوورەکەیە.`, en: `Unpaid boxes opened more than ${N} days ago. The same line as the red badge.`, ar: `صناديق غير مدفوعة فُتحت قبل أكثر من ${N} أيام. نفس حد الشارة الحمراء.`, zh: `开箱超过 ${N} 天仍未付款，与红色标记同一标准。` },
  },
  {
    key: "handed", icon: Truck, urgent: true,
    label: { ku: "گەیەندراو بێ پارە", en: "Handed over, unpaid", ar: "سُلّم دون دفع", zh: "已交付未付款" },
    hint: { ku: "گەیەندراون بەڵام پارەیان نەدراوە. بەپەلەترینەکانن.", en: "Handed over but not paid. The most urgent.", ar: "سُلّمت لكن لم يُدفع مبلغها. الأكثر إلحاحاً.", zh: "已交付但未付款，最紧急。" },
  },
  {
    key: "paid", icon: Archive,
    label: { ku: "پارە دراو · ئەرشیف", en: "Paid · archive", ar: "مدفوع · الأرشيف", zh: "已付 · 归档" },
    hint: { ku: "بۆکسە پارەدراوەکان. ئەرشیف هەروەها بۆکسە هەڵوەشاوەکان و بۆکسە گەیەندراوە کۆنەکانی بێ پارەدانی تۆمارکراو دەگرێتەوە.", en: "Paid boxes. The archive also keeps cancelled boxes, and old handed-over boxes with no payment recorded on them.", ar: "الصناديق المدفوعة. يحفظ الأرشيف أيضاً الصناديق الملغاة والصناديق القديمة المسلّمة دون دفعة مسجلة عليها.", zh: "已付款的箱子。归档中也包括已取消的箱子，以及没有付款记录的较早已交付箱子。" },
  },
];

export function BoxSegmentBar({ value, counts, onChange }: {
  value: BoxView;
  counts?: BoxSegmentCountsLike;
  onChange: (view: BoxView) => void;
}) {
  const { language } = useTranslation();
  const t = (k: Words) => pickLang(language, k);
  const active = CHIPS.find((c) => c.key === value) ?? CHIPS[0];

  return (
    <div className="mb-4 space-y-2" data-testid="box-segments">
      <div role="tablist" className="flex flex-wrap gap-2">
        {CHIPS.map(({ key, icon: Icon, label, urgent }) => {
          const on = key === value;
          const n = counts?.[key];
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              data-testid={`box-segment-${key}`}
              onClick={() => onChange(key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                on
                  ? "border-orange-500 bg-orange-50 text-orange-700 dark:border-orange-400 dark:bg-orange-950/40 dark:text-orange-300"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {t(label)}
              {n !== undefined && (
                <span className={cn("font-semibold tabular-nums", urgent && n > 0 && !on && "text-red-600 dark:text-red-400")}>
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t(active.hint)}</p>
    </div>
  );
}
