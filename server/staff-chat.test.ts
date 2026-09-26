import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * The owner, 2026-09-26: «گرنگە پەیام ناردن هەبێ لە نێوان ئادمینەکان، چات
 * کردن هەبێ وەکو مەسنجەر، کە چاتی نوێ هات دەنگی بێت وەکو نۆتفکەیشن،
 * ئایکۆنی چاتێ هەبێ لە ژێرەوەی لای ڕاست.»
 */
describe("the office talking to itself", () => {
  const db = read("server/db/staffChat.db.ts");

  it("keeps a conversation to the two people in it", () => {
    // The same shape as the tasks table beside it: a query that forgot
    // would publish the office's private words and no screen would look
    // wrong.
    expect(db).toContain("const between = (a: number, b: number) =>");
    const conv = db.slice(db.indexOf("export async function staffConversation"), db.indexOf("export async function staffInbox"));
    expect(conv.length).toBeGreaterThan(100);
    expect(conv).toContain("where(between(userId, otherId))");
  });

  it("reads a long conversation as cheaply as a short one", () => {
    const conv = db.slice(db.indexOf("export async function staffConversation"));
    expect(conv).toContain("orderBy(desc(staffMessages.id))");
    expect(conv).toContain("rows.reverse()");
  });

  it("builds the whole list in one query, not one per colleague", () => {
    const inbox = db.slice(db.indexOf("export async function staffInbox"), db.indexOf("export async function staffUnreadCount"));
    expect(inbox.length).toBeGreaterThan(200);
    expect((inbox.match(/await db$/gm) ?? []).length).toBeLessThanOrEqual(2);
    // Somebody waiting for an answer comes first.
    expect(inbox).toContain("(b.unread > 0 ? 1 : 0) - (a.unread > 0 ? 1 : 0)");
  });

  it("marks read only what the other person said", () => {
    const mark = db.slice(db.indexOf("export async function markStaffMessagesRead"));
    expect(mark).toContain("eq(staffMessages.toId, userId)");
    expect(mark).toContain("eq(staffMessages.fromId, otherId)");
    expect(mark).toContain("isNull(staffMessages.readAt)");
  });

  it("refuses a message to nobody, and to yourself", () => {
    const send = db.slice(db.indexOf("export async function sendStaffMessage"), db.indexOf("export async function staffConversation"));
    expect(send).toContain("if (!body)");
    expect(send).toContain("if (fromId === toId)");
  });
});

describe("the bubble in the corner", () => {
  const ui = read("client/src/components/chat/StaffChat.tsx");

  it("rings the way a task does, and only for something new", () => {
    expect(ui).toContain("soundManager.playNotice()");
    expect(ui).toContain("localStorage.getItem(chimedKey(user.id))");
    expect(ui).toContain("if (newest <= lastSeen) return;");
  });

  it("opens where he asked, and gets out of the way when printing", () => {
    expect(ui).toContain("fixed bottom-4 end-4");
    expect(ui).toContain("print:hidden");
    const layout = read("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain("{!fullScreen && <StaffChat />}");
  });

  it("sends on Enter and keeps Shift+Enter for a new line", () => {
    expect(ui).toContain('if (e.key === "Enter" && !e.shiftKey)');
  });

  it("reads a conversation by opening it", () => {
    expect(ui).toContain("markRead.mutate({ userId: withId })");
  });
});
