import { useState } from "react";
import { Eye, Loader2, LogOut } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { VIEW_AS_WORDS } from "@shared/viewAsCustomer";

/**
 * The bar that says whose portal this is, and whose eyes are on it.
 *
 * An admin looking at a customer's portal (shared/viewAsCustomer) sees every
 * screen exactly as that customer does — which is the point, and also the
 * hazard: a page that looks like the real thing is a page somebody starts
 * treating as the real thing. So it is named at the top of every screen, in
 * a colour nothing else in the portal uses, with the way out beside it.
 *
 * It draws itself from the session (auth.me), never from a prop or a URL: a
 * page cannot pretend to be a real session, and a real session cannot be
 * made to wear this bar.
 */
export function ViewAsBanner() {
  const { language } = useTranslation();
  const say = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const [leaving, setLeaving] = useState(false);

  const me = trpc.auth.me.useQuery(undefined, { retry: false, staleTime: 60_000 });
  const viewAs = (me.data as { viewAs?: { by: number; name: string } } | null | undefined)?.viewAs;

  const exit = trpc.auth.exitViewAs.useMutation({
    onSuccess: () => {
      // A full reload, not a route change: every cached answer on this page
      // belongs to the customer, and none of it belongs to the admin coming
      // back.
      window.location.href = "/portal-center";
    },
    onError: () => setLeaving(false),
  });

  if (!viewAs) return null;

  const name = (me.data as { fullName?: string; name?: string } | null | undefined);

  return (
    <div
      className="sticky top-0 z-50 flex flex-wrap items-center gap-x-3 gap-y-1 bg-amber-500 px-3 py-2 text-amber-950 shadow"
      data-testid="view-as-banner"
    >
      <Eye className="h-4 w-4 shrink-0" />
      <span className="text-sm font-medium">{say(VIEW_AS_WORDS.banner)}</span>
      {(name?.fullName || name?.name) && (
        <span className="text-sm">{name.fullName ?? name.name}</span>
      )}
      <span className="text-xs opacity-80">{say(VIEW_AS_WORDS.readOnly)}</span>
      {viewAs.name && <span className="text-xs opacity-80">· {viewAs.name}</span>}
      <button
        type="button"
        className="ms-auto inline-flex items-center gap-1.5 rounded-md bg-amber-950/10 px-2.5 py-1 text-xs font-medium hover:bg-amber-950/20"
        onClick={() => { setLeaving(true); exit.mutate(); }}
        disabled={leaving}
        data-testid="view-as-leave"
      >
        {leaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
        {say(VIEW_AS_WORDS.leave)}
      </button>
    </div>
  );
}
