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
    // `standing` joined it on 2026-09-28: a struck message is not part of
    // the conversation any more. The pair bound is what must never leave.
    expect(conv).toContain("where(and(between(userId, otherId), standing))");
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

  it("is drawn where the layout keeps a place for it, and gets out of the way when printing", () => {
    // Not over the page since 2026-10-07 (client/src/lib/floatingCorner): the
    // foot of the menu rail on a desktop - still the right-hand corner he
    // asked for - and beside the bells on a phone.
    expect(ui).toContain("createPortal(");
    expect(ui).not.toContain("cornerSlot");
    expect(ui).toContain("print:hidden");
    const layout = read("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain(
      '{!fullScreen && <StaffChat slot={isMobile ? barChatSlot : railChatSlot} placement={isMobile ? "bar" : "rail"} />}',
    );
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
    // Four now: sending, reading, deleting one, emptying a thread. None of
    // them earns a "done successfully" — the message appearing, or being
    // gone, is the confirmation.
    expect((ui.match(/meta: \{ skipGlobalToast: true \}/g) ?? []).length).toBe(4);
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

/**
 * Taking a message back out (owner, 2026-09-28).
 *
 * «سڕینەوەی نامەش بوونی هەبێ», and when asked what the other
 * person should be left with, «هەمووی بسرێتەوە هیچ نەمێنێ» — and
 * either of the two may do it, not only whoever wrote the message.
 */
describe("a message can be taken out of the conversation", () => {
  const db = read("server/db/staffChat.db.ts");
  const router = read("server/routers/staffChat.router.ts");
  const ui = read("client/src/components/chat/StaffChat.tsx");

  it("is struck, never erased", () => {
    // The office does not delete what it has written down; it stops showing
    // it. The row keeps the hour and the person who struck it.
    expect(db).toContain("set({ deletedAt: new Date(), deletedById: userId })");
    expect(db).not.toMatch(/delete\(staffMessages\)/);
  });

  it("every read skips a struck message, through one condition", () => {
    expect(db).toContain("const standing = isNull(staffMessages.deletedAt);");
    // Each of the four reads, so none can forget and show what was taken back.
    const inbox = db.slice(db.indexOf("export async function staffInbox"), db.indexOf("export async function staffUnreadCount"));
    const count = db.slice(db.indexOf("export async function staffUnreadCount"), db.indexOf("export async function markStaffMessagesRead"));
    const read0 = db.slice(db.indexOf("export async function markStaffMessagesRead"), db.indexOf("export async function deleteStaffMessage"));
    for (const [name, body] of [["inbox", inbox], ["unread count", count], ["mark read", read0]] as const) {
      expect(body.length, name).toBeGreaterThan(100);
      expect(body, name).toContain("standing");
    }
  });

  it("can only reach a message in your own conversation", () => {
    // Bounded here and not in the screen, the same as every read: an id from
    // outside the pair matches nothing however it is asked for.
    const one = db.slice(db.indexOf("export async function deleteStaffMessage"), db.indexOf("export async function clearStaffConversation"));
    expect(one).toContain("or(eq(staffMessages.fromId, userId), eq(staffMessages.toId, userId))");
    const all = db.slice(db.indexOf("export async function clearStaffConversation"));
    expect(all).toContain("where(and(between(userId, otherId), standing))");
    // The router hands over the signed-in person and nothing else.
    expect(router).toContain("db.deleteStaffMessage(ctx.user.id, input.messageId)");
    expect(router).toContain("db.clearStaffConversation(ctx.user.id, input.userId)");
  });

  it("a refusal says what to do about it", () => {
    const one = db.slice(db.indexOf("export async function deleteStaffMessage"), db.indexOf("export async function clearStaffConversation"));
    expect(one).toContain("withFix(");
  });

  it("asks before it deletes, in the app's own dialog", () => {
    // Never the browser's box — it speaks the phone's language and offers to
    // stop asking (confirm-dialog.test).
    expect((ui.match(/confirmDanger\(/g) ?? []).length).toBe(2);
    expect(ui).toContain("WORDS.delAsk");
    expect(ui).toContain("WORDS.clearAsk");
  });

  it("the handle is reachable on a phone, where there is no hovering", () => {
    const btn = ui.slice(ui.indexOf("staff-chat-delete-"), ui.indexOf("staff-chat-delete-") + 400);
    // Visible at rest and hidden only from `md` up: a phone has no hover to
    // bring it back, so that resting state is stated, not assumed.
    expect(ui).toContain("opacity-100 md:opacity-0 md:group-hover:opacity-100");
    expect(btn.length).toBeGreaterThan(50);
  });
});

/**
 * "A message came for you" (owner, 2026-09-28).
 *
 * A sound says something happened somewhere. It does not say who wants you,
 * and a badge in the corner is missed by somebody typing into a form.
 */
describe("an arriving message says who sent it", () => {
  const ui = read("client/src/components/chat/StaffChat.tsx");

  it("names the sender and opens that conversation in one tap", () => {
    expect(ui).toContain("WORDS.arrived");
    expect(ui).toContain("action: { label: L(WORDS.openIt), onClick: openThem }");
    expect(ui).toContain("setWithId(from.id)");
  });

  it("still rings the same note as a task, and still only once", () => {
    expect(ui).toContain("soundManager.playNotice()");
    expect(ui).toContain("localStorage.setItem(chimedKey(user.id), String(newest))");
    expect(ui).toContain("if (newest <= lastSeen) return;");
  });

  it("uses the operating system only when this window is not the one being read", () => {
    // And only where permission was already given: nothing here asks for it.
    expect(ui).toContain("document.hidden && isNotificationEnabled()");
    expect(ui).toContain('showNotification("new_message"');
    expect(ui).not.toContain("requestPermission");
  });
});
