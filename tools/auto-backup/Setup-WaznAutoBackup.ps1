# Wazn Express - set up the daily backup on this computer.
#
# 1. Asks for the key made on the Backups page (Backups -> daily backup -> make key).
# 2. Checks the key with the server, and keeps it encrypted to this Windows user.
# 3. Adds a daily task to Windows Task Scheduler and takes the first backup now.
#
# Run again any time to put in a new key or change the time.

param(
    [string]$ServerUrl = "",
    [string]$Folder = "",
    [string]$Time = "",
    [string]$TaskName = "Wazn Daily Backup",
    [switch]$NoTask,
    [string]$KeyText = ""
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$here = $PSScriptRoot
$configPath = Join-Path $here "config.json"

if (Test-Path $configPath) {
    $config = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
} else {
    $config = [pscustomobject]@{ serverUrl = "https://admin.waznexpress.com"; folder = "D:\Wazn-Backups"; keep = 1; time = "23:00" }
}
if ($ServerUrl) { $config.serverUrl = $ServerUrl }
if ($Folder) { $config.folder = $Folder }
if ($Time) { $config.time = $Time }

Write-Host ""
Write-Host "  Wazn Express - بەکاپی خۆکاری ڕۆژانە"
Write-Host "  ------------------------------------"
Write-Host "  فۆڵدەر: $($config.folder)"
Write-Host "  کات: هەموو ڕۆژێک $($config.time) (ئەگەر کۆمپیوتەر کوژاوە بوو، کە هەڵکرا)"
Write-Host ""

# 1. The key.
if ($KeyText) {
    $plain = $KeyText.Trim()
} else {
    $secure = Read-Host "  کلیلەکە لێرە بلکێنە (Ctrl+V) و Enter دابگرە" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $plain = ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)).Trim() }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
if ($plain -notmatch '^wbk_[A-Za-z0-9_-]{40,60}$') {
    Write-Host "  ئەمە کلیلی بەکاپ نییە. لە لاپەڕەی «بەڕێوەبردنی بەکاپ» کلیلەکە کۆپی بکە و دووبارە هەوڵ بدەرەوە." -ForegroundColor Red
    exit 1
}

# 2. Does the server know it?
try {
    $check = Invoke-RestMethod -Uri "$($config.serverUrl.TrimEnd('/'))/api/auto-backup/check" -Headers @{ Authorization = "Bearer $plain" } -UseBasicParsing -TimeoutSec 60
    if (-not $check.ok) { throw "unexpected answer" }
} catch {
    $status = 0
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    if ($status -eq 401) {
        Write-Host "  سێرڤەر ئەم کلیلە ناناسێت (لەوانەیە کلیلێکی نوێتر دروست کرابێت). کلیلی تازە کۆپی بکە و دووبارە هەوڵ بدەرەوە." -ForegroundColor Red
    } elseif ($status -eq 404) {
        Write-Host "  سێرڤەر هێشتا نوێ نەکراوەتەوە. لە Coolify ـەوە Redeploy بکە، پاشان دووبارە ئەم پەنجەرەیە بکەرەوە." -ForegroundColor Red
    } else {
        Write-Host "  سێرڤەر وەڵامی نەدایەوە: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  ئینتەرنێت بپشکنە و دووبارە هەوڵ بدەرەوە."
    }
    exit 1
}

ConvertTo-SecureString $plain -AsPlainText -Force | ConvertFrom-SecureString | Set-Content (Join-Path $here "key.dat")
$plain = $null
$config | ConvertTo-Json | Set-Content $configPath -Encoding UTF8
if (-not (Test-Path $config.folder)) { New-Item -ItemType Directory -Path $config.folder | Out-Null }
Write-Host "  کلیلەکە پاشەکەوت کرا (تەنها بۆ ئەم بەکارهێنەرەی ویندۆز دەکرێتەوە)." -ForegroundColor Green

# 3. The daily task.
if (-not $NoTask) {
    $script = Join-Path $here "WaznAutoBackup.ps1"
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
    $trigger = New-ScheduledTaskTrigger -Daily -At $config.time
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 4) -MultipleInstances IgnoreNew
    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Wazn Express: complete daily backup to $($config.folder); keeps the newest only after it arrives whole." -Force | Out-Null
    Write-Host "  کاری ڕۆژانە زیاد کرا: $TaskName" -ForegroundColor Green
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "  یەکەم بەکاپ ئێستا دەستی پێکرد. چەند خولەکێکی پێدەچێت؛ فایلەکە لە $($config.folder) دەردەکەوێت."
}
Write-Host ""
