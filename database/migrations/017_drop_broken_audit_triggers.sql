-- ============================================================
-- Migration 017: Drop broken DB-level audit triggers
-- Author: Zishan Ahmad | Date: July 2026
-- ============================================================
-- WHY: 06_security_features.sql attached log_user_action() triggers to
-- departments/courses/teachers/students/timetables/substitutions. That
-- function casts current_user::uuid — but current_user is the DATABASE
-- role name ('postgres' or the app's DB user), never a UUID. Every
-- INSERT/UPDATE on those tables therefore crashes (this is why the
-- original sample-data seeding silently failed, and it would crash the
-- Admission module's student creation in production).
--
-- Auditing is done correctly at the application layer: every service
-- writes to audit.access_logs with the real JWT user_id. The INSERT-only
-- protection rules on audit tables (migration 010) remain untouched.
-- ============================================================

DROP TRIGGER IF EXISTS audit_departments_changes   ON departments;
DROP TRIGGER IF EXISTS audit_courses_changes       ON courses;
DROP TRIGGER IF EXISTS audit_teachers_changes      ON teachers;
DROP TRIGGER IF EXISTS audit_students_changes      ON students;
DROP TRIGGER IF EXISTS audit_timetables_changes    ON timetables;
DROP TRIGGER IF EXISTS audit_substitutions_changes ON substitutions;

-- The function itself is left in place (harmless once detached) so any
-- environment still referencing it doesn't break on restore.

COMMENT ON FUNCTION log_user_action() IS
    'DEPRECATED: detached in migration 017. Cast current_user::uuid crashes for non-UUID DB roles. Auditing happens at application layer via audit.access_logs.';
