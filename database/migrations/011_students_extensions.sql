-- ============================================================
-- Migration 011: Extend students table for ERP features
-- Author: Zishan Ahmad | Date: June 2026
-- ============================================================

ALTER TABLE students ADD COLUMN IF NOT EXISTS cgpa DECIMAL(4,2);
ALTER TABLE students ADD COLUMN IF NOT EXISTS sgpa_latest DECIMAL(4,2);
ALTER TABLE students ADD COLUMN IF NOT EXISTS noc_issued BOOLEAN DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS library_membership_active BOOLEAN DEFAULT TRUE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS academic_hold BOOLEAN DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS academic_hold_reason TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS academic_hold_by UUID REFERENCES users(user_id);
ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_status VARCHAR(20) DEFAULT 'pending'
  CHECK (admission_status IN ('pending', 'confirmed', 'rejected', 'withdrawn'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS credential_sent_at TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMPTZ;

COMMENT ON COLUMN students.academic_hold IS 'Set by HOD or Super Admin only. Blocks semester registration.';
COMMENT ON COLUMN students.admission_status IS 'Must be confirmed before credentials can be generated.';
