import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fingerprint, keyFromHeader, keyHint, keyMatches, newAutoBackupKey, parseStoredKey } from "./lib/autoBackupKey";

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

  it("is made, shown and switched off by the main admin alone; the page never sees it again", () => {
    const router = read("server/routers/admin.router.ts");
    expect(router).toMatch(/autoBackup: superAdminProcedure/);
    expect(router).toMatch(/createAutoBackupKey: superAdminProcedure/);
    expect(router).toMatch(/revokeAutoBackupKey: superAdminProcedure/);
    const status = router.slice(router.indexOf("autoBackup: superAdminProcedure"), router.indexOf("createAutoBackupKey:"));
    expect(status).not.toMatch(/\bkey:/);
    expect(status).not.toContain("hash");
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
