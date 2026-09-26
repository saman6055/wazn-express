import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Loader2, MessageCircle, Send, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { soundManager } from "@/lib/soundManager";
import { fmtWhen } from "@/lib/numericDate";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

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
 */

type Words = { ku: string; en: string; ar: string; zh: string };

const WORDS = {
  title: { ku: "پەیامەکان", en: "Messages", ar: "الرسائل", zh: "消息" },
  write: { ku: "بنووسە…", en: "Write…", ar: "اكتب…", zh: "输入…" },
  nobody: { ku: "هیچ هاوکارێکی تر نییە", en: "No colleagues yet", ar: "لا زملاء بعد", zh: "暂无同事" },
  empty: { ku: "هێشتا هیچ پەیامێک نییە", en: "No messages yet", ar: "لا رسائل بعد", zh: "暂无消息" },
  back: { ku: "گەڕانەوە", en: "Back", ar: "رجوع", zh: "返回" },
  send: { ku: "بینێرە", en: "Send", ar: "إرسال", zh: "发送" },
} as const;

const chimedKey = (userId: number) => `wazn-chat-chimed:${userId}`;


export function StaffChat() {
  const { language } = useTranslation();
  const { user } = useAuth();
  const L = (w: Words) => pickLang(language, w);

  const [open, setOpen] = useState(false);
  const [withId, setWithId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [flash, setFlash] = useState(false);
  const bottom = useRef<HTMLDivElement | null>(null);

  const utils = trpc.useUtils();
  // A colleague's message should land within the minute, not on the next
  // reload — it is the whole point of sending one.
  const inbox = trpc.staffChat.inbox.useQuery(undefined, { refetchInterval: 20_000, staleTime: 10_000 });
  const thread = trpc.staffChat.with.useQuery(
    { userId: withId ?? 0 },
    { enabled: open && !!withId, refetchInterval: 8_000, staleTime: 4_000 },
  );
  const markRead = trpc.staffChat.markRead.useMutation({ onSuccess: () => void utils.staffChat.inbox.invalidate() });
  const send = trpc.staffChat.send.useMutation({
    onSuccess: () => {
      setDraft("");
      void utils.staffChat.invalidate();
    },
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

  if (!user) return null;

  const submit = () => {
    const text = draft.trim();
    if (!text || !withId || send.isPending) return;
    send.mutate({ toId: withId, text });
  };

  return (
    <>
      {/* The bubble, in the corner he pointed at. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed bottom-4 end-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:brightness-110 active:scale-95 print:hidden",
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
          className="fixed bottom-20 end-4 z-40 flex h-[26rem] w-[21rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl print:hidden"
          data-testid="staff-chat-panel"
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
                        {r.lastText ? (r.lastFromMe ? "↩ " : "") + r.lastText : L(WORDS.empty)}
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
                          mine ? "bg-primary text-primary-foreground" : "bg-muted",
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        <p className={cn("mt-0.5 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          {fmtWhen(m.createdAt, true)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottom} />
              </div>

              <div className="flex items-end gap-1.5 border-t p-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter sends it; Shift+Enter is a new line, as everywhere.
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  rows={1}
                  placeholder={L(WORDS.write)}
                  className="max-h-24 min-h-9 resize-none py-2 text-sm"
                  data-testid="staff-chat-input"
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  disabled={!draft.trim() || send.isPending}
                  onClick={submit}
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
