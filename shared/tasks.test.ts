import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  TASK_GUIDE,
  TASK_LATE_AFTER_DAYS,
  TASK_WAITING_AFTER_DAYS,
  TASK_WORDS,
  ageInDays,
  byOldestFirst,
  canSeeTask,
  hrefForValue,
  isAwake,
  isSnoozed,
  taskTone,
  tomorrowMorning,
  wakeWhenWords,
} from "./tasks";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

const NOW = new Date("2026-09-25T10:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("who a task belongs to", () => {
  it("is whoever wrote it and whoever it is for", () => {
    const task = { createdById: 1, assignedToId: 2 };
    expect(canSeeTask(task, 1)).toBe(true);
    expect(canSeeTask(task, 2)).toBe(true);
  });

  it("is nobody else — a private reminder stays private", () => {
    // The owner, 2026-09-25: "my own personal task shows only to me."
    expect(canSeeTask({ createdById: 1, assignedToId: 1 }, 3)).toBe(false);
    expect(canSeeTask({ createdById: 1, assignedToId: 2 }, 3)).toBe(false);
  });

  it("is asserted in the query, not only in the screens", () => {
    /*
     * Every read and write of the table carries the clause. A query that
     * forgot it would publish one admin's list to the whole office and no
     * screen would look wrong, which is the kind of mistake nobody reports.
     */
    const src = read("server/db/tasks.db.ts");
    const chunks = src.split("export async function ").slice(1);
    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) {
      const name = chunk.slice(0, chunk.indexOf("("));
      if (!/\.from\(tasks\)|update\(tasks\)|delete\(tasks\)/.test(chunk)) continue;
      const guarded =
        chunk.includes("visibleTo(userId)") ||
        chunk.includes("eq(tasks.assignedToId, userId)");
      expect(guarded, `${name} reads or writes tasks without the visibility clause`).toBe(true);
    }
  });
});

describe("what the icon counts", () => {
  it("is open and not sleeping", () => {
    expect(isAwake({ doneAt: null, snoozedUntil: null }, NOW)).toBe(true);
    expect(isAwake({ doneAt: NOW, snoozedUntil: null }, NOW)).toBe(false);
  });

  it("leaves a snoozed one out until its moment passes", () => {
    const later = new Date(NOW.getTime() + 60 * 60 * 1000);
    expect(isSnoozed({ snoozedUntil: later }, NOW)).toBe(true);
    expect(isAwake({ doneAt: null, snoozedUntil: later }, NOW)).toBe(false);
    const earlier = new Date(NOW.getTime() - 60 * 1000);
    expect(isAwake({ doneAt: null, snoozedUntil: earlier }, NOW)).toBe(true);
  });

  it("puts it back tomorrow morning, not in twenty-four hours", () => {
    const next = tomorrowMorning(NOW);
    expect(next.getDate()).toBe(new Date(NOW).getDate() + 1);
    expect(next.getHours()).toBe(8);
    expect(next.getMinutes()).toBe(0);
  });
});

describe("how loudly it asks", () => {
  it("does not shout on the first day", () => {
    expect(taskTone({ createdAt: NOW }, NOW)).toBe("fresh");
    expect(ageInDays({ createdAt: NOW }, NOW)).toBe(0);
  });

  it("reddens with age, so the colour keeps meaning something", () => {
    expect(taskTone({ createdAt: daysAgo(TASK_WAITING_AFTER_DAYS) }, NOW)).toBe("waiting");
    expect(taskTone({ createdAt: daysAgo(TASK_LATE_AFTER_DAYS) }, NOW)).toBe("late");
    expect(TASK_WAITING_AFTER_DAYS).toBeLessThan(TASK_LATE_AFTER_DAYS);
  });

  it("puts the one that has waited longest first", () => {
    const list = [{ createdAt: daysAgo(1) }, { createdAt: daysAgo(9) }, { createdAt: daysAgo(4) }];
    expect(list.sort(byOldestFirst).map((t) => ageInDays(t, NOW))).toEqual([9, 4, 1]);
  });
});

