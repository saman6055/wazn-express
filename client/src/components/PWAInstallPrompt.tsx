import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download, Smartphone } from 'lucide-react';
import { useOffline } from '@/contexts/OfflineContext';
import { useTranslation } from '@/contexts/LanguageContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Check if user dismissed before
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 3000); // Show after 3 seconds
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Show iOS prompt after delay
    if (iOS && !standalone) {
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 5000);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
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
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if already installed
  if (isStandalone || !showPrompt) return null;

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
              دابەزاندنی ئەپ
            </h3>
            <p className="text-slate-400 text-sm mb-3">
              Wazn Express وەک ئەپ دابەزێنە بۆ ئەزموونی باشتر
            </p>

            {isIOS ? (
              <div className="text-slate-300 text-sm">
                <p className="mb-2">بۆ دابەزاندن:</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  <li>کلیک لەسەر <span className="inline-flex items-center px-1 py-0.5 bg-slate-700 rounded">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L12 14M12 2L8 6M12 2L16 6M4 14L4 20L20 20L20 14" stroke="currentColor" strokeWidth="2" fill="none"/>
                    </svg>
                  </span> بکە</li>
                  <li>"Add to Home Screen" هەڵبژێرە</li>
                  <li>"Add" کلیک بکە</li>
                </ol>
              </div>
            ) : (
              <Button
                onClick={handleInstall}
                className="bg-orange-500 hover:bg-orange-600 text-white w-full"
              >
                <Download className="h-4 w-4 ml-2" />
                دابەزاندن
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
        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
        {message}
      </span>
    </div>
  );
}
