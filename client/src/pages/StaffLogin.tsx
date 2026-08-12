import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import CompanyLogo from "@/components/CompanyLogo";
import { Eye, EyeOff, Loader2, AlertCircle, User } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { useTranslation } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function StaffLogin() {
  const { t } = useTranslation();
  const company = useCompanyInfo();
  const [, setLocation] = useLocation();
  const [identifier, setIdentifier] = useState(""); // Can be username, email or mobile number
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.staffLogin.useMutation({
    onSuccess: () => {
      // Redirect to dashboard
      window.location.href = "/dashboard";
    },
    onError: (err) => {
      const msg = (err as { message?: string; data?: { message?: string } }).message
        || (err as { data?: { message?: string } }).data?.message
        || t("auth.loginFailed");
      setError(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!identifier.trim() || !password.trim()) {
      setError(t("messages.fillAllFields"));
      return;
    }
    
    loginMutation.mutate({ identifier: identifier.trim(), password });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="pointer-events-none absolute -top-24 end-0 h-96 w-96 rounded-full bg-sky-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 start-0 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
      {/* Language switcher — pick your language before signing in */}
      <div className="absolute top-4 end-4 z-10">
        <LanguageSwitcher className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white" />
      </div>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <CompanyLogo
              size={64}
              className="bg-white dark:bg-card rounded-2xl shadow-lg p-2"
              iconClassName="w-8 h-8 text-emerald-600"
              fallbackBg="bg-white"
            />
          </div>
          <h1 className="text-3xl font-bold text-white">{company.name}</h1>
          <p className="text-slate-300 mt-2">{t("auth.staffSubtitle")}</p>
        </div>

        {/* Login Card */}
        <Card className="border-0 shadow-2xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl">{t("auth.staffLogin")}</CardTitle>
            <CardDescription>
              {t("auth.enterCredentials")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="identifier">{t("auth.username")}</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="identifier"
                    type="text"
                    placeholder={t("auth.usernamePlaceholder")}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="h-12 pr-10"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pr-12"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-br from-sky-500 to-violet-600 hover:opacity-95 text-lg shadow-lg shadow-sky-500/25"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin me-2" />
                    {t("auth.loading")}
                  </>
                ) : (
                  t("auth.login")
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <a
                href="/"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-600 transition-colors"
              >
                {t("common.goHome")}
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-slate-400 text-sm mt-6">
          © {new Date().getFullYear()} {company.name}. {t("home.allRightsReserved")}
        </p>
      </div>
    </div>
  );
}