describe("the three ways in", () => {
  it("wears its own face, not the bell's", () => {
    // The owner, 2026-09-25: "but not the bell icon — a task and reminder
    // icon." The bell carries what the system noticed; this carries what
    // people promised, and only a person empties it.
    const bell = read("client/src/components/tasks/TaskBell.tsx");
    const imports = bell.slice(0, bell.indexOf('from "lucide-react"'));
    expect(imports.length).toBeGreaterThan(0);
    expect(imports).toContain("ListChecks");
    expect(imports).not.toMatch(/\bBell\b/);
  });

  it("opens on a right-click over anything that carries a value", () => {
    const composer = read("client/src/components/tasks/TaskComposer.tsx");
    expect(composer).toContain('window.addEventListener("contextmenu"');
    expect(composer).toContain("[data-task-value]");
    // Shift is the way back to the browser's own menu, so copy and paste
    // never become unreachable.
    expect(composer).toContain("e.shiftKey");
    // And a right-click inside a field is left to the browser, because that
    // is where paste lives.
    expect(composer).toContain("closest(EDITABLE)");
    expect(composer).toMatch(/const EDITABLE = .*input, textarea/);
    // And every copyable value in the system is one, from one component.
    expect(read("client/src/components/CopyButton.tsx")).toContain("data-task-value");
  });

  it("opens on the keyboard and from its own icon", () => {
    const composer = read("client/src/components/tasks/TaskComposer.tsx");
    expect(composer).toContain('window.addEventListener("keydown"');
    expect(composer).toMatch(/e\.altKey/);
    expect(read("client/src/App.tsx")).toContain("TaskComposerProvider");
    expect(read("client/src/components/DashboardLayout.tsx")).toContain("TaskBell");
  });

  it("reads the shortcut key by position, not by the letter it types", () => {
    /*
     * The owner, 2026-09-25: "Ctrl+Alt+T does not work everywhere." On a
     * Kurdish or Arabic layout that key produces an Arabic letter, so a
     * handler comparing e.key worked in English and nowhere else.
     */
    const composer = read("client/src/components/tasks/TaskComposer.tsx");
    expect(composer).toContain('e.code === "KeyT"');
    // And in the capture phase, so a window with a focus trap cannot eat it.
    expect(composer).toContain('window.addEventListener("keydown", onKey, true)');
  });

  it("opens from a right-click even where no copy button was printed", () => {
    // "The copy icon is not in every place, so a right-click cannot reach a
    // task." Now the menu is ours on every working screen; only a field and
    // Shift are left to the browser.
    const composer = read("client/src/components/tasks/TaskComposer.tsx");
    const handler = composer.slice(
      composer.indexOf("const onContextMenu ="),
      composer.indexOf('window.addEventListener("contextmenu"'),
    );
    expect(handler.length).toBeGreaterThan(20);
    expect(handler).toContain("openComposer({ about: aboutFromEvent(e.target) ?? undefined })");
    expect(handler).not.toContain("if (!found) return");
    // A code printed as plain text is still a code.
    expect(composer).toContain("CODE_LIKE.test(own)");
  });
});

