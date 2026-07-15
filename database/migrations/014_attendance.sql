-- ============================================================
-- ============================================================
-- Migration 014: Attendance table
-- Author: Zishan Ahmad | Date: July 2026
-- ============================================================

CREATE TABLE IF NOT EXISTS attendance (
    att_id             BIGSERIAL PRIMARY KEY,
    timetable_entry_id INTEGER NOT NULL REFERENCES timetable_entries(entry_id),
    student_id         INTEGER NOT NULL REFERENCES students(student_id),
    att_date           DATE NOT NULL,
    status             VARCHAR(5) NOT NULL CHECK (status IN ('P', 'A', 'ML', 'DL')),
    marked_by          UUID NOT NULL REFERENCES users(user_id),
    marked_at          TIMESTAMPTZ DEFAULT NOW(),
    edited_by          UUID REFERENCES users(user_id),
    edit_reason        TEXT,
    edited_at          TIMESTAMPTZ,
    UNIQUE(timetable_entry_id, student_id, att_date)
);

CREATE INDEX IF NOT EXISTS idx_att_student_date
    ON attendance(student_id, att_date DESC);

CREATE INDEX IF NOT EXISTS idx_att_entry_date
    ON attendance(timetable_entry_id, att_date);

COMMENT ON TABLE attendance IS
    'Attendance per student per class. P=Present A=Absent ML=Medical Leave DL=Duty Leave';
