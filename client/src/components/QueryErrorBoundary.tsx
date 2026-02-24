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
  if (error.message === UNAUTHED_ERR_MSG) return true;
  if (status === 401) return true;
  if (msg.includes("invalid session") || msg.includes("session cookie") || msg.includes("please login")) return true;
  // 403 with unclear message (e.g. "[object Object]" after bad parse) or "forbidden" → treat as session, redirect
  if (status === 403 && (msg.includes("session") || msg.includes("cookie") || msg === "[object object]" || msg === "forbidden" || msg.length < 3)) return true;
  const trpcData = isTRPCClientError(error) ? (error as TRPCClientError<any>).data as { code?: string } | null : null;
  if (trpcData?.code === "UNAUTHORIZED" || (trpcData?.code === "FORBIDDEN" && (msg.includes("session") || msg.includes("cookie") || msg === "[object object]"))) return true;
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
