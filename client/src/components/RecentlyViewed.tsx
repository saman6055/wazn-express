import { Clock } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { cn } from "@/lib/utils";

type RecentlyViewedProps = {
  className?: string;
};

/**
 * Dropdown listing recently visited locations (client-side UI state only).
 * Reads from useRecentlyViewed(); the recording happens elsewhere (callers).
 */
export function RecentlyViewed({ className }: RecentlyViewedProps) {
  const { t } = useTranslation();
  const { items } = useRecentlyViewed();
  const [location] = useLocation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("text-muted-foreground", className)}
          aria-label={t("recentlyViewed.title") || "دواترین بینراوەکان"}
        >
          <Clock className="size-5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" aria-hidden />
          {t("recentlyViewed.title") || "دواترین بینراوەکان"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-2 py-3 text-center text-sm text-muted-foreground">
            {t("recentlyViewed.empty") || "هیچ تۆمارێک نییە"}
          </div>
        ) : (
          items.map((item) => (
            <DropdownMenuItem
              key={item.path}
              asChild
              className={cn(
                item.path === location && "bg-accent text-accent-foreground"
              )}
            >
              <Link href={item.path} className="w-full truncate">
                {item.label}
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default RecentlyViewed;
