# 🧪 Testowanie API - Przykłady

## ❌ Błąd w Twoim Request

W Twoim JSON brakuje cudzysłowu przy emailu:

```json
❌ "email": Jan@exa.com",    // BŁĄD - brakuje otwierającego cudzysłowu
```

## ✅ Poprawny Format

```json
{
  "first_name": "Jan",
  "last_name": "Kowalski",
  "email": "Jan@exa.com",        // ✅ Poprawnie
  "phone": "+48 123 123 123",
  "role": "Admin",
  "organization_id": 1,
  "hourly_rate": 5,
  "max_hours_per_week": 5
}
```

## 📋 Przykładowe Requesty

### 1. Utworzenie Pracownika (POST /api/v1/employees/)

**Poprawny JSON:**
```json
{
  "first_name": "Jan",
  "last_name": "Kowalski",
  "email": "jan.kowalski@example.com",
  "phone": "+48123123123",
  "role": "Waiter",
  "organization_id": 1,
  "hourly_rate": 25.50,
  "max_hours_per_week": 40
}
```

**cURL:**
```bash
curl -X 'POST' \
  'http://localhost:8000/api/v1/employees/' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "first_name": "Jan",
  "last_name": "Kowalski",
  "email": "jan.kowalski@example.com",
  "phone": "+48123123123",
  "role": "Waiter",
  "organization_id": 1,
  "hourly_rate": 25.50,
  "max_hours_per_week": 40
}'
```

### 2. Pobranie Pracowników (GET /api/v1/employees/{org_id})

**Przykład:**
```
http://localhost:8000/api/v1/employees/1
```

### 3. Dodanie Dostępności (POST /api/v1/employees/availability)

**Poprawny JSON:**
```json
{
  "availabilities": [
    {
      "employee_id": 1,
      "start_time": "2025-11-25T09:00:00Z",
      "end_time": "2025-11-25T17:00:00Z",
      "preference_score": 10
    },
    {
      "employee_id": 1,
      "start_time": "2025-11-26T09:00:00Z",
      "end_time": "2025-11-26T17:00:00Z",
      "preference_score": 8
    }
  ]
}
```

**cURL:**
```bash
curl -X 'POST' \
  'http://localhost:8000/api/v1/employees/availability' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "availabilities": [
    {
      "employee_id": 1,
      "start_time": "2025-11-25T09:00:00Z",
      "end_time": "2025-11-25T17:00:00Z",
      "preference_score": 10
    }
  ]
}'
```

## ⚠️ Częste Błędy JSON

### 1. Brakujące cudzysłowy
```json
❌ "email": Jan@exa.com",
✅ "email": "Jan@exa.com",
```

### 2. Przecinek na końcu
```json
❌ "role": "Admin",
✅ "role": "Admin"    // Ostatnie pole bez przecinka
```

### 3. Nieprawidłowy format daty
```json
❌ "start_time": "2025-11-25 09:00:00",
✅ "start_time": "2025-11-25T09:00:00Z",
```

### 4. Nieprawidłowy typ liczby
```json
❌ "hourly_rate": "25.50",    // String zamiast liczby
✅ "hourly_rate": 25.50,      // Liczba
```

## 🔍 Sprawdzanie JSON

Użyj narzędzia online do walidacji JSON:
- https://jsonlint.com/
- https://jsonformatter.org/

Lub w PowerShell:
```powershell
$json = '{"email": "test@example.com"}'
$json | ConvertFrom-Json  # Jeśli błąd, JSON jest nieprawidłowy
```

## 💡 Wskazówki

1. **Używaj Swagger UI** - automatycznie formatuje JSON
2. **Kopiuj przykłady** z dokumentacji API
3. **Sprawdzaj cudzysłowy** - wszystkie wartości string muszą być w cudzysłowach
4. **Format daty** - zawsze ISO 8601 z 'Z' na końcu dla UTC

