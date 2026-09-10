import { Component, type ReactNode } from "react";
import { AlertTriangle, Check, Copy, RotateCcw } from "lucide-react";
import { buildErrorReport, getErrorBoundaryStrings } from "./ErrorBoundary";
import { copyText } from "@/lib/copyText";
import { errorRef, readerDirection, showsTechnicalDetail } from "@/lib/errorSurface";

/**
 * A crash inside one screen stays inside that screen.
 *
 * The app caught render crashes in one place, around the whole router, and
 * every layout renders inside its page — so one card that failed to render
 * replaced the sidebar, the header and the portal's bottom bar with a
 * full-page error, and moving to another page did not clear it. Each layout
 * now wraps only its content in this: the shell stays usable, the same report
 * and copy button appear where the page was, and the next page starts clean.
 */
interface Props {
  children: ReactNode;
  /** The route: a new address clears the error. */
  resetKey?: string;
}

interface State {
  error: Error | null;
  copied: boolean;
}

export class SectionBoundary extends Component<Props, State> {
  state: State = { error: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null, copied: false });
    }
  }

  private copy = () => {
    const { error } = this.state;
    if (!error) return;
    void copyText(buildErrorReport(error), getErrorBoundaryStrings().copyDetails).then((copied) => {
      if (!copied) return;
      this.setState({ copied: true });
      window.setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render() {
    const { error, copied } = this.state;
    if (!error) return this.props.children;

    const s = getErrorBoundaryStrings();
    const ref = errorRef(error);
    return (
      <div
        role="alert"
        dir={readerDirection()}
        className="mx-auto my-8 flex w-full max-w-lg flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center shadow-sm"
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">{s.title}</h2>
        <p className="text-sm text-muted-foreground">{s.description}</p>
        {ref && (
          <p className="text-xs text-muted-foreground" dir="ltr">
            Ref: <span className="font-mono">{ref}</span>
          </p>
        )}
        {showsTechnicalDetail() && (
          <pre className="max-h-32 w-full overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-start font-sans text-xs text-muted-foreground">
            {error.message}
          </pre>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {s.tryAgain}
          </button>
          <button
            type="button"
            onClick={this.copy}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border bg-muted px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {copied ? (
              <Check className="size-4 text-green-600 dark:text-green-300" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
            {copied ? s.copied : s.copyDetails}
          </button>
        </div>
      </div>
    );
  }
}
