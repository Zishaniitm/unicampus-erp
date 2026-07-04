-- =============================================
-- CORE ENTITY TABLES
-- =============================================

-- Departments Table
CREATE TABLE departments (
    department_id SERIAL PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL UNIQUE,
    department_code VARCHAR(10) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    head_of_department UUID REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE departments IS 'Academic departments within the college';

-- Classrooms Table
CREATE TABLE classrooms (
    classroom_id SERIAL PRIMARY KEY,
    classroom_name VARCHAR(50) NOT NULL,
    building VARCHAR(50) NOT NULL,
    floor INTEGER NOT NULL,
    room_number VARCHAR(20) NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    has_projector BOOLEAN DEFAULT FALSE,
    has_computer BOOLEAN DEFAULT FALSE,
    has_ac BOOLEAN DEFAULT FALSE,
    is_lab BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(building, floor, room_number)
);

COMMENT ON TABLE classrooms IS 'Physical classrooms and their facilities';

-- Batches/Sections Table
CREATE TABLE batches (
    batch_id SERIAL PRIMARY KEY,
    batch_name VARCHAR(50) NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(department_id),
    academic_year VARCHAR(9) NOT NULL, -- Format: 2024-2025
    semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
    section CHAR(1) NOT NULL, -- A, B, C, etc.
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(department_id, academic_year, semester, section),
    CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

COMMENT ON TABLE batches IS 'Student batches/sections organized by department, year, and section';

-- Teachers Table
CREATE TABLE teachers (
    teacher_id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    department_id INTEGER NOT NULL REFERENCES departments(department_id),
    employee_id VARCHAR(20) NOT NULL UNIQUE,
    designation VARCHAR(50) NOT NULL,
    qualification TEXT,
    date_of_joining DATE NOT NULL,
    specialization TEXT[],
    contact_number VARCHAR(15),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE teachers IS 'Faculty members who teach courses';

-- Students Table
CREATE TABLE students (
    student_id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    roll_number VARCHAR(20) NOT NULL UNIQUE,
    batch_id INTEGER NOT NULL REFERENCES batches(batch_id),
    admission_date DATE NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10) CHECK (gender IN ('Male', 'Female', 'Other', 'Prefer not to say')),
    address TEXT,
    contact_number VARCHAR(15),
    parent_guardian_name VARCHAR(100),
    parent_contact_number VARCHAR(15),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE students IS 'Students enrolled in the college';

-- Courses Table
CREATE TABLE courses (
    course_id SERIAL PRIMARY KEY,
    course_code VARCHAR(20) NOT NULL UNIQUE,
    course_name VARCHAR(100) NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(department_id),
    credits INTEGER NOT NULL CHECK (credits > 0),
    hours_per_week INTEGER NOT NULL CHECK (hours_per_week > 0),
    course_type VARCHAR(20) CHECK (course_type IN ('Theory', 'Practical', 'Project', 'Seminar')),
    description TEXT,
    syllabus TEXT,
    prerequisites INTEGER[] DEFAULT '{}', -- Array of course_ids that are prerequisites
    is_elective BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE courses IS 'Academic courses offered by departments';

-- Add triggers for timestamp updates
CREATE TRIGGER update_departments_timestamp
BEFORE UPDATE ON departments
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_classrooms_timestamp
BEFORE UPDATE ON classrooms
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_batches_timestamp
BEFORE UPDATE ON batches
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_teachers_timestamp
BEFORE UPDATE ON teachers
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_students_timestamp
BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_courses_timestamp
BEFORE UPDATE ON courses
FOR EACH ROW EXECUTE FUNCTION update_timestamp();
