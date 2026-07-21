import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Package, Phone, Lock, Loader2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { pickLang } from "@/lib/lang";

// Must mirror the server's phoneSchema so we can fail with a friendly,
// localized message instead of surfacing a raw zod pattern error.
const PHONE_RE = /^[+]?[\d\s-]{7,20}$/;

export default function CustomerLogin() {
    const { t, language } = useTranslation();
const [, setLocation] = useLocation();
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");

  const invalidPhoneMsg = () =>
    pickLang(language, {
      ku: "تکایە ژمارەی مۆبایلی دروست بنووسە (نموونە: 07701234567). ئەگەر ستافیت، بەشی «چوونەژوورەوەی ستاف» بەکاربهێنە.",
      en: "Please enter a valid mobile number (e.g. 07701234567). If you are staff, use the staff login below.",
      ar: "يرجى إدخال رقم هاتف صحيح (مثال: 07701234567). إذا كنت من الموظفين فاستخدم دخول الموظفين أدناه.",
      zh: "请输入有效的手机号（例如 07701234567）。如果您是员工，请使用下方的员工登录。",
    });

  const loginMutation = trpc.auth.customerLogin.useMutation({
    onSuccess: (data) => {
      toast.success(`${t("auth.welcomeBack")} ${data.customer.name || data.customer.customerCode}`);
      // Redirect to customer portal - use window.location for full page reload to pick up new cookie
      window.location.href = "/portal";
    },
    onError: (error) => {
      // Zod validation errors arrive as raw JSON — translate the mobile-number
      // one into a human message instead of dumping the pattern on the user.
      const raw = error.message || "";
      if (raw.includes("mobileNumber") || raw.includes("invalid_format") || raw.includes("must match pattern")) {
        toast.error(invalidPhoneMsg());
        return;
      }
      toast.error(raw || t("auth.loginFailed"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileNumber || !password) {
      toast.error(t("messages.fillAllFields"));
      return;
    }
    // Friendly pre-check: catch "admin"-style usernames before the server does.
    if (!PHONE_RE.test(mobileNumber.trim())) {
      toast.error(invalidPhoneMsg());
      return;
    }
    loginMutation.mutate({ mobileNumber: mobileNumber.trim(), password });
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Language switcher — pick your language before signing in */}
      <div className="absolute top-4 end-4 z-10">
        <LanguageSwitcher className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white" />
      </div>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl mb-4">
            <Package className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t("common.appName")}</h1>
          <p className="text-slate-400 mt-1">{t("home.customerPortal")}</p>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{t("auth.login")}</CardTitle>
            <CardDescription>
              {t("auto.text_e2ea3c")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mobile">{t("customers.form.mobileNumber")}</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="mobile"
                    type="tel"
                    placeholder="+964 750 123 4567"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    onInput={(e) => setMobileNumber((e.target as HTMLInputElement).value)}
                    className="pl-10"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                    className="pl-10"
                    dir="ltr"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t("auto.text_b6d29c")}
                  </>
                ) : (
                  t("auto.text_12a620")
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>{t("auto.text_c1178b")} </p>
              <p className="mt-1">{t("auto.text_f081a9")} </p>
            </div>
          </CardContent>
        </Card>

        {/* Staff login link */}
        <div className="mt-6 text-center">
          <a 
            href="/" 
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            {t("auto.text_9b64a9")} →
          </a>
        </div>
      </div>
    </div>
  );
}
