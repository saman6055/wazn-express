import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download, Smartphone } from 'lucide-react';
import { useOffline } from '@/contexts/OfflineContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { pickLang } from '@/lib/lang';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';

/**
 * Remembered once the app has been installed, so the prompt does not come
 * back when the customer later opens the site in an ordinary tab.
 *
 * Remembered — but not for good. The owner's rule is: installed, never ask;
 * deleted, ask again. Deletion is learned two different ways:
 *
 * - Android says so directly: Chrome only fires `beforeinstallprompt` when
 *   the app is NOT currently installed, so that event firing proves the
 *   remembered install is gone.
 * - iOS says nothing, ever. So the memory expires instead: every open inside
 *   the app refreshes this timestamp, and once the app has not been opened
 *   for IOS_INSTALL_STALE_MS while visits keep arriving through Safari, the
 *   install is presumed deleted and the instructions come back.
 */
const INSTALLED_KEY = 'pwa-installed';

/** Two weeks without a single open inside the app — presume it was deleted. */
const IOS_INSTALL_STALE_MS = 14 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const company = useCompanyInfo();
  const { language } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  /** Installed at some point, whether or not this visit is inside the app. */
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);

  useEffect(() => {
    // Check if the app is running as an installed app right now
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    /**
     * Running as an app and having installed it are different questions.
     *
     * `display-mode: standalone` is only true inside the installed app. A
     * customer who installed it in March and then opens the website in an
     * ordinary tab in April was asked to install it all over again — for an
     * app already sitting on their home screen. Being asked to do something
     * you have already done reads as the app not knowing you.
     *
     * Two ways to learn it: the browser fires `appinstalled` at the moment
     * it happens, and running in standalone mode proves it after the fact —
     * which is the only signal iOS gives, since it never fires the event.
     * Every standalone open refreshes the timestamp; the iOS staleness rule
     * on INSTALLED_KEY reads it to tell "installed and resting" apart from
     * "deleted".
     */
    if (standalone) localStorage.setItem(INSTALLED_KEY, String(Date.now()));
    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, String(Date.now()));
      setAlreadyInstalled(true);
      setShowPrompt(false);
    };
    window.addEventListener('appinstalled', onInstalled);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Dismissal is temporary (3 days), not forever: we re-ask on a later
    // visit so every customer keeps getting nudged to install the app.
    // Legacy value 'true' (old forever-dismiss) parses as NaN → re-ask.
    const DISMISS_TTL_MS = 3 * 24 * 60 * 60 * 1000;
    const isDismissedRecently = () => {
      const raw = localStorage.getItem('pwa-install-dismissed');
      if (!raw) return false;
      const ts = Number(raw);
      return Number.isFinite(ts) && Date.now() - ts < DISMISS_TTL_MS;
    };

    // Listen for install prompt. Chrome only fires this when the app is NOT
    // currently installed — so if it fires while an install is remembered,
    // the app was deleted since. Forget the memory and ask again.
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      localStorage.removeItem(INSTALLED_KEY);
      setAlreadyInstalled(false);

      if (!isDismissedRecently()) {
        setTimeout(() => setShowPrompt(true), 3000); // Show after 3 seconds
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Is the remembered install still believable? On Android the browser
    // corrects a stale memory itself (above). On iOS the memory expires when
    // the app has not been opened for two weeks. Legacy non-numeric values
    // count as stale on iOS so an old phantom flag cannot suppress forever.
    const installedRaw = localStorage.getItem(INSTALLED_KEY);
    const installedAt = Number(installedRaw);
    const installedFresh = !!installedRaw && (
      !iOS || (Number.isFinite(installedAt) && Date.now() - installedAt < IOS_INSTALL_STALE_MS)
    );

    if (installedFresh) {
      setAlreadyInstalled(true);
    } else if (iOS && !standalone && !isDismissedRecently()) {
      // Show iOS prompt after delay
      setTimeout(() => setShowPrompt(true), 5000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Timestamp, not a flag — the prompt comes back after the TTL passes.
    localStorage.setItem('pwa-install-dismissed', String(Date.now()));
  };

  // Never ask somebody to install what they have already installed.
  if (isStandalone || alreadyInstalled || !showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-4 mx-auto max-w-md">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-slate-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center">
            <Smartphone className="h-7 w-7 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-lg mb-1">
              {pickLang(language, { ku: "دابەزاندنی ئەپ", en: "Install App", ar: "تثبيت التطبيق", zh: "安装应用" })}
            </h3>
            <p className="text-slate-400 text-sm mb-3">
              {pickLang(language, {
                ku: `${company.name} وەک ئەپ دابەزێنە بۆ ئەزموونی باشتر`,
                en: `Install ${company.name} as an app for a better experience`,
                ar: `ثبّت ${company.name} كتطبيق للحصول على تجربة أفضل`,
                zh: `将 ${company.name} 安装为应用以获得更佳体验`,
              })}
            </p>

            {isIOS ? (
              <div className="text-slate-300 text-sm">
                <p className="mb-2">{pickLang(language, { ku: "بۆ دابەزاندن:", en: "To install:", ar: "للتثبيت:", zh: "安装步骤：" })}</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  <li>{pickLang(language, { ku: "کلیک لەسەر", en: "Tap", ar: "اضغط على", zh: "点击" })} <span className="inline-flex items-center px-1 py-0.5 bg-slate-700 rounded">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L12 14M12 2L8 6M12 2L16 6M4 14L4 20L20 20L20 14" stroke="currentColor" strokeWidth="2" fill="none"/>
                    </svg>
                  </span> {pickLang(language, { ku: "بکە", en: "", ar: "", zh: "" })}</li>
                  <li>{pickLang(language, { ku: '"Add to Home Screen" هەڵبژێرە', en: 'Select "Add to Home Screen"', ar: 'اختر "Add to Home Screen"', zh: '选择 "Add to Home Screen"' })}</li>
                  <li>{pickLang(language, { ku: '"Add" کلیک بکە', en: 'Tap "Add"', ar: 'اضغط "Add"', zh: '点击 "Add"' })}</li>
                </ol>
              </div>
            ) : (
              <Button
                onClick={handleInstall}
                className="bg-orange-500 hover:bg-orange-600 text-white w-full"
              >
                <Download className="h-4 w-4 ms-2" />
                {pickLang(language, { ku: "دابەزاندن", en: "Install", ar: "تثبيت", zh: "安装" })}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for checking PWA status
export function usePWA() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(standalone);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isInstalled, isOnline };
}

// Offline indicator component. Requires OfflineProvider and LanguageProvider in App.
export function OfflineIndicator() {
  const { isOnline, pendingCount } = useOffline();
  const { t } = useTranslation();

  if (isOnline) return null;

  const message = pendingCount > 0
    ? t("errors.offlinePendingActions", { count: pendingCount })
    : t("errors.offlineBanner");

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center py-2.5 text-sm font-medium shadow-md">
      <span className="inline-flex items-center gap-2">
        <span className="w-2 h-2 bg-white dark:bg-card rounded-full animate-pulse" />
        {message}
      </span>
    </div>
  );
}
