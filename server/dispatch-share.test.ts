import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { dispatchPlainText, dispatchWecomMarkdown, wecomKeyFrom, WECOM_SETTING_KEY } from "@shared/dispatchMessage";

/**
 * When a batch leaves China (owner, 2026-10-26): the WeCom group robot is told
 * by itself, and the report page sends a picture of the report to WeChat (the
 * share sheet) or Wazn's WhatsApp in one tap. All free; the robot key never
 * reaches a browser.
 */

const root = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");
const FACTS = { batchCode: "AIR-2026-075GZ", cartons: 6, parcels: 70, leftOut: 0, by: "Ako", reportUrl: "https://admin.example/dispatch-check/122/report" };

describe("the message", () => {
  it("Chinese for the group in China, Kurdish for Erbil, the same figures", () => {
    const t = dispatchPlainText(FACTS);
    expect(t).toContain("发货核对完成 · AIR-2026-075GZ");
    expect(t).toContain("6 箱 · 70 件");
    expect(t).toContain("6 کارتۆن · 70 پاکێج");
    expect(t).toContain(FACTS.reportUrl);
  });

  it("parcels left out are said, with the reason", () => {
    const md = dispatchWecomMarkdown({ ...FACTS, leftOut: 3, note: "不在仓库" });
    expect(md).toContain('<font color="warning">3 件未装箱：不在仓库</font>');
    expect(md).toContain("3 پاکێج نەخراونەتە کارتۆن");
    expect(md.length).toBeLessThan(4096);
  });
});

describe("the robot key", () => {
  it("taken from the whole webhook address or the key alone, nothing else", () => {
    const key = "693a91f6-7xxx-4bc4-97a0-0ec2sifa5aaa";
    expect(wecomKeyFrom(`https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${key}`)).toBe(key);
    expect(wecomKeyFrom(key)).toBe(key);
    expect(wecomKeyFrom("https://evil.example/cgi-bin/webhook/send?key=" + key)).toBeNull();
    expect(wecomKeyFrom("hello")).toBeNull();
  });

  it("never goes back to a browser", () => {
    const s = root("server/routers/settings.router.ts");
    expect(s).toContain("if (SERVER_ONLY_SETTINGS.includes(input.key)) return null;");
    expect(s).toContain(".filter((s) => !SERVER_ONLY_SETTINGS.includes(s.settingKey))");
    expect(s).toContain("wecomStatus: superAdminProcedure.query(async () => ({ configured: await wecomConfigured() }))");
    expect(root("server/lib/wecomBot.ts")).toContain("SERVER_ONLY_SETTINGS: readonly string[] = [WECOM_SETTING_KEY]");
    expect(WECOM_SETTING_KEY).toBe("wecom_dispatch_webhook_key");
  });
});

describe("sending", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts markdown to qyapi.weixin.qq.com and reads WeCom's answer", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ errcode: 0, errmsg: "ok" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendWecomMarkdown } = await import("./lib/wecomBot");
    const res = await sendWecomMarkdown("**hi**", "abcdefghijklmnopqrstuvwx");
    expect(res.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abcdefghijklmnopqrstuvwx");
    expect(JSON.parse(String(init.body))).toEqual({ msgtype: "markdown", markdown: { content: "**hi**" } });
  });

  it("a refusal from WeCom is reported, not thrown", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ errcode: 93000, errmsg: "invalid webhook url" }), { status: 200 })));
    const { sendWecomMarkdown } = await import("./lib/wecomBot");
    const res = await sendWecomMarkdown("x", "abcdefghijklmnopqrstuvwx");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("93000");
  });

  it("finishing a dispatch check tells the robot without waiting on it", () => {
    const r = root("server/routers/dispatch.router.ts");
    const fin = r.slice(r.indexOf("finish: staffProcedure"));
    expect(fin).toContain("void sendWecomMarkdown(dispatchWecomMarkdown({");
  });

  it("the report page shares the picture to WeChat and to Wazn's WhatsApp", () => {
    const page = root("client/src/pages/DispatchReport.tsx");
    expect(page).toContain('data-testid="dispatch-report-share"');
    expect(page).toContain('data-testid="dispatch-report-whatsapp"');
    expect(page).toContain("await navigator.share({ files: [file], text });");
    expect(page).toContain('window.open(waznChatUrl(text), "_blank", "noopener")');
    // ...and as a PDF (owner, 2026-10-26).
    expect(page).toContain('onClick={() => void send("whatsapp", "pdf")}');
    expect(page).toContain("jpegDataUrlToPdfFile(url, img.naturalWidth, img.naturalHeight");
    expect(root("client/src/pages/Settings.tsx")).toContain("<WecomRobotCard />");
  });
});

describe("the page keeps what was checked (owner, 2026-10-26)", () => {
  it("with no batch chosen it shows every check as cards, each with its report", () => {
    const page = root("client/src/pages/DispatchCheck.tsx");
    expect(page).toContain("{!batchId ? <DispatchHistory onOpen={(id) => setBatchId(id)} /> : !s ? (");
    expect(page).toContain('data-testid="dispatch-back-to-list"');
    const cards = root("client/src/components/dispatch/DispatchHistory.tsx");
    expect(cards).toContain("trpc.dispatch.history.useQuery()");
    expect(cards).toContain("href={`/dispatch-check/${r.batchId}/report`}");
    expect(root("server/routers/dispatch.router.ts")).toContain("history: staffProcedure.query(async () => db.getDispatchHistory())");
  });
});

describe("only batches made in China (owner, 2026-10-26)", () => {
  it("the page offers them and the server refuses any other", () => {
    expect(root("client/src/pages/DispatchCheck.tsx")).toContain("trpc.dispatch.batches.useQuery()");
    const db = root("server/db/dispatch.db.ts");
    const open = db.slice(db.indexOf("export async function openCarton"));
    expect(open.indexOf("if (!(await isChinaBatch(batch)))")).toBeGreaterThan(-1);
    expect(open.indexOf("if (!(await isChinaBatch(batch)))")).toBeLessThan(open.indexOf("insert(batchCartons)"));
    expect(db).toContain('inArray(batches.createdInCountryId, ids), inArray(batches.status, ["preparing", "in_transit"])');
  });
});
