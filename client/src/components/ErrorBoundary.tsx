import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, Home, Copy, Check } from "lucide-react";
import { Component, ReactNode } from "react";

// Kurdish strings for error page (ErrorBoundary renders outside LanguageProvider)
const ERROR_STRINGS = {
  title: "هەڵەیەک ڕوویدا",
  description: "پەردەکەین، هەڵەیەکی چاوەڕواننەکراو ڕوویدا. دەتوانیت دووبارە هەوڵ بدەیتەوە یان بگەڕێیتەوە سەرەکی.",
  tryAgain: "دووبارە هەوڵ بدەرەوە",
  goHome: "گەڕانەوە بۆ سەرەکی",
  copyDetails: "کۆپیکردنی وردەکاری بۆ پشتگیری",
  copied: "کۆپیکرا",
} as const;

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
    const text = [error.message, error.stack].filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const err = this.state.error;
      return (
        <div
          className="flex items-center justify-center min-h-screen p-6 bg-muted/30"
          dir="rtl"
        >
          <div className="flex flex-col items-center w-full max-w-lg rounded-2xl border bg-card p-8 shadow-lg">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle
                size={36}
                className="text-destructive flex-shrink-0"
              />
            </div>

            <h2 className="text-xl font-semibold text-foreground mb-2 text-center">
              {ERROR_STRINGS.title}
            </h2>
            <p className="text-muted-foreground text-center text-sm mb-6">
              {ERROR_STRINGS.description}
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
                {ERROR_STRINGS.tryAgain}
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
                {ERROR_STRINGS.goHome}
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
                  <Check size={18} className="text-green-600" />
                ) : (
                  <Copy size={18} />
                )}
                {this.state.copied ? ERROR_STRINGS.copied : ERROR_STRINGS.copyDetails}
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
