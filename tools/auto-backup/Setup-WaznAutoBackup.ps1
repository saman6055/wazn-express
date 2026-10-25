# Wazn Express - connect this computer to the daily backup.
#
# 1. Makes this computer's own key (it never leaves this computer).
# 2. Sends the server only the key's fingerprint and shows a 6-digit code.
#    The same code appears on the Backups page; press «بیبەستەوە» there.
# 3. Keeps the key encrypted to this Windows user, adds a daily task to
#    Windows Task Scheduler, and takes the first backup now.
#
# Run again any time to connect again (the old connection then stops working).

param(
    [string]$ServerUrl = "",
    [string]$Folder = "",
    [string]$Time = "",
    [string]$TaskName = "Wazn Daily Backup",
    [switch]$NoTask,
    [int]$WaitMinutes = 15
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$here = $PSScriptRoot
$configPath = Join-Path $here "config.json"

if (Test-Path $configPath) {
    $config = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
} else {
    $config = [pscustomobject]@{ serverUrl = "https://admin.waznexpress.com"; folder = "D:\Wazn-Backups"; keepDays = 30; maxFolderGB = 30; time = "23:00" }
}
# One copy a day for 30 days, the folder never past 30 GB (owner, 2026-10-25).
if (-not $config.PSObject.Properties["keepDays"]) { $config | Add-Member -NotePropertyName keepDays -NotePropertyValue 30 }
if (-not $config.PSObject.Properties["maxFolderGB"]) { $config | Add-Member -NotePropertyName maxFolderGB -NotePropertyValue 30 }
if ($config.PSObject.Properties["keep"]) { $config.PSObject.Properties.Remove("keep") }
if ($ServerUrl) { $config.serverUrl = $ServerUrl }
if ($Folder) { $config.folder = $Folder }
if ($Time) { $config.time = $Time }
$server = ([string]$config.serverUrl).TrimEnd("/")

Write-Host ""
Write-Host "  Wazn Express - بەکاپی خۆکاری ڕۆژانە"
Write-Host "  ------------------------------------"
Write-Host "  فۆڵدەر: $($config.folder)"
Write-Host "  کات: هەموو ڕۆژێک $($config.time) (ئەگەر کۆمپیوتەر کوژاوە بوو، کە هەڵکرا)"
Write-Host "  دەهێڵرێتەوە: یەک کۆپی بۆ هەر ڕۆژێک، $($config.keepDays) ڕۆژ، فۆڵدەرەکە لە $($config.maxFolderGB) GB تێناپەڕێت"
Write-Host ""

# 1. This computer's own key.
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$key = "wbk_" + ([Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_"))
$sha = [System.Security.Cryptography.SHA256]::Create()
$fingerprint = -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($key)) | ForEach-Object { $_.ToString("x2") })

# 2. Ask to be connected.
try {
    $body = @{ fingerprint = $fingerprint; computer = $env:COMPUTERNAME } | ConvertTo-Json
    $pair = Invoke-RestMethod -Method Post -Uri "$server/api/auto-backup/pair" -ContentType "application/json" -Body $body -UseBasicParsing -TimeoutSec 60
} catch {
    $status = 0
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    if ($status -eq 404) {
        Write-Host "  سێرڤەر هێشتا نوێ نەکراوەتەوە. لە Coolify ـەوە Redeploy بکە، پاشان دووبارە ئەم پەنجەرەیە بکەرەوە." -ForegroundColor Red
    } else {
        Write-Host "  سێرڤەر وەڵامی نەدایەوە: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  ئینتەرنێت بپشکنە و دووبارە هەوڵ بدەرەوە."
    }
    exit 1
}
$code = [string]$pair.code
Write-Host "  لە سیستەم بچۆ «بەڕێوەبردنی بەکاپ». ئەم کۆدە دەبینیت:"
Write-Host ""
Write-Host ("        {0} {1}" -f $code.Substring(0, 3), $code.Substring(3)) -ForegroundColor Yellow
Write-Host ""
Write-Host "  ئەگەر هەمان کۆد بوو، «بیبەستەوە» دابگرە. چاوەڕێ دەکەم..."
Write-Output "PAIR-CODE $code"

# 3. Wait until the main admin says yes.
$headers = @{ Authorization = "Bearer $key" }
$deadline = (Get-Date).AddMinutes($WaitMinutes)
$connected = $false
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 3
    try {
        $check = Invoke-RestMethod -Uri "$server/api/auto-backup/check" -Headers $headers -UseBasicParsing -TimeoutSec 30
        if ($check.ok) { $connected = $true; break }
    } catch {
        # 401 until it is approved; anything else is worth another try too.
    }
}
if (-not $connected) {
    Write-Host "  کەس نەیبەستەوە لە $WaitMinutes خولەکدا. دووبارە ئەم پەنجەرەیە بکەرەوە." -ForegroundColor Red
    exit 1
}

ConvertTo-SecureString $key -AsPlainText -Force | ConvertFrom-SecureString | Set-Content (Join-Path $here "key.dat")
$key = $null
$config | ConvertTo-Json | Set-Content $configPath -Encoding UTF8
if (-not (Test-Path $config.folder)) { New-Item -ItemType Directory -Path $config.folder | Out-Null }
Write-Host "  بەسترایەوە. کلیلەکە تەنها لەسەر ئەم کۆمپیوتەرە و بۆ ئەم بەکارهێنەرەی ویندۆز دەمێنێتەوە." -ForegroundColor Green
Write-Output "PAIR-CONNECTED"

# 4. The daily task, and the first backup now.
if (-not $NoTask) {
    $script = Join-Path $here "WaznAutoBackup.ps1"
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
    $trigger = New-ScheduledTaskTrigger -Daily -At $config.time
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 4) -MultipleInstances IgnoreNew
    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Wazn Express: complete daily backup to $($config.folder); one copy a day for $($config.keepDays) days, at most $($config.maxFolderGB) GB, older ones removed only after the new one arrives whole." -Force | Out-Null
    Write-Host "  کاری ڕۆژانە زیاد کرا: $TaskName" -ForegroundColor Green
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "  یەکەم بەکاپ ئێستا دەستی پێکرد. چەند خولەکێکی پێدەچێت؛ فایلەکە لە $($config.folder) دەردەکەوێت."
}
Write-Host ""
