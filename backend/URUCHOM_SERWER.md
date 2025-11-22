# 🚀 Jak Uruchomić Serwer - Krok po Kroku

## ⚠️ Problem: "Nie można połączyć się z serwerem zdalnym"
**Przyczyna:** Serwer FastAPI nie jest uruchomiony!

## ✅ Rozwiązanie - Krok po Kroku

### KROK 1: Otwórz PowerShell w katalogu backend
```powershell
cd D:\DynamicShiftScheduler\backend
```

### KROK 2: Ustaw zmienną środowiskową DATABASE_URL
```powershell
$env:DATABASE_URL='postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai'
```

### KROK 3: Aktywuj środowisko wirtualne
```powershell
.\venv\Scripts\Activate.ps1
```

Powinieneś zobaczyć `(venv)` na początku linii.

### KROK 4: Uruchom serwer
```powershell
uvicorn main:app --reload
```

## 📋 Pełna Komenda (Wszystko Razem)

Skopiuj i wklej to do PowerShell:

```powershell
cd D:\DynamicShiftScheduler\backend
$env:DATABASE_URL='postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai'
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload
```

## ✅ Jak Sprawdzić Czy Działa

Po uruchomieniu powinieneś zobaczyć:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

## 🌐 Teraz Otwórz w Przeglądarce

- **Health Check:** http://localhost:8000/api/v1/health
- **DB Check:** http://localhost:8000/api/v1/health/db
- **API Docs:** http://localhost:8000/docs

## ⚠️ Częste Problemy

### Problem 1: "uvicorn: command not found"
**Rozwiązanie:** Upewnij się, że venv jest aktywowany
```powershell
.\venv\Scripts\Activate.ps1
```

### Problem 2: "Database not initialized"
**Rozwiązanie:** Ustaw DATABASE_URL
```powershell
$env:DATABASE_URL='postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai'
```

### Problem 3: "Connection refused" (baza danych)
**Rozwiązanie:** Sprawdź czy PostgreSQL działa
- Otwórz pgAdmin4
- Sprawdź czy serwer jest połączony
- Sprawdź czy baza "shiftai" istnieje

### Problem 4: Port 8000 zajęty
**Rozwiązanie:** Użyj innego portu
```powershell
uvicorn main:app --reload --port 8001
```

## 🛑 Jak Zatrzymać Serwer

Naciśnij: `CTRL + C` w terminalu

## 💡 Wskazówka

Zostaw terminal z serwerem otwarty! Serwer musi działać, żeby API odpowiadało.

