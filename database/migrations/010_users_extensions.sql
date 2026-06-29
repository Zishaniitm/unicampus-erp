-- ============================================================
-- Migration 010: Extend users table for ERP features
-- Author: Zishan Ahmad | Date: June 2026
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number TEXT;           -- AES-256 encrypted at application layer
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_hash TEXT;                -- bcrypt hash of 6-digit OTP
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Enforce audit.access_logs is INSERT-only
-- No application code should UPDATE or DELETE audit records
CREATE OR REPLACE RULE no_update_access_logs AS
  ON UPDATE TO audit.access_logs DO INSTEAD NOTHING;

CREATE OR REPLACE RULE no_delete_access_logs AS
  ON DELETE TO audit.access_logs DO INSTEAD NOTHING;

COMMENT ON COLUMN users.mobile_number IS 'AES-256 encrypted Indian mobile number. Decrypt in application layer only.';
COMMENT ON COLUMN users.must_change_password IS 'TRUE for all new accounts. Forces password change on first login.';
