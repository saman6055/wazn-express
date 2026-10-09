import { LogIn, MessageCircle, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { isPortalDemo, leavePortalDemo, PORTAL_DEMO_WORDS } from "@/lib/portalDemo";
import { openWaznChat } from "@/lib/waznChat";

/**
 * The bar over every screen of the demo (lib/portalDemo).
 *
 * The demo is the real portal with recorded answers, so nothing on a page
 * says it is not somebody's account - this does, on every screen, and it is
 * also where the visitor is asked for the one thing the demo is for: to
 * become a customer. WhatsApp goes straight to Wazn, as every customer
 * button does (lib/waznChat).
 */
export function PortalDemoBanner() {
  const { language } = useTranslation();
  const [location] = useLocation();
  // Only over the portal: the website and the login page are not the demo.
  if (!isPortalDemo() || !location.startsWith("/portal") || location.startsWith("/portal-center")) return null;
  const say = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);

  return (
    <div
      // In the page's flow, not stuck: every skin has its own bar stuck to
      // the top, and two of them there cover each other.
      className="relative z-[51] flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-indigo-600 px-3 py-2 text-white print:hidden"
      data-testid="portal-demo-banner"
    >
      <Sparkles className="h-4 w-4 shrink-0" />
      {/* On a phone the sentence has the line to itself; beside two buttons it broke into five. */}
      <span className="min-w-0 basis-[calc(100%-2rem)] text-sm font-medium sm:flex-1 sm:basis-auto">{say(PORTAL_DEMO_WORDS.banner)}</span>
      <button
        type="button"
        className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-amber-300 px-3 py-1 text-xs font-bold text-indigo-950 hover:bg-amber-200 sm:flex-none"
        onClick={() => openWaznChat(say(PORTAL_DEMO_WORDS.askAccount))}
        data-testid="portal-demo-account"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {say(PORTAL_DEMO_WORDS.wantAccount)}
      </button>
      <button
        type="button"
        className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-indigo-800 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-900 sm:flex-none"
        onClick={leavePortalDemo}
        data-testid="portal-demo-leave"
      >
        <LogIn className="h-3.5 w-3.5" />
        {say(PORTAL_DEMO_WORDS.signIn)}
      </button>
    </div>
  );
}
