/**
 * Sending a backup ZIP from this computer to the server, a piece at a time.
 *
 * A complete backup holds every photo and can be gigabytes. One request that
 * big is cut off by the proxy or a slow connection long before it ends, and
 * then nothing has arrived. In pieces, a dropped connection costs one piece:
 * the server says how much it already has, and the upload carries on from
 * there (server/_core/backupFileRoute.ts).
 */

export interface UploadedBackup {
  id: number;
  createdAt: string;
  tables: number;
  rows: number;
  files: number;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

async function errorOf(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return typeof body?.error === "string" ? body.error : `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function uploadBackupZip(
  file: Blob & { name?: string },
  onProgress: (sentBytes: number, totalBytes: number) => void,
  options: { fetch?: Fetch; retries?: number; pause?: (ms: number) => Promise<void> } = {},
): Promise<UploadedBackup> {
  const doFetch: Fetch = options.fetch ?? ((u, i) => fetch(u, { credentials: "include", ...i }));
  const retries = options.retries ?? 5;
  const pause = options.pause ?? ((ms) => new Promise((r) => setTimeout(r, ms)));

  const startRes = await doFetch("/api/backup-upload/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: file.name ?? "backup.zip", size: file.size }),
  });
  if (!startRes.ok) throw new Error(await errorOf(startRes));
  const { id, chunkSize } = (await startRes.json()) as { id: number; chunkSize: number };

  let offset = 0;
  let failures = 0;
  onProgress(0, file.size);
  while (offset < file.size) {
    const piece = file.slice(offset, Math.min(offset + chunkSize, file.size));
    let res: Response;
    try {
      res = await doFetch(`/api/backup-upload/${id}/chunk?offset=${offset}`, {
        method: "PUT",
        headers: { "content-type": "application/octet-stream" },
        body: piece,
      });
    } catch (err) {
      // The connection dropped: wait, then ask again — the server will say where it stands.
      if (++failures > retries) throw err instanceof Error ? err : new Error(String(err));
      await pause(1000 * failures);
      continue;
    }
    if (res.status === 409) {
      const body = (await res.json().catch(() => ({}))) as { size?: number };
      if (typeof body.size !== "number") throw new Error(await errorOf(res));
      offset = body.size;
      onProgress(offset, file.size);
      continue;
    }
    if (!res.ok) {
      if (res.status >= 500 && ++failures <= retries) {
        await pause(1000 * failures);
        continue;
      }
      throw new Error(await errorOf(res));
    }
    failures = 0;
    offset = ((await res.json()) as { size: number }).size;
    onProgress(offset, file.size);
  }

  const finish = await doFetch(`/api/backup-upload/${id}/finish`, { method: "POST" });
  if (!finish.ok) throw new Error(await errorOf(finish));
  return (await finish.json()) as UploadedBackup;
}
