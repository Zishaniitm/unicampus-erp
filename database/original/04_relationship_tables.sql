-- =============================================
-- RELATIONSHIP TABLES
-- =============================================

-- Teacher-Course Assignment Table
CREATE TABLE teacher_courses (
    teacher_course_id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES teachers(teacher_id),
    course_id INTEGER NOT NULL REFERENCES courses(course_id),
    academic_year VARCHAR(9) NOT NULL, -- Format: 2024-2025
    semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
    is_primary_teacher BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(teacher_id, course_id, academic_year, semester)
);

COMMENT ON TABLE teacher_courses IS 'Maps teachers to courses they are assigned to teach';

-- Batch-Course Relationship Table
CREATE TABLE batch_courses (
    batch_course_id SERIAL PRIMARY KEY,
    batch_id INTEGER NOT NULL REFERENCES batches(batch_id),
    course_id INTEGER NOT NULL REFERENCES courses(course_id),
    teacher_course_id INTEGER NOT NULL REFERENCES teacher_courses(teacher_course_id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(batch_id, course_id)
);

COMMENT ON TABLE batch_courses IS 'Maps batches to courses they are enrolled in';

-- Time Slots Table
CREATE TABLE time_slots (
    time_slot_id SERIAL PRIMARY KEY,
    slot_name VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time))/60
    ) STORED,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_time_range CHECK (end_time > start_time),
    UNIQUE(start_time, end_time)
);

COMMENT ON TABLE time_slots IS 'Defines standard time slots for scheduling classes';

-- Days of Week Enum Type
CREATE TYPE day_of_week AS ENUM ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');

COMMENT ON TYPE day_of_week IS 'Enum type for days of the week';

-- Department Working Days Table
CREATE TABLE department_working_days (
    department_id INTEGER REFERENCES departments(department_id),
    working_day day_of_week NOT NULL,
    PRIMARY KEY (department_id, working_day)
);

COMMENT ON TABLE department_working_days IS 'Working days for each department';

-- Teacher Availability Table
CREATE TABLE teacher_availability (
    availability_id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES teachers(teacher_id),
    day_of_week day_of_week NOT NULL,
    time_slot_id INTEGER NOT NULL REFERENCES time_slots(time_slot_id),
    is_available BOOLEAN DEFAULT TRUE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(teacher_id, day_of_week, time_slot_id)
);

COMMENT ON TABLE teacher_availability IS 'Tracks when teachers are available for scheduling';

-- Classroom Availability Table
CREATE TABLE classroom_availability (
    availability_id SERIAL PRIMARY KEY,
    classroom_id INTEGER NOT NULL REFERENCES classrooms(classroom_id),
    day_of_week day_of_week NOT NULL,
    time_slot_id INTEGER NOT NULL REFERENCES time_slots(time_slot_id),
    is_available BOOLEAN DEFAULT TRUE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(classroom_id, day_of_week, time_slot_id)
);

COMMENT ON TABLE classroom_availability IS 'Tracks when classrooms are available for scheduling';

-- Add triggers for timestamp updates
CREATE TRIGGER update_teacher_courses_timestamp
BEFORE UPDATE ON teacher_courses
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_batch_courses_timestamp
BEFORE UPDATE ON batch_courses
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_time_slots_timestamp
BEFORE UPDATE ON time_slots
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_teacher_availability_timestamp
BEFORE UPDATE ON teacher_availability
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_classroom_availability_timestamp
BEFORE UPDATE ON classroom_availability
FOR EACH ROW EXECUTE FUNCTION update_timestamp();
