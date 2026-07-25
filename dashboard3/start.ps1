# Dashboard 3 — StatsBomb Scout Analytics
# Backend: http://localhost:8001  (compartido con dashboard2)
# Frontend: http://localhost:3002

$backendPath = "$PSScriptRoot\..\dashboard2\backend"
$frontendPath = "$PSScriptRoot\frontend"

Write-Host "Iniciando Dashboard 3 — StatsBomb Scout Analytics" -ForegroundColor Green
Write-Host ""

# Check if backend already running
$backendUp = try { (Invoke-WebRequest -Uri "http://localhost:8001/api/health" -TimeoutSec 2 -ErrorAction Stop).StatusCode -eq 200 } catch { $false }

if (-not $backendUp) {
    Write-Host "Iniciando backend (puerto 8001)..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload" -WindowStyle Normal
    Start-Sleep 3
} else {
    Write-Host "Backend ya activo en puerto 8001" -ForegroundColor Yellow
}

Write-Host "Iniciando frontend dashboard3 (puerto 3002)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev" -WindowStyle Normal
Start-Sleep 3

Write-Host ""
Write-Host "Dashboard disponible en: http://localhost:3002" -ForegroundColor Green
Start-Process "http://localhost:3002"
