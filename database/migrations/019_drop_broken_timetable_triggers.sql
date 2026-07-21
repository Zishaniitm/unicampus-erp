-- ============================================================
-- Migration 019: Drop broken timetable audit triggers
-- Author: Zishan Ahmad | Date: July 2026
-- ============================================================
-- WHY: log_timetable_change() (05_timetable_and_substitution_tables.sql)
-- is broken twice over:
--   1. It references OLD.entry_id in a branch evaluated on INSERT,
--      where OLD does not exist → "record OLD has no field entry_id"
--   2. It casts session_user::uuid — the DB role name is never a UUID
--      (same defect removed from other tables in migration 017)
-- Every INSERT into timetables / timetable_entries crashes because of it.
--
-- Auditing is already handled at the application layer:
-- timetable.service.ts writes to audit.timetable_changes with the real
-- JWT user on every create/cancel. The INSERT-only protection on the
-- audit table itself is unaffected.
-- ============================================================

DROP TRIGGER IF EXISTS audit_timetable_changes       ON timetables;
DROP TRIGGER IF EXISTS audit_timetable_entry_changes ON timetable_entries;

COMMENT ON FUNCTION log_timetable_change() IS
    'DEPRECATED: detached in migration 019. References OLD on INSERT and casts session_user::uuid — both crash. App layer audits via audit.timetable_changes.';
