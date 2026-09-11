import { useCallback, useState } from "react";
import {
  forgetSearchHistory,
  readSearchHistory,
  rememberSearch,
  suggestFromHistory,
} from "@/lib/entry/searchHistory";

/** One search box's own list of recent searches (lib/entry/searchHistory.ts). */
export function useSearchHistory(scope: string) {
  const [history, setHistory] = useState<string[]>(() => readSearchHistory(scope));

  const remember = useCallback((term: string) => setHistory(rememberSearch(scope, term)), [scope]);
  const clear = useCallback(() => {
    forgetSearchHistory(scope);
    setHistory([]);
  }, [scope]);
  const suggest = useCallback((typed: string) => suggestFromHistory(typed, history), [history]);

  return { history, remember, clear, suggest };
}
