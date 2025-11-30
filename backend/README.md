# 🧠 ShiftAI Backend - Dokumentacja

Centralna dokumentacja dla backendu aplikacji ShiftAI.

## 📋 Spis Treści
1. [Uruchomienie Projektu](#-uruchomienie-projektu)
2. [Baza Danych i Migracje](#-baza-danych-i-migracje)
3. [API i Endpointy](#-api-i-endpointy)
4. [Struktura Projektu](#-struktura-projektu)
5. [Rozwiązywanie Problemów](#-rozwiązywanie-problemów)

---

## 🚀 Uruchomienie Projektu

### Wymagania
- Python 3.10+
- PostgreSQL
- PowerShell (zalecane na Windows)

### Szybki Start

1. **Otwórz terminal w katalogu `backend`**:
   ```powershell
   cd backend
   ```

2. **Skonfiguruj zmienną środowiskową bazy danych**:
   ```powershell
   $env:DATABASE_URL='postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai'
   ```
   *Zalecane: Utwórz plik `.env` w katalogu `backend/` z tą zawartością.*

3. **Aktywuj środowisko wirtualne**:
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```

4. **Uruchom serwer**:
   ```powershell
   uvicorn main:app --reload
   ```

Serwer będzie dostępny pod adresem: `http://localhost:8000`

### Linki
- **Dokumentacja API (Swagger UI):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

## 🗄️ Baza Danych i Migracje (Alembic)

Zarządzanie schematem bazy danych odbywa się za pomocą narzędzia Alembic.

### Podstawowe Komendy

| Akcja | Komenda |
|-------|---------|
| **Utwórz migrację** (po zmianie modeli) | `alembic revision --autogenerate -m "Opis zmian"` |
| **Zastosuj migracje** (aktualizacja bazy) | `alembic upgrade head` |
| **Cofnij ostatnią zmianę** | `alembic downgrade -1` |
| **Sprawdź status** | `alembic current` |
| **Historia zmian** | `alembic history` |

### Typowy Workflow Zmian w Bazie
1. Zmodyfikuj model w `app/models/`.
2. Wygeneruj migrację: `alembic revision --autogenerate -m "Dodano pole X"`.
3. Sprawdź wygenerowany plik w `alembic/versions/`.
4. Zastosuj zmiany: `alembic upgrade head`.

---

## 📡 API i Endpointy

Pełna interaktywna dokumentacja znajduje się pod adresem `/docs`.

### Główne Zasoby

#### Pracownicy (`/employees`)
- `POST /` - Dodaj pracownika
- `GET /{org_id}` - Pobierz listę pracowników
- `POST /availability` - Dodaj dyspozycyjność

#### Organizacje (`/organizations`)
- `POST /` - Utwórz organizację (Wymagane jako pierwszy krok!)
- `GET /{id}` - Pobierz szczegóły organizacji

### Przykładowe Zapytania (cURL)

**Tworzenie Organizacji:**
```bash
curl -X POST "http://localhost:8000/api/v1/organizations/" \
  -H "Content-Type: application/json" \
  -d '{"name": "Moja Firma", "plan": "free"}'
```

**Tworzenie Pracownika:**
```bash
curl -X POST "http://localhost:8000/api/v1/employees/" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jan",
    "last_name": "Kowalski",
    "email": "jan@example.com",
    "organization_id": 1,
    "role": "Waiter",
    "hourly_rate": 25.0,
    "max_hours_per_week": 40
  }'
```

---

## 📁 Struktura Projektu

```
backend/
├── app/
│   ├── api/          # Routery i endpointy (v1/)
│   ├── models/       # Modele SQLAlchemy (Baza danych)
│   ├── schemas/      # Schematy Pydantic (Walidacja danych)
│   ├── services/     # Logika biznesowa
│   └── core/         # Konfiguracja i narzędzia
├── alembic/          # Pliki migracji
├── main.py           # Punkt startowy aplikacji
└── requirements.txt  # Zależności
```

---

## ⚠️ Rozwiązywanie Problemów

### 1. "Database not initialized" / Błąd połączenia
**Rozwiązanie:** Upewnij się, że zmienna `DATABASE_URL` jest ustawiona.
```powershell
$env:DATABASE_URL='postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai'
```

### 2. "ForeignKeyViolationError" przy tworzeniu pracownika
**Rozwiązanie:** Próbujesz przypisać pracownika do nieistniejącej organizacji. Najpierw utwórz organizację przez `POST /api/v1/organizations/` i użyj jej ID.

### 3. "uvicorn: command not found"
**Rozwiązanie:** Nie aktywowano środowiska wirtualnego.
```powershell
.\venv\Scripts\Activate.ps1
```

### 4. Port 8000 zajęty
**Rozwiązanie:** Uruchom na innym porcie.
```powershell
uvicorn main:app --reload --port 8001
```
