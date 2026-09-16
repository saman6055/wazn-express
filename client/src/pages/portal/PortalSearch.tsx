import { PortalLayout } from "@/components/portal/PortalLayout";
import { TutorialHint } from "@/components/TutorialHint";
import { useLanguage } from "@/contexts/LanguageContext";
import { PortalSearchField, PORTAL_SEARCH_INPUT_ID } from "@/components/portal/PortalSearchSheet";
import PortalUniversalSearch from "@/components/portal/PortalUniversalSearch";
import { usePortalSearchView } from "@/hooks/usePortalSearchView";

function getInitialSearchQuery(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

/**
 * The search as a page, for the links that lead here — the home header's
 * magnifier, the search bar above every other screen, a shared address.
 *
 * The same answers as the sheet the bottom bar opens (PortalUniversalSearch):
 * one box for a tracking number or its last digits, an order, a box, a
 * product's name; three tabs with live counts; a tap that goes to the
 * answer's own place or opens its detail.
 */
export default function PortalSearch() {
  const { t } = useLanguage();
  // The same history-kept view as the sheet: Back from an answer's page or
  // details returns to exactly these answers. The address keeps ?q= too.
  const view = usePortalSearchView({ initialQuery: getInitialSearchQuery(), urlPath: "/portal/search" });

  return (
    <PortalLayout>
      <div className="bg-slate-800 px-4 pb-5 pt-8 text-white">
        <h1 className="mb-2 text-2xl font-bold">{t("trackPackage") || "Track Package"}</h1>
        <TutorialHint section="شوێنکەوتن" className="mb-3" />
        <PortalSearchField
          id={PORTAL_SEARCH_INPUT_ID}
          value={view.query}
          onChange={view.setQuery}
          onSubmit={view.submit}
          autoFocus={!view.query && !view.detail}
          onDark
        />
      </div>
      <div className="pb-6">
        <PortalUniversalSearch view={view} />
      </div>
    </PortalLayout>
  );
}
