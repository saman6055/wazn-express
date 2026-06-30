import { memo, useId } from "react";
import { cn } from "@/lib/utils";

export interface SparklineProps {
  data: number[];
  className?: string;
  /** Line/fill color. Defaults to the inherited text color. */
  stroke?: string;
}

/**
 * Tiny presentational SVG trend line — no external libs, no data fetching.
 * Renders a polyline scaled to the data's min/max with a faint area fill and
 * a dot on the latest point. Returns null for fewer than 2 points.
 */
export const Sparkline = memo(function Sparkline({
  data,
  className,
  stroke = "currentColor",
}: SparklineProps) {
  const gradientId = useId();

  if (!data || data.length < 2) return null;

  const width = 100;
  const height = 32;
  const padY = 3;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // guard divide-by-zero on all-equal values

  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = padY + (1 - (v - min) / range) * (height - padY * 2);
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("block h-8 w-full", className)}
      style={{ color: stroke }}
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last.x} cy={last.y} r={1.6} fill="currentColor" vectorEffect="non-scaling-stroke" />
    </svg>
  );
});
