import { useRef, useState } from "react";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
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
