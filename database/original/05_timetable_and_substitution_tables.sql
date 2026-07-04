-- =============================================
-- TIMETABLE AND SUBSTITUTION TABLES
-- =============================================

-- Timetable Table
CREATE TABLE timetables (
    timetable_id SERIAL PRIMARY KEY,
    batch_id INTEGER NOT NULL REFERENCES batches(batch_id),
    academic_year VARCHAR(9) NOT NULL, -- Format: 2024-2025
    semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
    is_active BOOLEAN DEFAULT TRUE,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_date_range CHECK (effective_to IS NULL OR effective_to > effective_from)
);

COMMENT ON TABLE timetables IS 'Master timetable records for each batch and semester';

-- Timetable Entries Table
CREATE TABLE timetable_entries (
    entry_id SERIAL PRIMARY KEY,
    timetable_id INTEGER NOT NULL REFERENCES timetables(timetable_id) ON DELETE CASCADE,
    day_of_week day_of_week NOT NULL,
    time_slot_id INTEGER NOT NULL REFERENCES time_slots(time_slot_id),
    batch_course_id INTEGER NOT NULL REFERENCES batch_courses(batch_course_id),
    classroom_id INTEGER NOT NULL REFERENCES classrooms(classroom_id),
    teacher_id INTEGER NOT NULL REFERENCES teachers(teacher_id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Ensure no time clashes for the same batch on the same day
    UNIQUE(timetable_id, day_of_week, time_slot_id, batch_id),
    -- Ensure no time clashes for the same teacher on the same day
    UNIQUE(day_of_week, time_slot_id, teacher_id),
    -- Ensure no time clashes for the same classroom on the same day
    UNIQUE(day_of_week, time_slot_id, classroom_id)
);

COMMENT ON TABLE timetable_entries IS 'Individual class schedule entries in the timetable';

-- Add a batch_id column to timetable_entries for the unique constraint
ALTER TABLE timetable_entries ADD COLUMN batch_id INTEGER GENERATED ALWAYS AS 
    (SELECT batch_id FROM timetables WHERE timetable_id = timetable_entries.timetable_id) STORED;

-- Teacher Absence Table
CREATE TABLE teacher_absences (
    absence_id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES teachers(teacher_id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

COMMENT ON TABLE teacher_absences IS 'Records of teacher absences for substitution planning';

-- Substitution Table
CREATE TABLE substitutions (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT different_teachers CHECK (original_teacher_id != substitute_teacher_id)
);

COMMENT ON TABLE substitutions IS 'Records of teacher substitutions for absent teachers';

-- Timetable Change History Table (in audit schema)
CREATE TABLE audit.timetable_changes (
    change_id SERIAL PRIMARY KEY,
    timetable_id INTEGER NOT NULL,
    entry_id INTEGER,
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('CREATE', 'UPDATE', 'DELETE', 'SUBSTITUTION')),
    changed_by UUID NOT NULL REFERENCES users(user_id),
    old_data JSONB,
    new_data JSONB,
    change_reason TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE audit.timetable_changes IS 'Audit trail for all changes to timetables';

-- Timetable Conflicts Table
CREATE TABLE timetable_conflicts (
    conflict_id SERIAL PRIMARY KEY,
    conflict_type VARCHAR(50) NOT NULL CHECK (conflict_type IN (
        'TEACHER_CLASH', 'CLASSROOM_CLASH', 'BATCH_CLASH', 'TEACHER_UNAVAILABLE', 'CLASSROOM_UNAVAILABLE'
    )),
    timetable_entry_id INTEGER REFERENCES timetable_entries(entry_id),
    conflicting_entry_id INTEGER REFERENCES timetable_entries(entry_id),
    description TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES users(user_id),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE timetable_conflicts IS 'Records of detected conflicts in timetable scheduling';

-- Add triggers for timestamp updates
CREATE TRIGGER update_timetables_timestamp
BEFORE UPDATE ON timetables
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_timetable_entries_timestamp
BEFORE UPDATE ON timetable_entries
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_teacher_absences_timestamp
BEFORE UPDATE ON teacher_absences
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_substitutions_timestamp
BEFORE UPDATE ON substitutions
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_timetable_conflicts_timestamp
BEFORE UPDATE ON timetable_conflicts
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Create a function to log timetable changes
CREATE OR REPLACE FUNCTION log_timetable_change()
RETURNS TRIGGER AS $$
DECLARE
    change_type VARCHAR(20);
    old_data JSONB := NULL;
    new_data JSONB := NULL;
BEGIN
    IF TG_OP = 'INSERT' THEN
        change_type := 'CREATE';
        new_data := row_to_json(NEW)::JSONB;
    ELSIF TG_OP = 'UPDATE' THEN
        change_type := 'UPDATE';
        old_data := row_to_json(OLD)::JSONB;
        new_data := row_to_json(NEW)::JSONB;
    ELSIF TG_OP = 'DELETE' THEN
        change_type := 'DELETE';
        old_data := row_to_json(OLD)::JSONB;
    END IF;
    
    INSERT INTO audit.timetable_changes (
        timetable_id, 
        entry_id, 
        change_type, 
        changed_by, 
        old_data, 
        new_data, 
        change_reason
    ) VALUES (
        CASE 
            WHEN TG_TABLE_NAME = 'timetables' THEN 
                CASE WHEN TG_OP = 'DELETE' THEN OLD.timetable_id ELSE NEW.timetable_id END
            WHEN TG_TABLE_NAME = 'timetable_entries' THEN 
                CASE WHEN TG_OP = 'DELETE' THEN OLD.timetable_id ELSE NEW.timetable_id END
        END,
        CASE 
            WHEN TG_TABLE_NAME = 'timetable_entries' THEN 
                CASE WHEN TG_OP = 'DELETE' THEN OLD.entry_id ELSE NEW.entry_id END
            ELSE NULL
        END,
        change_type,
        CASE 
            WHEN TG_OP = 'DELETE' THEN 
                (SELECT session_user::uuid)
            ELSE 
                (SELECT session_user::uuid)
        END,
        old_data,
        new_data,
        'System generated audit log'
    );
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add audit triggers for timetable changes
CREATE TRIGGER audit_timetable_changes
AFTER INSERT OR UPDATE OR DELETE ON timetables
FOR EACH ROW EXECUTE FUNCTION log_timetable_change();

CREATE TRIGGER audit_timetable_entry_changes
AFTER INSERT OR UPDATE OR DELETE ON timetable_entries
FOR EACH ROW EXECUTE FUNCTION log_timetable_change();
