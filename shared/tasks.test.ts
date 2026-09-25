import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  TASK_LATE_AFTER_DAYS,
  TASK_WAITING_AFTER_DAYS,
  ageInDays,
  byOldestFirst,
  canSeeTask,
  isAwake,
  isSnoozed,
  taskTone,
  tomorrowMorning,
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
});
