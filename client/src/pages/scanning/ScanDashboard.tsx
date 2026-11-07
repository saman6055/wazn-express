import { useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, ArrowLeft, BarChart3, Users, TrendingUp, TrendingDown, Clock } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { soundManager } from "@/lib/soundManager";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { SCANNER_MODULES } from "@/constants/scannerModules";
import { packagesHref } from "@shared/listLinks";
import type { Station } from "@shared/stationActivity";
import "../dashboard/dashboardLive.css";

/**
 * The scan dashboard, redrawn (owner, 2026-11-07: «گرنگتری بکە، نازدارتری بکە،
 * وابکە بە سانایی سەردانی بکرێ» and «داتاکانی سەتا سەت دروست ببێت»).
 *
 * Every figure comes from scanning.stationActivity, which counts each station
 * from its own event (shared/stationActivity). The page it replaces counted a
 * table only the arrival check writes, drew a random week, read two keys that
 * did not exist, and linked to filters that were not there.
 */

type Words = { ku: string; en: string; ar: string; zh: string };

const STATION_TONE: Record<Station, { bar: string; text: string; ring: string; fill: string }> = {
  registered: { bar: "from-sky-500 to-blue-600", text: "text-sky-700 dark:text-sky-300", ring: "hover:ring-sky-400/60", fill: "#0ea5e9" },
  in_batch: { bar: "from-violet-500 to-purple-600", text: "text-violet-700 dark:text-violet-300", ring: "hover:ring-violet-400/60", fill: "#8b5cf6" },
  received_local: { bar: "from-indigo-500 to-blue-700", text: "text-indigo-700 dark:text-indigo-300", ring: "hover:ring-indigo-400/60", fill: "#6366f1" },
  delivered: { bar: "from-fuchsia-500 to-purple-700", text: "text-fuchsia-700 dark:text-fuchsia-300", ring: "hover:ring-fuchsia-400/60", fill: "#c026d3" },
};

const WEEKDAY: Words[] = [
  { ku: "یەکشەممە", en: "Sun", ar: "الأحد", zh: "周日" },
  { ku: "دووشەممە", en: "Mon", ar: "الإثنين", zh: "周一" },
  { ku: "سێشەممە", en: "Tue", ar: "الثلاثاء", zh: "周二" },
  { ku: "چوارشەممە", en: "Wed", ar: "الأربعاء", zh: "周三" },
  { ku: "پێنجشەممە", en: "Thu", ar: "الخميس", zh: "周四" },
  { ku: "هەینی", en: "Fri", ar: "الجمعة", zh: "周五" },
  { ku: "شەممە", en: "Sat", ar: "السبت", zh: "周六" },
];

