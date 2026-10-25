import { describe, expect, it } from "vitest";
import { uploadBackupZip } from "./backupUpload";

/**
 * The upload talks to a fake server that behaves like the real one: it keeps
 * the bytes it has, answers a piece at the wrong offset with 409 and its
 * size, and can drop the connection once.
 */
function fakeServer(opts: { dropOnce?: boolean; chunkSize?: number } = {}) {
  let stored = new Uint8Array(0);
  let dropped = false;
  const calls: string[] = [];
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  const fetch = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push(`${init?.method} ${url}`);
    if (url.endsWith("/start")) return json(200, { id: 7, chunkSize: opts.chunkSize ?? 4 });
    if (url.includes("/chunk")) {
      const offset = Number(new URL(url, "http://x").searchParams.get("offset"));
      if (opts.dropOnce && !dropped && offset > 0) {
        // The piece arrives, but the answer is lost.
        const bytes = new Uint8Array(await (init!.body as Blob).arrayBuffer());
        const next = new Uint8Array(stored.length + bytes.length);
        next.set(stored);
        next.set(bytes, stored.length);
        stored = next;
        dropped = true;
        throw new TypeError("network down");
      }
      if (offset !== stored.length) return json(409, { error: "offset", size: stored.length });
      const bytes = new Uint8Array(await (init!.body as Blob).arrayBuffer());
      const next = new Uint8Array(stored.length + bytes.length);
      next.set(stored);
      next.set(bytes, stored.length);
      stored = next;
      return json(200, { size: stored.length });
    }
    if (url.endsWith("/finish")) return json(200, { id: 7, createdAt: "2026-10-25", tables: 113, rows: 9, files: 3 });
    return json(404, { error: "no" });
  };
  return { fetch, calls, stored: () => stored };
}

const file = (text: string) => Object.assign(new Blob([text]), { name: "wazn.zip" });

describe("sending a backup to the server", () => {
  it("sends every byte, in order, in pieces, and reports progress to the end", async () => {
    const server = fakeServer();
    const seen: number[] = [];
    const result = await uploadBackupZip(file("0123456789"), (s) => seen.push(s), { fetch: server.fetch });
    expect(new TextDecoder().decode(server.stored())).toBe("0123456789");
    expect(server.calls.filter((c) => c.includes("/chunk"))).toHaveLength(3);
    expect(seen.at(-1)).toBe(10);
    expect(result.tables).toBe(113);
  });

  it("carries on from where the server stands after a lost answer, without sending a byte twice", async () => {
    const server = fakeServer({ dropOnce: true });
    await uploadBackupZip(file("abcdefghijkl"), () => undefined, { fetch: server.fetch, pause: async () => undefined });
    expect(new TextDecoder().decode(server.stored())).toBe("abcdefghijkl");
  });

  it("says the server's own reason when it refuses", async () => {
    const refusing = async () => new Response(JSON.stringify({ error: "تەنها ئادمینی سەرەکی" }), { status: 403 });
    await expect(uploadBackupZip(file("x"), () => undefined, { fetch: refusing })).rejects.toThrow("تەنها ئادمینی سەرەکی");
  });
});
