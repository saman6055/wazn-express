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

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const scrollEl = containerRef.current;
    if (!scrollEl) return;
    if (scrollEl.scrollTop <= 0) startY.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const scrollEl = containerRef.current;
    if (!scrollEl || scrollEl.scrollTop > 0) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0) setPullDistance(Math.min(diff * 0.5, MAX_PULL));
  }, []);

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
