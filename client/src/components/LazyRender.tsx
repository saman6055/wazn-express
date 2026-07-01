import { useEffect, useRef, useState } from "react";

interface LazyRenderProps {
  children: React.ReactNode;
  /** Reserve this height until content mounts, to avoid layout shift. */
  minHeight?: number;
  /** Start rendering this far before the element enters the viewport. */
  rootMargin?: string;
  className?: string;
}

/**
 * Defers mounting its children until they are about to scroll into view, using a
 * native IntersectionObserver (no dependency). Keeps heavy content (e.g. charts)
 * out of the initial render so first paint stays fast. Falls back to rendering
 * immediately where IntersectionObserver is unavailable.
 */
export function LazyRender({ children, minHeight = 280, rootMargin = "250px", className }: LazyRenderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} className={className} style={visible ? undefined : { minHeight }}>
      {visible ? children : null}
    </div>
  );
}
