import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

/**
 * Tracks in-app navigation as a back/forward stack so the portal can show
 * Back (←) and Forward (→) buttons that know whether a move is possible and
 * never step outside the app. The provider wraps the whole app (above the
 * router); only the portal layouts render the buttons via usePortalHistory().
 *
 * How it works: every wouter location change is compared to the tracked
 * stack — matching the previous entry means the user went back, the next
 * entry means forward, anything else is a fresh push (which truncates any
 * forward history, exactly like a browser).
 */
type PortalHistoryValue = {
  canBack: boolean;
  canForward: boolean;
  back: () => void;
  forward: () => void;
};

const PortalHistoryContext = createContext<PortalHistoryValue>({
  canBack: false,
  canForward: false,
  back: () => {},
  forward: () => {},
});

export function PortalHistoryProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [state, setState] = useState<{ stack: string[]; pos: number }>({
    stack: [location],
    pos: 0,
  });

  useEffect(() => {
    setState((prev) => {
      if (prev.stack[prev.pos] === location) return prev; // no real change
      if (prev.pos > 0 && prev.stack[prev.pos - 1] === location) {
        return { ...prev, pos: prev.pos - 1 }; // went back
      }
      if (prev.pos < prev.stack.length - 1 && prev.stack[prev.pos + 1] === location) {
        return { ...prev, pos: prev.pos + 1 }; // went forward
      }
      const stack = prev.stack.slice(0, prev.pos + 1); // new push: drop forward entries
      stack.push(location);
      return { stack, pos: stack.length - 1 };
    });
  }, [location]);

  const value: PortalHistoryValue = {
    canBack: state.pos > 0,
    canForward: state.pos < state.stack.length - 1,
    back: () => window.history.back(),
    forward: () => window.history.forward(),
  };

  return <PortalHistoryContext.Provider value={value}>{children}</PortalHistoryContext.Provider>;
}

export function usePortalHistory() {
  return useContext(PortalHistoryContext);
}
