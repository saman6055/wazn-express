# Stop Wazn Express server (port 3000 and 3001)
$ports = @(3000, 3001)

foreach ($port in $ports) {
    $connections = netstat -ano | Select-String ":$port\s"
    $pids = @()
    
    foreach ($line in $connections) {
        if ($line -match '\s+(\d+)\s*$') {
            $pid = [int]$Matches[1]
            if ($pid -gt 0 -and $pids -notcontains $pid) {
                $pids += $pid
            }
        }
    }
    
    foreach ($pid in $pids) {
        try {
            $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($proc -and $proc.ProcessName -eq "node") {
                Stop-Process -Id $pid -Force
                Write-Host "Stopped Node process (PID: $pid) on port $port" -ForegroundColor Green
            }
        }
        catch {
            Write-Host "Could not stop PID $pid : $_" -ForegroundColor Yellow
        }
    }
}

Write-Host "Done." -ForegroundColor Cyan
