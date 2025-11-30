# ShiftAI - System Zarządzania Grafikami Pracy

Witaj w repozytorium projektu ShiftAI. Projekt składa się z dwóch głównych części:

## 📂 Struktura Projektu

### [Backend (Python/FastAPI)](./backend/README.md)
Logika biznesowa, API, baza danych i algorytmy harmonogramowania.
- **Technologie:** Python 3.10+, FastAPI, PostgreSQL, SQLAlchemy, Alembic.
- **Dokumentacja:** Zobacz `backend/README.md` po szczegóły instalacji i uruchomienia.

### [Frontend (Next.js)](./frontend/README.md)
Interfejs użytkownika dla pracowników i menedżerów.
- **Technologie:** Next.js 14, React, Tailwind CSS.
- **Uruchomienie:** `cd frontend` -> `npm install` -> `npm run dev`.

## 🚀 Szybki Start

1. **Uruchom Backend:**
   ```powershell
   cd backend
   .\venv\Scripts\Activate.ps1
   uvicorn main:app --reload
   ```

2. **Uruchom Frontend:**
   ```powershell
   cd frontend
   npm run dev
   ```

## 📝 Status Projektu
Szczegółowy status projektu znajduje się w pliku `PROJECT_STATUS.md` (tylko lokalnie).
