Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  StatsBomb Dashboard - Inicio" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check Python
$python = "C:\Users\Usuario\AppData\Local\Programs\Python\Python312\python.exe"
if (-not (Test-Path $python)) {
    $python = (Get-Command python -ErrorAction SilentlyContinue).Source
    if (-not $python) {
        Write-Host "ERROR: Python no encontrado" -ForegroundColor Red
        exit 1
    }
}
Write-Host "Python: $python" -ForegroundColor Green

# Install backend deps
Write-Host "`nInstalando dependencias del backend..." -ForegroundColor Yellow
& $python -m pip install -q dashboard/backend/requirements.txt

# Start backend
Write-Host "Iniciando backend (puerto 8000)..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    param($py, $dir)
    Set-Location $dir
    & $py -m uvicorn dashboard.backend.main:app --host 0.0.0.0 --port 8000 --reload
} -ArgumentList $python, (Get-Location)

Start-Sleep 4

$health = Invoke-RestMethod -Uri "http://localhost:8000/api/health" -ErrorAction SilentlyContinue
if ($health.status -eq "ok") {
    Write-Host "Backend OK!" -ForegroundColor Green
} else {
    Write-Host "ERROR: Backend no responde" -ForegroundColor Red
    exit 1
}

# Start frontend
Write-Host "`nIniciando frontend (puerto 5173)..." -ForegroundColor Yellow
$frontendDir = Join-Path (Get-Location) "dashboard/frontend"
$frontendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    npx vite --host 0.0.0.0 --port 5173
} -ArgumentList $frontendDir

Start-Sleep 5

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  Dashboard listo!" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor Green
Write-Host "  Docs API: http://localhost:8000/docs" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Presiona Ctrl+C para detener los servidores"
Write-Host ""

# Keep script running
try {
    while ($true) { Start-Sleep 1 }
} finally {
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -ErrorAction SilentlyContinue
    Write-Host "Servidores detenidos." -ForegroundColor Yellow
}
