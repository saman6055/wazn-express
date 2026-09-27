import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { STAFF_ATTACHMENT_MAX_BYTES, staffAttachmentAllowed } from "@shared/staffChatAttachment";

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
    // Empty text with nothing attached (a picture alone is a message).
    expect(send).toContain("if (!body && !attachment?.url)");
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
    // The corner, and which slot of it, comes from lib/floatingCorner: the
    // owner asked for the right-hand side, clear of the sidebar rail.
    expect(ui).toContain("cornerSlot(CORNER.chat)");
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

describe("files in the chat, and no applause (owner, 2026-09-27)", () => {
  const ui = read("client/src/components/chat/StaffChat.tsx");
  const router = read("server/routers/staffChat.router.ts");

  it("sends and reads without the global success toast", () => {
    expect((ui.match(/meta: \{ skipGlobalToast: true \}/g) ?? []).length).toBe(2);
    // A failure still speaks, inside the panel, with a copyable report.
    expect(ui).toContain("buildErrorReport(sendError)");
  });

  it("takes a file three ways: picked, pasted, dropped — and a screenshot", () => {
    expect(ui).toContain("onPaste={onPaste}");
    expect(ui).toContain("onDrop={(e) => {");
    expect(ui).toContain('type="file"');
    expect(ui).toContain("captureScreen()");
  });

  it("refuses what a browser would run, and anything over 10 MB", () => {
    expect(STAFF_ATTACHMENT_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(staffAttachmentAllowed("image/png", "shot.png")).toBe(true);
    expect(staffAttachmentAllowed("image/jpeg", "photo.jpg")).toBe(true);
    expect(staffAttachmentAllowed("application/pdf", "invoice.pdf")).toBe(true);
    expect(staffAttachmentAllowed("image/svg+xml", "x.svg")).toBe(false);
    expect(staffAttachmentAllowed("text/html", "page.html")).toBe(false);
    expect(staffAttachmentAllowed("application/octet-stream", "run.exe")).toBe(false);
    expect(router).toContain("buffer.length > STAFF_ATTACHMENT_MAX_BYTES");
  });

  it("a picture alone is a message", () => {
    expect(read("server/db/staffChat.db.ts")).toContain("if (!body && !attachment?.url)");
  });

  it("the live table gains the columns without losing its NOT NULLs", () => {
    const mig = read("server/_core/migrations.ts");
    const block = mig.slice(mig.indexOf("  staffMessages: ["), mig.indexOf("  expenses: ["));
    for (const col of ["fromId", "toId", "text", "readAt", "createdAt", "attachmentUrl", "attachmentName", "attachmentType"]) {
      expect(block, col).toContain(`name: "${col}"`);
    }
  });
});
