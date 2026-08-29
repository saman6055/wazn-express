import { trpc } from "@/lib/trpc";
import { Sparkles, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";

/**
 * A word on the days worth one.
 *
 * Deliberately not a notification, not a banner, and not at the top of the
 * page. The channel that carries "your goods are in Erbil, come and collect"
 * is the one thing a customer must never learn to ignore, and a greeting a
 * day is how that happens — so this lives down the page beside the rating
 * card, found while scrolling rather than announced.
 *
 * That placement is also what makes it feel like a kindness instead of
 * marketing. Nobody minds a nice thing they came across; they mind one that
 * got in the way.
 *
 * Renders nothing on an ordinary day, which is most days.
 */
export function GreetingCard({ isDark, language }: { isDark: boolean; language: string }) {
  const { data } = trpc.customerPortal.getGreeting.useQuery(undefined, {
    // Once a session is plenty. The answer changes at midnight at the
    // earliest, and a milestone is marked as given the moment it is fetched.
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (!data) return null;

  const milestone = data.kind === "milestone";
  const L = (k: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, k);

  return (
    <div className="px-4 mt-4" data-testid="portal-greeting">
      <div
        className={cn(
          "rounded-2xl p-4 flex items-start gap-3.5 ring-1",
          milestone
            ? isDark
              ? "bg-amber-950/40 ring-amber-800"
              : "bg-amber-50 dark:bg-amber-950/40 ring-amber-200 dark:ring-amber-800"
            : isDark
              ? "bg-violet-950/40 ring-violet-800"
              : "bg-violet-50 dark:bg-violet-950/40 ring-violet-200 dark:ring-violet-800",
        )}
      >
        <div
          className={cn(
            "w-11 h-11 shrink-0 rounded-xl flex items-center justify-center",
            milestone ? "bg-amber-500" : "bg-violet-500",
          )}
        >
          {milestone ? (
            <PartyPopper className="w-5 h-5 text-white" />
          ) : (
            <Sparkles className="w-5 h-5 text-white" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-semibold leading-snug",
              isDark ? "text-white" : "text-slate-800 dark:text-slate-100",
            )}
          >
            {L(data.title)}
          </p>
          <p
            className={cn(
              "text-sm mt-0.5 leading-relaxed",
              isDark ? "text-slate-300" : "text-slate-600 dark:text-slate-300",
            )}
          >
            {L(data.message)}
          </p>
        </div>
      </div>
    </div>
  );
}
