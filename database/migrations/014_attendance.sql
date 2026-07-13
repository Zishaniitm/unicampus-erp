-- ============================================================
-- Migration 014: Attendance table
-- Author: Zishan Ahmad | Date: July 2026
-- ============================================================

CREATE TABLE IF NOT EXISTS attendance (
    att_id          BIGSERIAL PRIMARY KEY,
    timetable_entry_id INTEGER NOT NULL REFERENCES timetable_entries(entry_id),
    student_id      INTEGER NOT NULL REFERENCES students(student_id),
    att_date        DATE NOT NULL,
    status          VARCHAR(5) NOT NULL CHECK (status IN ('P', 'A', 'ML', 'DL')),
    -- P=Present, A=Absent, ML=Medical Leave, DL=Duty Leave
    marked_by       UUID NOT NULL REFERENCES users(user_id),
    marked_at       TIMESTAMPTZ DEFAULT NOW() AT TIME ZONE 'Asia/Kolkata',
    edited_by       UUID REFERENCES users(user_id),
    edit_reason     TEXT,
    edited_at       TIMESTAMPTZ,
    UNIQUE(timetable_entry_id, student_id, att_date)
);

-- Index for student attendance queries (most frequent)
CREATE INDEX IF NOT EXISTS idx_att_student_date
    ON attendance(student_id, att_date DESC);

-- Index for faculty marking queries
CREATE INDEX IF NOT EXISTS idx_att_entry_date
    ON attendance(timetable_entry_id, att_date);

COMMENT ON TABLE attendance IS
  'Attendance per student per class session. P=Present A=Absent ML=Medical DL=Duty Leave';

COMMENT ON COLUMN attendance.status IS
  'P=Present, A=Absent, ML=Medical Leave (counts toward eligibility), DL=Duty Leave';
