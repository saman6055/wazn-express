/**
 * When a row was made: the date in full, the time small beneath it.
 *
 * It used to say "last month", "last week", "3 days ago". The owner,
 * 2026-10-20: «بەروار بە تەواوی بنووسرێت نەنووسرێت لاست ویک دەی مۆنس ...
 * ئەگەر دیتیلی زیاتر ویست کاتیش نیشان بدات». So: 20/10/2026, and 14:05 under
 * it - the same day-first date the other lists print, in Latin digits in
 * every language, kept left-to-right inside a right-to-left row.
 *
 * The name stays so the lists that use it did not have to change.
 */

interface RelativeTimeProps {
  date: string | number | Date | null | undefined;
  className?: string;
}

export function formatRowDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatRowTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function RelativeTime({ date, className }: RelativeTimeProps) {
  if (date == null) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;

  return (
    <span className={className} dir="ltr" data-testid="row-date">
      <span className="block whitespace-nowrap tabular-nums">{formatRowDate(d)}</span>
      <span className="block whitespace-nowrap text-[11px] tabular-nums opacity-70">{formatRowTime(d)}</span>
    </span>
  );
}

export default RelativeTime;
