# Wazn Express - the daily backup, run by Windows Task Scheduler.
#
# Asks the server for a complete backup (every table, every photo), waits for
# it, downloads it into the backup folder, checks the file is whole, and only
# then deletes the older copies - on this computer and on the server.
# A backup that did not arrive whole never replaces yesterday's.
#
# Settings: config.json beside this file. Key: key.dat, encrypted to this
# Windows user (made by Setup-WaznAutoBackup.ps1). Log: auto-backup.log.

param([string]$ConfigPath = (Join-Path $PSScriptRoot "config.json"))

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.IO.Compression.FileSystem

$LogPath = Join-Path $PSScriptRoot "auto-backup.log"

function Write-Log([string]$Message) {
    $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Add-Content -Path $LogPath -Value $line -Encoding UTF8
    Write-Host $line
}

function Trim-Log {
    if (Test-Path $LogPath) {
        $lines = Get-Content $LogPath -Encoding UTF8
        if ($lines.Count -gt 1000) { $lines | Select-Object -Last 500 | Set-Content $LogPath -Encoding UTF8 }
    }
}

function Read-Key([string]$Folder) {
    $keyFile = Join-Path $Folder "key.dat"
    if (-not (Test-Path $keyFile)) { throw "No key yet. Open 'Wazn - auto backup' on the desktop and paste the key from the Backups page." }
    $secure = Get-Content $keyFile | ConvertTo-SecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function Invoke-Api([string]$Method, [string]$Path, [hashtable]$Headers) {
    $uri = "$($script:Server)$Path"
    try {
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $Headers -UseBasicParsing -TimeoutSec 120
    } catch {
        $detail = ""
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $detail = $_.ErrorDetails.Message }
        throw "$Method $Path failed: $($_.Exception.Message) $detail"
    }
}

