import { usePortalPalette } from "@/components/portal/PortalHeaderControls";
import { useState } from "react";
import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Shield, ArrowLeft, ArrowRight, Lock, KeyRound, Eye, EyeOff,
  CheckCircle2, Loader2, ShieldCheck,
} from "lucide-react";

type L = { ku: string; en: string; ar: string; zh: string };

export default function PortalSecurity() {
  const { language } = useLanguage();

  // Banner colour follows the mode the customer picked, like every other page.

  const { banner: portalBanner } = usePortalPalette();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  const pick = (v: L) => pickLang(language, v);
  const [, navigate] = useLocation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const changePassword = trpc.customerPortal.changeMyPassword.useMutation({
    onSuccess: () => {
      toast.success(pick({
        ku: "وشەی نهێنی بە سەرکەوتوویی گۆڕدرا",
        en: "Password changed successfully",
        ar: "تم تغيير كلمة المرور بنجاح",
        zh: "密码修改成功",
      }));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => {
      toast.error(err.message || pick({
        ku: "گۆڕینی وشەی نهێنی سەرکەوتوو نەبوو",
        en: "Could not change password",
        ar: "تعذّر تغيير كلمة المرور",
        zh: "无法修改密码",
      }));
    },
  });

  // Password strength: 0..4 based on length and character variety.
  const strength = (() => {
    let s = 0;
    if (newPassword.length >= 6) s++;
    if (newPassword.length >= 10) s++;
    if (/[0-9]/.test(newPassword) && /[a-zA-Z]/.test(newPassword)) s++;
    if (/[^a-zA-Z0-9]/.test(newPassword)) s++;
    return Math.min(4, s);
  })();
  const strengthLabel: L =
    strength <= 1 ? { ku: "لاواز", en: "Weak", ar: "ضعيفة", zh: "弱" } :
    strength === 2 ? { ku: "مامناوەند", en: "Fair", ar: "متوسطة", zh: "一般" } :
    strength === 3 ? { ku: "باش", en: "Good", ar: "جيدة", zh: "良好" } :
                     { ku: "بەهێز", en: "Strong", ar: "قوية", zh: "强" };
  const strengthColor =
    strength <= 1 ? "bg-red-500" :
    strength === 2 ? "bg-amber-500" :
    strength === 3 ? "bg-lime-500" : "bg-emerald-500";

  const tooShort = newPassword.length > 0 && newPassword.length < 6;
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const canSubmit =
    currentPassword.length >= 1 &&
    newPassword.length >= 6 &&
    confirmPassword === newPassword &&
    newPassword !== currentPassword &&
    !changePassword.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword === currentPassword) {
      toast.error(pick({
        ku: "وشەی نهێنی نوێ دەبێت جیاواز بێت لە کۆنەکە",
        en: "New password must differ from the current one",
        ar: "يجب أن تختلف كلمة المرور الجديدة عن الحالية",
        zh: "新密码必须与当前密码不同",
      }));
      return;
    }
    if (!canSubmit) return;
    changePassword.mutate({ currentPassword, newPassword });
  };

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  const inputCls = cn(
    "w-full h-12 rounded-xl px-4 pe-11 text-sm font-medium outline-none transition",
    "border focus:ring-2",
    isDark
      ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-cyan-500/40 focus:border-cyan-500"
      : "bg-white border-slate-200 dark:border-slate-800/60 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-cyan-500/30 focus:border-cyan-500",
  );

  const tips: L[] = [
    { ku: "بەلایەنی کەمەوە ٦ پیت", en: "At least 6 characters", ar: "٦ أحرف على الأقل", zh: "至少 6 个字符" },
    { ku: "تێکەڵەی پیت و ژمارە بەکاربهێنە", en: "Mix letters and numbers", ar: "امزج الأحرف والأرقام", zh: "混合字母和数字" },
    { ku: "وشەی نهێنیت لەگەڵ کەس هاوبەش مەکە", en: "Never share your password", ar: "لا تشارك كلمة مرورك", zh: "切勿分享密码" },
  ];

  return (
    <CustomerPortalLayout>
      <div
        className={cn("min-h-screen", isDark ? "bg-slate-950" : "bg-gray-50 dark:bg-gray-950/40")}
        dir={isRTL ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="relative overflow-hidden text-white px-4 pt-6 pb-10" style={portalBanner}>
          <div className="absolute -top-10 -end-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-12 -start-6 w-40 h-40 rounded-full bg-white/10 blur-2xl" />

          <button
            onClick={() => navigate("/portal/profile")}
            className="relative flex items-center gap-1.5 text-white/90 text-sm font-medium mb-4 active:scale-95 transition"
          >
            <BackArrow className="w-5 h-5" />
            {pick({ ku: "پرۆفایل", en: "Profile", ar: "الملف الشخصي", zh: "个人资料" })}
          </button>

          <div className="relative flex items-center gap-3">
            <div className="w-14 h-14 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center ring-1 ring-white/25">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold leading-tight">
                {pick({ ku: "پاراستن", en: "Security", ar: "الأمان", zh: "安全" })}
              </h1>
              <p className="text-sm text-white/80">
                {pick({ ku: "وشەی نهێنی و ئەمنیەتی هەژمار", en: "Password & account safety", ar: "كلمة المرور وأمان الحساب", zh: "密码与账户安全" })}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-6 space-y-5 pb-28 max-w-lg mx-auto">
          {/* Change password card */}
          <form
            onSubmit={handleSubmit}
            className={cn(
              "rounded-3xl p-5 shadow-sm ring-1",
              isDark ? "bg-slate-900 ring-white/5" : "bg-white ring-gray-100",
            )}
          >
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white shrink-0">
                <KeyRound className="w-4.5 h-4.5" />
              </div>
              <h2 className={cn("font-bold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                {pick({ ku: "گۆڕینی وشەی نهێنی", en: "Change Password", ar: "تغيير كلمة المرور", zh: "修改密码" })}
              </h2>
            </div>

            {/* Current password */}
            <label className={cn("text-xs font-semibold mb-1.5 block", isDark ? "text-slate-400" : "text-slate-500")}>
              {pick({ ku: "وشەی نهێنی ئێستا", en: "Current password", ar: "كلمة المرور الحالية", zh: "当前密码" })}
            </label>
            <div className="relative mb-4">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className={inputCls}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className={cn("absolute top-1/2 -translate-y-1/2 end-3", isDark ? "text-slate-400" : "text-slate-500")}
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* New password */}
            <label className={cn("text-xs font-semibold mb-1.5 block", isDark ? "text-slate-400" : "text-slate-500")}>
              {pick({ ku: "وشەی نهێنی نوێ", en: "New password", ar: "كلمة المرور الجديدة", zh: "新密码" })}
            </label>
            <div className="relative mb-2">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className={inputCls}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className={cn("absolute top-1/2 -translate-y-1/2 end-3", isDark ? "text-slate-400" : "text-slate-500")}
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Strength meter */}
            {newPassword.length > 0 && (
              <div className="mb-4">
                <div className="flex gap-1.5 mb-1.5">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 flex-1 rounded-full transition-colors",
                        i < strength ? strengthColor : isDark ? "bg-slate-700" : "bg-slate-200",
                      )}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className={cn("text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                    {pick({ ku: "هێزی وشەی نهێنی", en: "Password strength", ar: "قوة كلمة المرور", zh: "密码强度" })}
                  </span>
                  <span className={cn(
                    "text-xs font-bold",
                    strength <= 1 ? "text-red-500" : strength === 2 ? "text-amber-500" : strength === 3 ? "text-lime-600" : "text-emerald-500",
                  )}>
                    {pick(strengthLabel)}
                  </span>
                </div>
                {tooShort && (
                  <p className="text-xs text-red-500 mt-1.5">
                    {pick({ ku: "دەبێت بەلایەنی کەمەوە ٦ پیت بێت", en: "Must be at least 6 characters", ar: "يجب ألا تقل عن ٦ أحرف", zh: "至少需 6 个字符" })}
                  </p>
                )}
              </div>
            )}

            {/* Confirm password */}
            <label className={cn("text-xs font-semibold mb-1.5 block", isDark ? "text-slate-400" : "text-slate-500")}>
              {pick({ ku: "دووبارەکردنەوەی وشەی نهێنی نوێ", en: "Confirm new password", ar: "تأكيد كلمة المرور الجديدة", zh: "确认新密码" })}
            </label>
            <div className="relative mb-2">
              <input
                type={showNew ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className={cn(inputCls, mismatch && "border-red-500 focus:border-red-500 focus:ring-red-500/30")}
                placeholder="••••••••"
              />
              {confirmPassword.length > 0 && !mismatch && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 absolute top-1/2 -translate-y-1/2 end-3" />
              )}
            </div>
            {mismatch && (
              <p className="text-xs text-red-500 mb-3">
                {pick({ ku: "وشە نهێنییەکان یەک ناگرنەوە", en: "Passwords do not match", ar: "كلمتا المرور غير متطابقتين", zh: "密码不一致" })}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "w-full h-12 rounded-xl font-bold text-white flex items-center justify-center gap-2 mt-3 transition active:scale-[0.98]",
                canSubmit
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-blue-500/25"
                  : "bg-slate-400 dark:bg-slate-700 cursor-not-allowed",
              )}
            >
              {changePassword.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Lock className="w-5 h-5" />
              )}
              {pick({ ku: "پاشەکەوتکردنی وشەی نهێنی نوێ", en: "Save new password", ar: "حفظ كلمة المرور الجديدة", zh: "保存新密码" })}
            </button>
          </form>

          {/* Safety tips */}
          <div className={cn(
            "rounded-3xl p-5 ring-1",
            isDark ? "bg-slate-900 ring-white/5" : "bg-white ring-gray-100",
          )}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white shrink-0">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
              <h2 className={cn("font-bold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                {pick({ ku: "ڕێنماییەکانی ئەمنیەت", en: "Safety tips", ar: "نصائح الأمان", zh: "安全提示" })}
              </h2>
            </div>
            <ul className="space-y-2.5">
              {tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span className={cn("text-sm", isDark ? "text-slate-300" : "text-slate-600")}>
                    {pick(tip)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </CustomerPortalLayout>
  );
}
