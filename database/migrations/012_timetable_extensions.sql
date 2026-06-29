-- ============================================================
-- Migration 012: Extend timetable_entries for class cancellation
-- Author: Zishan Ahmad | Date: June 2026
-- ============================================================

ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT FALSE;
ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(user_id);
ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Enforce audit.timetable_changes is INSERT-only
CREATE OR REPLACE RULE no_update_timetable_changes AS
  ON UPDATE TO audit.timetable_changes DO INSTEAD NOTHING;

CREATE OR REPLACE RULE no_delete_timetable_changes AS
  ON DELETE TO audit.timetable_changes DO INSTEAD NOTHING;
