-- Manual migration script for employee invitations
-- Run this directly in your PostgreSQL database

-- 1. Add EMPLOYEE to UserRole enum
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'EMPLOYEE' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userrole')
    ) THEN
        ALTER TYPE userrole ADD VALUE 'EMPLOYEE';
    END IF;
END $$;

-- 2. Add user_id column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE employees ADD CONSTRAINT fk_employees_user_id 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_employees_user_id ON employees(user_id);

-- 3. Create employee_invitations table
CREATE TABLE IF NOT EXISTS employee_invitations (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_employee_invitation_employee 
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_employee_invitation_token ON employee_invitations(token);
CREATE INDEX IF NOT EXISTS idx_employee_invitation_employee ON employee_invitations(employee_id);
CREATE INDEX IF NOT EXISTS ix_employee_invitations_id ON employee_invitations(id);

-- 5. Create enum type for employee invitation status (if not exists)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employeeinvitationstatus') THEN
        CREATE TYPE employeeinvitationstatus AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');
    END IF;
END $$;

-- 6. Update employee_invitations.status to use enum (if needed)
-- Note: This might require dropping and recreating the column if it's already VARCHAR
-- Uncomment if needed:
-- ALTER TABLE employee_invitations ALTER COLUMN status TYPE employeeinvitationstatus USING status::employeeinvitationstatus;

