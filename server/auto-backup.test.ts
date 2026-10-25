import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  cleanComputerName,
  fingerprint,
  isFingerprint,
  keyFromHeader,
  keyHint,
  keyMatches,
  livePending,
  newAutoBackupKey,
  newPairCode,
  parseStoredKey,
} from "./lib/autoBackupKey";

/**
 * The daily backup the owner's computer takes by itself (owner, 2026-10-25:
 * «ڕۆژانە باکئەپ بکات، پاش ئەوەی هی ئەمڕۆ تەواو بوو هی دوێنێ بسڕێتەوە»).
 *
 * Proved on 2026-10-25 against the local app: the setup refused a wrong key
 * and a server not yet redeployed, Task Scheduler ran the script (result 0),
 * two runs left only the newest copy here and nothing on the server, and a
 * switched-off key failed in seconds with yesterday's copy still in place.
 */
const read = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

describe("the backup key", () => {
  it("is long, random and recognisable", () => {
    const a = newAutoBackupKey();
    const b = newAutoBackupKey();
    expect(a).toMatch(/^wbk_[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
    expect(keyHint(a)).toBe(`${a.slice(0, 8)}…`);
  });

  it("is read only from an Authorization: Bearer header of its own shape", () => {
    const k = newAutoBackupKey();
    expect(keyFromHeader(`Bearer ${k}`)).toBe(k);
    expect(keyFromHeader(`bearer   ${k}  `)).toBe(k);
    expect(keyFromHeader(k)).toBeNull();
    expect(keyFromHeader("Bearer eyJhbGciOi.session.token")).toBeNull();
    expect(keyFromHeader(undefined)).toBeNull();
  });

  it("matches only its own fingerprint, and nothing when switched off", () => {
    const k = newAutoBackupKey();
    const stored = { hash: fingerprint(k), hint: keyHint(k), createdAt: "", createdById: 1 };
    expect(keyMatches(k, stored)).toBe(true);
    expect(keyMatches(newAutoBackupKey(), stored)).toBe(false);
    expect(keyMatches(k, null)).toBe(false);
    expect(keyMatches(k, parseStoredKey(""))).toBe(false);
    expect(keyMatches(k, { ...stored, hash: "not-hex" })).toBe(false);
  });
});

describe("what the key may do", () => {
  const routes = read("server/_core/autoBackupRoute.ts");

  it("every address asks for the key first", () => {
    for (const p of ['"/api/auto-backup/check"', '"/api/auto-backup/start"', '"/api/auto-backup/:id"', '"/api/auto-backup/:id/file"']) {
      const at = routes.indexOf(p);
      expect(at, p).toBeGreaterThan(-1);
      expect(routes.slice(at, at + 200), p).toContain("await keyHolder(req, res)");
    }
    expect(routes).toContain('app.delete("/api/auto-backup/:id", async (req, res) => {\n    const stored = await keyHolder(req, res);');
  });

  it("only ever touches backups the key itself made", () => {
    expect(routes).toContain("!row.fileKey.startsWith(AUTO_KEY_PREFIX)");
    expect((routes.match(/await ownBackup\(req, res\)/g) ?? []).length).toBe(3);
    expect(routes).toContain("automatic: true");
  });

  it("is registered from the one place both server entries call", () => {
    expect(read("server/_core/backupFileRoute.ts")).toContain("registerAutoBackupRoutes(app);");
  });

  it("is connected and cut off by the main admin alone, and the page never sees a key", () => {
    const router = read("server/routers/admin.router.ts");
    expect(router).toMatch(/autoBackup: superAdminProcedure/);
    expect(router).toMatch(/approveAutoBackupComputer: superAdminProcedure/);
    expect(router).toMatch(/rejectAutoBackupComputer: superAdminProcedure/);
    expect(router).toMatch(/revokeAutoBackupKey: superAdminProcedure/);
    // No procedure makes or returns a key any more: the computer makes its own.
    expect(router).not.toContain("createAutoBackupKey");
    expect(router).not.toContain("newAutoBackupKey(");
    const end = router.indexOf("Connect the computer that is showing this code");
    expect(end).toBeGreaterThan(-1);
    const status = router.slice(router.indexOf("autoBackup: superAdminProcedure"), end);
    expect(status).not.toMatch(/\bkey:/);
    expect(status).not.toContain("fingerprint");
    expect(status).not.toContain("hash");
  });
});

describe("connecting a computer without anybody copying a key", () => {
  // Owner, 2026-10-25: «لەوانە هیچ تێناگەم» — no key is copied or shown.
  const routes = read("server/_core/autoBackupRoute.ts");
  const router = read("server/routers/admin.router.ts");
  const setup = read("tools/auto-backup/Setup-WaznAutoBackup.ps1");

  it("the computer sends only a fingerprint, at a person's pace", () => {
    expect(routes).toContain('app.post("/api/auto-backup/pair", pairLimiter,');
    expect(routes).toContain("if (!isFingerprint(body.fingerprint))");
    expect(setup).toContain("$body = @{ fingerprint = $fingerprint; computer = $env:COMPUTERNAME }");
    expect(setup).not.toMatch(/Read-Host/);
  });

  it("the approval must name the very code that is waiting, inside its 15 minutes", () => {
    expect(router).toContain("if (!pending || pending.code !== input.code)");
    expect(router).toContain("livePending(await db.getSetting(AUTO_BACKUP_PENDING_SETTING))");
  });

  it("codes run out, and a fingerprint is exactly 64 hex characters", () => {
    const now = new Date("2026-10-25T10:00:00Z");
    const p = (minutesAgo: number) =>
      JSON.stringify({ fingerprint: "a".repeat(64), code: "123456", computer: "PC", requestedAt: new Date(now.getTime() - minutesAgo * 60000).toISOString() });
    expect(livePending(p(1), now)?.code).toBe("123456");
    expect(livePending(p(16), now)).toBeNull();
    expect(livePending("", now)).toBeNull();
    expect(isFingerprint("a".repeat(64))).toBe(true);
    expect(isFingerprint("A".repeat(64))).toBe(false);
    expect(isFingerprint("a".repeat(63))).toBe(false);
    expect(newPairCode()).toMatch(/^\d{6}$/);
    expect(cleanComputerName("XOGR<script>")).toBe("XOGRscript");
  });
});

describe("the script on the computer", () => {
  const script = read("tools/auto-backup/WaznAutoBackup.ps1");

  it("deletes an older copy only after the new one is whole", () => {
    const room = script.indexOf("if ($free -lt $need)");
    const verify = script.indexOf("Test-BackupZip $part");
    const sizeCheck = script.indexOf("-ne [int64]$state.fileSize");
    const move = script.indexOf("Move-Item $part $final");
    const deleteOld = script.indexOf("$cutoff = (Get-Date).AddDays(-$keepDays)");
    expect(room).toBeGreaterThan(-1);
    expect(sizeCheck).toBeGreaterThan(room);
    expect(verify).toBeGreaterThan(sizeCheck);
    expect(move).toBeGreaterThan(verify);
    expect(deleteOld).toBeGreaterThan(move);
  });

  it("keeps one copy a day for 30 days within 30 GB, and never the copy that just arrived", () => {
    // Owner, 2026-10-25: «ئەگەر زۆر جێگا ناگرێت، 7 ڕۆژ یان 1 مانگ بمێنێتەوە».
    expect(script).toContain("$keepDays = 30");
    expect(script).toContain("$maxBytes = 30GB");
    expect(script).toContain("if (-not $isNewest -and ($daysSeen.ContainsKey($day) -or $f.LastWriteTime -lt $cutoff))");
    expect(script).toContain("while ($kept.Count -gt 1 -and $total -gt $maxBytes)");
    const setup = read("tools/auto-backup/Setup-WaznAutoBackup.ps1");
    expect(setup).toContain("keepDays = 30; maxFolderGB = 30");
  });

  it("makes the same fingerprint the server makes", () => {
    const setup = read("tools/auto-backup/Setup-WaznAutoBackup.ps1");
    // sha256 of the key's UTF-8 bytes, lower-case hex — fingerprint() in autoBackupKey.ts.
    expect(setup).toContain("$sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($key))");
    expect(setup).toContain('$_.ToString("x2")');
  });

  it("keeps the key encrypted to the Windows user, and the key file out of git", () => {
    expect(read("tools/auto-backup/Setup-WaznAutoBackup.ps1")).toContain("ConvertFrom-SecureString | Set-Content (Join-Path $here \"key.dat\")");
    expect(read("tools/auto-backup/.gitignore")).toContain("key.dat");
  });

  it("is saved with a byte-order mark, or Windows PowerShell misreads the Kurdish in it", () => {
    for (const f of ["WaznAutoBackup.ps1", "Setup-WaznAutoBackup.ps1"]) {
      const bytes = fs.readFileSync(path.join(__dirname, "..", "tools/auto-backup", f));
      expect([bytes[0], bytes[1], bytes[2]], f).toEqual([0xef, 0xbb, 0xbf]);
    }
  });
});
