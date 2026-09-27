import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Copy, FileText, Loader2, MessageCircle, Monitor, Paperclip, Send, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { CORNER, CORNER_PANEL, cornerSlot } from "@/lib/floatingCorner";
import { soundManager } from "@/lib/soundManager";
import { fmtWhen } from "@/lib/numericDate";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { buildErrorReport } from "@/components/ErrorBoundary";
import { copyText } from "@/lib/copyText";
import { canCaptureScreen, captureScreen, fileToBase64, isImageType, shrinkImage } from "@/lib/chatAttachment";

/**
 * The office talking to itself, in the corner of every screen.
 *
 * The owner, 2026-09-26: «گرنگە پەیام ناردن هەبێ لە نێوان ئادمینەکان، چات
 * کردن هەبێ وەکو مەسنجەر، کە چاتی نوێ هات دەنگی بێت وەکو نۆتفکەیشن، بەشێکی
 * چاتەکەش نیشان بدات، ئایکۆنی چاتێ هەبێ لە ژێرەوەی لای ڕاست — جێگایەکی بەتاڵ
 * ماوە.»
 *
 * Between two people, always. The office is four or five people asking each
 * other about one parcel; a group chat is where that question is asked to
 * nobody in particular and answered by nobody in particular.
 *
 * It rings the way a task does — the same soft note, so the office learns
 * one sound for "somebody wants you" — and only for a message that was not
 * there before: the highest id already announced is remembered per person,
 * per browser, so a reload is silent.
 *
 * 2026-09-27, the owner again: no "done successfully" toast for a chat — the
 * message appearing is the confirmation — and a way to send a file, a
 * screenshot, or a picture pasted with Ctrl+V. One component for every
 * member of staff, whatever their role: everybody gets the same chat.
 */

type Words = { ku: string; en: string; ar: string; zh: string };

const WORDS = {
  title: { ku: "پەیامەکان", en: "Messages", ar: "الرسائل", zh: "消息" },
  write: { ku: "بنووسە…", en: "Write…", ar: "اكتب…", zh: "输入…" },
  nobody: { ku: "هیچ هاوکارێکی تر نییە", en: "No colleagues yet", ar: "لا زملاء بعد", zh: "暂无同事" },
  empty: { ku: "هێشتا هیچ پەیامێک نییە", en: "No messages yet", ar: "لا رسائل بعد", zh: "暂无消息" },
  back: { ku: "گەڕانەوە", en: "Back", ar: "رجوع", zh: "返回" },
  send: { ku: "بینێرە", en: "Send", ar: "إرسال", zh: "发送" },
  attach: { ku: "فایل یان وێنە هاوپێچ بکە", en: "Attach a file or picture", ar: "إرفاق ملف أو صورة", zh: "附加文件或图片" },
  screen: { ku: "وێنەی شاشە بگرە", en: "Take a screenshot", ar: "التقاط صورة للشاشة", zh: "截屏" },
  photo: { ku: "📷 وێنە", en: "📷 Photo", ar: "📷 صورة", zh: "📷 图片" },
  file: { ku: "📎 فایل", en: "📎 File", ar: "📎 ملف", zh: "📎 文件" },
  pasteHint: { ku: "بنووسە… (وێنە: Ctrl+V)", en: "Write… (picture: Ctrl+V)", ar: "اكتب… (صورة: Ctrl+V)", zh: "输入…（图片：Ctrl+V）" },
  failed: { ku: "نەنێردرا", en: "Not sent", ar: "لم تُرسل", zh: "未发送" },
  copyReport: { ku: "کۆپیکردنی وردەکاری", en: "Copy details", ar: "نسخ التفاصيل", zh: "复制详情" },
  copied: { ku: "کۆپی کرا", en: "Copied", ar: "تم النسخ", zh: "已复制" },
  remove: { ku: "لابردن", en: "Remove", ar: "إزالة", zh: "移除" },
} as const;