export default function ScanDashboard() {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const { data, isLoading } = trpc.scanning.stationActivity.useQuery({ days: 7 }, { refetchInterval: 60_000, refetchIntervalInBackground: false });

  const moduleName = (m: (typeof SCANNER_MODULES)[number]) => pickLang(language, { ku: m.labelKu, en: m.labelEn, ar: m.labelAr, zh: m.labelZh });
  const chart = useMemo(
    () => (data?.days ?? []).map((d) => ({ ...d, label: L(WEEKDAY[new Date(`${d.date}T12:00:00Z`).getUTCDay()]!) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, language],
  );

  // What still waits at a station, each with the list that holds the same rows.
  const waiting: Partial<Record<Station, { count: number; href: string; words: Words }>> = data
    ? {
        in_batch: { count: data.waiting.noBatch, href: packagesHref({ tab: "no_batch" }), words: { ku: "بێ باچ چاوەڕێن", en: "waiting with no batch", ar: "بدون دفعة", zh: "未装批次" } },
        delivered: { count: data.waiting.leftOut, href: "/problems", words: { ku: "گەیشتوون و لە بۆکسدا نین", en: "arrived and in no box", ar: "وصلت وليست في صندوق", zh: "已到达未装箱" } },
      }
    : {};

  const diff = data ? data.todayTotal - data.yesterdaySoFar : 0;

  return (
    <DashboardLayout>
      <div
        className="dash-live mx-auto flex max-w-6xl flex-col gap-5 p-4"
        onClickCapture={(e) => {
          if ((e.target as HTMLElement).closest("button, a, [role='button']")) soundManager.playTap();
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 text-white shadow-lg">
            <Activity className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{L({ ku: "داشبۆردی سکان", en: "Scan dashboard", ar: "لوحة المسح", zh: "扫描仪表板" })}</h1>
            <p className="text-sm text-muted-foreground">
              {data
                ? L({ ku: `ئەمڕۆ ${data.todayTotal} کار · دوێنێ تا ئەم کاتە ${data.yesterdaySoFar}`, en: `Today ${data.todayTotal} · yesterday by this time ${data.yesterdaySoFar}`, ar: `اليوم ${data.todayTotal} · أمس حتى هذا الوقت ${data.yesterdaySoFar}`, zh: `今天 ${data.todayTotal} · 昨天同一时间 ${data.yesterdaySoFar}` })
                : L({ ku: "کاری هەر چوار وێستگەی سکان", en: "The four scan stations", ar: "محطات المسح الأربع", zh: "四个扫描站" })}
            </p>
          </div>
          {data && diff !== 0 && (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium", diff > 0 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200")} data-testid="scan-diff">
              {diff > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span dir="ltr">{diff > 0 ? `+${diff}` : diff}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="scan-stations">
          {SCANNER_MODULES.map((m) => {
            const station = m.scanType as Station;
            const Icon = m.icon;
            const tone = STATION_TONE[station];
            const w = waiting[station];
            return (
              <Card key={m.id} className={cn("overflow-hidden ring-1 ring-transparent transition-all", tone.ring)} data-testid={`station-${station}`}>
                <div className={cn("h-1.5 bg-gradient-to-r", tone.bar)} />
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md", tone.bar)}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="text-end">
                      {isLoading ? <Skeleton className="h-8 w-12" /> : <p className={cn("text-3xl font-bold tabular-nums", tone.text)} data-testid={`station-${station}-today`}>{data?.today[station] ?? 0}</p>}
                      <p className="text-xs text-muted-foreground">{L({ ku: "ئەمڕۆ", en: "today", ar: "اليوم", zh: "今天" })}</p>
                    </div>
                  </div>
                  <div>
                    <CardTitle className="text-base">{moduleName(m)}</CardTitle>
                    <p className="text-xs text-muted-foreground">{pickLang(language, { ku: m.descKu, en: m.descEn, ar: m.descAr, zh: m.descZh })}</p>
                  </div>
                  {w && w.count > 0 && (
                    <Link href={w.href} className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/70" data-testid={`station-${station}-waiting`}>
                      <Clock className="h-3.5 w-3.5" />
                      <span className="tabular-nums">{w.count}</span> {L(w.words)}
                    </Link>
                  )}
                  <Link href={m.path} className={cn("flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r px-3 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5", tone.bar)}>
                    {L({ ku: "دەستپێکردن", en: "Start", ar: "بدء", zh: "开始" })}
                    <ArrowLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5 text-violet-600 dark:text-violet-300" />
                {L({ ku: "7 ڕۆژی ڕابردوو", en: "Last 7 days", ar: "آخر 7 أيام", zh: "最近 7 天" })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64" dir="ltr" data-testid="scan-week">
                {isLoading ? <Skeleton className="h-full w-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      {SCANNER_MODULES.map((m, i) => (
                        <Bar key={m.id} dataKey={m.scanType} name={moduleName(m)} stackId="s" fill={STATION_TONE[m.scanType as Station].fill} radius={i === SCANNER_MODULES.length - 1 ? [4, 4, 0, 0] : 0} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {SCANNER_MODULES.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATION_TONE[m.scanType as Station].fill }} />
                    {moduleName(m)}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                {L({ ku: "کێ کاری کرد ئەمڕۆ", en: "Who worked today", ar: "من عمل اليوم", zh: "今日操作人员" })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-32 w-full" /> : (data?.byUser.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{L({ ku: "هێشتا کەس کاری نەکردووە ئەمڕۆ", en: "Nobody has scanned today yet", ar: "لم يمسح أحد اليوم بعد", zh: "今天还没有人扫描" })}</p>
              ) : (
                <div className="space-y-2" data-testid="scan-by-user">
                  {data!.byUser.map((u) => {
                    const share = Math.round((u.count / Math.max(1, data!.todayTotal)) * 100);
                    return (
                      <div key={u.userId}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate">{u.name}</span>
                          <span className="font-semibold tabular-nums">{u.count}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500 transition-[width] duration-700" style={{ width: `${Math.max(4, share)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Link href="/scan-reports" className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
                <BarChart3 className="h-4 w-4" />
                {L({ ku: "ڕاپۆرتی سکان", en: "Scan reports", ar: "تقارير المسح", zh: "扫描报告" })}
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
