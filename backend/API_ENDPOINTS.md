# 📡 API Endpoints - ShiftAI

## Base URL
```
http://localhost:8000/api/v1
```

## 🔍 Health Check Endpoints

### GET `/health`
Basic health check (no database connection).

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-22T12:00:00",
  "service": "ShiftAI API"
}
```

### GET `/health/db`
Health check with database connection test.

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "database_version": "PostgreSQL 15.x",
  "timestamp": "2025-11-22T12:00:00",
  "service": "ShiftAI API"
}
```

## 👥 Employee Endpoints

### POST `/employees/`
Create a new employee.

**Request Body:**
```json
{
  "first_name": "Jan",
  "last_name": "Kowalski",
  "email": "jan.kowalski@example.com",
  "phone": "+48123456789",
  "role": "Waiter",
  "organization_id": 1,
  "hourly_rate": 25.50,
  "max_hours_per_week": 40
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "first_name": "Jan",
  "last_name": "Kowalski",
  "email": "jan.kowalski@example.com",
  "phone": "+48123456789",
  "hourly_rate": 25.50,
  "max_hours_per_week": 40,
  "role": "Waiter",
  "organization_id": 1,
  "created_at": "2025-11-22T12:00:00",
  "updated_at": "2025-11-22T12:00:00"
}
```

### GET `/employees/{org_id}`
Get all employees for an organization.

**Path Parameters:**
- `org_id` (integer): Organization ID

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "first_name": "Jan",
    "last_name": "Kowalski",
    "email": "jan.kowalski@example.com",
    "phone": "+48123456789",
    "hourly_rate": 25.50,
    "max_hours_per_week": 40,
    "role": "Waiter",
    "organization_id": 1,
    "created_at": "2025-11-22T12:00:00",
    "updated_at": "2025-11-22T12:00:00"
  }
]
```

**Note:** Returns empty array `[]` if no employees found.

## 📅 Availability Endpoints

### GET `/employees/availability/{employee_id}`
Get availability slots for an employee within a date range.

**Path Parameters:**
- `employee_id` (integer): Employee ID

**Query Parameters:**
- `start_date` (date, optional): Start date filter (inclusive). Format: `YYYY-MM-DD`
- `end_date` (date, optional): End date filter (inclusive). Format: `YYYY-MM-DD`

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "employee_id": 1,
    "start_time": "2025-11-25T09:00:00Z",
    "end_time": "2025-11-25T17:00:00Z",
    "preference_score": 10,
    "created_at": "2025-11-22T12:00:00Z",
    "updated_at": "2025-11-22T12:00:00Z"
  }
]
```

**Examples:**
```
# Get all availability for employee 1
GET /api/v1/employees/availability/1

# Get availability for employee 1 in November 2025
GET /api/v1/employees/availability/1?start_date=2025-11-01&end_date=2025-11-30

# Get availability from a specific date onwards
GET /api/v1/employees/availability/1?start_date=2025-11-25
```

**Error Responses:**
- `404`: Employee not found
- `400`: Invalid employee ID or invalid date range (start_date > end_date)

### POST `/employees/availability`
Bulk add availability slots with duplicate prevention (upsert logic).

**Request Body:**
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

**Response (201 Created):**
```json
[
  {
    "id": 1,
    "employee_id": 1,
    "start_time": "2025-11-25T09:00:00Z",
    "end_time": "2025-11-25T17:00:00Z",
    "preference_score": 10,
    "created_at": "2025-11-22T12:00:00",
    "updated_at": "2025-11-22T12:00:00"
  },
  {
    "id": 2,
    "employee_id": 1,
    "start_time": "2025-11-26T09:00:00Z",
    "end_time": "2025-11-26T17:00:00Z",
    "preference_score": 8,
    "created_at": "2025-11-22T12:00:00",
    "updated_at": "2025-11-22T12:00:00"
  }
]
```

**Important:** 
- If an availability slot overlaps with an existing one for the same employee, the existing slot is deleted and replaced.
- All times must be in UTC format.
- `end_time` must be after `start_time`.

## 🧪 Testing with cURL

### Create Employee
```bash
curl -X POST "http://localhost:8000/api/v1/employees/" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jan",
    "last_name": "Kowalski",
    "email": "jan@example.com",
    "role": "Waiter",
    "organization_id": 1,
    "hourly_rate": 25.50,
    "max_hours_per_week": 40
  }'
```

### Get Employees
```bash
curl "http://localhost:8000/api/v1/employees/1"
```

### Add Availability
```bash
curl -X POST "http://localhost:8000/api/v1/employees/availability" \
  -H "Content-Type: application/json" \
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

## 📖 Interactive API Documentation

FastAPI automatically generates interactive documentation:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## ⚠️ Error Responses

### 400 Bad Request
```json
{
  "detail": "end_time must be after start_time"
}
```

### 404 Not Found
```json
{
  "detail": "Employee with id 999 not found"
}
```

### 422 Validation Error
```json
{
  "detail": [
    {
      "loc": ["body", "first_name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

