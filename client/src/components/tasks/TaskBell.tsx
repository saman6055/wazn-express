import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Archive, ListChecks, Plus, Clock, ExternalLink, HelpCircle, Moon, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { confirmDanger } from "@/components/ConfirmDialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { soundManager } from "@/lib/soundManager";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTaskComposer } from "@/components/tasks/TaskComposer";
import {
  TASK_GUIDE,
  TASK_WORDS,
  ageInDays,
  isAwake,
  taskTone,
  tomorrowMorning,
  wakeWhenWords,
  type Task,
} from "@shared/tasks";

/**
 * The task list, in its own icon beside the bell.
 *
 * The owner, 2026-09-25: "but not the bell icon — a task and reminder icon."
 * He is right that they are different things and should not share a face. The
 * bell carries what the system noticed; this carries what people promised,
 * and only a person empties it.
 *
 * It rings when one arrives: a different sound from the risk chime, so you
 * learn which is which without looking up. Muted the same way, remembered per
 * browser, and it only ever rings for something that was not there before —
 * a page reload is not news.
 *
 * Two things he asked for the same day, after using it: a snoozed task must
 * not simply vanish — it says the hour it returns and waits under "Sleeping",
 * where it can be woken early — and the list carries its own short lesson,
 * because an icon nobody understands is an icon nobody presses.
 */

const chimedKey = (userId: number) => `wazn-task-chimed:${userId}`;

