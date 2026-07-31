import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { FileText } from "lucide-react";
import {
  termsSections,
  termsClosing,
  termsHint,
  termsHeader,
  termsGeneralOpener,
  termsPartyLabel,
  TERMS_WHATSAPP_NUMBER,
  type L10n,
} from "@/constants/portalTerms";

/** WhatsApp brand glyph (lucide has no brand icons). */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
    </svg>
  );
}

export default function PortalTerms() {
  const { language } = useLanguage();
  const isRTL = language === "ku" || language === "ar";
  const pick = (v: L10n) => pickLang(language, v);

  // Build a wa.me link that drops the tapped point into the chat, followed by
  // the polite closing line — both in the customer's current language.
  const waHref = (message: string) =>
    `https://wa.me/${TERMS_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  const pointHref = (point: string) =>
    waHref(`«${point}»\n\n${pick(termsClosing)}`);

  return (
    <CustomerPortalLayout>
      <div
        className={`min-h-screen bg-gray-50 dark:bg-gray-950 ${isRTL ? "rtl" : "ltr"}`}
        dir={isRTL ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white px-4 pt-8 pb-10">
          <div className="absolute -top-10 -end-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-12 -start-6 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center ring-1 ring-white/25">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold leading-tight">{pick(termsHeader.title)}</h1>
              <p className="text-sm text-white/80">{pick(termsHeader.subtitle)}</p>
            </div>
          </div>

          {/* WhatsApp tap tip */}
          <div className="relative mt-5 flex items-center gap-2 rounded-2xl bg-white/12 backdrop-blur px-3.5 py-2.5 ring-1 ring-white/20">
            <WhatsAppIcon className="w-5 h-5 text-white shrink-0" />
            <span className="text-sm font-medium">{pick(termsHeader.tapTip)}</span>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-6 space-y-4 pb-28 max-w-2xl mx-auto">
          {termsSections.map((section, index) => (
            <section
              key={section.id}
              className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm ring-1 ring-gray-100 dark:ring-white/5 overflow-hidden"
            >
              {/* Section header */}
              <div className={`bg-gradient-to-r ${section.gradient} px-4 py-3.5 flex items-center gap-3`}>
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center ring-1 ring-white/20 shrink-0">
                  <section.icon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-base font-bold text-white flex-1">{pick(section.title)}</h2>
                <span className="text-xs font-bold text-white/70 tabular-nums">
                  {index + 1}/{termsSections.length}
                </span>
              </div>

              {/* Section items — the point is plain, selectable text; only the
                  green hint below it is the WhatsApp deep-link. */}
              <div className="p-2 sm:p-3 divide-y divide-gray-100 dark:divide-white/5">
                {section.items.map((item, itemIndex) => {
                  const text = pick(item.text);
                  const isYou = item.party === "you";
                  return (
                    <div key={itemIndex} className="flex items-start gap-3 p-3">
                      {/* Who this point binds. Two colours, alternating down the
                          page, so the balance between the customer's side and
                          ours is visible before a word is read. */}
                      <span
                        className={`mt-0.5 flex h-6 shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-bold ${
                          isYou
                            ? "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                        }`}
                      >
                        {pick(termsPartyLabel[item.party])}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] leading-relaxed text-gray-800 dark:text-gray-100 font-medium">
                          {text}
                        </p>
                        {/* Only this pill is the link — it carries the point into
                            the WhatsApp message. */}
                        <a
                          href={pointHref(text)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600 transition hover:bg-emerald-100 active:scale-95 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                        >
                          <WhatsAppIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{pick(termsHint)}</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Consent note */}
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-4 flex items-start gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
              {pick(termsHeader.consent)}
            </p>
          </div>

          {/* Contact CTA */}
          <a
            href={waHref(pick(termsGeneralOpener))}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3.5 text-white font-bold shadow-lg shadow-emerald-500/25 transition-transform active:scale-[0.98]"
          >
            <WhatsAppIcon className="w-5 h-5" />
            <span>{pick(termsHeader.contactCta)}</span>
          </a>

          {/* Last updated */}
          <div className="text-center text-gray-400 dark:text-gray-600 text-xs">
            {pick(termsHeader.updated)}
          </div>
        </div>
      </div>
    </CustomerPortalLayout>
  );
}
