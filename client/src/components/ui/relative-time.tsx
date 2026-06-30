import { useTranslation, type Language } from "@/contexts/LanguageContext";

// Map the app language codes to BCP-47 locales for Intl.
const LOCALE_MAP: Record<Language, string> = {
  ku: "ckb",
  en: "en",
  ar: "ar",
  zh: "zh",
};

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

interface RelativeTimeProps {
  date: string | number | Date | null | undefined;
  className?: string;
}

export function RelativeTime({ date, className }: RelativeTimeProps) {
  const { language } = useTranslation();
  const locale = LOCALE_MAP[language] ?? "en";

  if (date == null) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;

  let duration = (d.getTime() - Date.now()) / 1000;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      unit = division.unit;
      break;
    }
    duration /= division.amount;
  }

  let label: string;
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    label = rtf.format(Math.round(duration), unit);
  } catch {
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    label = rtf.format(Math.round(duration), unit);
  }

  let title: string;
  try {
    title = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    title = d.toLocaleString();
  }

  return (
    <span className={className} title={title}>
      {label}
    </span>
  );
}

export default RelativeTime;
