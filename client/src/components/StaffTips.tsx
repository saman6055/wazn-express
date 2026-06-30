import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Lightbulb, X, ChevronDown, ChevronUp } from "lucide-react";
import { STAFF_TIPS, MOTIVATION_MESSAGES, type TipLang } from "@/constants/staffTips";

// A "tip of the day" card (bottom-left) that teaches good system use, plus a
// one-time motivation toast 10 minutes into the session.
//
// Timing is deliberately UN-intrusive: a tip appears on login, then NOT again
// while the staff member is actively working (so it never pulls their mind off
// the task). It only goes quiet after 10 minutes of no mouse/keyboard activity,
// and a fresh tip appears the next time they become active again. Rendered once
// at the app root (not in the per-page layout) so the idle timer is continuous.
const TIP_INDEX_KEY = "wazn-tip-index";
const TIP_DISMISS_DATE_KEY = "wazn-tip-dismissed-date";
const TIP_SESSION_INIT_KEY = "wazn-tip-session-init";
const SESSION_START_KEY = "wazn-session-start";
const MOTIVATION_SHOWN_KEY = "wazn-motivation-shown";
const IDLE_MS = 10 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 1500;

const UI: Record<TipLang, { tip: string; more: string; less: string; example: string; hideToday: string; close: string }> = {
  ku: { tip: "ئامۆژگاری", more: "زانیاری زیاتر", less: "کەمتر", example: "نموونە", hideToday: "ئەمڕۆ پیشانی مەدە", close: "داخستن" },
  en: { tip: "Tip", more: "Learn more", less: "Less", example: "Example", hideToday: "Hide for today", close: "Close" },
  ar: { tip: "نصيحة", more: "معلومات أكثر", less: "أقل", example: "مثال", hideToday: "إخفاء لليوم", close: "إغلاق" },
  zh: { tip: "提示", more: "了解更多", less: "收起", example: "示例", hideToday: "今天不再显示", close: "关闭" },
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function StaffTips() {
  const { language, isRTL } = useTranslation();
  const { user } = useAuth();
  const [location] = useLocation();
  const lang: TipLang = (["ku", "en", "ar", "zh"].includes(language) ? language : "ku") as TipLang;
  const labels = UI[lang];

  // Only on staff pages (auth.me is staff-only, so user is null on the portal /
  // login / landing — but guard the path too for the rare staff-on-portal case).
  const onStaffArea =
    !!user &&
    !location.startsWith("/portal") &&
    location !== "/" &&
    location !== "/customer-login" &&
    location !== "/staff-login" &&
    location !== "/404";
  const onStaffAreaRef = useRef(onStaffArea);
  onStaffAreaRef.current = onStaffArea;

  const [index, setIndex] = useState(() => {
    const v = Number(localStorage.getItem(TIP_INDEX_KEY) || "0");
    return Number.isFinite(v) ? v : 0;
  });
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const lastActivityRef = useRef(0);
  const idleRef = useRef(false);
  const idleTimerRef = useRef<number | null>(null);

  const showNextTip = useCallback(() => {
    setExpanded(false);
    setIndex((i) => {
      const n = i + 1;
      localStorage.setItem(TIP_INDEX_KEY, String(n));
      return n;
    });
    setOpen(true);
  }, []);

  // Show on login, then drive show/hide off real activity (mouse + keyboard).
  useEffect(() => {
    if (localStorage.getItem(TIP_DISMISS_DATE_KEY) === todayStr()) return;

    // One tip the first time we enter the session (login / fresh tab).
    if (sessionStorage.getItem(TIP_SESSION_INIT_KEY) !== "1") {
      sessionStorage.setItem(TIP_SESSION_INIT_KEY, "1");
      setOpen(true);
    }

    const armIdleTimer = () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        idleRef.current = true;
        setOpen(false); // go quiet while the desk is idle
      }, IDLE_MS);
    };

    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityRef.current = now;
      if (localStorage.getItem(TIP_DISMISS_DATE_KEY) === todayStr()) return;
      // Returned to the desk after being idle → surface a fresh tip.
      if (idleRef.current && onStaffAreaRef.current) {
        idleRef.current = false;
        showNextTip();
      }
      armIdleTimer();
    };

    window.addEventListener("mousemove", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    armIdleTimer();
    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [showNextTip]);

  // One personalised motivation toast, 10 minutes into the session.
  useEffect(() => {
    if (sessionStorage.getItem(MOTIVATION_SHOWN_KEY) === "1") return;
    let start = Number(sessionStorage.getItem(SESSION_START_KEY) || "0");
    if (!start) {
      start = Date.now();
      sessionStorage.setItem(SESSION_START_KEY, String(start));
    }
    const remaining = Math.max(0, IDLE_MS - (Date.now() - start));
    const timer = window.setTimeout(() => {
      if (sessionStorage.getItem(MOTIVATION_SHOWN_KEY) === "1") return;
      if (!onStaffAreaRef.current) return;
      sessionStorage.setItem(MOTIVATION_SHOWN_KEY, "1");
      const name = ((user?.name as string) || "").trim() || (lang === "ku" ? "هاوکار" : lang === "ar" ? "زميلنا" : lang === "zh" ? "同事" : "colleague");
      const msg = MOTIVATION_MESSAGES[Math.floor(Math.random() * MOTIVATION_MESSAGES.length)];
      const text = (msg.text[lang] || msg.text.ku).replace(/\{name\}/g, name);
      toast(text, { duration: 12000 });
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [user, lang]);

  if (!onStaffArea || !open || STAFF_TIPS.length === 0) return null;

  const tip = STAFF_TIPS[((index % STAFF_TIPS.length) + STAFF_TIPS.length) % STAFF_TIPS.length];
  const short = tip.short[lang] || tip.short.ku;
  const detail = tip.detail ? (tip.detail[lang] || tip.detail.ku) : undefined;
  const example = tip.example ? (tip.example[lang] || tip.example.ku) : undefined;

  const close = () => setOpen(false);
  const hideToday = () => {
    localStorage.setItem(TIP_DISMISS_DATE_KEY, todayStr());
    setOpen(false);
  };

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="fixed bottom-4 left-4 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-gray-900 shadow-lg"
    >
      <div className="flex items-center gap-2 border-b border-amber-100 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-t-xl">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">{labels.tip}</span>
        <button onClick={close} title={labels.close} aria-label={labels.close} className="ms-auto text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 space-y-2">
        <p className="text-sm leading-relaxed">{short}</p>

        {expanded && detail && (
          <div className="space-y-2 rounded-lg bg-muted/50 p-2.5 text-xs leading-relaxed">
            <p className="text-muted-foreground">{detail}</p>
            {example && (
              <p>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{labels.example}: </span>
                {example}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          {detail ? (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? labels.less : labels.more}
            </button>
          ) : (
            <span />
          )}
          <button onClick={hideToday} className="text-[11px] text-muted-foreground hover:text-foreground hover:underline">
            {labels.hideToday}
          </button>
        </div>
      </div>
    </div>
  );
}
