# 🔧 Rozwiązanie Błędu: Foreign Key Violation

## ❌ Problem

```
ForeignKeyViolationError: Klucz (organization_id)=(1) nie występuje w tabeli "organizations".
```

**Przyczyna:** Próbujesz utworzyć pracownika z `organization_id=1`, ale organizacja o ID 1 nie istnieje w bazie danych.

## ✅ Rozwiązanie

### Krok 1: Utwórz Organizację Najpierw

**Endpoint:** `POST /api/v1/organizations/`

**Request Body:**
```json
{
  "name": "Moja Restauracja",
  "plan": "free"
}
```

**Przykład w Swagger UI:**
1. Otwórz http://localhost:8000/docs
2. Znajdź endpoint `POST /api/v1/organizations/`
3. Kliknij "Try it out"
4. Wpisz:
   ```json
   {
     "name": "Moja Restauracja",
     "plan": "free"
   }
   ```
5. Kliknij "Execute"

**Odpowiedź (201 Created):**
```json
{
  "id": 1,
  "name": "Moja Restauracja",
  "plan": "free",
  "created_at": "2025-11-22T16:30:00",
  "updated_at": "2025-11-22T16:30:00"
}
```

**Zapamiętaj ID organizacji!** (w tym przypadku `1`)

### Krok 2: Teraz Utwórz Pracownika

Użyj `organization_id` z odpowiedzi powyżej:

```json
{
  "first_name": "Jan",
  "last_name": "Kowalski",
  "email": "Jan@exa.com",
  "phone": "+48 123 123 123",
  "role": "Admin",
  "organization_id": 1,  // ← ID z kroku 1
  "hourly_rate": 5,
  "max_hours_per_week": 5
}
```

## 📋 Nowe Endpointy

### POST `/api/v1/organizations/`
Tworzy nową organizację.

**Request:**
```json
{
  "name": "Nazwa Organizacji",
  "plan": "free"  // lub "pro"
}
```

### GET `/api/v1/organizations/{org_id}`
Pobiera organizację po ID.

## 🔍 Sprawdzenie Organizacji w Bazie

Możesz sprawdzić czy organizacja istnieje:

```bash
# W pgAdmin4 lub przez SQL
SELECT * FROM organizations;
```

Lub użyj endpointu:
```
GET http://localhost:8000/api/v1/organizations/1
```

## 💡 Wskazówki

1. **Zawsze najpierw utwórz organizację** przed dodaniem pracowników
2. **Zapamiętaj ID organizacji** - będziesz go potrzebować
3. **Użyj Swagger UI** - automatycznie pokazuje wszystkie dostępne endpointy
4. **Sprawdź odpowiedź** - jeśli dostaniesz 404, organizacja nie istnieje

## 🎯 Pełny Przykład Workflow

```bash
# 1. Utwórz organizację
POST /api/v1/organizations/
{
  "name": "Moja Firma",
  "plan": "free"
}
# Odpowiedź: {"id": 1, ...}

# 2. Utwórz pracownika
POST /api/v1/employees/
{
  "first_name": "Jan",
  "last_name": "Kowalski",
  "organization_id": 1,  // ← ID z kroku 1
  ...
}

# 3. Pobierz pracowników organizacji
GET /api/v1/employees/1
```

## ⚠️ Poprawione Błędy

Teraz API zwraca czytelny błąd zamiast 500:

```json
{
  "detail": "Organization with id 1 not found. Please create the organization first."
}
```

