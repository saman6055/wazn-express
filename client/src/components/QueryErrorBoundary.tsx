import { TRPCClientError } from "@trpc/client";
import { Component, ReactNode } from "react";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { getLoginUrl } from "@/const";
import { QueryErrorFallback } from "./QueryErrorFallback";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

function isTRPCClientError(e: unknown): e is TRPCClientError<any> {
  return e instanceof TRPCClientError;
}

function getHttpStatus(error: Error): number | undefined {
  if (isTRPCClientError(error) && error.data && typeof error.data === "object" && "httpStatus" in error.data) {
    return (error.data as { httpStatus?: number }).httpStatus;
  }
  const err = error as Error & { httpStatus?: number };
  if (typeof err.httpStatus === "number") return err.httpStatus;
  return undefined;
}

function isAuthError(error: Error): boolean {
  const msg = (error.message ?? "").toLowerCase();
  const status = getHttpStatus(error);

  // Explicit session-expired marker (shared const used by the auth layer
  // when it detects a missing/invalid session cookie).
  if (error.message === UNAUTHED_ERR_MSG) return true;

  // HTTP 401 is the canonical "unauthenticated" signal. Always redirect.
  if (status === 401) return true;

  // tRPC UNAUTHORIZED code → procedure-level auth failure (session
  // missing or rejected by middleware). Redirect.
  const trpcData = isTRPCClientError(error) ? (error as TRPCClientError<any>).data as { code?: string } | null : null;
  if (trpcData?.code === "UNAUTHORIZED") return true;

  // Explicit session-expired language in the error message (Kurdish/Arabic
  // backends sometimes throw plain strings rather than wrap in tRPC).
  if (
    msg.includes("invalid session") ||
    msg.includes("session cookie") ||
    msg.includes("session expired") ||
    msg.includes("please login") ||
    msg.includes("please log in") ||
    msg.includes("not authenticated")
  ) {
    return true;
  }

  // IMPORTANT: We intentionally do NOT treat HTTP 403 / tRPC FORBIDDEN as a
  // logout trigger. FORBIDDEN means "you ARE authenticated but lack
  // permission for this specific action" — a permissions issue, NOT a
  // session issue. Forcing logout on every FORBIDDEN kicked portal
  // customers out the moment they touched a procedure restricted to
  // staff (or vice versa), which was the production bug
  // "زۆر جار لەناو پۆرتاڵی کریار راستەوخۆ لەناو پەرەی کریار دەچیتە دەرەوە".
  // The old `msg === "[object object]"` / `msg.length < 3` heuristics
  // were especially harmful because they fired on ANY error whose
  // message got stringified to `[object Object]` (very common when a
  // tRPC error's data shape was unexpected).
  return false;
}

function isNotFoundError(error: Error): boolean {
  return getHttpStatus(error) === 404;
}

function isNetworkError(error: Error): boolean {
  const msg = error.message?.toLowerCase() ?? "";
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) return true;
  if (isTRPCClientError(error) && error.cause) {
    const c = error.cause as Error;
    return c.message?.toLowerCase().includes("network") || c.message?.toLowerCase().includes("fetch") || false;
  }
  return false;
}

/**
 * Error boundary for tRPC/React Query errors.
 * Renders QueryErrorFallback with appropriate message (404, 401, network, generic)
 * and auto-redirects to login on 401.
 */
class QueryErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(_: Props, prevState: State) {
    if (this.state.error && this.state.error !== prevState.error && isAuthError(this.state.error)) {
      window.location.href = getLoginUrl();
    }
  }

  componentDidCatch(error: Error) {
    if (isAuthError(error)) {
      window.location.href = getLoginUrl();
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <QueryErrorFallback
          error={this.state.error}
          onRetry={this.reset}
          isAuthError={isAuthError(this.state.error)}
          isNotFound={isNotFoundError(this.state.error)}
          isNetwork={isNetworkError(this.state.error)}
        />
      );
    }
    return this.props.children;
  }
}

export default QueryErrorBoundary;
export { isAuthError, isNotFoundError, isNetworkError, getHttpStatus };