/** A file waiting in the composer, not yet sent. */
type Pending = { blob: Blob; name: string; type: string; preview: string | null };

const chimedKey = (userId: number) => `wazn-chat-chimed:${userId}`;


export function StaffChat() {
  const { language } = useTranslation();
  const { user } = useAuth();
  const L = (w: Words) => pickLang(language, w);

  const [open, setOpen] = useState(false);
  const [withId, setWithId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [flash, setFlash] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [sendError, setSendError] = useState<Error | null>(null);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const bottom = useRef<HTMLDivElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const utils = trpc.useUtils();
  // A colleague's message should land within the minute, not on the next
  // reload — it is the whole point of sending one.
  const inbox = trpc.staffChat.inbox.useQuery(undefined, { refetchInterval: 20_000, staleTime: 10_000 });
  const thread = trpc.staffChat.with.useQuery(
    { userId: withId ?? 0 },
    { enabled: open && !!withId, refetchInterval: 8_000, staleTime: 4_000 },
  );

  const clearPending = () => {
    setPending((p) => {
      if (p?.preview) URL.revokeObjectURL(p.preview);
      return null;
    });
  };

  /*
   * No global "done successfully" toast for either of these: the message in
   * the thread says it was sent, and reading needs no applause. A failure
   * still speaks — inside the panel, with its details to copy.
   */
  const markRead = trpc.staffChat.markRead.useMutation({
    meta: { skipGlobalToast: true },
    onSuccess: () => void utils.staffChat.inbox.invalidate(),
  });
  const send = trpc.staffChat.send.useMutation({
    meta: { skipGlobalToast: true },
    onSuccess: () => {
      setDraft("");
      clearPending();
      setSendError(null);
      void utils.staffChat.invalidate();
    },
    onError: (e) => setSendError(e instanceof Error ? e : new Error(String(e))),
  });

  const rows = useMemo(() => inbox.data ?? [], [inbox.data]);
  const unread = rows.reduce((sum, r) => sum + (r.unread ?? 0), 0);
  const active = rows.find((r) => r.id === withId) ?? null;

  /*
   * Ring once for a message that was not there before.
   *
   * Keyed on the highest id already announced, per person per browser, so
   * reopening the app is silent and a genuinely new message is not.
   */
  useEffect(() => {
    if (!user?.id || !inbox.data) return;
    const newest = rows.reduce((max, r) => (r.unread > 0 && r.lastAt ? Math.max(max, new Date(r.lastAt).getTime()) : max), 0);
    if (!newest) return;
    let lastSeen = 0;
    try {
      lastSeen = Number(localStorage.getItem(chimedKey(user.id)) ?? 0) || 0;
    } catch {
      /* private mode: it will simply ring again */
    }
    if (newest <= lastSeen) return;
    try {
      localStorage.setItem(chimedKey(user.id), String(newest));
    } catch {
      /* nothing to do */
    }
    soundManager.playNotice();
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 2600);
    return () => clearTimeout(t);
  }, [inbox.data, rows, user?.id]);

  // Opening a conversation is reading it.
  useEffect(() => {
    if (!open || !withId) return;
    if ((active?.unread ?? 0) > 0) markRead.mutate({ userId: withId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, withId, active?.unread]);

  useEffect(() => {
    if (thread.data) bottom.current?.scrollIntoView({ block: "end" });
  }, [thread.data]);

  // A file waiting to go belongs to the conversation it was meant for.
  useEffect(() => {
    clearPending();
    setSendError(null);
  }, [withId]);

  useEffect(() => setCopied(false), [sendError]);

  if (!user) return null;

  /** A picked, pasted, dropped or captured file, into the composer. */
  const attach = async (blob: Blob, name: string) => {
    setSendError(null);
    setPreparing(true);
    try {
      const type = blob.type || "application/octet-stream";
      // A phone photo or a 4K screenshot is made lighter before it travels.
      const ready = isImageType(type) ? await shrinkImage(blob) : blob;
      const readyType = ready.type || type;
      const readyName = ready === blob ? name : `${name.replace(/\.[a-z0-9]+$/i, "")}.jpg`;
      clearPending();
      setPending({
        blob: ready,
        name: readyName,
        type: readyType,
        preview: isImageType(readyType) ? URL.createObjectURL(ready) : null,
      });
    } catch (e) {
      setSendError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setPreparing(false);
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const file = Array.from(e.clipboardData.files ?? [])[0];
    if (!file) return; // text pastes as text
    e.preventDefault();
    void attach(file, file.name && file.name !== "image.png" ? file.name : `screenshot-${Date.now()}.png`);
  };

  const takeScreenshot = async () => {
    setSendError(null);
    try {
      const shot = await captureScreen();
      if (shot) await attach(shot, `screenshot-${Date.now()}.png`);
    } catch (e) {
      // Closing the browser's "share your screen" picker is not a failure.
      if ((e as { name?: string } | null)?.name === "NotAllowedError") return;
      setSendError(e instanceof Error ? e : new Error(String(e)));
    }
  };

  const submit = async () => {
    const text = draft.trim();
    if ((!text && !pending) || !withId || send.isPending || preparing) return;
    setSendError(null);
    try {
      const attachment = pending
        ? { name: pending.name, type: pending.type, base64: await fileToBase64(pending.blob) }
        : undefined;
      send.mutate({ toId: withId, text, attachment });
    } catch (e) {
      setSendError(e instanceof Error ? e : new Error(String(e)));
    }
  };

  return (
    <>
      {/* The bubble, in the corner he pointed at. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          cornerSlot(CORNER.chat),
          "grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:brightness-110 active:scale-95 print:hidden",
          flash && "ring-4 ring-primary/40 animate-pulse",
        )}
        title={L(WORDS.title)}
        aria-label={L(WORDS.title)}
        data-testid="staff-chat-bubble"
      >
        <MessageCircle className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            CORNER_PANEL,
            // Its own colours, stated rather than inherited, so the panel
            // reads the same for every member of staff whatever their
            // appearance settings (owner, 2026-09-27).
            "flex h-[30rem] max-h-[calc(100dvh-7rem)] w-[23rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-2xl print:hidden",
            dragging && "ring-2 ring-primary",
          )}
          data-testid="staff-chat-panel"
          onDragOver={(e) => {
            if (!withId || !Array.from(e.dataTransfer.types).includes("Files")) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (!withId || !file) return;
            e.preventDefault();
            void attach(file, file.name);
          }}
        >
          <div className="flex items-center gap-2 border-b px-3 py-2">
            {withId && (
              <button
                type="button"
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                onClick={() => setWithId(null)}
                title={L(WORDS.back)}
                data-testid="staff-chat-back"
              >
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </button>
            )}
            <span className="truncate text-sm font-medium">{active ? active.name : L(WORDS.title)}</span>
            <button
              type="button"
              className="ms-auto grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              onClick={() => setOpen(false)}
              aria-label="close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!withId ? (
            <div className="flex-1 overflow-y-auto">
              {rows.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">{L(WORDS.nobody)}</p>
              ) : (
                rows.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setWithId(r.id)}
                    className="flex w-full items-center gap-2 border-b px-3 py-2.5 text-start last:border-0 hover:bg-muted/50"
                    data-testid={`staff-chat-person-${r.id}`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                      {(r.name || "?").slice(0, 2)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {r.lastText || r.lastAttachmentType
                          ? (r.lastFromMe ? "↩ " : "") +
                            (r.lastText || (isImageType(r.lastAttachmentType) ? L(WORDS.photo) : L(WORDS.file)))
                          : L(WORDS.empty)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[10px] text-muted-foreground">{r.lastAt ? fmtWhen(r.lastAt, true) : ""}</span>
                      {r.unread > 0 && (
                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                          {r.unread}
                        </span>
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-2">
                {(thread.data ?? []).length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">{L(WORDS.empty)}</p>
                )}
                {(thread.data ?? []).map((m) => {
                  const mine = m.fromId === user.id;
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3 py-1.5 text-sm",
                          mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                        )}
                      >
                        {m.attachmentUrl &&
                          (isImageType(m.attachmentType) ? (
                            <a
                              href={m.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="-mx-1.5 mb-1 mt-0.5 block"
                              title={m.attachmentName ?? ""}
                              data-testid="staff-chat-image"
                            >
                              <img
                                src={m.attachmentUrl}
                                alt={m.attachmentName ?? ""}
                                loading="lazy"
                                className="max-h-56 w-full rounded-xl bg-black/10 object-contain"
                                onLoad={() => bottom.current?.scrollIntoView({ block: "end" })}
                              />
                            </a>
                          ) : (
                            <a
                              href={m.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={m.attachmentName ?? undefined}
                              className={cn(
                                "mb-1 mt-0.5 flex items-center gap-2 rounded-lg px-2 py-1.5 underline-offset-2 hover:underline",
                                mine ? "bg-primary-foreground/15" : "bg-background/60",
                              )}
                            >
                              <FileText className="h-4 w-4 shrink-0" />
                              <span className="truncate">{m.attachmentName}</span>
                            </a>
                          ))}
                        {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                        <p className={cn("mt-0.5 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          {fmtWhen(m.createdAt, true)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottom} />
              </div>

              {(pending || preparing || sendError) && (
                <div className="space-y-1.5 border-t px-2 pt-2">
                  {preparing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {pending && (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-1.5" data-testid="staff-chat-pending">
                      {pending.preview ? (
                        <img src={pending.preview} alt="" className="h-12 w-12 rounded-md object-cover" />
                      ) : (
                        <FileText className="h-8 w-8 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-xs">{pending.name}</span>
                      <button
                        type="button"
                        onClick={clearPending}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                        title={L(WORDS.remove)}
                        aria-label={L(WORDS.remove)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {sendError && (
                    <div
                      className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
                      role="alert"
                      data-testid="staff-chat-error"
                    >
                      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                        <b>{L(WORDS.failed)}:</b> {sendError.message}
                      </span>
                      <button
                        type="button"
                        className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold hover:bg-destructive/15"
                        onClick={async () => {
                          if (await copyText(buildErrorReport(sendError))) setCopied(true);
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copied ? L(WORDS.copied) : L(WORDS.copyReport)}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-end gap-1 border-t p-2">
                <input
                  ref={fileInput}
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.zip,.rar,.7z"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void attach(file, file.name);
                  }}
                  data-testid="staff-chat-file"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 shrink-0"
                  onClick={() => fileInput.current?.click()}
                  title={L(WORDS.attach)}
                  aria-label={L(WORDS.attach)}
                  data-testid="staff-chat-attach"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                {canCaptureScreen() && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0"
                    onClick={() => void takeScreenshot()}
                    title={L(WORDS.screen)}
                    aria-label={L(WORDS.screen)}
                    data-testid="staff-chat-screenshot"
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                )}
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onPaste={onPaste}
                  onKeyDown={(e) => {
                    // Enter sends it; Shift+Enter is a new line, as everywhere.
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                  rows={1}
                  placeholder={pending ? L(WORDS.write) : L(WORDS.pasteHint)}
                  className="max-h-24 min-h-9 resize-none py-2 text-sm"
                  data-testid="staff-chat-input"
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  disabled={(!draft.trim() && !pending) || send.isPending || preparing}
                  onClick={() => void submit()}
                  title={L(WORDS.send)}
                  data-testid="staff-chat-send"
                >
                  {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rtl:rotate-180" />}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
