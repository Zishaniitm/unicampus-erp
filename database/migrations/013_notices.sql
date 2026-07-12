-- ============================================================
-- Migration 013: Notices table
-- Author: Zishan Ahmad | Date: July 2026
-- ============================================================
CREATE TABLE IF NOT EXISTS notices (
    notice_id    SERIAL PRIMARY KEY,
    title        VARCHAR(200) NOT NULL,
    body         TEXT NOT NULL,
    is_critical  BOOLEAN DEFAULT FALSE,
    target_role  VARCHAR(50),          -- NULL = all roles
    target_dept  INTEGER REFERENCES departments(department_id),
    target_batch INTEGER,              -- batch_id (no FK to allow flexibility)
    visible_from TIMESTAMPTZ,          -- NULL = visible immediately
    visible_to   TIMESTAMPTZ,          -- NULL = no expiry
    posted_by    UUID NOT NULL REFERENCES users(user_id),
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notices_active_visible
  ON notices(is_active, visible_from, visible_to);

COMMENT ON TABLE notices IS 'Notice board posts with role/dept targeting and validity windows';
