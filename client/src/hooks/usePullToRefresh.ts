import { useCallback, useRef, useState } from "react";

const PULL_THRESHOLD = 80;
const MAX_PULL = 120;

export function usePullToRefresh(onRefresh: () => Promise<unknown> | void) {
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleRefresh = useCallback(async () => {
    try {
      await Promise.resolve(onRefresh());
    } finally {
      setPullDistance(0);
    }
  }, [onRefresh]);

  /**
   * Whether we are at the very top of whatever is actually scrolling.
   *
   * The container used to be its own scroll region, so scrollTop alone was
   * enough. Now that lists flow in the page — so the news strip at the bottom
   * can be scrolled to rather than parked over the content — that container
   * never scrolls, its scrollTop is permanently 0, and a pull would have
   * triggered on any downward drag anywhere in the list.
   */
  const atTop = useCallback(() => {
    const el = containerRef.current;
    if (el && el.scrollHeight > el.clientHeight + 1) return el.scrollTop <= 0;
    return window.scrollY <= 0;
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (atTop()) startY.current = e.touches[0].clientY;
  }, [atTop]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!atTop()) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0) setPullDistance(Math.min(diff * 0.5, MAX_PULL));
  }, [atTop]);

  const onTouchEnd = useCallback(() => {
    if (pullDistance >= PULL_THRESHOLD) handleRefresh();
    else setPullDistance(0);
  }, [pullDistance, handleRefresh]);

  return {
    pullToRefreshProps: {
      ref: (el: HTMLDivElement | null) => { containerRef.current = el; },
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    pullDistance,
    setRef: (el: HTMLDivElement | null) => { containerRef.current = el; },
  };
}
