# 🔍 Sprawdzanie Połączenia z Bazą Danych

## Problem: "Nie można połączyć się z serwerem zdalnym"

To oznacza, że **serwer FastAPI nie jest uruchomiony**!

## ✅ Rozwiązanie - Uruchom Serwer

### Sposób 1: Użyj Skryptu (NAJŁATWIEJSZE)
```powershell
cd D:\DynamicShiftScheduler\backend
.\START_SERVER.ps1
```

### Sposób 2: Ręcznie (Krok po Kroku)

**KROK 1:** Otwórz PowerShell w katalogu backend
```powershell
cd D:\DynamicShiftScheduler\backend
```

**KROK 2:** Ustaw zmienną środowiskową
```powershell
$env:DATABASE_URL='postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai'
```

**KROK 3:** Aktywuj venv
```powershell
.\venv\Scripts\Activate.ps1
```

Powinieneś zobaczyć `(venv)` na początku linii.

**KROK 4:** Uruchom serwer
```powershell
uvicorn main:app --reload
```

## ✅ Jak Sprawdzić Czy Serwer Działa

Po uruchomieniu powinieneś zobaczyć:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

## 🌐 Teraz Otwórz w Przeglądarce

1. **Health Check (podstawowy):**
   ```
   http://localhost:8000/api/v1/health
   ```
   Powinieneś zobaczyć:
   ```json
   {
     "status": "healthy",
     "timestamp": "2025-11-22T...",
     "service": "ShiftAI API"
   }
   ```

2. **Sprawdzenie Bazy Danych:**
   ```
   http://localhost:8000/api/v1/health/db
   ```
   Powinieneś zobaczyć:
   ```json
   {
     "status": "healthy",
     "database": "connected",
     "database_version": "PostgreSQL ...",
     "timestamp": "2025-11-22T...",
     "service": "ShiftAI API"
   }
   ```

3. **Dokumentacja API (Swagger):**
   ```
   http://localhost:8000/docs
   ```

## ⚠️ Ważne!

**Zostaw terminal z serwerem otwarty!** 
Serwer musi działać, żeby API odpowiadało na żądania.

Aby zatrzymać serwer, naciśnij `CTRL + C` w terminalu.

## 🔧 Sprawdzanie Bazy Danych w pgAdmin4

1. Otwórz pgAdmin4
2. Połącz się z serwerem PostgreSQL
3. Sprawdź czy baza "shiftai" istnieje
4. Sprawdź czy są tabele:
   - organizations
   - users
   - employees
   - availabilities
   - shifts

## 🐛 Rozwiązywanie Problemów

### Problem: "uvicorn: command not found"
**Rozwiązanie:**
```powershell
.\venv\Scripts\Activate.ps1
pip install uvicorn
```

### Problem: "Database not initialized"
**Rozwiązanie:**
```powershell
$env:DATABASE_URL='postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai'
```

### Problem: "ModuleNotFoundError: asyncpg"
**Rozwiązanie:**
```powershell
.\venv\Scripts\Activate.ps1
pip install asyncpg
```

### Problem: Port 8000 zajęty
**Rozwiązanie:** Użyj innego portu
```powershell
uvicorn main:app --reload --port 8001
```

