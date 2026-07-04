-- ============================================================
-- Migration 012: Create timetable_entries + related tables
-- This replaces the broken version in 05_timetable_and_substitution_tables.sql
-- Author: Zishan Ahmad | Date: June 2026
-- ============================================================

-- timetable_entries (fixed — no generated column subquery which PostgreSQL doesn't support)
CREATE TABLE IF NOT EXISTS timetable_entries (
    entry_id SERIAL PRIMARY KEY,
    timetable_id INTEGER NOT NULL REFERENCES timetables(timetable_id) ON DELETE CASCADE,
    day_of_week day_of_week NOT NULL,
    time_slot_id INTEGER NOT NULL REFERENCES time_slots(time_slot_id),
    batch_course_id INTEGER NOT NULL REFERENCES batch_courses(batch_course_id),
    classroom_id INTEGER NOT NULL REFERENCES classrooms(classroom_id),
    teacher_id INTEGER NOT NULL REFERENCES teachers(teacher_id),
    is_active BOOLEAN DEFAULT TRUE,
    is_cancelled BOOLEAN DEFAULT FALSE,
    cancel_reason TEXT,
    cancelled_by UUID REFERENCES users(user_id),
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(day_of_week, time_slot_id, teacher_id),
    UNIQUE(day_of_week, time_slot_id, classroom_id)
);

COMMENT ON TABLE timetable_entries IS 'Individual class schedule entries in the timetable';

-- substitutions
CREATE TABLE IF NOT EXISTS substitutions (
    substitution_id SERIAL PRIMARY KEY,
    timetable_entry_id INTEGER NOT NULL REFERENCES timetable_entries(entry_id),
    original_teacher_id INTEGER NOT NULL REFERENCES teachers(teacher_id),
    substitute_teacher_id INTEGER NOT NULL REFERENCES teachers(teacher_id),
    absence_id INTEGER REFERENCES teacher_absences(absence_id),
    substitution_date DATE NOT NULL,
    reason TEXT,
    is_confirmed BOOLEAN DEFAULT FALSE,
    confirmed_by UUID REFERENCES users(user_id),
    notification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT different_teachers CHECK (original_teacher_id != substitute_teacher_id)
);

COMMENT ON TABLE substitutions IS 'Records of teacher substitutions for absent teachers';

-- timetable_conflicts
CREATE TABLE IF NOT EXISTS timetable_conflicts (
    conflict_id SERIAL PRIMARY KEY,
    conflict_type VARCHAR(50) NOT NULL CHECK (conflict_type IN (
        'TEACHER_CLASH', 'CLASSROOM_CLASH', 'BATCH_CLASH',
        'TEACHER_UNAVAILABLE', 'CLASSROOM_UNAVAILABLE'
    )),
    timetable_entry_id INTEGER REFERENCES timetable_entries(entry_id),
    conflicting_entry_id INTEGER REFERENCES timetable_entries(entry_id),
    description TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES users(user_id),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE timetable_conflicts IS 'Records of scheduling conflicts';

-- Triggers
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_timetable_entries_timestamp') THEN
    EXECUTE 'CREATE TRIGGER update_timetable_entries_timestamp BEFORE UPDATE ON timetable_entries FOR EACH ROW EXECUTE FUNCTION update_timestamp()';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_substitutions_timestamp') THEN
    EXECUTE 'CREATE TRIGGER update_substitutions_timestamp BEFORE UPDATE ON substitutions FOR EACH ROW EXECUTE FUNCTION update_timestamp()';
  END IF;
END $$;

-- Protect timetable audit table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_rules WHERE tablename = 'timetable_changes' AND rulename = 'no_update_timetable_changes') THEN
    EXECUTE 'CREATE RULE no_update_timetable_changes AS ON UPDATE TO audit.timetable_changes DO INSTEAD NOTHING';
  END IF;
END $$;
