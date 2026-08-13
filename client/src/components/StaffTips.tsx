import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Lightbulb, X, ChevronDown, ChevronUp } from "lucide-react";
import { STAFF_TIPS, MOTIVATION_MESSAGES, type TipLang } from "@/constants/staffTips";

// A "tip of the day" card that teaches good system use, plus a
// delightful, one-time motivation celebration 10 minutes into the session.
//
// It sits in the bottom corner the reader's language ends at — `end-4`, not
// `left-4`. The sidebar follows the reading direction too, so a hardcoded
// left put the card underneath the sidebar the moment anyone switched to
// English, where it was clipped by the screen edge.
//
// Timing is deliberately UN-intrusive: a tip greets the staff member on each
// app (re)load, but NOT again while they're actively working. It only goes quiet
// after 10 minutes of no mouse/keyboard activity, and a fresh tip appears the
// next time they become active. Rendered once at the app root (not in the
// per-page layout) so the idle timer stays continuous across navigation.
const TIP_INDEX_KEY = "wazn-tip-index";
const SESSION_START_KEY = "wazn-session-start";
const MOTIVATION_SHOWN_KEY = "wazn-motivation-shown";
const IDLE_MS = 10 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 1500;
const MOTIVATION_VISIBLE_MS = 8500;
const AUTO_DISMISS_MS = 15 * 1000;

const UI: Record<TipLang, { tip: string; more: string; less: string; example: string; close: string; tapClose: string }> = {
  ku: { tip: "ئامۆژگاری", more: "زانیاری زیاتر", less: "کەمتر", example: "نموونە", close: "داخستن", tapClose: "کرتە بکە بۆ داخستن" },
  en: { tip: "Tip", more: "Learn more", less: "Less", example: "Example", close: "Close", tapClose: "Tap to close" },
  ar: { tip: "نصيحة", more: "معلومات أكثر", less: "أقل", example: "مثال", close: "إغلاق", tapClose: "انقر للإغلاق" },
  zh: { tip: "提示", more: "了解更多", less: "收起", example: "示例", close: "关闭", tapClose: "点击关闭" },
};

const CONFETTI_COLORS = ["#f59e0b", "#ec4899", "#8b5cf6", "#10b981", "#3b82f6", "#ef4444", "#fbbf24", "#06b6d4"];

const MOTIVATION_KEYFRAMES = `
@keyframes wazn-pop {
  0% { transform: scale(0.7) translateY(20px); opacity: 0; }
  55% { transform: scale(1.06) translateY(0); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
@keyframes wazn-confetti {
  0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
  100% { transform: translateY(110vh) rotate(720deg); opacity: 0.85; }
}
@keyframes wazn-glow {
  0%, 100% { box-shadow: 0 10px 40px rgba(251,191,36,0.55), 0 0 0 rgba(236,72,153,0); }
  50% { box-shadow: 0 10px 60px rgba(236,72,153,0.65), 0 0 30px rgba(139,92,246,0.5); }
}
@keyframes wazn-emoji {
  0%, 100% { transform: translateY(0) rotate(-6deg); }
  50% { transform: translateY(-8px) rotate(6deg); }
}
`;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Full-screen celebration: gradient card + falling confetti, auto-dismisses.
function MotivationOverlay({ text, isRTL, tapClose, onClose }: { text: string; isRTL: boolean; tapClose: string; onClose: () => void }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 44 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.9,
        dur: 2.4 + Math.random() * 2,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 7 + Math.random() * 9,
        rot: Math.random() * 360,
      })),
    [],
  );

  useEffect(() => {
    const t = window.setTimeout(onClose, MOTIVATION_VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
      <style>{MOTIVATION_KEYFRAMES}</style>

      <div className="absolute inset-0 overflow-hidden">
        {pieces.map((p, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${p.left}%`,
              top: "-6%",
              width: `${p.size}px`,
              height: `${p.size * 0.55}px`,
              background: p.color,
              borderRadius: "2px",
              transform: `rotate(${p.rot}deg)`,
              animation: `wazn-confetti ${p.dur}s linear ${p.delay}s 1 forwards`,
            }}
          />
        ))}
      </div>

      <div
        dir={isRTL ? "rtl" : "ltr"}
        onClick={onClose}
        className="pointer-events-auto cursor-pointer mx-4 max-w-md rounded-[28px] bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 px-9 py-8 text-center"
        style={{ animation: "wazn-pop 0.55s cubic-bezier(0.2,0.8,0.2,1.2) both, wazn-glow 2.4s ease-in-out infinite" }}
      >
        <div className="mb-3 text-5xl" style={{ animation: "wazn-emoji 1.6s ease-in-out infinite", display: "inline-block" }}>
          🎉
        </div>
        <p className="text-xl font-extrabold leading-relaxed text-white drop-shadow-lg">{text}</p>
        <p className="mt-4 text-xs font-medium text-white/85">{tapClose}</p>
      </div>
    </div>
  );
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
  const [motivation, setMotivation] = useState<string | null>(null);

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

  // Greet on each app load, then drive show/hide off real activity.
  useEffect(() => {
    setOpen(true);

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

  // Auto-dismiss the tip card after 15s so it doesn't linger — UNLESS the reader
  // opened "learn more" (expanded), in which case it stays until they close or
  // collapse it. The timer resets on a new tip (index) or when expand toggles.
  useEffect(() => {
    if (!open || expanded) return;
    const t = window.setTimeout(() => setOpen(false), AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [open, expanded, index]);

  // One personalised motivation celebration, 10 minutes into the session.
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
      setMotivation(text);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [user, lang]);

  if (!onStaffArea || STAFF_TIPS.length === 0) {
    return motivation ? <MotivationOverlay text={motivation} isRTL={isRTL} tapClose={labels.tapClose} onClose={() => setMotivation(null)} /> : null;
  }

  const overlay = motivation ? <MotivationOverlay text={motivation} isRTL={isRTL} tapClose={labels.tapClose} onClose={() => setMotivation(null)} /> : null;

  // Card closed → leave a small lightbulb button so a tip is always one click
  // away (and the feature stays discoverable).
  if (!open) {
    return (
      <>
        {overlay}
        <button
          onClick={() => {
            idleRef.current = false;
            showNextTip();
          }}
          title={labels.tip}
          aria-label={labels.tip}
          className="fixed bottom-4 end-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 transition-colors"
        >
          <Lightbulb className="h-5 w-5" />
        </button>
      </>
    );
  }

  const tip = STAFF_TIPS[((index % STAFF_TIPS.length) + STAFF_TIPS.length) % STAFF_TIPS.length];
  const short = tip.short[lang] || tip.short.ku;
  const detail = tip.detail ? (tip.detail[lang] || tip.detail.ku) : undefined;
  const example = tip.example ? (tip.example[lang] || tip.example.ku) : undefined;

  const close = () => setOpen(false);

  return (
    <>
      {overlay}
      <div
        dir={isRTL ? "rtl" : "ltr"}
        className="fixed bottom-4 end-4 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-gray-900 shadow-lg"
      >
        <div className="flex items-center gap-2 border-b border-amber-100 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-t-xl">
          <Lightbulb className="h-4 w-4 text-amber-500 dark:text-amber-400" />
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

          {detail && (
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setExpanded((e) => !e)}
                className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline"
              >
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {expanded ? labels.less : labels.more}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
