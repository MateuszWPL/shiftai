# 📋 Wszystkie Komendy - Szybka Referencja

## 🗄️ MIGRACJE (Alembic)

### Podstawowe
```powershell
# Utwórz migrację (automatycznie wykrywa zmiany)
alembic revision --autogenerate -m "Opis zmian"

# Zastosuj wszystkie migracje
alembic upgrade head

# Cofnij ostatnią migrację
alembic downgrade -1

# Sprawdź aktualną wersję
alembic current

# Historia migracji
alembic history
```

### Przykłady
```powershell
# Dodałeś nowe pole do modelu Employee
alembic revision --autogenerate -m "Dodano pole notes do Employee"
alembic upgrade head

# Chcesz cofnąć zmiany
alembic downgrade -1
```

## 🚀 SERWER

### Uruchomienie
```powershell
# Sposób 1: Użyj skryptu
.\START_SERVER.ps1

# Sposób 2: Ręcznie
cd backend
$env:DATABASE_URL='postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai'
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload
```

### Adresy URL
- **API Docs:** http://localhost:8000/docs
- **Health Check:** http://localhost:8000/api/v1/health
- **DB Check:** http://localhost:8000/api/v1/health/db
- **Root:** http://localhost:8000/

## 🔍 SPRAWDZANIE POŁĄCZENIA

### 1. Przez API (w przeglądarce)
```
http://localhost:8000/api/v1/health/db
```

### 2. Przez skrypt Python
```powershell
$env:DATABASE_URL='postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai'
.\venv\Scripts\python.exe verify_db.py
```

### 3. Przez Alembic
```powershell
$env:DATABASE_URL='postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai'
alembic current
```

## ⚙️ KONFIGURACJA

### Ustawienie DATABASE_URL (PowerShell)
```powershell
# Tylko dla tej sesji
$env:DATABASE_URL='postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai'

# Sprawdź czy jest ustawione
echo $env:DATABASE_URL
```

### Utworzenie pliku .env (zalecane)
Utwórz plik `backend/.env`:
```
DATABASE_URL=postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai
SECRET_KEY=twoj-secret-key
CORS_ORIGINS=http://localhost:3000
```

## 📦 ŚRODOWISKO WIRTUALNE

```powershell
# Aktywacja
.\venv\Scripts\Activate.ps1

# Deaktywacja
deactivate

# Sprawdź zainstalowane pakiety
pip list
```

## 🧪 TESTY

### Test API (PowerShell)
```powershell
# Podstawowy health check
Invoke-WebRequest -Uri http://localhost:8000/api/v1/health

# Sprawdzenie bazy danych
Invoke-WebRequest -Uri http://localhost:8000/api/v1/health/db
```

### Test w przeglądarce
Otwórz:
- http://localhost:8000/api/v1/health
- http://localhost:8000/api/v1/health/db

## 📚 DOKUMENTACJA

- **FastAPI Auto Docs:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **Przewodnik Python:** `PYTHON_BACKEND_GUIDE.md`
- **Komendy Alembic:** `ALEMBIC_KOMENDY.md`

## 🔄 TYPOWY WORKFLOW

```powershell
# 1. Ustaw zmienną środowiskową
$env:DATABASE_URL='postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai'

# 2. Aktywuj venv
.\venv\Scripts\Activate.ps1

# 3. Uruchom serwer
uvicorn main:app --reload

# 4. W drugim terminalu - utwórz migrację (jeśli zmieniłeś modele)
alembic revision --autogenerate -m "Opis zmian"
alembic upgrade head

# 5. Sprawdź w przeglądarce
# http://localhost:8000/docs
```

## ⚠️ CZĘSTE PROBLEMY

### Problem: "Database not initialized"
**Rozwiązanie:**
```powershell
$env:DATABASE_URL='postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai'
```

### Problem: "Connection refused"
**Rozwiązanie:** Sprawdź czy PostgreSQL działa
```powershell
Get-Service postgresql*
```

### Problem: "Module not found"
**Rozwiązanie:** Aktywuj venv
```powershell
.\venv\Scripts\Activate.ps1
```

