import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ListChecks, Link2, User, CalendarDays, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TASK_WORDS, type TaskAbout, type TaskAboutType } from "@shared/tasks";

/**
 * The window a task is written in, and the three ways to open it.
 *
 * The owner, 2026-09-25: "I wanted, for example, to right-click on a tracking
 * and have it say 'make a task', and the task window opens at once — and an
 * icon as well, for making a task on its own."
 *
 * So: right-click anything that carries a value, the icon in the top bar, or
 * the keyboard. One window, always the same, and when it is opened from a
 * record it arrives already fastened to it, which is what lets the words be
 * short: "get the piece back from Layla" is a whole task when the row it
 * hangs on says which piece.
 *
 * Alt+T is the shortcut. Ctrl+T is listened for too and works in the desktop
 * app; in a browser it opens a tab before any page sees it, which is why it
 * is not the one that is taught.
 */

interface OpenOptions {
  about?: TaskAbout;
  /** Pre-filled text, when something is known about the job already. */
  text?: string;
}

const TaskComposerContext = createContext<(options?: OpenOptions) => void>(() => {});

/** Open the task window from anywhere: `const newTask = useTaskComposer()`. */
export function useTaskComposer() {
  return useContext(TaskComposerContext);
}

/** Where the browser's own menu must keep working: paste lives there. */
const EDITABLE = "input, textarea, select, [contenteditable='true'], [contenteditable='']";

/** How far out from the pointer a value still counts as "this one". */
const NEARBY_STEPS = 5;

/** The nearest copyable value in the same cell, then the same row. */
function nearestValue(target: Element): HTMLElement | null {
  let scope: Element | null = target;
  for (let step = 0; step < NEARBY_STEPS && scope; step += 1) {
    if (scope === document.body) break;
    const found = scope.querySelector<HTMLElement>("[data-task-value]");
    if (found?.dataset.taskValue) return found;
    scope = scope.parentElement;
  }
  return null;
}

/** What the global right-click found under the pointer, if anything. */
function aboutFromEvent(target: EventTarget | null): TaskAbout | null {
  if (!(target instanceof Element)) return null;

  // An element that opted in and said exactly what it is.
  const tagged = target.closest<HTMLElement>("[data-task-about]");
  if (tagged) {
    try {
      const parsed = JSON.parse(tagged.dataset.taskAbout ?? "{}") as TaskAbout;
      if (parsed && typeof parsed === "object") return { ...parsed, type: parsed.type ?? "none" };
    } catch {
      /* a malformed attribute is the same as none */
    }
  }

  /*
   * A value that can be copied is a value worth making a task about — which
   * covers every tracking, box code, customer code and order number in the
   * system in one place (components/CopyButton).
   *
   * The pointer is rarely on it, though. A tracking is printed as plain text
   * with the copy button beside it, so a right-click on the number itself
   * lands on nothing. Climb a few steps and take the nearest value in the
   * same cell, then the same row — which is what a person means when they
   * right-click a line and say "make a task about this".
   */
  const copyable =
    target.closest<HTMLElement>("[data-task-value]") ?? nearestValue(target);
  if (copyable?.dataset.taskValue) {
    return {
      type: (copyable.dataset.taskType as TaskAboutType) || "none",
      label: copyable.dataset.taskValue,
      href: copyable.dataset.taskHref || window.location.pathname + window.location.search,
    };
  }

  // Failing both: whatever the person has selected on the page.
  const selected = window.getSelection()?.toString().trim();
  if (selected && selected.length <= 120) {
    return { type: "none", label: selected, href: window.location.pathname + window.location.search };
  }
  return null;
}

