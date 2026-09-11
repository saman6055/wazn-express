import { useEffect, useState } from "react";
import { fmtTime } from "@/lib/numericDate";

/**
 * A clock that re-renders only itself.
 *
 * The orders dashboard kept the time in its own state and ticked it every
 * second — so once a second it rebuilt every order list, recomputed both
 * charts and re-rendered every table row, all for a clock in the corner.
 */
export function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className={className}>{fmtTime(now, true)}</span>;
}