describe("a task that was put down", () => {
  /*
   * The owner, 2026-09-25, having pressed "remind me tomorrow": the task
   * vanished and nothing said when it returns. A task that disappears
   * silently is a task nobody trusts.
   */
  it("says the hour it comes back", () => {
    const at8 = tomorrowMorning(NOW);
    expect(wakeWhenWords(at8, NOW).en).toBe("tomorrow at 08:00");
    expect(wakeWhenWords(at8, NOW).ku).toContain("08:00");
    const later = new Date(NOW.getTime() + 3 * 60 * 60 * 1000);
    expect(wakeWhenWords(later, NOW).en).toMatch(/^today at /);
    const next = new Date(NOW.getTime() + 9 * 24 * 60 * 60 * 1000);
    expect(wakeWhenWords(next, NOW).en).toMatch(/^\d{4}-\d{2}-\d{2} at /);
  });

  it("says it the moment it is put down, and again in the list", () => {
    const bell = read("client/src/components/tasks/TaskBell.tsx");
    const snooze = bell.slice(bell.indexOf("const snooze ="), bell.indexOf("const wake ="));
    expect(snooze.length).toBeGreaterThan(20);
    expect(snooze).toContain("TASK_WORDS.backAt");
    expect(snooze).toContain("wakeWhenWords");
    expect(bell).toContain("TASK_WORDS.returnsAt");
  });

  it("waits in sight, and can be picked up early", () => {
    const bell = read("client/src/components/tasks/TaskBell.tsx");
    expect(bell).toContain('data-testid="task-sleeping"');
    expect(bell).toContain("TASK_WORDS.wakeNow");
    // With nothing awake, the sleeping ones are the list — otherwise the
    // popover says "nothing waiting" while work sits behind a fold.
    expect(bell).toContain("openSleeping || awake.length === 0");
  });
});

describe("the short lesson", () => {
  // The owner, 2026-09-25: "add a little teaching \u2014 what a task is, the
  // shortcut and how it works \u2014 so the person knows what a task means."
  it("covers what it is, how to make one, who sees it and how it ends", () => {
    expect(TASK_GUIDE.length).toBeGreaterThanOrEqual(5);
    for (const step of TASK_GUIDE) {
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(step.title[lang].trim().length, `${step.title.en} title ${lang}`).toBeGreaterThan(0);
        expect(step.body[lang].trim().length, `${step.title.en} body ${lang}`).toBeGreaterThan(0);
      }
    }
    const ku = TASK_GUIDE.map((s) => s.body.ku).join(" ");
    expect(ku).toContain("Alt+T");
    expect(ku).toContain("08:00");
  });

  it("sits where somebody with no tasks is already looking", () => {
    const bell = read("client/src/components/tasks/TaskBell.tsx");
    expect(bell).toContain('data-testid="task-guide-toggle"');
    expect(bell).toContain('data-testid="task-guide"');
    const empty = bell.slice(bell.indexOf("awake.length === 0 ? ("), bell.indexOf("awake.map("));
    expect(empty.length).toBeGreaterThan(20);
    expect(empty).toContain("TASK_WORDS.hint");
    expect(empty).toContain("setGuide(true)");
  });

  it("keeps a Latin shortcut upright inside Kurdish", () => {
    // Without an isolate, "Alt+T" reorders in an RTL line.
    for (const words of [TASK_WORDS.hint.ku, TASK_GUIDE[1].body.ku]) {
      if (!words.includes("Alt+T")) continue;
      expect(words, words).toContain("\u2066Alt+T\u2069");
    }
  });
});

describe("pressing a task", () => {
  /*
   * The owner, 2026-09-25: "the link of the place must go into the task —
   * when I press it, it goes straight to the section that task belongs to.
   * This is very important."
   */
  it("goes to the record, not to the page it was written on", () => {
    expect(hrefForValue("SF1234567890", "/batches")).toBe("/packages/all?search=SF1234567890");
    // A box code has no row in the parcels table; the screen it came from is
    // the box screen, so that is where it stays.
    expect(hrefForValue("BOX-20260918-004", "/delivery?tab=open")).toBe("/delivery?tab=open");
    expect(hrefForValue("   ", "/here")).toBe("/here");
  });

  it("is the whole line, not the small code at the end of it", () => {
    const bell = read("client/src/components/tasks/TaskBell.tsx");
    expect(bell).toContain("onClick={() => goTo(task.about?.href)}");
    // The tick and the snooze must not navigate as well.
    expect(bell).toMatch(/e\.stopPropagation\(\); setDone\.mutate/);
    expect(bell).toMatch(/e\.stopPropagation\(\); snooze\.mutate/);
  });

  it("is what the right-click writes into the task in the first place", () => {
    const composer = read("client/src/components/tasks/TaskComposer.tsx");
    expect(composer).toContain("hrefForValue(copyable.dataset.taskValue, here)");
  });
});
