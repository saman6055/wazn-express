import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, Home, Copy, Check } from "lucide-react";
import { Component, ReactNode } from "react";
/**
 * The six strings this screen needs, written out here rather than read from
 * the locale files.
 *
 * Two reasons. It is the screen that runs when something has already gone
 * wrong, so it must not depend on a translation file having downloaded
 * successfully. And importing all four locales for six strings was pinning
 * ~1 MB of JSON into the entry chunk — the single largest thing every visitor
 * downloaded before anything could render, and the reason splitting them in
 * i18nRegistry had no effect until this was found.
 */
const ERROR_STRINGS: Record<string, {
  title: string; description: string; tryAgain: string;
  goHome: string; copyDetails: string; copied: string;
}> = {
  ku: {
    title: "هەڵەیەک ڕوویدا",
    description: "پەردەکەین، هەڵەیەکی چاوەڕواننەکراو ڕوویدا. دەتوانیت دووبارە هەوڵ بدەیتەوە یان بگەڕێیتەوە سەرەکی.",
    tryAgain: "دووبارە هەوڵ بدەرەوە",
    goHome: "گەڕانەوە بۆ سەرەکی",
    copyDetails: "کۆپیکردنی وردەکاری بۆ پشتگیری",
    copied: "کۆپیکرا",
  },
  en: {
    title: "Something went wrong",
    description: "We're sorry, an unexpected error occurred. You can try again or go back home.",
    tryAgain: "Try again",
    goHome: "Go home",
    copyDetails: "Copy error details for support",
    copied: "Copied",
  },
  ar: {
    title: "حدث خطأ ما",
    description: "عذراً، حدث خطأ غير متوقع. يمكنك المحاولة مرة أخرى أو العودة للرئيسية.",
    tryAgain: "حاول مرة أخرى",
    goHome: "العودة للرئيسية",
    copyDetails: "نسخ تفاصيل الخطأ للدعم",
    copied: "تم النسخ",
  },
  zh: {
    title: "出错了",
    description: "抱歉，发生未预期的错误。您可以重试或返回首页。",
    tryAgain: "重试",
    goHome: "返回首页",
    copyDetails: "复制错误详情以便支持",
    copied: "已复制",
  },
};

const LANGUAGE_STORAGE_KEY = "wazn-express-language";

export function getErrorBoundaryStrings(): {
  title: string;
  description: string;
  tryAgain: string;
  goHome: string;
  copyDetails: string;
  copied: string;
} {
  const lang = (typeof localStorage !== "undefined" && localStorage.getItem(LANGUAGE_STORAGE_KEY)) || "ku";
  const s = ERROR_STRINGS[lang] || ERROR_STRINGS.ku;
  return {
    title: s?.title ?? "Something went wrong",
    description: s?.description ?? "An unexpected error occurred.",
    tryAgain: s?.tryAgain ?? "Try again",
    goHome: s?.goHome ?? "Go home",
    copyDetails: s?.copyDetails ?? "Copy details",
    copied: s?.copied ?? "Copied",
  };
}

/**
 * One report format for every error screen (and the pre-mount failure screen
 * in main.tsx): what happened, where, and when — so "copy details for
 * support" always hands support enough to act on, no matter which screen
 * caught the problem.
 */
export function buildErrorReport(error: Error): string {
  return [
    error.message,
    error.stack,
    typeof window !== "undefined" ? `Page: ${window.location.href}` : null,
    `Time: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  handleCopyDetails = () => {
    const { error } = this.state;
    if (!error) return;
    navigator.clipboard.writeText(buildErrorReport(error)).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const err = this.state.error;
      const strings = getErrorBoundaryStrings();
      const isRTL = typeof localStorage !== "undefined" && ["ku", "ar"].includes(localStorage.getItem(LANGUAGE_STORAGE_KEY) || "");
      return (
        <div
          className="flex items-center justify-center min-h-screen p-6 bg-muted/30"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <div className="flex flex-col items-center w-full max-w-lg rounded-2xl border bg-card p-8 shadow-lg">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle
                size={36}
                className="text-destructive flex-shrink-0"
              />
            </div>

            <h2 className="text-xl font-semibold text-foreground mb-2 text-center">
              {strings.title}
            </h2>
            <p className="text-muted-foreground text-center text-sm mb-6">
              {strings.description}
            </p>

            <div className="w-full max-h-32 overflow-auto rounded-lg bg-muted p-3 mb-6">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words font-sans">
                {err.message}
              </pre>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 w-full">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium",
                  "bg-primary text-primary-foreground",
                  "hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                )}
              >
                <RotateCcw size={18} />
                {strings.tryAgain}
              </button>
              <button
                type="button"
                onClick={() => { window.location.href = "/"; }}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium",
                  "bg-secondary text-secondary-foreground border border-border",
                  "hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                )}
              >
                <Home size={18} />
                {strings.goHome}
              </button>
              <button
                type="button"
                onClick={this.handleCopyDetails}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium",
                  "bg-muted text-muted-foreground",
                  "hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                )}
              >
                {this.state.copied ? (
                  <Check size={18} className="text-green-600 dark:text-green-300" />
                ) : (
                  <Copy size={18} />
                )}
                {this.state.copied ? strings.copied : strings.copyDetails}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