export function TaskBell({ className }: { className?: string }) {
  const { language } = useTranslation();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const newTask = useTaskComposer();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);

  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const [guide, setGuide] = useState(false);
  const [archive, setArchive] = useState(false);
  const [openSleeping, setOpenSleeping] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const utils = trpc.useUtils();
  const mine = trpc.tasks.mine.useQuery(undefined, {
    // A colleague's task should land within the minute, not on the next
    // reload — it is the whole point of sending one.
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const setDone = trpc.tasks.setDone.useMutation({ onSuccess: () => void utils.tasks.invalidate() });
  // Putting one down says when it comes back; picking it up early says
  // nothing, because the task reappearing is the whole answer.
  const snooze = trpc.tasks.snooze.useMutation({
    onSuccess: (_result, sent) => {
      void utils.tasks.invalidate();
      toast.success(L(TASK_WORDS.backAt(L(wakeWhenWords(sent.until)))));
    },
  });
  const wake = trpc.tasks.snooze.useMutation({ onSuccess: () => void utils.tasks.invalidate() });

  /*
   * The finished ones, kept rather than gone.
   *
   * The owner, 2026-09-26: they should be archived, able to come back as
   * tasks, and deletable for good one at a time. Only fetched when the
   * archive is opened — it is the rarer half of the two.
   */
  const archived = trpc.tasks.archive.useQuery(undefined, { enabled: archive, staleTime: 30_000 });
  const reopen = trpc.tasks.setDone.useMutation({
    onSuccess: () => {
      void utils.tasks.invalidate();
      toast.success(L(TASK_WORDS.reopened));
    },
  });
  const forget = trpc.tasks.remove.useMutation({
    onSuccess: () => {
      void utils.tasks.invalidate();
      toast.success(L(TASK_WORDS.deleted));
    },
  });

  /** Pressing a task lands on the record it is about, and the list steps aside. */
  const goTo = (href?: string | null) => {
    if (!href) return;
    setOpen(false);
    navigate(href);
  };

  const mineOpen = mine.data?.open ?? [];
  const awake = mineOpen.filter((t) => isAwake(t as Task));
  const sleeping = mineOpen.filter((t) => !isAwake(t as Task));
  // When nothing is awake, the sleeping ones are the list — otherwise the
  // popover would say "nothing waiting" while work sits behind a fold.
  const showSleeping = openSleeping || awake.length === 0;

  /*
   * Ring once for a task that was not there before.
   *
   * The highest id we have already announced is remembered per person, per
   * browser, so reopening the app is silent and a genuinely new task is not.
   * Only tasks somebody else sent: a person does not need telling about the
   * one they just wrote.
   */
  useEffect(() => {
    if (!user?.id || !mine.data) return;
    const fromOthers = awake.filter((t) => t.createdById !== user.id);
    if (fromOthers.length === 0) return;
    const newest = Math.max(...fromOthers.map((t) => t.id));
    let lastSeen = 0;
    try {
      lastSeen = Number(localStorage.getItem(chimedKey(user.id)) ?? 0) || 0;
    } catch {
      /* private mode: it will simply ring again next time */
    }
    if (newest <= lastSeen) return;
    try {
      localStorage.setItem(chimedKey(user.id), String(newest));
    } catch {
      /* nothing to do */
    }
    // Two soft notes rising — nothing like the risk chime's fall.
    soundManager.playNotice();
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 2600);
  }, [mine.data, user?.id, awake]);

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  if (!user) return null;

  const toneClass = {
    fresh: "text-muted-foreground",
    waiting: "text-amber-600 dark:text-amber-400",
    late: "text-red-600 dark:text-red-400",
  } as const;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setGuide(false); }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", flash && "ring-2 ring-primary ring-offset-2 ring-offset-background", className)}
          title={L(TASK_WORDS.mine)}
          aria-label={L(TASK_WORDS.mine)}
          data-testid="task-bell"
        >
          <ListChecks className={cn("h-5 w-5", flash && "animate-pulse")} />
          {awake.length > 0 && (
            <span className="absolute -top-0.5 -end-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {awake.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center gap-1 border-b px-3 py-2">
          <span className="text-sm font-medium">{L(TASK_WORDS.mine)}</span>
          <span className="text-xs text-muted-foreground">{awake.length}</span>
          <button
            type="button"
            onClick={() => { setArchive((a) => !a); setGuide(false); }}
            className={cn(
              "ms-auto grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
              archive && "bg-muted text-foreground",
            )}
            title={L(TASK_WORDS.archive)}
            aria-label={L(TASK_WORDS.archive)}
            data-testid="task-archive-toggle"
          >
            <Archive className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => { setGuide((g) => !g); setArchive(false); }}
            className={cn(
              "grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
              guide && "bg-muted text-foreground",
            )}
            title={L(TASK_WORDS.guide)}
            aria-label={L(TASK_WORDS.guide)}
            data-testid="task-guide-toggle"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => { setOpen(false); newTask(); }}
            data-testid="task-new"
          >
            <Plus className="h-3.5 w-3.5" />
            {L(TASK_WORDS.title)}
          </Button>
        </div>

        {archive ? (
          <div className="max-h-[24rem] overflow-y-auto" data-testid="task-archive">
            {(archived.data ?? []).length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {L(TASK_WORDS.archiveEmpty)}
              </p>
            ) : (
              (archived.data ?? []).map((task) => (
                <div key={task.id} className="flex gap-2 border-b px-3 py-2.5 last:border-0" data-testid={`task-done-row-${task.id}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-muted-foreground line-through">{task.text}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                      {task.about?.label && (
                        <button
                          type="button"
                          className="inline-flex max-w-[11rem] items-center gap-1 font-mono text-primary hover:underline"
                          onClick={() => goTo(task.about?.href)}
                        >
                          <bdi dir="ltr" className="truncate">{task.about.label}</bdi>
                        </button>
                      )}
                      <button
                        type="button"
                        className="ms-auto inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => reopen.mutate({ id: task.id, done: false })}
                        title={L(TASK_WORDS.reopen)}
                        data-testid={`task-reopen-${task.id}`}
                      >
                        <RotateCcw className="h-3 w-3" />
                        {L(TASK_WORDS.reopen)}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 dark:text-red-400"
                        onClick={async () => {
                          const ok = await confirmDanger({
                            title: L(TASK_WORDS.deleteTitle),
                            message: task.text,
                            confirmLabel: L(TASK_WORDS.deleteConfirm),
                          });
                          if (ok) forget.mutate({ id: task.id });
                        }}
                        title={L(TASK_WORDS.deleteTitle)}
                        data-testid={`task-delete-${task.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : guide ? (
          /*
           * The short lesson, in the one place somebody looks when they have
           * no tasks yet and are wondering what the icon is for.
           */
          <div className="max-h-[24rem] overflow-y-auto" data-testid="task-guide">
            {TASK_GUIDE.map((step) => (
              <div key={step.title.en} className="border-b px-3 py-2.5 last:border-0">
                <p className="text-xs font-medium">{L(step.title)}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{L(step.body)}</p>
              </div>
            ))}
            <div className="flex items-center gap-2 px-3 py-2">
              <kbd className="rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Alt T</kbd>
              <Button variant="ghost" size="sm" className="ms-auto h-7 px-2 text-xs" onClick={() => setGuide(false)}>
                {L(TASK_WORDS.close)}
              </Button>
            </div>
          </div>
        ) : (
          <div className="max-h-[22rem] overflow-y-auto">
            {awake.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">{L(TASK_WORDS.empty)}</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/80">{L(TASK_WORDS.hint)}</p>
                <button
                  type="button"
                  onClick={() => setGuide(true)}
                  className="mt-2 text-[11px] text-primary hover:underline"
                >
                  {L(TASK_WORDS.guide)}
                </button>
              </div>
            ) : (
              awake.map((task) => {
                const days = ageInDays(task as Task);
                const tone = taskTone(task as Task);
                return (
                  /*
                   * The whole line is the link, not the small code at the end
                   * of it. The owner, 2026-09-25: "when I press it, it must
                   * go straight to the section that task belongs to."
                   */
                  <div
                    key={task.id}
                    className={cn(
                      "flex gap-2 border-b px-3 py-2.5 last:border-0",
                      task.about?.href && "cursor-pointer hover:bg-muted/50",
                    )}
                    onClick={() => goTo(task.about?.href)}
                    role={task.about?.href ? "link" : undefined}
                    data-testid={`task-${task.id}`}
                  >
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDone.mutate({ id: task.id, done: true }); }}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-[1.5px] border-muted-foreground/60 transition-colors hover:border-primary hover:bg-primary/10"
                      title={L(TASK_WORDS.done)}
                      aria-label={L(TASK_WORDS.done)}
                      data-testid={`task-done-${task.id}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{task.text}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                        <span className={toneClass[tone]}>
                          {days === 0 ? L({ ku: "ئەمڕۆ", en: "Today", ar: "اليوم", zh: "今天" }) : L(TASK_WORDS.openDays(days))}
                        </span>
                        {task.createdById !== user.id && task.createdByName && (
                          <span className="text-muted-foreground">· {task.createdByName}</span>
                        )}
                        {task.about?.label && (
                          <span className="inline-flex max-w-[11rem] items-center gap-1 font-mono text-primary">
                            <bdi dir="ltr" className="truncate">{task.about.label}</bdi>
                            {task.about.href && <ExternalLink className="h-3 w-3 shrink-0" />}
                          </span>
                        )}
                        <button
                          type="button"
                          className="ms-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                          onClick={(e) => { e.stopPropagation(); snooze.mutate({ id: task.id, until: tomorrowMorning() }); }}
                          title={L(TASK_WORDS.snooze)}
                          data-testid={`task-snooze-${task.id}`}
                        >
                          <Clock className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {sleeping.length > 0 && (
              /*
               * Nothing was deleted. It waits here, says the hour it comes
               * back, and can be picked up again before then.
               */
              <div className="border-t bg-muted/30" data-testid="task-sleeping">
                <button
                  type="button"
                  onClick={() => setOpenSleeping((s) => !s)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <Moon className="h-3.5 w-3.5" />
                  {L(TASK_WORDS.sleeping)}
                  <span>{sleeping.length}</span>
                </button>
                {showSleeping && sleeping.map((task) => (
                  <div
                    key={task.id}
                    className={cn("flex gap-2 px-3 pb-2.5 ps-6", task.about?.href && "cursor-pointer")}
                    onClick={() => goTo(task.about?.href)}
                    data-testid={`task-asleep-${task.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-muted-foreground">{task.text}</p>
                      <p className="text-[11px] text-muted-foreground/80">
                        {L(TASK_WORDS.returnsAt(L(wakeWhenWords(task.snoozedUntil ?? new Date()))))}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-6 shrink-0 items-center gap-1 self-center rounded-md px-1.5 text-[11px] text-muted-foreground hover:bg-background hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); wake.mutate({ id: task.id, until: new Date(Date.now() - 1000) }); }}
                      title={L(TASK_WORDS.wakeNow)}
                      data-testid={`task-wake-${task.id}`}
                    >
                      <Undo2 className="h-3 w-3" />
                      {L(TASK_WORDS.wakeNow)}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
