/**
 * Fetching a file whose address somebody else wrote.
 *
 * The backup collects files by the links stored on records, and some of those
 * links were typed by a customer (a message's attachment). A plain fetch
 * would wait for ever on an address that never answers — and stop the daily
 * backup with it — follow a redirect into the server's own network, and read
 * a file of any size into memory. This one gives up after a timeout, refuses
 * redirects, and stops at a size ceiling (security audit, 2026-11-05).
 */

/** Large enough for any photo or PDF the system stores; small enough to never sink the server. */
export const MAX_FETCHED_FILE_BYTES = 30 * 1024 * 1024;
export const FETCH_TIMEOUT_MS = 30_000;

export async function boundedFetch(
  url: string,
  options: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<Buffer> {
  const maxBytes = options.maxBytes ?? MAX_FETCHED_FILE_BYTES;
  const res = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(options.timeoutMs ?? FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new Error(`file too large (${declared} bytes)`);
  if (!res.body) return Buffer.alloc(0);

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error(`file too large (over ${maxBytes} bytes)`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
