import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { useTranslation } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Copy, RefreshCw, ShieldQuestion, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { checkDefinition, type CheckResult, type CheckSeverity } from "@shared/auditSweep";

/**
 * The eighteen checks, on a screen.
 *
 * The endpoint existed before this page did, and that was a mistake I made
 * concretely: the sweep runs on the production server behind a session cookie,
 * so nothing outside a signed-in browser can call it. Telling the owner to
 * point another tool at it was advice that could not be followed.
 *
 * So: the auditor account opens this, reads what the system found, and presses
 * copy. What lands on the clipboard is the whole report as plain text — which
 * is what actually gets handed to somebody to act on, pasted into a message or
 * a chat, and it should not require a screenshot of a screenshot.
 */

const SEVERITY_STYLE: Record<CheckSeverity | "failed" | "clean", string> = {
  failed: "border-purple-300 bg-purple-50 text-purple-800 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-200",
  critical: "border-red-300 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200",
  warning: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
  info: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200",
  clean: "border-border bg-card text-muted-foreground",
};

function styleFor(result: CheckResult): CheckSeverity | "failed" | "clean" {
  if (result.status === "failed") return "failed";
  if (result.status === "clean") return "clean";
  return checkDefinition(result.id)?.severity ?? "info";
}

/**
 * The report as text.
 *
 * Deliberately plain: no table drawing, no colour, nothing that survives only
 * inside this page. It is meant to be pasted somewhere else and still read.
 */
function buildReport(data: NonNullable<ReturnType<typeof useSweep>["data"]>, language: string): string {
  const lines: string[] = [];
  lines.push(`Wazn Express — audit sweep`);
  lines.push(new Date(data.ranAt).toLocaleString());
  lines.push(pickLang(language, data.headline));
  lines.push("");
  lines.push(
    `critical ${data.summary.critical} · warning ${data.summary.warning} · info ${data.summary.info} · failed ${data.summary.failed} · clean ${data.summary.clean}`,
  );
  lines.push("");

  for (const result of data.results) {
    const def = checkDefinition(result.id);
    const title = def ? pickLang(language, def.title) : result.id;

    if (result.status === "clean") continue;

    if (result.status === "failed") {
      lines.push(`[COULD NOT RUN] ${result.id} — ${title}`);
      lines.push(`  error: ${result.error ?? "unknown"}`);
      lines.push("");
      continue;
    }

    lines.push(`[${def?.severity ?? "info"}] ${result.id} — ${title}: ${result.count}`);
    if (def) lines.push(`  ${pickLang(language, def.meaning)}`);
    for (const row of (result.sample ?? []).slice(0, 10)) {
      lines.push(`  ${JSON.stringify(row)}`);
    }
    lines.push("");
  }

  const clean = data.results.filter((r) => r.status === "clean").map((r) => r.id);
  if (clean.length) lines.push(`clean: ${clean.join(", ")}`);

  return lines.join("\n");
}

function useSweep() {
  return trpc.audit.sweep.useQuery(undefined, {
    // A sweep is eighteen aggregate scans against the live database. It runs
    // when somebody asks for it, not because a screen was left open.
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
}

export default function AuditSweep() {
  const { language } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading, isFetching, refetch } = useSweep();

  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(buildReport(data, language));
      toast.success(pickLang(language, { ku: "کۆپی کرا", en: "Copied", ar: "تم النسخ", zh: "已复制" }));
    } catch {
      toast.error(pickLang(language, { ku: "کۆپی نەکرا", en: "Could not copy", ar: "تعذّر النسخ", zh: "复制失败" }));
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <ShieldQuestion className="h-6 w-6 text-muted-foreground" />
              {pickLang(language, { ku: "پشکنینی سیستەم", en: "System sweep", ar: "فحص النظام", zh: "系统扫描" })}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {pickLang(language, {
                ku: "هەموو بەشەکان بە یەک بانگکردن — ژمارەی ناتەبا، ڕیزی هەتیو، و کاری ڕاوەستاو.",
                en: "Every part of the system in one pass — figures that disagree, rows pointing at nothing, and work that has stopped.",
                ar: "كل أجزاء النظام بمرور واحد — أرقام متناقضة، وقيود بلا مرجع، وأعمال متوقفة.",
                zh: "一次遍历整个系统——互相矛盾的数字、指向空缺的记录、停滞的工作。",
              })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn("me-2 h-4 w-4", isFetching && "animate-spin")} />
              {pickLang(language, { ku: "دووبارە", en: "Run again", ar: "إعادة الفحص", zh: "重新扫描" })}
            </Button>
            <Button size="sm" onClick={copy} disabled={!data}>
              <Copy className="me-2 h-4 w-4" />
              {pickLang(language, { ku: "کۆپیکردنی ڕاپۆرت", en: "Copy report", ar: "نسخ التقرير", zh: "复制报告" })}
            </Button>
          </div>
        </div>

        {isLoading || !data ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            {/* The headline refuses to say "nothing to report" while any check
                failed to run — a sweep that could not see everything must not
                claim everything is fine. */}
            <div
              className={cn(
                "rounded-xl border p-4",
                data.summary.failed > 0
                  ? SEVERITY_STYLE.failed
                  : data.summary.critical > 0
                    ? SEVERITY_STYLE.critical
                    : data.summary.warning > 0
                      ? SEVERITY_STYLE.warning
                      : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
              )}
            >
              <p className="text-lg font-bold">{pickLang(language, data.headline)}</p>
              <p className="mt-1 font-mono text-xs opacity-80">
                {new Date(data.ranAt).toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              {data.results.map((result) => {
                const def = checkDefinition(result.id);
                const style = styleFor(result);
                const expanded = open === result.id;

                return (
                  <div key={result.id} className={cn("overflow-hidden rounded-xl border", SEVERITY_STYLE[style])}>
                    <button
                      onClick={() => setOpen(expanded ? null : result.id)}
                      className="flex w-full items-center gap-3 p-3 text-start"
                      aria-expanded={expanded}
                    >
                      {result.status === "clean" ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 opacity-60" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {def ? pickLang(language, def.title) : result.id}
                        </p>
                        <p className="truncate font-mono text-[11px] opacity-70">{result.id}</p>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-bold">
                        {result.status === "failed"
                          ? pickLang(language, { ku: "نەیتوانی", en: "could not run", ar: "تعذّر", zh: "无法运行" })
                          : result.count}
                      </span>
                      <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")} />
                    </button>

                    {expanded && (
                      <div className="border-t border-current/20 bg-background/60 p-3 text-sm">
                        {def && <p className="mb-2">{pickLang(language, def.meaning)}</p>}

                        {result.status === "failed" && (
                          <p className="rounded bg-background/80 p-2 font-mono text-xs">
                            {result.error}
                          </p>
                        )}

                        {result.sample && result.sample.length > 0 && (
                          <div className="overflow-x-auto">
                            <pre className="min-w-full rounded bg-background/80 p-2 text-[11px] leading-relaxed">
                              {result.sample.map((row) => JSON.stringify(row)).join("\n")}
                            </pre>
                          </div>
                        )}

                        {def?.path && (
                          <a href={def.path} className="mt-2 inline-block text-xs underline">
                            {pickLang(language, { ku: "بڕۆ بۆ ئەو بەشە", en: "Go to that section", ar: "الانتقال إلى القسم", zh: "前往该板块" })}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
