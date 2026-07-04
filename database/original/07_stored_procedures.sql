-- =============================================
-- STORED PROCEDURES
-- =============================================

-- Schema for application procedures
SET search_path TO app, public;

-- =============================================
-- 1. TEACHER ASSIGNMENT PROCEDURES
-- =============================================

-- Procedure to assign a teacher to a course
CREATE OR REPLACE PROCEDURE assign_teacher_to_course(
    p_teacher_id INTEGER,
    p_course_id INTEGER,
    p_academic_year VARCHAR(9),
    p_semester INTEGER,
    p_is_primary_teacher BOOLEAN DEFAULT TRUE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_teacher_dept_id INTEGER;
    v_course_dept_id INTEGER;
BEGIN
    -- Check if teacher and course exist
    IF NOT EXISTS (SELECT 1 FROM teachers WHERE teacher_id = p_teacher_id) THEN
        RAISE EXCEPTION 'Teacher with ID % does not exist', p_teacher_id;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM courses WHERE course_id = p_course_id) THEN
        RAISE EXCEPTION 'Course with ID % does not exist', p_course_id;
    END IF;
    
    -- Check if teacher and course belong to the same department
    SELECT department_id INTO v_teacher_dept_id FROM teachers WHERE teacher_id = p_teacher_id;
    SELECT department_id INTO v_course_dept_id FROM courses WHERE course_id = p_course_id;
    
    IF v_teacher_dept_id != v_course_dept_id THEN
        RAISE WARNING 'Teacher (dept ID: %) and course (dept ID: %) belong to different departments', 
                      v_teacher_dept_id, v_course_dept_id;
    END IF;
    
    -- Check if assignment already exists
    IF EXISTS (
        SELECT 1 FROM teacher_courses 
        WHERE teacher_id = p_teacher_id 
        AND course_id = p_course_id 
        AND academic_year = p_academic_year 
        AND semester = p_semester
    ) THEN
        -- Update existing assignment
        UPDATE teacher_courses
        SET is_primary_teacher = p_is_primary_teacher,
            is_active = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE teacher_id = p_teacher_id 
        AND course_id = p_course_id 
        AND academic_year = p_academic_year 
        AND semester = p_semester;
        
        RAISE NOTICE 'Updated existing teacher-course assignment';
    ELSE
        -- Create new assignment
        INSERT INTO teacher_courses (
            teacher_id, 
            course_id, 
            academic_year, 
            semester, 
            is_primary_teacher
        ) VALUES (
            p_teacher_id, 
            p_course_id, 
            p_academic_year, 
            p_semester, 
            p_is_primary_teacher
        );
        
        RAISE NOTICE 'Created new teacher-course assignment';
    END IF;
    
    -- If this is the primary teacher, update any other primary assignments for this course
    IF p_is_primary_teacher THEN
        UPDATE teacher_courses
        SET is_primary_teacher = FALSE
        WHERE course_id = p_course_id 
        AND academic_year = p_academic_year 
        AND semester = p_semester
        AND teacher_id != p_teacher_id
        AND is_primary_teacher = TRUE;
        
        RAISE NOTICE 'Updated other primary teacher assignments for this course';
    END IF;
END;
$$;

COMMENT ON PROCEDURE assign_teacher_to_course IS 'Assigns a teacher to a course for a specific academic year and semester';

