import { useState, useEffect } from "react";

/**
 * Returns a value that updates after `delayMs` when the input value changes.
 * Use for search inputs to avoid firing requests on every keystroke (e.g. 300ms).
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
