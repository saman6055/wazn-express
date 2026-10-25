import { useRef, useState } from "react";
import { Upload, Loader2, CheckCircle2, AlertCircle, KeyRound, Laptop } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { confirmDanger } from "@/components/ConfirmDialog";
import { fmtWhen } from "@/lib/numericDate";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { uploadBackupZip } from "@/lib/backupUpload";

/**
 * A backup kept on this computer, brought back to the server.
 *
 * Main admin only — the server says so too. Once it has arrived and been
 * checked it appears in the list below like any other backup, and the
 * Restore button on it puts the system back to that moment.
 */
export function BackupUploadCard({ onUploaded }: { onUploaded: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [sent, setSent] = useState<{ done: number; total: number } | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error("تەنها فایلی ZIP ی بەکاپی تەواو وەردەگیرێت.");
      return;
    }
    setSent({ done: 0, total: file.size });
    try {
      const result = await uploadBackupZip(file, (done, total) => setSent({ done, total }));
      toast.success(`بەکاپەکە گەیشت و پشکنرا: ${result.tables} خشتە، ${result.rows} تۆمار، ${result.files} فایل. ئێستا لە لیستەکەدا دوگمەی گەڕاندنەوەی لێ بدە.`, { duration: 10000 });
      onUploaded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err), { duration: 12000 });
    } finally {
      setSent(null);
      if (input.current) input.current.value = "";
    }
  };

  const percent = sent && sent.total ? Math.floor((sent.done / sent.total) * 100) : 0;
  const mb = (n: number) => (n / 1024 / 1024).toFixed(1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          بارکردنی بەکاپ لە کۆمپیوتەر
        </CardTitle>
        <CardDescription>
          ئەو فایلە ZIP ـەی پێشتر دابەزاندووتە هەڵبژێرە. سیستەم پشکنینی بۆ دەکات و دەیخاتە لیستەکە؛ پاشان بە دوگمەی گەڕاندنەوە سیستەم دەگەڕێتەوە بۆ ئەو کاتە.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input ref={input} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        {sent ? (
          <div className="space-y-2">
            <Progress value={percent} />
            <p className="text-sm text-muted-foreground">
              {percent}% — {mb(sent.done)} / {mb(sent.total)} MB. ئەم لاپەڕەیە دامەخە تا تەواو دەبێت.
            </p>
          </div>
        ) : (
          <Button onClick={() => input.current?.click()} variant="outline">
            <Upload className="w-4 h-4 me-2" />
            هەڵبژاردنی فایلی ZIP
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export interface BackupJobView {
  kind: "backup" | "restore";
  backupId: number;
  step: string;
  done: number;
  total: number;
  finishedAt?: string;
  ok?: boolean;
  message?: string;
  safetyBackupId?: number;
}

/** How far the backup or restore running now has got, and how it ended. */
export function BackupJobBanner({ job }: { job: BackupJobView | null | undefined }) {
  if (!job) return null;
  const percent = job.total ? Math.min(100, Math.floor((job.done / job.total) * 100)) : 0;
  const title = job.kind === "restore" ? "گەڕاندنەوەی سیستەم" : "دروستکردنی بەکاپی تەواو";

  if (!job.finishedAt) {
    return (
      <Card className="border-blue-400">
        <CardContent className="pt-6 space-y-2">
          <div className="flex items-center gap-2 font-medium">
            <Loader2 className="w-4 h-4 animate-spin" />
            {title} — {percent}%
          </div>
          <Progress value={percent} />
          <p className="text-sm text-muted-foreground">{job.step}</p>
          {job.kind === "restore" && (
            <p className="text-sm text-amber-700 dark:text-amber-300">تا تەواو دەبێت هیچ کەس کار لە سیستەم نەکات.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={job.ok ? "border-green-500" : "border-red-500"}>
      <CardContent className="pt-6 space-y-2">
        <div className="flex items-center gap-2 font-medium">
          {job.ok ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
          {title} — {job.ok ? "تەواو بوو" : "سەرکەوتوو نەبوو"}
        </div>
        {job.message && <p className="text-sm whitespace-pre-line">{job.message}</p>}
        {job.kind === "restore" && job.ok && (
          <Button size="sm" onClick={() => window.location.reload()}>
            نوێکردنەوەی لاپەڕە
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The daily backup the owner's computer takes by itself (tools/auto-backup).
 *
 * Connecting it is one button: the computer shows a six-digit code, the same
 * code appears here, and «بیبەستەوە» connects it. No key is ever shown or
 * copied (server/lib/autoBackupKey.ts).
 */
export function AutoBackupCard() {
  const utils = trpc.useUtils();
  const { data } = trpc.backup.autoBackup.useQuery(undefined, { refetchInterval: 4000 });
  const approve = trpc.backup.approveAutoBackupComputer.useMutation({
    onSuccess: (r: { connected: string }) => {
      toast.success(`کۆمپیوتەری «${r.connected}» بەسترایەوە. یەکەم بەکاپ ئێستا دەستی پێدەکات.`);
      void utils.backup.autoBackup.invalidate();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const reject = trpc.backup.rejectAutoBackupComputer.useMutation({
    onSuccess: () => void utils.backup.autoBackup.invalidate(),
  });
  const revoke = trpc.backup.revokeAutoBackupKey.useMutation({
    onSuccess: () => {
      void utils.backup.autoBackup.invalidate();
      toast.success("پچڕا — ئەو کۆمپیوتەرە ئیتر ناتوانێت بەکاپ بگرێت.");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const last = data?.last;
  const pending = data?.pending;
  const mb = (n: number | null | undefined) => (n ? `${(n / 1024 / 1024).toFixed(1)} MB` : "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Laptop className="w-5 h-5" />
          بەکاپی خۆکاری ڕۆژانە لەسەر کۆمپیوتەرەکەت
        </CardTitle>
        <CardDescription>
          کۆمپیوتەرەکەت هەموو ڕۆژێک خۆی بەکاپێکی تەواو دەگرێت و دایدەبەزێنێت. یەک کۆپی بۆ هەر ڕۆژێک بۆ 30 ڕۆژ دەمێنێتەوە و فۆڵدەرەکە لە 30 GB تێناپەڕێت؛ کۆنەکان تەنها دوای گەیشتنی ساغی هی نوێ دەسڕێنەوە.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {pending && (
          <div className="rounded-md border-2 border-amber-400 p-3 space-y-2">
            <p className="font-medium">کۆمپیوتەری «{pending.computer}» داوای بەستنەوە دەکات. ئەگەر ئەم کۆدە هەمان کۆدی سەر کۆمپیوتەرەکەیە، بیبەستەوە:</p>
            <p dir="ltr" className="text-center text-3xl font-bold tracking-[0.4em]">{pending.code.slice(0, 3)} {pending.code.slice(3)}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => approve.mutate({ code: pending.code })} disabled={approve.isPending}>
                <CheckCircle2 className="w-4 h-4 me-2" /> بیبەستەوە
              </Button>
              <Button variant="outline" onClick={() => reject.mutate()} disabled={reject.isPending}>
                ڕەتکردنەوە
              </Button>
            </div>
          </div>
        )}

        {data?.hasKey ? (
          <p className="flex items-center gap-1">
            <KeyRound className="w-4 h-4" />
            بەستراوە بە: <span className="font-medium">{data.hint}</span>
            {data.lastUsedAt ? ` — دوایین جار: ${fmtWhen(data.lastUsedAt, true)}` : " — هێشتا بەکاپی نەگرتووە"}
          </p>
        ) : (
          !pending && (
            <p className="text-muted-foreground">
              هێشتا هیچ کۆمپیوتەرێک نەبەستراوە. لەسەر کۆمپیوتەرەکەت «Wazn - بەکاپی خۆکار» بکەرەوە؛ کۆدێک لێرە دەردەکەوێت و دوگمەی «بیبەستەوە» دابگرە.
            </p>
          )
        )}
        {last && (
          <p className="flex items-center gap-1">
            {last.status === "failed" ? <AlertCircle className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
            دوایین بەکاپی خۆکار: {fmtWhen(last.createdAt, true)} {mb(last.fileSize)}
            {last.status === "failed" && last.errorMessage ? ` — ${last.errorMessage}` : ""}
          </p>
        )}

        {data?.hasKey && (
          <Button
            variant="outline"
            disabled={revoke.isPending}
            onClick={async () => {
              if (await confirmDanger("ئەم کۆمپیوتەرە بپچڕێت؟ ئیتر ناتوانێت بەکاپ بگرێت تا دووبارە دەیبەستیتەوە.")) revoke.mutate();
            }}
          >
            پچڕاندنی کۆمپیوتەرەکە
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