-- Procedure to remove a teacher from a course
CREATE OR REPLACE PROCEDURE remove_teacher_from_course(
    p_teacher_id INTEGER,
    p_course_id INTEGER,
    p_academic_year VARCHAR(9),
    p_semester INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check if assignment exists
    IF NOT EXISTS (
        SELECT 1 FROM teacher_courses 
        WHERE teacher_id = p_teacher_id 
        AND course_id = p_course_id 
        AND academic_year = p_academic_year 
        AND semester = p_semester
    ) THEN
        RAISE EXCEPTION 'Teacher-course assignment does not exist';
    END IF;
    
    -- Check if teacher is assigned to any timetable entries
    IF EXISTS (
        SELECT 1 
        FROM timetable_entries te
        JOIN timetables t ON te.timetable_id = t.timetable_id
        WHERE te.teacher_id = p_teacher_id
        AND t.academic_year = p_academic_year
        AND t.semester = p_semester
        AND EXISTS (
            SELECT 1 
            FROM batch_courses bc
            WHERE bc.batch_course_id = te.batch_course_id
            AND bc.course_id = p_course_id
        )
    ) THEN
        RAISE EXCEPTION 'Cannot remove teacher from course as they are assigned to timetable entries';
    END IF;
    
    -- Deactivate the assignment instead of deleting
    UPDATE teacher_courses
    SET is_active = FALSE,
        updated_at = CURRENT_TIMESTAMP
    WHERE teacher_id = p_teacher_id 
    AND course_id = p_course_id 
    AND academic_year = p_academic_year 
    AND semester = p_semester;
    
    RAISE NOTICE 'Teacher-course assignment deactivated';
END;
$$;

COMMENT ON PROCEDURE remove_teacher_from_course IS 'Removes a teacher from a course for a specific academic year and semester';

-- =============================================
-- 2. TIMETABLE GENERATION PROCEDURES
-- =============================================

-- Procedure to create a new timetable
CREATE OR REPLACE PROCEDURE create_timetable(
    p_batch_id INTEGER,
    p_academic_year VARCHAR(9),
    p_semester INTEGER,
    p_effective_from DATE,
    p_effective_to DATE DEFAULT NULL,
    p_created_by UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_timetable_id INTEGER;
BEGIN
    -- Check if batch exists
    IF NOT EXISTS (SELECT 1 FROM batches WHERE batch_id = p_batch_id) THEN
        RAISE EXCEPTION 'Batch with ID % does not exist', p_batch_id;
    END IF;
    
    -- Check if a timetable already exists for this batch, academic year, and semester
    IF EXISTS (
        SELECT 1 FROM timetables 
        WHERE batch_id = p_batch_id 
        AND academic_year = p_academic_year 
        AND semester = p_semester
        AND is_active = TRUE
    ) THEN
        -- Deactivate existing timetable
        UPDATE timetables
        SET is_active = FALSE,
            updated_at = CURRENT_TIMESTAMP
        WHERE batch_id = p_batch_id 
        AND academic_year = p_academic_year 
        AND semester = p_semester
        AND is_active = TRUE;
        
        RAISE NOTICE 'Deactivated existing timetable';
    END IF;
    
    -- Create new timetable
    INSERT INTO timetables (
        batch_id, 
        academic_year, 
        semester, 
        effective_from, 
        effective_to, 
        created_by
    ) VALUES (
        p_batch_id, 
        p_academic_year, 
        p_semester, 
        p_effective_from, 
        p_effective_to, 
        p_created_by
    ) RETURNING timetable_id INTO v_timetable_id;
    
    RAISE NOTICE 'Created new timetable with ID %', v_timetable_id;
END;
$$;

COMMENT ON PROCEDURE create_timetable IS 'Creates a new timetable for a batch, academic year, and semester';

-- Function to check for timetable conflicts
CREATE OR REPLACE FUNCTION check_timetable_conflicts(
    p_timetable_id INTEGER,
    p_day_of_week day_of_week,
    p_time_slot_id INTEGER,
    p_batch_id INTEGER,
    p_classroom_id INTEGER,
    p_teacher_id INTEGER
)
RETURNS TABLE (
    conflict_type VARCHAR(50),
    description TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check for batch clash
    RETURN QUERY
    SELECT 
        'BATCH_CLASH'::VARCHAR(50) AS conflict_type,
        format('Batch %s already has a class scheduled on %s during this time slot', 
               p_batch_id, p_day_of_week) AS description
    WHERE EXISTS (
        SELECT 1 
        FROM timetable_entries te
        JOIN timetables t ON te.timetable_id = t.timetable_id
        WHERE t.batch_id = p_batch_id
        AND te.day_of_week = p_day_of_week
        AND te.time_slot_id = p_time_slot_id
        AND t.is_active = TRUE
        AND te.is_active = TRUE
        AND t.timetable_id != p_timetable_id
    );
    
    -- Check for teacher clash
    RETURN QUERY
    SELECT 
        'TEACHER_CLASH'::VARCHAR(50) AS conflict_type,
        format('Teacher %s already has a class scheduled on %s during this time slot', 
               p_teacher_id, p_day_of_week) AS description
    WHERE EXISTS (
        SELECT 1 
        FROM timetable_entries te
        WHERE te.teacher_id = p_teacher_id
        AND te.day_of_week = p_day_of_week
        AND te.time_slot_id = p_time_slot_id
        AND te.is_active = TRUE
        AND (te.timetable_id != p_timetable_id OR p_timetable_id IS NULL)
    );
    
    -- Check for classroom clash
    RETURN QUERY
    SELECT 
        'CLASSROOM_CLASH'::VARCHAR(50) AS conflict_type,
        format('Classroom %s already has a class scheduled on %s during this time slot', 
               p_classroom_id, p_day_of_week) AS description
    WHERE EXISTS (
        SELECT 1 
        FROM timetable_entries te
        WHERE te.classroom_id = p_classroom_id
        AND te.day_of_week = p_day_of_week
        AND te.time_slot_id = p_time_slot_id
        AND te.is_active = TRUE
        AND (te.timetable_id != p_timetable_id OR p_timetable_id IS NULL)
    );
    
    -- Check for teacher unavailability
    RETURN QUERY
    SELECT 
        'TEACHER_UNAVAILABLE'::VARCHAR(50) AS conflict_type,
        format('Teacher %s is marked as unavailable on %s during this time slot', 
               p_teacher_id, p_day_of_week) AS description
    WHERE EXISTS (
        SELECT 1 
        FROM teacher_availability ta
        WHERE ta.teacher_id = p_teacher_id
        AND ta.day_of_week = p_day_of_week
        AND ta.time_slot_id = p_time_slot_id
        AND ta.is_available = FALSE
    );
    
    -- Check for classroom unavailability
    RETURN QUERY
    SELECT 
        'CLASSROOM_UNAVAILABLE'::VARCHAR(50) AS conflict_type,
        format('Classroom %s is marked as unavailable on %s during this time slot', 
               p_classroom_id, p_day_of_week) AS description
    WHERE EXISTS (
        SELECT 1 
        FROM classroom_availability ca
        WHERE ca.classroom_id = p_classroom_id
        AND ca.day_of_week = p_day_of_week
        AND ca.time_slot_id = p_time_slot_id
        AND ca.is_available = FALSE
    );
    
    RETURN;
END;
$$;

COMMENT ON FUNCTION check_timetable_conflicts IS 'Checks for conflicts when scheduling a timetable entry';

-- Procedure to add a timetable entry
CREATE OR REPLACE PROCEDURE add_timetable_entry(
    p_timetable_id INTEGER,
    p_day_of_week day_of_week,
    p_time_slot_id INTEGER,
    p_batch_course_id INTEGER,
    p_classroom_id INTEGER,
    p_teacher_id INTEGER,
    p_ignore_conflicts BOOLEAN DEFAULT FALSE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_batch_id INTEGER;
    v_conflict RECORD;
    v_entry_id INTEGER;
BEGIN
    -- Get batch ID from timetable
    SELECT batch_id INTO v_batch_id
    FROM timetables
    WHERE timetable_id = p_timetable_id;
    
    IF v_batch_id IS NULL THEN
        RAISE EXCEPTION 'Timetable with ID % does not exist', p_timetable_id;
    END IF;
    
    -- Check for conflicts
    IF NOT p_ignore_conflicts THEN
        FOR v_conflict IN 
            SELECT * FROM check_timetable_conflicts(
                p_timetable_id,
                p_day_of_week,
                p_time_slot_id,
                v_batch_id,
                p_classroom_id,
                p_teacher_id
            )
        LOOP
            -- Log the conflict
            INSERT INTO timetable_conflicts (
                conflict_type,
                description,
                is_resolved,
                created_at
            ) VALUES (
                v_conflict.conflict_type,
                v_conflict.description,
                FALSE,
                CURRENT_TIMESTAMP
            );
            
            RAISE WARNING 'Conflict detected: % - %', v_conflict.conflict_type, v_conflict.description;
            
            -- If not ignoring conflicts, raise an exception
            RAISE EXCEPTION 'Cannot add timetable entry due to conflict: % - %', 
                           v_conflict.conflict_type, v_conflict.description;
        END LOOP;
    END IF;
    
    -- Add timetable entry
    INSERT INTO timetable_entries (
        timetable_id,
        day_of_week,
        time_slot_id,
        batch_course_id,
        classroom_id,
        teacher_id
    ) VALUES (
        p_timetable_id,
        p_day_of_week,
        p_time_slot_id,
        p_batch_course_id,
        p_classroom_id,
        p_teacher_id
    ) RETURNING entry_id INTO v_entry_id;
    
    RAISE NOTICE 'Added timetable entry with ID %', v_entry_id;
END;
$$;

COMMENT ON PROCEDURE add_timetable_entry IS 'Adds a new entry to a timetable with conflict checking';

-- =============================================
-- 3. SUBSTITUTION MANAGEMENT PROCEDURES
-- =============================================

-- Procedure to create a substitution
CREATE OR REPLACE PROCEDURE create_substitution(
    p_timetable_entry_id INTEGER,
    p_substitute_teacher_id INTEGER,
    p_substitution_date DATE,
    p_reason TEXT DEFAULT NULL,
    p_absence_id INTEGER DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_original_teacher_id INTEGER;
    v_day_of_week day_of_week;
    v_time_slot_id INTEGER;
    v_conflict RECORD;
BEGIN
    -- Get original teacher ID from timetable entry
    SELECT teacher_id, day_of_week, time_slot_id 
    INTO v_original_teacher_id, v_day_of_week, v_time_slot_id
    FROM timetable_entries
    WHERE entry_id = p_timetable_entry_id;
    
    IF v_original_teacher_id IS NULL THEN
        RAISE EXCEPTION 'Timetable entry with ID % does not exist', p_timetable_entry_id;
    END IF;
    
    -- Check if substitute teacher exists
    IF NOT EXISTS (SELECT 1 FROM teachers WHERE teacher_id = p_substitute_teacher_id) THEN
        RAISE EXCEPTION 'Substitute teacher with ID % does not exist', p_substitute_teacher_id;
    END IF;
    
    -- Check if substitute teacher is the same as original teacher
    IF v_original_teacher_id = p_substitute_teacher_id THEN
        RAISE EXCEPTION 'Substitute teacher cannot be the same as the original teacher';
    END IF;
    
    -- Check if substitution date is a valid day of the week
    IF EXTRACT(DOW FROM p_substitution_date) != 
       CASE 
           WHEN v_day_of_week = 'Monday' THEN 1
           WHEN v_day_of_week = 'Tuesday' THEN 2
           WHEN v_day_of_week = 'Wednesday' THEN 3
           WHEN v_day_of_week = 'Thursday' THEN 4
           WHEN v_day_of_week = 'Friday' THEN 5
           WHEN v_day_of_week = 'Saturday' THEN 6
           WHEN v_day_of_week = 'Sunday' THEN 0
       END THEN
        RAISE WARNING 'Substitution date % is not a %', p_substitution_date, v_day_of_week;
    END IF;
    
    -- Check if substitute teacher is available at that time
    FOR v_conflict IN 
        SELECT * FROM check_timetable_conflicts(
            NULL, -- Not checking against a specific timetable
            v_day_of_week,
            v_time_slot_id,
            NULL, -- Not checking batch conflicts
            NULL, -- Not checking classroom conflicts
            p_substitute_teacher_id
        )
    LOOP
        IF v_conflict.conflict_type IN ('TEACHER_CLASH', 'TEACHER_UNAVAILABLE') THEN
            RAISE WARNING 'Substitute teacher conflict: % - %', v_conflict.conflict_type, v_conflict.description;
        END IF;
    END LOOP;
    
    -- Check if a substitution already exists for this entry and date
    IF EXISTS (
        SELECT 1 FROM substitutions
        WHERE timetable_entry_id = p_timetable_entry_id
        AND substitution_date = p_substitution_date
    ) THEN
        -- Update existing substitution
        UPDATE substitutions
        SET substitute_teacher_id = p_substitute_teacher_id,
            absence_id = p_absence_id,
            reason = p_reason,
            is_confirmed = FALSE,
            confirmed_by = NULL,
            notification_sent = FALSE,
            updated_at = CURRENT_TIMESTAMP
        WHERE timetable_entry_id = p_timetable_entry_id
        AND substitution_date = p_substitution_date;
        
        RAISE NOTICE 'Updated existing substitution';
    ELSE
        -- Create new substitution
        INSERT INTO substitutions (
            timetable_entry_id,
            original_teacher_id,
            substitute_teacher_id,
            absence_id,
            substitution_date,
            reason
        ) VALUES (
            p_timetable_entry_id,
            v_original_teacher_id,
            p_substitute_teacher_id,
            p_absence_id,
            p_substitution_date,
            p_reason
        );
        
        RAISE NOTICE 'Created new substitution';
    END IF;
END;
$$;

COMMENT ON PROCEDURE create_substitution IS 'Creates a substitution for a teacher in a timetable entry';

-- Procedure to approve a substitution
CREATE OR REPLACE PROCEDURE approve_substitution(
    p_substitution_id INTEGER,
    p_approved_by UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check if substitution exists
    IF NOT EXISTS (SELECT 1 FROM substitutions WHERE substitution_id = p_substitution_id) THEN
        RAISE EXCEPTION 'Substitution with ID % does not exist', p_substitution_id;
    END IF;
    
    -- Update substitution
    UPDATE substitutions
    SET is_confirmed = TRUE,
        confirmed_by = p_approved_by,
        updated_at = CURRENT_TIMESTAMP
    WHERE substitution_id = p_substitution_id;
    
    RAISE NOTICE 'Approved substitution with ID %', p_substitution_id;
END;
$$;

COMMENT ON PROCEDURE approve_substitution IS 'Approves a substitution request';

-- =============================================
-- 4. UTILITY PROCEDURES
-- =============================================

-- Function to get a teacher's timetable for a specific day
CREATE OR REPLACE FUNCTION get_teacher_timetable(
    p_teacher_id INTEGER,
    p_day_of_week day_of_week DEFAULT NULL,
    p_academic_year VARCHAR(9) DEFAULT NULL,
    p_semester INTEGER DEFAULT NULL
)
RETURNS TABLE (
    day day_of_week,
    start_time TIME,
    end_time TIME,
    course_name VARCHAR(100),
    batch_name VARCHAR(50),
    classroom_name VARCHAR(50),
    is_substitution BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        te.day_of_week AS day,
        ts.start_time,
        ts.end_time,
        c.course_name,
        b.batch_name,
        cr.classroom_name,
        CASE WHEN s.substitution_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_substitution
    FROM timetable_entries te
    JOIN time_slots ts ON te.time_slot_id = ts.time_slot_id
    JOIN batch_courses bc ON te.batch_course_id = bc.batch_course_id
    JOIN courses c ON bc.course_id = c.course_id
    JOIN timetables t ON te.timetable_id = t.timetable_id
    JOIN batches b ON t.batch_id = b.batch_id
    JOIN classrooms cr ON te.classroom_id = cr.classroom_id
    LEFT JOIN substitutions s ON te.entry_id = s.timetable_entry_id 
                             AND s.substitution_date = CURRENT_DATE
                             AND s.is_confirmed = TRUE
    WHERE (te.teacher_id = p_teacher_id OR s.substitute_teacher_id = p_teacher_id)
    AND (p_day_of_week IS NULL OR te.day_of_week = p_day_of_week)
    AND (p_academic_year IS NULL OR t.academic_year = p_academic_year)
    AND (p_semester IS NULL OR t.semester = p_semester)
    AND te.is_active = TRUE
    AND t.is_active = TRUE
    ORDER BY 
        CASE 
            WHEN te.day_of_week = 'Monday' THEN 1
            WHEN te.day_of_week = 'Tuesday' THEN 2
            WHEN te.day_of_week = 'Wednesday' THEN 3
            WHEN te.day_of_week = 'Thursday' THEN 4
            WHEN te.day_of_week = 'Friday' THEN 5
            WHEN te.day_of_week = 'Saturday' THEN 6
            WHEN te.day_of_week = 'Sunday' THEN 7
        END,
        ts.start_time;
END;
$$;

COMMENT ON FUNCTION get_teacher_timetable IS 'Gets a teacher''s timetable for a specific day or all days';

-- Function to get a batch's timetable for a specific day
CREATE OR REPLACE FUNCTION get_batch_timetable(
    p_batch_id INTEGER,
    p_day_of_week day_of_week DEFAULT NULL,
    p_academic_year VARCHAR(9) DEFAULT NULL,
    p_semester INTEGER DEFAULT NULL
)
RETURNS TABLE (
    day day_of_week,
    start_time TIME,
    end_time TIME,
    course_name VARCHAR(100),
    teacher_name VARCHAR(201),
    classroom_name VARCHAR(50),
    has_substitution BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        te.day_of_week AS day,
        ts.start_time,
        ts.end_time,
        c.course_name,
        CASE 
            WHEN s.substitution_id IS NOT NULL THEN 
                (SELECT first_name || ' ' || last_name 
                 FROM teachers t JOIN users u ON t.user_id = u.user_id 
                 WHERE t.teacher_id = s.substitute_teacher_id)
            ELSE 
                (SELECT first_name || ' ' || last_name 
                 FROM teachers t JOIN users u ON t.user_id = u.user_id 
                 WHERE t.teacher_id = te.teacher_id)
        END AS teacher_name,
        cr.classroom_name,
        CASE WHEN s.substitution_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_substitution
    FROM timetables t
    JOIN timetable_entries te ON t.timetable_id = te.timetable_id
    JOIN time_slots ts ON te.time_slot_id = ts.time_slot_id
    JOIN batch_courses bc ON te.batch_course_id = bc.batch_course_id
    JOIN courses c ON bc.course_id = c.course_id
    JOIN classrooms cr ON te.classroom_id = cr.classroom_id
    LEFT JOIN substitutions s ON te.entry_id = s.timetable_entry_id 
                             AND s.substitution_date = CURRENT_DATE
                             AND s.is_confirmed = TRUE
    WHERE t.batch_id = p_batch_id
    AND (p_day_of_week IS NULL OR te.day_of_week = p_day_of_week)
    AND (p_academic_year IS NULL OR t.academic_year = p_academic_year)
    AND (p_semester IS NULL OR t.semester = p_semester)
    AND te.is_active = TRUE
    AND t.is_active = TRUE
    ORDER BY 
        CASE 
            WHEN te.day_of_week = 'Monday' THEN 1
            WHEN te.day_of_week = 'Tuesday' THEN 2
            WHEN te.day_of_week = 'Wednesday' THEN 3
            WHEN te.day_of_week = 'Thursday' THEN 4
            WHEN te.day_of_week = 'Friday' THEN 5
            WHEN te.day_of_week = 'Saturday' THEN 6
            WHEN te.day_of_week = 'Sunday' THEN 7
        END,
        ts.start_time;
END;
$$;

COMMENT ON FUNCTION get_batch_timetable IS 'Gets a batch''s timetable for a specific day or all days';

-- Function to get a classroom's timetable for a specific day
CREATE OR REPLACE FUNCTION get_classroom_timetable(
    p_classroom_id INTEGER,
    p_day_of_week day_of_week DEFAULT NULL,
    p_academic_year VARCHAR(9) DEFAULT NULL,
    p_semester INTEGER DEFAULT NULL
)
RETURNS TABLE (
    day day_of_week,
    start_time TIME,
    end_time TIME,
    course_name VARCHAR(100),
    batch_name VARCHAR(50),
    teacher_name VARCHAR(201),
    has_substitution BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        te.day_of_week AS day,
        ts.start_time,
        ts.end_time,
        c.course_name,
        b.batch_name,
        CASE 
            WHEN s.substitution_id IS NOT NULL THEN 
                (SELECT first_name || ' ' || last_name 
                 FROM teachers t JOIN users u ON t.user_id = u.user_id 
                 WHERE t.teacher_id = s.substitute_teacher_id)
            ELSE 
                (SELECT first_name || ' ' || last_name 
                 FROM teachers t JOIN users u ON t.user_id = u.user_id 
                 WHERE t.teacher_id = te.teacher_id)
        END AS teacher_name,
        CASE WHEN s.substitution_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_substitution
    FROM timetable_entries te
    JOIN time_slots ts ON te.time_slot_id = ts.time_slot_id
    JOIN batch_courses bc ON te.batch_course_id = bc.batch_course_id
    JOIN courses c ON bc.course_id = c.course_id
    JOIN timetables t ON te.timetable_id = t.timetable_id
    JOIN batches b ON t.batch_id = b.batch_id
    LEFT JOIN substitutions s ON te.entry_id = s.timetable_entry_id 
                             AND s.substitution_date = CURRENT_DATE
                             AND s.is_confirmed = TRUE
    WHERE te.classroom_id = p_classroom_id
    AND (p_day_of_week IS NULL OR te.day_of_week = p_day_of_week)
    AND (p_academic_year IS NULL OR t.academic_year = p_academic_year)
    AND (p_semester IS NULL OR t.semester = p_semester)
    AND te.is_active = TRUE
    AND t.is_active = TRUE
    ORDER BY 
        CASE 
            WHEN te.day_of_week = 'Monday' THEN 1
            WHEN te.day_of_week = 'Tuesday' THEN 2
            WHEN te.day_of_week = 'Wednesday' THEN 3
            WHEN te.day_of_week = 'Thursday' THEN 4
            WHEN te.day_of_week = 'Friday' THEN 5
            WHEN te.day_of_week = 'Saturday' THEN 6
            WHEN te.day_of_week = 'Sunday' THEN 7
        END,
        ts.start_time;
END;
$$;

COMMENT ON FUNCTION get_classroom_timetable IS 'Gets a classroom''s timetable for a specific day or all days';

-- Function to find available classrooms for a specific time slot
CREATE OR REPLACE FUNCTION find_available_classrooms(
    p_day_of_week day_of_week,
    p_time_slot_id INTEGER,
    p_min_capacity INTEGER DEFAULT NULL,
    p_requires_projector BOOLEAN DEFAULT FALSE,
    p_requires_computer BOOLEAN DEFAULT FALSE,
    p_is_lab BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    classroom_id INTEGER,
    classroom_name VARCHAR(50),
    building VARCHAR(50),
    room_number VARCHAR(20),
    capacity INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.classroom_id,
        c.classroom_name,
        c.building,
        c.room_number,
        c.capacity
    FROM classrooms c
    WHERE c.is_active = TRUE
    AND (p_min_capacity IS NULL OR c.capacity >= p_min_capacity)
    AND (p_requires_projector = FALSE OR c.has_projector = TRUE)
    AND (p_requires_computer = FALSE OR c.has_computer = TRUE)
    AND (p_is_lab = FALSE OR c.is_lab = TRUE)
    AND NOT EXISTS (
        SELECT 1 
        FROM timetable_entries te
        JOIN timetables t ON te.timetable_id = t.timetable_id
        WHERE te.classroom_id = c.classroom_id
        AND te.day_of_week = p_day_of_week
        AND te.time_slot_id = p_time_slot_id
        AND te.is_active = TRUE
        AND t.is_active = TRUE
    )
    AND NOT EXISTS (
        SELECT 1 
        FROM classroom_availability ca
        WHERE ca.classroom_id = c.classroom_id
        AND ca.day_of_week = p_day_of_week
        AND ca.time_slot_id = p_time_slot_id
        AND ca.is_available = FALSE
    )
    ORDER BY c.capacity;
END;
$$;

COMMENT ON FUNCTION find_available_classrooms IS 'Finds available classrooms for a specific time slot';

-- Function to find available teachers for a specific time slot
CREATE OR REPLACE FUNCTION find_available_teachers(
    p_day_of_week day_of_week,
    p_time_slot_id INTEGER,
    p_department_id INTEGER DEFAULT NULL,
    p_course_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
    teacher_id INTEGER,
    teacher_name VARCHAR(201),
    department_name VARCHAR(100),
    specialization TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.teacher_id,
        u.first_name || ' ' || u.last_name AS teacher_name,
        d.department_name,
        t.specialization
    FROM teachers t
    JOIN users u ON t.user_id = u.user_id
    JOIN departments d ON t.department_id = d.department_id
    WHERE t.is_active = TRUE
    AND (p_department_id IS NULL OR t.department_id = p_department_id)
    AND (
        p_course_id IS NULL OR 
        EXISTS (
            SELECT 1 
            FROM teacher_courses tc
            WHERE tc.teacher_id = t.teacher_id
            AND tc.course_id = p_course_id
            AND tc.is_active = TRUE
        )
    )
    AND NOT EXISTS (
        SELECT 1 
        FROM timetable_entries te
        JOIN timetables tm ON te.timetable_id = tm.timetable_id
        WHERE te.teacher_id = t.teacher_id
        AND te.day_of_week = p_day_of_week
        AND te.time_slot_id = p_time_slot_id
        AND te.is_active = TRUE
        AND tm.is_active = TRUE
    )
    AND NOT EXISTS (
        SELECT 1 
        FROM teacher_availability ta
        WHERE ta.teacher_id = t.teacher_id
        AND ta.day_of_week = p_day_of_week
        AND ta.time_slot_id = p_time_slot_id
        AND ta.is_available = FALSE
    )
    ORDER BY t.teacher_id;
END;
$$;

COMMENT ON FUNCTION find_available_teachers IS 'Finds available teachers for a specific time slot';

-- Reset search path
SET search_path TO public;
