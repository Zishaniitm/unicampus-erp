-- =============================================
-- COLLEGE TIMETABLE MANAGEMENT SYSTEM
-- MAIN SETUP SCRIPT
-- =============================================
-- Created: April 17, 2025
-- PostgreSQL 14+ Compatible
-- =============================================

-- This script combines all the individual scripts to set up the complete
-- College Timetable Management System database.

-- =============================================
-- INSTRUCTIONS
-- =============================================
-- 1. Run this script as a PostgreSQL superuser or a user with CREATE DATABASE privileges
-- 2. The script will create a new database named 'college_timetable_db'
-- 3. All required tables, functions, procedures, and sample data will be created
-- 4. Default admin user will be created with username 'admin' and password 'admin123'

-- =============================================
-- EXECUTION ORDER
-- =============================================
-- 1. Database and Extensions Setup
-- 2. Authentication Tables
-- 3. Core Entity Tables
-- 4. Relationship Tables
-- 5. Timetable and Substitution Tables
-- 6. Security Features
-- 7. Stored Procedures
-- 8. Indexes and Optimizations
-- 9. Sample Data (optional)

-- =============================================
-- SCRIPT EXECUTION
-- =============================================

-- Include all scripts in order
\i 01_database_setup.sql
\i 02_authentication_tables.sql
\i 03_core_entity_tables.sql
\i 04_relationship_tables.sql
\i 05_timetable_and_substitution_tables.sql
\i 06_security_features.sql
\i 07_stored_procedures.sql
\i 08_indexes_and_optimizations.sql
\i 09_sample_data.sql

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Verify database setup
SELECT current_database(), current_schema, version();

-- Verify extensions
SELECT extname, extversion FROM pg_extension;

-- Verify table counts
SELECT 'roles' AS table_name, COUNT(*) AS record_count FROM roles UNION ALL
SELECT 'users', COUNT(*) FROM users UNION ALL
SELECT 'departments', COUNT(*) FROM departments UNION ALL
SELECT 'teachers', COUNT(*) FROM teachers UNION ALL
SELECT 'students', COUNT(*) FROM students UNION ALL
SELECT 'courses', COUNT(*) FROM courses UNION ALL
SELECT 'batches', COUNT(*) FROM batches UNION ALL
SELECT 'classrooms', COUNT(*) FROM classrooms UNION ALL
SELECT 'timetables', COUNT(*) FROM timetables UNION ALL
SELECT 'timetable_entries', COUNT(*) FROM timetable_entries UNION ALL
SELECT 'substitutions', COUNT(*) FROM substitutions
ORDER BY table_name;

-- =============================================
-- SYSTEM OVERVIEW
-- =============================================
/*
The College Timetable Management System provides a comprehensive solution for managing
academic timetables in a college or university environment. The system supports:

1. User Management with Role-Based Access Control
   - Admin, Department Head, Teacher, Staff, Student, and Guest roles
   - Granular permissions for different operations

2. Department and Course Management
   - Multiple departments with courses
   - Course assignment to batches/sections

3. Teacher and Student Management
   - Teacher profiles with specializations
   - Student enrollment in batches

4. Timetable Generation and Management
   - Conflict-free scheduling
   - Classroom allocation
   - Time slot management

5. Substitution Handling
   - Teacher absence management
   - Substitute teacher assignment

6. Security Features
   - Role-based access control
   - Row-level security
   - Password encryption
   - Comprehensive audit logging

7. Performance Optimizations
   - Indexes for common query patterns
   - Materialized views for complex reports
*/

-- =============================================
-- COMMON USAGE EXAMPLES
-- =============================================

-- Example 1: Get a teacher's timetable for a specific day
/*
SELECT * FROM get_teacher_timetable(
    (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP001'),
    'Monday',
    '2024-2025',
    1
);
*/

-- Example 2: Get a batch's timetable for the whole week
/*
SELECT * FROM get_batch_timetable(
    (SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-A')
);
*/

-- Example 3: Find available classrooms for a specific time slot
/*
SELECT * FROM find_available_classrooms(
    'Monday',
    (SELECT time_slot_id FROM time_slots WHERE slot_name = 'Morning 1'),
    40,  -- minimum capacity
    TRUE,  -- requires projector
    TRUE,  -- requires computer
    FALSE  -- is not a lab
);
*/

-- Example 4: Find available teachers for a specific time slot
/*
SELECT * FROM find_available_teachers(
    'Monday',
    (SELECT time_slot_id FROM time_slots WHERE slot_name = 'Morning 1'),
    (SELECT department_id FROM departments WHERE department_code = 'CS')
);
*/

-- Example 5: Create a substitution
/*
CALL create_substitution(
    (timetable_entry_id),
    (substitute_teacher_id),
    '2024-09-10',
    'Reason for substitution',
    NULL  -- absence_id (optional)
);
*/

-- Example 6: Assign a teacher to a course
/*
CALL assign_teacher_to_course(
    (teacher_id),
    (course_id),
    '2024-2025',  -- academic_year
    1,  -- semester
    TRUE  -- is_primary_teacher
);
*/

-- Example 7: Create a new timetable
/*
CALL create_timetable(
    (batch_id),
    '2024-2025',  -- academic_year
    1,  -- semester
    '2024-08-15',  -- effective_from
    '2024-12-15',  -- effective_to
    (created_by_user_id)
);
*/

-- Example 8: Add a timetable entry
/*
CALL add_timetable_entry(
    (timetable_id),
    'Monday',  -- day_of_week
    (time_slot_id),
    (batch_course_id),
    (classroom_id),
    (teacher_id),
    FALSE  -- ignore_conflicts
);
*/

-- =============================================
-- MAINTENANCE TASKS
-- =============================================

-- Refresh materialized views (should be scheduled to run periodically)
/*
SELECT refresh_all_materialized_views();
*/

-- Analyze tables to update statistics
/*
ANALYZE VERBOSE;
*/

-- Vacuum tables to reclaim space and update statistics
/*
VACUUM ANALYZE;
*/
