# Start Wazn Express dev server
Set-Location $PSScriptRoot

Write-Host "Starting Wazn Express server..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

pnpm run dev