export function TaskComposerProvider({ children }: { children: ReactNode }) {
  const { language } = useTranslation();
  const { user } = useAuth();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [about, setAbout] = useState<TaskAbout | null>(null);
  const [assignee, setAssignee] = useState<string>("me");
  const boxRef = useRef<HTMLTextAreaElement | null>(null);

  const openComposer = useCallback((options?: OpenOptions) => {
    setAbout(options?.about ?? null);
    setText(options?.text ?? "");
    setAssignee("me");
    setOpen(true);
  }, []);

  // Alt+T from anywhere; Ctrl+T too, for the desktop app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isT = e.key === "t" || e.key === "T";
      if (!isT || (!e.altKey && !(e.ctrlKey || e.metaKey))) return;
      e.preventDefault();
      openComposer({ about: aboutFromEvent(document.activeElement) ?? undefined });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openComposer]);

  /*
   * Right-click, anywhere.
   *
   * Only where there is something to make a task about — a tracking, a code,
   * a selection. Everywhere else the browser's own menu is left alone, which
   * is what keeps copy and paste working.
   */
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (e.shiftKey) return; // the escape hatch to the browser's own menu
      // Inside a field, a right-click is how a person pastes. Never take it.
      if (e.target instanceof Element && e.target.closest(EDITABLE)) return;
      const found = aboutFromEvent(e.target);
      if (!found) return;
      e.preventDefault();
      openComposer({ about: found });
    };
    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
  }, [openComposer]);

  const staff = trpc.tasks.staff.useQuery(undefined, { enabled: open, staleTime: 10 * 60_000 });
  const create = trpc.tasks.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      setText("");
      void utils.tasks.invalidate();
      toast.success(L(TASK_WORDS.added));
    },
    onError: (err) => toast.error(err.message),
  });

  const submit = () => {
    const body = text.trim();
    if (!body || create.isPending) return;
    create.mutate({
      text: body,
      assignedToId: assignee === "me" ? null : Number(assignee),
      aboutType: about?.type ?? "none",
      aboutId: about?.id ?? null,
      aboutLabel: about?.label ?? null,
      aboutHref: about?.href ?? null,
    });
  };

  const others = useMemo(
    () => (staff.data ?? []).filter((s) => s.id !== user?.id),
    [staff.data, user?.id],
  );

  return (
    <TaskComposerContext.Provider value={openComposer}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <ListChecks className="h-4 w-4 text-primary" />
              </span>
              {L(TASK_WORDS.title)}
              <kbd className="ms-auto rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                Alt T
              </kbd>
            </DialogTitle>
          </DialogHeader>

          <Textarea
            ref={boxRef}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends it; Shift+Enter is a new line, as everywhere else.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={3}
            placeholder={L(TASK_WORDS.placeholder)}
            className="resize-none text-sm"
            data-testid="task-text"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger className="h-8 w-auto gap-1.5 rounded-full border-0 bg-primary/10 px-3 text-xs text-primary" data-testid="task-assignee">
                <User className="h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="me">{L(TASK_WORDS.me)}</SelectItem>
                {others.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name || s.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-muted px-3 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {L({ ku: "ئەمڕۆ", en: "Today", ar: "اليوم", zh: "今天" })}
            </span>

            {about?.label && (
              /*
               * What it is fastened to, and the way off it. The window can be
               * opened from the keyboard while the focus is still on a row,
               * so it sometimes arrives fastened to something the person did
               * not mean — they can see which, and drop it.
               */
              <span
                className="inline-flex h-8 max-w-[14rem] items-center gap-1.5 rounded-full bg-muted ps-3 pe-1 font-mono text-xs"
                title={about.label}
                data-testid="task-about"
              >
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                <bdi dir="ltr" className="truncate">{about.label}</bdi>
                <button
                  type="button"
                  onClick={() => setAbout(null)}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                  title={L(TASK_WORDS.unfasten)}
                  aria-label={L(TASK_WORDS.unfasten)}
                  data-testid="task-about-off"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={submit} disabled={!text.trim() || create.isPending} data-testid="task-add">
              {L(TASK_WORDS.add)}
            </Button>
            <span className="text-[11px] text-muted-foreground">Enter</span>
            <span className={cn("ms-auto text-[11px] text-muted-foreground")}>
              Esc
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </TaskComposerContext.Provider>
  );
}
