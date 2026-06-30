import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tiny inline "copy to clipboard" icon, meant to sit next to a value in dense
 * list rows (order number, customer, batch, tracking…). Stops propagation so it
 * never triggers a row/cell click, and flips to a green check for ~1.2s.
 */
export function CopyButton({
  value,
  className,
  label,
}: {
  value?: string | number | null;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (value === null || value === undefined || value === "") return null;

  return (
    <button
      type="button"
      title={label || "کۆپی کردن"}
      aria-label={label || "کۆپی کردن"}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        navigator.clipboard
          ?.writeText(String(value))
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          })
          .catch(() => {});
      }}
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}
