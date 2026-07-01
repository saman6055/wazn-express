import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  value: number;
  /** Format the (possibly fractional, mid-animation) number for display. */
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
}

/**
 * Animates a number counting up to its value on mount and whenever it changes.
 * Zero dependencies — a single requestAnimationFrame loop, cancelled on unmount.
 * Honours prefers-reduced-motion (jumps straight to the value).
 */
export function CountUp({ value, format, durationMs = 900, className }: CountUpProps) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const from = fromRef.current;
    const to = value;
    if (reduce || from === to || !isFinite(to)) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  const text = format ? format(display) : Math.round(display).toLocaleString();
  return <span className={className}>{text}</span>;
}
