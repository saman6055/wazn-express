import { useEffect, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

// Two small floating buttons on the LEFT edge that scroll the page up / down by
// roughly one screen — handy on long forms and tables. They only appear when the
// page is actually scrollable, and each disables itself at the respective end.
export function ScrollButtons() {
  const [scrollable, setScrollable] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    const update = () => {
      const doc = document.documentElement;
      const y = window.scrollY || doc.scrollTop || 0;
      const max = doc.scrollHeight - window.innerHeight;
      setScrollable(max > 120);
      setAtTop(y <= 80);
      setAtBottom(y >= max - 80);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }, []);

  if (!scrollable) return null;

  const step = Math.round(window.innerHeight * 0.85);
  const up = () => window.scrollBy({ top: -step, behavior: "smooth" });
  const down = () => window.scrollBy({ top: step, behavior: "smooth" });

  const btn =
    "h-9 w-9 rounded-full bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 shadow-md backdrop-blur flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors disabled:opacity-30 disabled:pointer-events-none";

  // `end-2`, not a fixed left: the sidebar sits at the start of the reading
  // direction and moves with it, so a hardcoded left parked these on top of
  // it the moment anyone switched to English.
  return (
    <div className="fixed end-2 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2 print:hidden">
      <button onClick={up} disabled={atTop} aria-label="Scroll up" className={btn}>
        <ChevronUp className="h-5 w-5" />
      </button>
      <button onClick={down} disabled={atBottom} aria-label="Scroll down" className={btn}>
        <ChevronDown className="h-5 w-5" />
      </button>
    </div>
  );
}
