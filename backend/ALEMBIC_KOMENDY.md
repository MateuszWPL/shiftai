# 📚 Przewodnik po Alembic (Migracje Bazy Danych)

## Co to są migracje?

**Migracje** to sposób na zarządzanie zmianami w strukturze bazy danych (tabele, kolumny, indeksy).

### Analogia:
- **Modele SQLAlchemy** (`app/models/`) = Plan domu (jak ma wyglądać)
- **Migracje Alembic** = Instrukcje budowy (jak zbudować/zmienić)
- **Baza danych** = Gotowy dom

## 🔧 Podstawowe Komendy Alembic

### 1. Tworzenie nowej migracji (automatycznie)
```powershell
# Automatycznie wykrywa zmiany w modelach i tworzy migrację
alembic revision --autogenerate -m "Opis zmian"
```

**Przykład:**
```powershell
alembic revision --autogenerate -m "Dodano pole telefonu do Employee"
```

### 2. Tworzenie pustej migracji (ręcznie)
```powershell
# Tworzy pusty plik migracji - musisz sam napisać kod
alembic revision -m "Opis zmian"
```

### 3. Zastosowanie migracji (tworzenie tabel w bazie)
```powershell
# Zastosowuje wszystkie migracje do najnowszej wersji
alembic upgrade head
```

### 4. Cofnięcie ostatniej migracji
```powershell
# Cofa jedną migrację wstecz
alembic downgrade -1
```

### 5. Cofnięcie do konkretnej wersji
```powershell
# Cofa do konkretnej wersji (użyj ID migracji)
alembic downgrade 1346ab535307
```

### 6. Sprawdzenie aktualnej wersji
```powershell
# Pokazuje aktualną wersję migracji w bazie
alembic current
```

### 7. Historia migracji
```powershell
# Pokazuje wszystkie migracje (od najstarszej)
alembic history

# Pokazuje wszystkie migracje (od najnowszej)
alembic history --verbose
```

### 8. Sprawdzenie różnic (bez tworzenia migracji)
```powershell
# Pokazuje różnice między modelami a bazą (bez zapisywania)
alembic check
```

## 📋 Typowy Workflow

### Scenariusz 1: Dodałeś nowe pole do modelu

```powershell
# 1. Zmień model w app/models/employee.py (np. dodaj pole "notes")

# 2. Utwórz migrację
alembic revision --autogenerate -m "Dodano pole notes do Employee"

# 3. Sprawdź wygenerowany plik w alembic/versions/

# 4. Zastosuj migrację
alembic upgrade head
```

### Scenariusz 2: Chcesz cofnąć zmiany

```powershell
# 1. Cofnij ostatnią migrację
alembic downgrade -1

# 2. Sprawdź status
alembic current
```

## 🗂️ Struktura Plików

```
backend/
├── alembic/
│   ├── versions/              # Tutaj są pliki migracji
│   │   └── 1346ab535307_initial_migration.py
│   ├── env.py                # Konfiguracja Alembic
│   └── script.py.mako        # Szablon migracji
├── alembic.ini                # Główna konfiguracja
└── app/
    └── models/                # Twoje modele SQLAlchemy
```

## ⚠️ Ważne Uwagi

1. **Zawsze sprawdź wygenerowaną migrację** przed zastosowaniem
2. **Nie edytuj istniejących migracji** - zamiast tego stwórz nową
3. **Backup bazy** przed ważnymi zmianami
4. **Testuj migracje** na kopii bazy przed produkcją

## 🔍 Przykładowy Plik Migracji

```python
def upgrade() -> None:
    """Dodaje nową tabelę/kolumnę."""
    op.add_column('employees', 
        sa.Column('notes', sa.String(500), nullable=True)
    )

def downgrade() -> None:
    """Cofa zmiany."""
    op.drop_column('employees', 'notes')
```

