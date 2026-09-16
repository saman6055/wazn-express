import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { TutorialHint } from "@/components/TutorialHint";
import { useLanguage } from "@/contexts/LanguageContext";
import { PortalSearchField, PORTAL_SEARCH_INPUT_ID } from "@/components/portal/PortalSearchSheet";
import PortalUniversalSearch from "@/components/portal/PortalUniversalSearch";

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
  const [, navigate] = useLocation();
  const [query, setQuery] = useState(getInitialSearchQuery);
  const [submitted, setSubmitted] = useState(0);

  // The address keeps the search, so Back from an answer returns to the same
  // answers rather than to an empty box.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const q = query.trim();
      const next = q ? `/portal/search?q=${encodeURIComponent(q)}` : "/portal/search";
      if (next !== `${window.location.pathname}${window.location.search}`) {
        window.history.replaceState(window.history.state, "", next);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <PortalLayout>
      <div className="bg-slate-800 px-4 pb-5 pt-8 text-white">
        <h1 className="mb-2 text-2xl font-bold">{t("trackPackage") || "Track Package"}</h1>
        <TutorialHint section="شوێنکەوتن" className="mb-3" />
        <PortalSearchField
          id={PORTAL_SEARCH_INPUT_ID}
          value={query}
          onChange={setQuery}
          onSubmit={() => setSubmitted((n) => n + 1)}
          autoFocus={!query}
          onDark
        />
      </div>
      <div className="pb-6">
        <PortalUniversalSearch query={query} onQueryChange={setQuery} onNavigate={navigate} submitted={submitted} />
      </div>
    </PortalLayout>
  );
}
