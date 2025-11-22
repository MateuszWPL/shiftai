# 🐍 Przewodnik po Python Backend dla Początkujących

## 📖 Podstawowe Pojęcia

### 1. **Migracje (Alembic)**
**Co to jest?**
- Migracje to sposób na zarządzanie strukturą bazy danych
- Gdy zmieniasz modele (np. dodajesz kolumnę), tworzysz migrację
- Migracja = instrukcja jak zmienić bazę danych

**Proces:**
```
1. Zmieniasz model w app/models/employee.py
2. Tworzysz migrację: alembic revision --autogenerate -m "Opis"
3. Zastosowujesz: alembic upgrade head
4. Baza danych jest zaktualizowana!
```

### 2. **Modele (SQLAlchemy)**
**Co to jest?**
- Modele to reprezentacja tabel w bazie danych w Pythonie
- Każda klasa = jedna tabela
- Każde pole = jedna kolumna

**Przykład:**
```python
class Employee(BaseModel):
    first_name = Column(String(100))  # Kolumna w bazie
    email = Column(String(255))      # Kolejna kolumna
```

### 3. **Routers (FastAPI)**
**Co to jest?**
- Routery to endpointy API (adresy URL)
- `/api/v1/health` = jeden endpoint
- Każdy endpoint może zwracać dane (GET) lub przyjmować (POST)

**Przykład:**
```python
@router.get("/health")
async def health_check():
    return {"status": "ok"}
```

### 4. **Schemas (Pydantic)**
**Co to jest?**
- Schemas to walidacja danych wejściowych/wyjściowych
- Sprawdzają czy dane są poprawne przed zapisem do bazy

### 5. **Services**
**Co to jest?**
- Logika biznesowa (np. obliczenia, walidacje)
- Oddzielona od routerów i baz danych

### 6. **Repositories**
**Co to jest?**
- Warstwa dostępu do danych
- Funkcje do zapytań do bazy danych

## 🔄 Jak Działa Aplikacja

```
1. Użytkownik wysyła request → http://localhost:8000/api/v1/health
2. FastAPI znajduje router → app/api/v1/health.py
3. Router wykonuje funkcję → health_check()
4. Funkcja może użyć → get_db() (połączenie z bazą)
5. Zwraca odpowiedź → JSON {"status": "ok"}
```

## 📁 Struktura Projektu

```
backend/
├── main.py                    # Punkt startowy aplikacji
├── app/
│   ├── api/                   # Endpointy (routers)
│   │   └── v1/
│   │       ├── health.py      # Endpoint /health
│   │       └── router.py      # Główny router
│   ├── models/                # Modele bazy danych
│   │   ├── employee.py
│   │   └── organization.py
│   ├── schemas/               # Walidacja danych
│   ├── services/              # Logika biznesowa
│   ├── repositories/          # Dostęp do bazy
│   └── core/
│       ├── config.py          # Konfiguracja
│       └── dependencies.py   # Połączenie z bazą
└── alembic/                   # Migracje
    └── versions/              # Pliki migracji
```

## 🚀 Komendy do Pracy

### Uruchomienie Serwera
```powershell
cd backend
$env:DATABASE_URL='postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai'
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload
```

### Migracje
```powershell
# Utwórz migrację
alembic revision --autogenerate -m "Opis zmian"

# Zastosuj migrację
alembic upgrade head

# Sprawdź status
alembic current
```

### Testowanie API
```powershell
# W przeglądarce:
http://localhost:8000/api/v1/health
http://localhost:8000/api/v1/health/db

# W PowerShell (curl):
Invoke-WebRequest -Uri http://localhost:8000/api/v1/health
```

## 🔍 Sprawdzanie Połączenia z Bazą

### 1. Przez API (w przeglądarce)
```
http://localhost:8000/api/v1/health/db
```

### 2. Przez skrypt Python
```powershell
.\venv\Scripts\python.exe verify_db.py
```

### 3. Przez Alembic
```powershell
alembic current
```

## 💡 Typowe Błędy i Rozwiązania

### Błąd: "Database not initialized"
**Rozwiązanie:** Ustaw DATABASE_URL
```powershell
$env:DATABASE_URL='postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai'
```

### Błąd: "Connection refused"
**Rozwiązanie:** Sprawdź czy PostgreSQL działa
```powershell
# Sprawdź czy działa
Get-Service postgresql*
```

### Błąd: "Module not found"
**Rozwiązanie:** Aktywuj venv
```powershell
.\venv\Scripts\Activate.ps1
```

## 📚 Przydatne Linki

- **FastAPI Docs:** http://localhost:8000/docs (automatyczna dokumentacja)
- **Alembic Docs:** https://alembic.sqlalchemy.org/
- **SQLAlchemy Docs:** https://docs.sqlalchemy.org/

