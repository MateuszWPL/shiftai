# Database Configuration

## Connection Details

- **Host**: localhost
- **User**: postgres
- **Password**: Loginek12!
- **Database**: shiftai

## Setting DATABASE_URL

### PowerShell (Current Session)
```powershell
$env:DATABASE_URL='postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai'
```

### Permanent (PowerShell Profile)
Add to your PowerShell profile:
```powershell
$env:DATABASE_URL='postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai'
```

### .env File (Recommended)
Create a `.env` file in the `backend/` directory:
```
DATABASE_URL=postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai
SECRET_KEY=your-secret-key-change-in-production
CORS_ORIGINS=http://localhost:3000
```

## Alembic Commands

### Create a new migration
```powershell
alembic revision --autogenerate -m "Description of changes"
```

### Apply migrations
```powershell
alembic upgrade head
```

### Rollback last migration
```powershell
alembic downgrade -1
```

### Check current migration status
```powershell
alembic current
```

### View migration history
```powershell
alembic history
```

