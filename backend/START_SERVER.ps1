# Skrypt do uruchomienia serwera FastAPI
# Użycie: .\START_SERVER.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Uruchamianie serwera ShiftAI API" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ustaw zmienną środowiskową
$env:DATABASE_URL='postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai'
Write-Host "[OK] DATABASE_URL ustawione" -ForegroundColor Green

# Aktywuj środowisko wirtualne
Write-Host "[OK] Aktywowanie venv..." -ForegroundColor Green
.\venv\Scripts\Activate.ps1

# Sprawdź czy asyncpg jest zainstalowany
Write-Host "[OK] Sprawdzanie zależności..." -ForegroundColor Green
$asyncpg = python -c "import asyncpg; print('OK')" 2>$null
if (-not $asyncpg) {
    Write-Host "[INFO] Instalowanie asyncpg..." -ForegroundColor Yellow
    pip install asyncpg -q
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Serwer będzie dostępny na:" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  API Docs:    http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "  Health:      http://localhost:8000/api/v1/health" -ForegroundColor Yellow
Write-Host "  DB Check:    http://localhost:8000/api/v1/health/db" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Naciśnij CTRL+C aby zatrzymać serwer" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Uruchom serwer
uvicorn main:app --reload --host 127.0.0.1 --port 8000