function Test-BackupZip([string]$File) {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($File)
    try {
        $entry = $zip.GetEntry("manifest.json")
        if (-not $entry) { return $false }
        $reader = New-Object System.IO.StreamReader($entry.Open(), [Text.Encoding]::UTF8)
        try { $manifest = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
        if ($manifest.format -ne "wazn-complete-backup") { return $false }
        foreach ($t in $manifest.database.tables) {
            if (-not $zip.GetEntry("db/$($t.name).rows.sql")) { return $false }
        }
        return $true
    } finally {
        $zip.Dispose()
    }
}

try {
    Trim-Log
    $config = Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $script:Server = ([string]$config.serverUrl).TrimEnd("/")
    $folder = [string]$config.folder
    # How long a copy stays, and the most the folder may hold (owner, 2026-10-25:
    # «ئەگەر زۆر جێگا ناگرێت، 7 ڕۆژ یان 1 مانگ بمێنێتەوە»). Whichever is reached first.
    $keepDays = 30
    if ($config.PSObject.Properties["keepDays"] -and [int]$config.keepDays -ge 1) { $keepDays = [int]$config.keepDays }
    $maxBytes = 30GB
    if ($config.PSObject.Properties["maxFolderGB"] -and [double]$config.maxFolderGB -gt 0) { $maxBytes = [int64]([double]$config.maxFolderGB * 1GB) }
    if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Path $folder | Out-Null }

    $key = Read-Key $PSScriptRoot
    $headers = @{ Authorization = "Bearer $key" }

    Write-Log "Starting a complete backup on $($script:Server)"

    # 1. Start it. If another backup or a restore is running, try again a few times.
    $started = $null
    for ($try = 1; $try -le 6 -and -not $started; $try++) {
        try { $started = Invoke-Api "POST" "/api/auto-backup/start" $headers }
        catch {
            # A key the server refuses will not start working by waiting.
            if ($_.Exception.Message -match "\(401\)") { throw "The server refused the key - make a new key on the Backups page and run 'Wazn - auto backup' again. $($_.Exception.Message)" }
            if ($try -eq 6) { throw }
            Write-Log "Server busy or unreachable ($($_.Exception.Message)); waiting 2 minutes"
            Start-Sleep -Seconds 120
        }
    }
    $id = $started.id

    # 2. Wait for it (a backup with every photo takes minutes).
    $deadline = (Get-Date).AddHours(3)
    do {
        Start-Sleep -Seconds 5
        $state = Invoke-Api "GET" "/api/auto-backup/$id" $headers
        if ((Get-Date) -gt $deadline) { throw "Backup $id did not finish within 3 hours" }
    } while ($state.status -eq "in_progress")
    if ($state.status -ne "completed") { throw "The server could not make backup $($id): $($state.error)" }

    # 3. Room for it? A disk filled by something else stops the backup, never the old copies.
    $free = (Get-PSDrive -Name (Split-Path -Qualifier (Resolve-Path $folder)).TrimEnd(":")).Free
    $need = [int64]$state.fileSize + 500MB
    if ($free -lt $need) {
        throw ("Not enough room on the disk: {0:N1} GB free, {1:N1} GB needed; the earlier copies were kept" -f ($free / 1GB), ($need / 1GB))
    }

    # Download it beside the others, under a temporary name.
    $stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
    $final = Join-Path $folder "Wazn-Backup-$stamp.zip"
    $part = "$final.part"
    if (Test-Path $part) { Remove-Item $part -Force }
    Invoke-WebRequest -Uri "$($script:Server)/api/auto-backup/$id/file" -Headers $headers -OutFile $part -UseBasicParsing -TimeoutSec 10800

    # 4. Whole? Same size as the server's copy, opens as a ZIP, every table in it.
    $size = (Get-Item $part).Length
    if ($state.fileSize -and $size -ne [int64]$state.fileSize) {
        Remove-Item $part -Force
        throw "Download of backup $id was incomplete ($size of $($state.fileSize) bytes); yesterday's copy kept"
    }
    if (-not (Test-BackupZip $part)) {
        Remove-Item $part -Force
        throw "Backup $id arrived but is not a complete backup; yesterday's copy kept"
    }
    Move-Item $part $final -Force
    Write-Log ("Saved {0} ({1:N1} MB)" -f $final, ($size / 1MB))

    # 5. Only now: the older copies go, here and on the server.
    #    One copy per day (the newest of that day), none older than keepDays,
    #    and the oldest go first while the folder is over its ceiling.
    #    The copy that just arrived is never deleted.
    $copies = @(Get-ChildItem -Path $folder -Filter "Wazn-Backup-*.zip" | Sort-Object LastWriteTime -Descending)
    $cutoff = (Get-Date).AddDays(-$keepDays)
    $kept = New-Object System.Collections.ArrayList
    $daysSeen = @{}
    foreach ($f in $copies) {
        $day = $f.LastWriteTime.ToString("yyyy-MM-dd")
        $isNewest = ($f.FullName -eq (Get-Item $final).FullName)
        if (-not $isNewest -and ($daysSeen.ContainsKey($day) -or $f.LastWriteTime -lt $cutoff)) {
            Remove-Item $f.FullName -Force
            Write-Log "Deleted older copy $($f.Name)"
            continue
        }
        $daysSeen[$day] = $true
        [void]$kept.Add($f)
    }
    $total = ($kept | Measure-Object -Property Length -Sum).Sum
    while ($kept.Count -gt 1 -and $total -gt $maxBytes) {
        $oldest = $kept[$kept.Count - 1]
        Remove-Item $oldest.FullName -Force
        Write-Log ("Deleted {0} - the folder was over {1:N0} GB" -f $oldest.Name, ($maxBytes / 1GB))
        $total -= $oldest.Length
        $kept.RemoveAt($kept.Count - 1)
    }
    Write-Log ("Keeping {0} copies, {1:N1} GB" -f $kept.Count, ($total / 1GB))
    try {
        Invoke-Api "DELETE" "/api/auto-backup/$id" $headers | Out-Null
        Write-Log "Deleted the server's copy of backup $id"
    } catch {
        Write-Log "Could not delete the server's copy (it goes by itself after 2 days): $($_.Exception.Message)"
    }

    Write-Log "OK"
    exit 0
} catch {
    Write-Log "FAILED: $($_.Exception.Message)"
    exit 1
}
