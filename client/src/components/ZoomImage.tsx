import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

/**
 * Product thumbnail that pops a larger preview on hover so staff can see what a
 * package actually is without leaving the list. The preview is portaled (via
 * HoverCard) so it never gets clipped by the table's scroll container, and it
 * closes again as soon as the cursor leaves.
 */
export function ZoomImage({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  if (!src) return null;
  return (
    <HoverCard openDelay={120} closeDelay={60}>
      <HoverCardTrigger asChild>
        <img
          src={src}
          alt={alt || ""}
          className={cn("cursor-zoom-in rounded-lg object-cover", className)}
        />
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-auto p-1">
        <img
          src={src}
          alt={alt || ""}
          className="max-h-72 max-w-72 rounded-md object-contain"
        />
      </HoverCardContent>
    </HoverCard>
  );
}
