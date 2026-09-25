import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ListChecks, Plus, Clock, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { soundManager } from "@/lib/soundManager";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTaskComposer } from "@/components/tasks/TaskComposer";
import {
  TASK_WORDS,
  ageInDays,
  isAwake,
  taskTone,
  tomorrowMorning,
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
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const utils = trpc.useUtils();
  const mine = trpc.tasks.mine.useQuery(undefined, {
    // A colleague's task should land within the minute, not on the next
    // reload — it is the whole point of sending one.
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const setDone = trpc.tasks.setDone.useMutation({ onSuccess: () => void utils.tasks.invalidate() });
  const snooze = trpc.tasks.snooze.useMutation({ onSuccess: () => void utils.tasks.invalidate() });

  const awake = (mine.data?.open ?? []).filter((t) => isAwake(t as Task));

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
    <Popover open={open} onOpenChange={setOpen}>
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
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <span className="text-sm font-medium">{L(TASK_WORDS.mine)}</span>
          <span className="text-xs text-muted-foreground">{awake.length}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ms-auto h-7 gap-1 px-2 text-xs"
            onClick={() => { setOpen(false); newTask(); }}
            data-testid="task-new"
          >
            <Plus className="h-3.5 w-3.5" />
            {L(TASK_WORDS.title)}
          </Button>
        </div>

        <div className="max-h-[22rem] overflow-y-auto">
          {awake.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{L(TASK_WORDS.empty)}</p>
          ) : (
            awake.map((task) => {
              const days = ageInDays(task as Task);
              const tone = taskTone(task as Task);
              return (
                <div key={task.id} className="flex gap-2 border-b px-3 py-2.5 last:border-0" data-testid={`task-${task.id}`}>
                  <button
                    type="button"
                    onClick={() => setDone.mutate({ id: task.id, done: true })}
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
                        <button
                          type="button"
                          className="inline-flex max-w-[11rem] items-center gap-1 font-mono text-primary hover:underline"
                          onClick={() => {
                            if (!task.about?.href) return;
                            setOpen(false);
                            navigate(task.about.href);
                          }}
                        >
                          <bdi dir="ltr" className="truncate">{task.about.label}</bdi>
                          {task.about.href && <ExternalLink className="h-3 w-3 shrink-0" />}
                        </button>
                      )}
                      <button
                        type="button"
                        className="ms-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        onClick={() => snooze.mutate({ id: task.id, until: tomorrowMorning() })}
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
