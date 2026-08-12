import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { PlatformBadge } from "@/components/PlatformSelect";
import { LANGUAGE_NAME, TUTORIAL_LANGUAGES, type TutorialLanguage } from "@/constants/tutorialLanguages";
import {
  GraduationCap, Plus, Trash2, Pencil, Eye, EyeOff, Star, Loader2, X, ThumbsUp, ThumbsDown,
} from "lucide-react";

type L = { ku: string; en: string; ar: string; zh: string };

/**
 * Portal Center → Tutorials.
 *
 * Only the YouTube link is stored; the thumbnail is derived from it, so the
 * admin never uploads an image. Sections are free text with the platform list
 * offered as suggestions, so a section can be a shop (Taobao) or a topic of
 * its own ("Portal", "Payment").
 */
export function TutorialsTab({ p }: { p: (v: L) => string }) {
  const utils = trpc.useUtils();
  const { data: tutorials, isLoading } = trpc.tutorials.listAll.useQuery();
  const { data: platformAttrs } = trpc.productAttributes.list.useQuery({ type: "platform" });

  const blank = {
    id: 0,
    category: "",
    language: "ku" as TutorialLanguage,
    titleKu: "", titleEn: "", titleAr: "",
    summaryKu: "", summaryEn: "", summaryAr: "",
    videoUrl: "",
    durationSeconds: "",
    sortOrder: 0,
    isPublished: false,
    isFeatured: false,
  };
  const [form, setForm] = useState<typeof blank>(blank);
  const [editing, setEditing] = useState(false);

  const done = (msg: L) => {
    toast.success(p(msg));
    utils.tutorials.listAll.invalidate();
    utils.tutorials.list.invalidate();
    setForm(blank);
    setEditing(false);
  };

  const createM = trpc.tutorials.create.useMutation({
    onSuccess: () => done({ ku: "فێرکاری زیاد کرا ✓", en: "Tutorial added ✓", ar: "تمت الإضافة ✓", zh: "已添加 ✓" }),
    onError: (e) => toast.error(e.message),
  });
  const updateM = trpc.tutorials.update.useMutation({
    onSuccess: () => done({ ku: "نوێکرایەوە ✓", en: "Updated ✓", ar: "تم التحديث ✓", zh: "已更新 ✓" }),
    onError: (e) => toast.error(e.message),
  });
  const deleteM = trpc.tutorials.delete.useMutation({
    onSuccess: () => done({ ku: "سڕایەوە", en: "Deleted", ar: "تم الحذف", zh: "已删除" }),
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    if (!form.category.trim() || !form.titleKu.trim() || !form.videoUrl.trim()) {
      toast.error(p({
        ku: "بەش، ناونیشان و لینکی یوتوب پێویستن",
        en: "Section, title and YouTube link are required",
        ar: "القسم والعنوان ورابط يوتيوب مطلوبة",
        zh: "分区、标题和 YouTube 链接为必填",
      }));
      return;
    }
    // For a single-language video the title lives in the canonical column
    // whatever language it is written in — there is only ever one. The
    // per-language columns are sent empty so a video switched from "all" to
    // one language doesn't leave stale translations behind.
    const everyPortal = form.language === "all";
    const payload = {
      category: form.category.trim(),
      language: form.language,
      titleKu: form.titleKu.trim(),
      titleEn: everyPortal ? form.titleEn.trim() || undefined : "",
      titleAr: everyPortal ? form.titleAr.trim() || undefined : "",
      summaryKu: form.summaryKu.trim() || undefined,
      summaryEn: everyPortal ? form.summaryEn.trim() || undefined : "",
      summaryAr: everyPortal ? form.summaryAr.trim() || undefined : "",
      videoUrl: form.videoUrl.trim(),
      // Blank means "unknown length" — the card then shows no duration badge.
      durationSeconds: form.durationSeconds ? Number(form.durationSeconds) : undefined,
      sortOrder: Number(form.sortOrder) || 0,
      isPublished: form.isPublished,
      isFeatured: form.isFeatured,
    };
    if (editing && form.id) updateM.mutate({ id: form.id, ...payload });
    else createM.mutate(payload);
  };

  const edit = (t: any) => {
    setForm({
      id: t.id,
      category: t.category ?? "",
      language: (t.language ?? "ku") as TutorialLanguage,
      titleKu: t.titleKu ?? "", titleEn: t.titleEn ?? "", titleAr: t.titleAr ?? "",
      summaryKu: t.summaryKu ?? "", summaryEn: t.summaryEn ?? "", summaryAr: t.summaryAr ?? "",
      videoUrl: t.videoUrl ?? "",
      durationSeconds: t.durationSeconds ? String(t.durationSeconds) : "",
      sortOrder: t.sortOrder ?? 0,
      isPublished: !!t.isPublished,
      isFeatured: !!t.isFeatured,
    });
    setEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const suggestions = (platformAttrs ?? []).map((a: any) => a.value as string);
  const busy = createM.isPending || updateM.isPending;

  return (
    <div className="space-y-4">
      {/* Editor */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-sky-600 dark:text-sky-300" />
            <h3 className="font-bold">
              {editing
                ? p({ ku: "دەستکاری فێرکاری", en: "Edit tutorial", ar: "تعديل الشرح", zh: "编辑教程" })
                : p({ ku: "زیادکردنی فێرکاری", en: "Add a tutorial", ar: "إضافة شرح", zh: "添加教程" })}
            </h3>
            {editing && (
              <Button variant="ghost" size="sm" className="ms-auto" onClick={() => { setForm(blank); setEditing(false); }}>
                <X className="h-4 w-4 me-1" />
                {p({ ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{p({ ku: "بەش *", en: "Section *", ar: "القسم *", zh: "分区 *" })}</Label>
              <Input
                list="tutorial-sections"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder={p({ ku: "Taobao، Pinduoduo، پۆرتاڵ...", en: "Taobao, Pinduoduo, Portal…", ar: "تاوباو، بيندودو، البوابة…", zh: "淘宝、拼多多、门户…" })}
              />
              {/* Platform names as suggestions, but any section name is allowed. */}
              <datalist id="tutorial-sections">
                {suggestions.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{p({ ku: "لینکی یوتوب *", en: "YouTube link *", ar: "رابط يوتيوب *", zh: "YouTube 链接 *" })}</Label>
              <Input
                value={form.videoUrl}
                onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
                dir="ltr"
              />
            </div>
          </div>

          {/* Language of the video. This is what decides which portal sees it,
              so it sits above the title — the answer changes what you type. */}
          <div className="space-y-1.5">
            <Label className="text-xs">{p({ ku: "زمانی ڤیدیۆکە", en: "Language of the video", ar: "لغة الفيديو", zh: "视频语言" })}</Label>
            <div className="flex flex-wrap gap-1.5">
              {TUTORIAL_LANGUAGES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setForm({ ...form, language: code })}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition active:scale-95",
                    form.language === code ? "bg-sky-600 border-sky-600 text-white" : "bg-muted/40",
                  )}
                >
                  {LANGUAGE_NAME[code]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {form.language === "all"
                ? p({
                    ku: "لە هەموو پۆرتاڵێکدا دەردەکەوێت — بۆ ڤیدیۆی بێ دەنگ. ناونیشان بۆ هەر زمانێک بنووسە.",
                    en: "Appears in every portal — for videos with no speech. Give a title per language.",
                    ar: "يظهر في كل بوابة — للفيديو بلا صوت. اكتب عنواناً لكل لغة.",
                    zh: "在所有门户中显示——适用于无语音视频。请为每种语言填写标题。",
                  })
                : p({
                    ku: "تەنها لە پۆرتاڵی هەمان زمان دەردەکەوێت",
                    en: "Shown only in the portal set to this language",
                    ar: "يظهر فقط في البوابة بهذه اللغة",
                    zh: "仅在设为该语言的门户中显示",
                  })}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              {p({ ku: "ناونیشان", en: "Title", ar: "العنوان", zh: "标题" })}
              {" "}({LANGUAGE_NAME[form.language === "all" ? "ku" : form.language]}) *
            </Label>
            <Input
              value={form.titleKu}
              onChange={(e) => setForm({ ...form, titleKu: e.target.value })}
              dir={form.language === "en" ? "ltr" : undefined}
            />
          </div>

          {/* Only a speechless video needs the same title in three languages. */}
          {form.language === "all" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{p({ ku: "ناونیشان (ئینگلیزی)", en: "Title (English)", ar: "العنوان (إنجليزي)", zh: "标题（英语）" })}</Label>
                <Input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{p({ ku: "ناونیشان (عەرەبی)", en: "Title (Arabic)", ar: "العنوان (عربي)", zh: "标题（阿拉伯语）" })}</Label>
                <Input value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">
              {p({ ku: "کورتە", en: "Summary", ar: "ملخص", zh: "简介" })}
              {" "}({LANGUAGE_NAME[form.language === "all" ? "ku" : form.language]})
            </Label>
            <Textarea rows={2} value={form.summaryKu} onChange={(e) => setForm({ ...form, summaryKu: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{p({ ku: "ماوە (چرکە)", en: "Length (seconds)", ar: "المدة (ثوانٍ)", zh: "时长（秒）" })}</Label>
              <Input type="number" min="0" value={form.durationSeconds} onChange={(e) => setForm({ ...form, durationSeconds: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{p({ ku: "ڕیزبەندی", en: "Order", ar: "الترتيب", zh: "排序" })}</Label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} dir="ltr" />
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, isPublished: !form.isPublished })}
              className={cn("mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition",
                form.isPublished ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300" : "bg-muted/40")}
            >
              {form.isPublished ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {form.isPublished
                ? p({ ku: "بڵاوکراوە", en: "Published", ar: "منشور", zh: "已发布" })
                : p({ ku: "ڕەشنووس", en: "Draft", ar: "مسودة", zh: "草稿" })}
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, isFeatured: !form.isFeatured })}
              className={cn("mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition",
                form.isFeatured ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/60 text-amber-700 dark:text-amber-300" : "bg-muted/40")}
            >
              <Star className={cn("h-4 w-4", form.isFeatured && "fill-amber-500 text-amber-500 dark:text-amber-400")} />
              {p({ ku: "سەرەکی", en: "Featured", ar: "مميّز", zh: "推荐" })}
            </button>
          </div>

          <Button onClick={submit} disabled={busy} className="w-full sm:w-auto">
            {busy ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Plus className="h-4 w-4 me-2" />}
            {editing
              ? p({ ku: "پاشەکەوتکردن", en: "Save", ar: "حفظ", zh: "保存" })
              : p({ ku: "زیادکردن", en: "Add", ar: "إضافة", zh: "添加" })}
          </Button>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardContent className="pt-5">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">…</p>
          ) : !tutorials || tutorials.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {p({ ku: "هێشتا هیچ فێرکارییەک نییە", en: "No tutorials yet", ar: "لا توجد شروحات بعد", zh: "暂无教程" })}
            </p>
          ) : (
            <div className="space-y-2">
              {tutorials.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border p-2.5">
                  {t.thumbnailUrl
                    ? <img src={t.thumbnailUrl} alt="" className="h-12 w-20 shrink-0 rounded-lg object-cover" loading="lazy" />
                    : <div className="h-12 w-20 shrink-0 rounded-lg bg-muted" />}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <PlatformBadge name={t.category} size={16} />
                      <span className="text-xs text-muted-foreground">{t.category}</span>
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium",
                        t.language === "all"
                          ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                          : "bg-muted text-muted-foreground",
                      )}>
                        {LANGUAGE_NAME[t.language as TutorialLanguage] ?? t.language}
                      </span>
                      {t.isFeatured && <Star className="h-3 w-3 fill-amber-500 text-amber-500 dark:text-amber-400" />}
                      {!t.isPublished && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                          {p({ ku: "ڕەشنووس", en: "Draft", ar: "مسودة", zh: "草稿" })}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm font-medium">{t.titleKu}</p>
                    {/* A big gap between opens and completions means the video
                        is too long or unclear — worth knowing at a glance. */}
                    <p className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>{t.viewCount} {p({ ku: "بینین", en: "views", ar: "مشاهدة", zh: "次观看" })}</span>
                      <span className="inline-flex items-center gap-0.5"><ThumbsUp className="h-3 w-3" />{t.helpfulCount}</span>
                      <span className="inline-flex items-center gap-0.5"><ThumbsDown className="h-3 w-3" />{t.notHelpfulCount}</span>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => edit(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => deleteM.mutate({ id: t.id })}
                      disabled={deleteM.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
