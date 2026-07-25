# StatsBomb Dashboard 2 — Start script
# Runs backend (FastAPI) and frontend (Next.js) concurrently

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend  = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

Write-Host "Starting StatsBomb Dashboard 2..." -ForegroundColor Cyan
Write-Host ""

# ── Backend ────────────────────────────────────────────────────────────────
Write-Host "[Backend] Starting FastAPI on http://localhost:8001" -ForegroundColor Green
$backendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    py -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload 2>&1
} -ArgumentList $backend

# ── Frontend ───────────────────────────────────────────────────────────────
Write-Host "[Frontend] Starting Next.js on http://localhost:3001" -ForegroundColor Blue
$frontendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    $env:PORT = "3001"
    npm run dev -- --port 3001 2>&1
} -ArgumentList $frontend

Write-Host ""
Write-Host "Dashboard running at http://localhost:3001" -ForegroundColor Yellow
Write-Host "API running at        http://localhost:8001" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop..." -ForegroundColor Gray

try {
    while ($true) {
        # Print output from both jobs
        Receive-Job $backendJob  | ForEach-Object { Write-Host "[API] $_" -ForegroundColor DarkGreen }
        Receive-Job $frontendJob | ForEach-Object { Write-Host "[FE]  $_" -ForegroundColor DarkBlue }
        Start-Sleep -Seconds 1
    }
} finally {
    Stop-Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob, $frontendJob -Force -ErrorAction SilentlyContinue
    Write-Host "Dashboard stopped." -ForegroundColor Red
}
