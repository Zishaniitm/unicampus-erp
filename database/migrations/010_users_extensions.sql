-- ============================================================
-- Migration 010: Extend users table for ERP features
-- Author: Zishan Ahmad | Date: June 2026
-- Safe to run multiple times (IF NOT EXISTS / IF NOT EXISTS guards)
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Make must_change_password FALSE for existing users (they already set their passwords)
UPDATE users SET must_change_password = FALSE WHERE must_change_password IS NULL OR must_change_password = TRUE;

-- Protect audit.access_logs — INSERT only, no UPDATE or DELETE ever
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_rules WHERE tablename = 'access_logs' AND rulename = 'no_update_access_logs'
  ) THEN
    EXECUTE 'CREATE RULE no_update_access_logs AS ON UPDATE TO audit.access_logs DO INSTEAD NOTHING';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_rules WHERE tablename = 'access_logs' AND rulename = 'no_delete_access_logs'
  ) THEN
    EXECUTE 'CREATE RULE no_delete_access_logs AS ON DELETE TO audit.access_logs DO INSTEAD NOTHING';
  END IF;
END $$;

COMMENT ON COLUMN users.mobile_number IS 'AES-256 encrypted Indian mobile number.';
COMMENT ON COLUMN users.must_change_password IS 'TRUE for new accounts. Forces password change on first login.';
