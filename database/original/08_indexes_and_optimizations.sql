-- =============================================
-- INDEXES AND OPTIMIZATIONS
-- =============================================

-- =============================================
-- 1. INDEXES FOR AUTHENTICATION TABLES
-- =============================================

-- Users table indexes
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_last_login ON users(last_login);

-- User Sessions table indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_login_timestamp ON user_sessions(login_timestamp);
CREATE INDEX idx_user_sessions_is_active ON user_sessions(is_active);

-- Access Logs table indexes
CREATE INDEX idx_access_logs_user_id ON audit.access_logs(user_id);
CREATE INDEX idx_access_logs_action ON audit.access_logs(action);
CREATE INDEX idx_access_logs_resource_type ON audit.access_logs(resource_type);
CREATE INDEX idx_access_logs_timestamp ON audit.access_logs(timestamp);
CREATE INDEX idx_access_logs_ip_address ON audit.access_logs(ip_address);

-- =============================================
-- 2. INDEXES FOR CORE ENTITY TABLES
-- =============================================

-- Departments table indexes
CREATE INDEX idx_departments_head_of_department ON departments(head_of_department);
CREATE INDEX idx_departments_is_active ON departments(is_active);

-- Classrooms table indexes
CREATE INDEX idx_classrooms_building ON classrooms(building);
CREATE INDEX idx_classrooms_capacity ON classrooms(capacity);
CREATE INDEX idx_classrooms_is_lab ON classrooms(is_lab);
CREATE INDEX idx_classrooms_is_active ON classrooms(is_active);

-- Batches table indexes
CREATE INDEX idx_batches_department_id ON batches(department_id);
CREATE INDEX idx_batches_academic_year ON batches(academic_year);
CREATE INDEX idx_batches_semester ON batches(semester);
CREATE INDEX idx_batches_is_active ON batches(is_active);
CREATE INDEX idx_batches_start_date ON batches(start_date);
CREATE INDEX idx_batches_end_date ON batches(end_date);

-- Teachers table indexes
CREATE INDEX idx_teachers_user_id ON teachers(user_id);
CREATE INDEX idx_teachers_department_id ON teachers(department_id);
CREATE INDEX idx_teachers_is_active ON teachers(is_active);
CREATE INDEX idx_teachers_employee_id ON teachers(employee_id);

-- Students table indexes
CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_students_batch_id ON students(batch_id);
CREATE INDEX idx_students_roll_number ON students(roll_number);
CREATE INDEX idx_students_is_active ON students(is_active);

-- Courses table indexes
CREATE INDEX idx_courses_department_id ON courses(department_id);
CREATE INDEX idx_courses_course_type ON courses(course_type);
CREATE INDEX idx_courses_is_elective ON courses(is_elective);
CREATE INDEX idx_courses_is_active ON courses(is_active);
CREATE INDEX idx_courses_credits ON courses(credits);

-- =============================================
-- 3. INDEXES FOR RELATIONSHIP TABLES
-- =============================================

-- Teacher Courses table indexes
CREATE INDEX idx_teacher_courses_teacher_id ON teacher_courses(teacher_id);
CREATE INDEX idx_teacher_courses_course_id ON teacher_courses(course_id);
CREATE INDEX idx_teacher_courses_academic_year ON teacher_courses(academic_year);
CREATE INDEX idx_teacher_courses_semester ON teacher_courses(semester);
CREATE INDEX idx_teacher_courses_is_primary_teacher ON teacher_courses(is_primary_teacher);
CREATE INDEX idx_teacher_courses_is_active ON teacher_courses(is_active);

-- Batch Courses table indexes
CREATE INDEX idx_batch_courses_batch_id ON batch_courses(batch_id);
CREATE INDEX idx_batch_courses_course_id ON batch_courses(course_id);
CREATE INDEX idx_batch_courses_teacher_course_id ON batch_courses(teacher_course_id);
CREATE INDEX idx_batch_courses_is_active ON batch_courses(is_active);

-- Time Slots table indexes
CREATE INDEX idx_time_slots_start_time ON time_slots(start_time);
CREATE INDEX idx_time_slots_end_time ON time_slots(end_time);
CREATE INDEX idx_time_slots_duration_minutes ON time_slots(duration_minutes);
CREATE INDEX idx_time_slots_is_active ON time_slots(is_active);

-- Department Working Days table indexes
CREATE INDEX idx_department_working_days_department_id ON department_working_days(department_id);
CREATE INDEX idx_department_working_days_working_day ON department_working_days(working_day);

-- Teacher Availability table indexes
CREATE INDEX idx_teacher_availability_teacher_id ON teacher_availability(teacher_id);
CREATE INDEX idx_teacher_availability_day_of_week ON teacher_availability(day_of_week);
CREATE INDEX idx_teacher_availability_time_slot_id ON teacher_availability(time_slot_id);
CREATE INDEX idx_teacher_availability_is_available ON teacher_availability(is_available);

-- Classroom Availability table indexes
CREATE INDEX idx_classroom_availability_classroom_id ON classroom_availability(classroom_id);
CREATE INDEX idx_classroom_availability_day_of_week ON classroom_availability(day_of_week);
CREATE INDEX idx_classroom_availability_time_slot_id ON classroom_availability(time_slot_id);
CREATE INDEX idx_classroom_availability_is_available ON classroom_availability(is_available);

-- =============================================
-- 4. INDEXES FOR TIMETABLE TABLES
-- =============================================

-- Timetables table indexes
CREATE INDEX idx_timetables_batch_id ON timetables(batch_id);
CREATE INDEX idx_timetables_academic_year ON timetables(academic_year);
CREATE INDEX idx_timetables_semester ON timetables(semester);
CREATE INDEX idx_timetables_is_active ON timetables(is_active);
CREATE INDEX idx_timetables_effective_from ON timetables(effective_from);
CREATE INDEX idx_timetables_effective_to ON timetables(effective_to);
CREATE INDEX idx_timetables_created_by ON timetables(created_by);

-- Timetable Entries table indexes
CREATE INDEX idx_timetable_entries_timetable_id ON timetable_entries(timetable_id);
CREATE INDEX idx_timetable_entries_day_of_week ON timetable_entries(day_of_week);
CREATE INDEX idx_timetable_entries_time_slot_id ON timetable_entries(time_slot_id);
CREATE INDEX idx_timetable_entries_batch_course_id ON timetable_entries(batch_course_id);
CREATE INDEX idx_timetable_entries_classroom_id ON timetable_entries(classroom_id);
CREATE INDEX idx_timetable_entries_teacher_id ON timetable_entries(teacher_id);
CREATE INDEX idx_timetable_entries_is_active ON timetable_entries(is_active);
CREATE INDEX idx_timetable_entries_batch_id ON timetable_entries(batch_id);

-- Teacher Absences table indexes
CREATE INDEX idx_teacher_absences_teacher_id ON teacher_absences(teacher_id);
CREATE INDEX idx_teacher_absences_start_date ON teacher_absences(start_date);
CREATE INDEX idx_teacher_absences_end_date ON teacher_absences(end_date);
CREATE INDEX idx_teacher_absences_is_approved ON teacher_absences(is_approved);
CREATE INDEX idx_teacher_absences_approved_by ON teacher_absences(approved_by);

-- Substitutions table indexes
CREATE INDEX idx_substitutions_timetable_entry_id ON substitutions(timetable_entry_id);
CREATE INDEX idx_substitutions_original_teacher_id ON substitutions(original_teacher_id);
CREATE INDEX idx_substitutions_substitute_teacher_id ON substitutions(substitute_teacher_id);
CREATE INDEX idx_substitutions_absence_id ON substitutions(absence_id);
CREATE INDEX idx_substitutions_substitution_date ON substitutions(substitution_date);
CREATE INDEX idx_substitutions_is_confirmed ON substitutions(is_confirmed);
CREATE INDEX idx_substitutions_confirmed_by ON substitutions(confirmed_by);
CREATE INDEX idx_substitutions_notification_sent ON substitutions(notification_sent);

-- Timetable Changes table indexes
CREATE INDEX idx_timetable_changes_timetable_id ON audit.timetable_changes(timetable_id);
CREATE INDEX idx_timetable_changes_entry_id ON audit.timetable_changes(entry_id);
CREATE INDEX idx_timetable_changes_change_type ON audit.timetable_changes(change_type);
CREATE INDEX idx_timetable_changes_changed_by ON audit.timetable_changes(changed_by);
CREATE INDEX idx_timetable_changes_timestamp ON audit.timetable_changes(timestamp);

-- Timetable Conflicts table indexes
CREATE INDEX idx_timetable_conflicts_conflict_type ON timetable_conflicts(conflict_type);
CREATE INDEX idx_timetable_conflicts_timetable_entry_id ON timetable_conflicts(timetable_entry_id);
CREATE INDEX idx_timetable_conflicts_conflicting_entry_id ON timetable_conflicts(conflicting_entry_id);
CREATE INDEX idx_timetable_conflicts_is_resolved ON timetable_conflicts(is_resolved);
CREATE INDEX idx_timetable_conflicts_resolved_by ON timetable_conflicts(resolved_by);

-- =============================================
-- 5. COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- =============================================

-- Composite indexes for users
CREATE INDEX idx_users_role_active ON users(role_id, is_active);

-- Composite indexes for teachers
CREATE INDEX idx_teachers_dept_active ON teachers(department_id, is_active);

-- Composite indexes for students
CREATE INDEX idx_students_batch_active ON students(batch_id, is_active);

-- Composite indexes for courses
CREATE INDEX idx_courses_dept_active ON courses(department_id, is_active);
CREATE INDEX idx_courses_type_elective ON courses(course_type, is_elective);

-- Composite indexes for teacher courses
CREATE INDEX idx_teacher_courses_teacher_course ON teacher_courses(teacher_id, course_id);
CREATE INDEX idx_teacher_courses_year_semester ON teacher_courses(academic_year, semester, is_active);

-- Composite indexes for timetables
CREATE INDEX idx_timetables_batch_year_semester ON timetables(batch_id, academic_year, semester, is_active);

-- Composite indexes for timetable entries
CREATE INDEX idx_timetable_entries_day_time ON timetable_entries(day_of_week, time_slot_id, is_active);
CREATE INDEX idx_timetable_entries_teacher_day_time ON timetable_entries(teacher_id, day_of_week, time_slot_id);
CREATE INDEX idx_timetable_entries_classroom_day_time ON timetable_entries(classroom_id, day_of_week, time_slot_id);

-- Composite indexes for substitutions
CREATE INDEX idx_substitutions_date_confirmed ON substitutions(substitution_date, is_confirmed);
CREATE INDEX idx_substitutions_teacher_date ON substitutions(original_teacher_id, substitution_date);
CREATE INDEX idx_substitutions_substitute_date ON substitutions(substitute_teacher_id, substitution_date);

-- =============================================
-- 6. PARTIAL INDEXES FOR SPECIFIC QUERIES
-- =============================================

-- Partial index for active users
CREATE INDEX idx_users_active ON users(user_id) WHERE is_active = TRUE;

-- Partial index for active teachers
CREATE INDEX idx_teachers_active ON teachers(teacher_id) WHERE is_active = TRUE;

-- Partial index for active students
CREATE INDEX idx_students_active ON students(student_id) WHERE is_active = TRUE;

-- Partial index for active courses
CREATE INDEX idx_courses_active ON courses(course_id) WHERE is_active = TRUE;

-- Partial index for active timetables
CREATE INDEX idx_timetables_active ON timetables(timetable_id) WHERE is_active = TRUE;

-- Partial index for active timetable entries
CREATE INDEX idx_timetable_entries_active ON timetable_entries(entry_id) WHERE is_active = TRUE;

-- Partial index for confirmed substitutions
CREATE INDEX idx_substitutions_confirmed ON substitutions(substitution_id) WHERE is_confirmed = TRUE;

-- Partial index for unresolved conflicts
CREATE INDEX idx_timetable_conflicts_unresolved ON timetable_conflicts(conflict_id) WHERE is_resolved = FALSE;

-- =============================================
-- 7. EXPRESSION INDEXES FOR ADVANCED QUERIES
-- =============================================

-- Expression index for case-insensitive username search
CREATE INDEX idx_users_username_lower ON users(LOWER(username));

-- Expression index for case-insensitive email search
CREATE INDEX idx_users_email_lower ON users(LOWER(email));

-- Expression index for case-insensitive department name search
CREATE INDEX idx_departments_name_lower ON departments(LOWER(department_name));

-- Expression index for case-insensitive course name search
CREATE INDEX idx_courses_name_lower ON courses(LOWER(course_name));

-- Expression index for current day's substitutions
CREATE INDEX idx_substitutions_current_day ON substitutions(substitution_date) 
WHERE substitution_date = CURRENT_DATE;

-- Expression index for upcoming timetables
CREATE INDEX idx_timetables_upcoming ON timetables(effective_from) 
WHERE effective_from >= CURRENT_DATE;

-- =============================================
-- 8. DATABASE OPTIMIZATIONS
-- =============================================

-- Set appropriate statistics targets for important columns
ALTER TABLE users ALTER COLUMN role_id SET STATISTICS 1000;
ALTER TABLE teachers ALTER COLUMN department_id SET STATISTICS 1000;
ALTER TABLE students ALTER COLUMN batch_id SET STATISTICS 1000;
ALTER TABLE courses ALTER COLUMN department_id SET STATISTICS 1000;
ALTER TABLE timetable_entries ALTER COLUMN teacher_id SET STATISTICS 1000;
ALTER TABLE timetable_entries ALTER COLUMN classroom_id SET STATISTICS 1000;

-- Cluster tables by their most frequently used indexes
-- Note: CLUSTER is a one-time operation, it needs to be re-run periodically
ALTER TABLE users CLUSTER ON users_pkey;
ALTER TABLE teachers CLUSTER ON teachers_pkey;
ALTER TABLE students CLUSTER ON students_pkey;
ALTER TABLE courses CLUSTER ON courses_pkey;
ALTER TABLE timetables CLUSTER ON timetables_pkey;
ALTER TABLE timetable_entries CLUSTER ON timetable_entries_pkey;

-- Create materialized views for common complex queries
-- Materialized view for current semester's active timetables
CREATE MATERIALIZED VIEW mv_current_timetables AS
SELECT t.timetable_id, t.batch_id, b.batch_name, d.department_name, t.academic_year, t.semester
FROM timetables t
JOIN batches b ON t.batch_id = b.batch_id
JOIN departments d ON b.department_id = d.department_id
WHERE t.is_active = TRUE
AND t.effective_from <= CURRENT_DATE
AND (t.effective_to IS NULL OR t.effective_to >= CURRENT_DATE);

CREATE UNIQUE INDEX idx_mv_current_timetables_id ON mv_current_timetables(timetable_id);

-- Materialized view for teacher workload
CREATE MATERIALIZED VIEW mv_teacher_workload AS
SELECT 
    t.teacher_id,
    u.first_name || ' ' || u.last_name AS teacher_name,
    d.department_name,
    COUNT(DISTINCT tc.course_id) AS course_count,
    SUM(c.hours_per_week) AS total_hours_per_week,
    COUNT(DISTINCT te.entry_id) AS class_count
FROM teachers t
JOIN users u ON t.user_id = u.user_id
JOIN departments d ON t.department_id = d.department_id
LEFT JOIN teacher_courses tc ON t.teacher_id = tc.teacher_id AND tc.is_active = TRUE
LEFT JOIN courses c ON tc.course_id = c.course_id
LEFT JOIN timetable_entries te ON t.teacher_id = te.teacher_id AND te.is_active = TRUE
WHERE t.is_active = TRUE
GROUP BY t.teacher_id, u.first_name, u.last_name, d.department_name;

CREATE UNIQUE INDEX idx_mv_teacher_workload_id ON mv_teacher_workload(teacher_id);

-- Materialized view for classroom utilization
CREATE MATERIALIZED VIEW mv_classroom_utilization AS
SELECT 
    c.classroom_id,
    c.classroom_name,
    c.building,
    c.room_number,
    c.capacity,
    COUNT(te.entry_id) AS class_count,
    COUNT(DISTINCT te.day_of_week) AS days_used,
    COUNT(DISTINCT te.time_slot_id) AS time_slots_used
FROM classrooms c
LEFT JOIN timetable_entries te ON c.classroom_id = te.classroom_id AND te.is_active = TRUE
WHERE c.is_active = TRUE
GROUP BY c.classroom_id, c.classroom_name, c.building, c.room_number, c.capacity;

CREATE UNIQUE INDEX idx_mv_classroom_utilization_id ON mv_classroom_utilization(classroom_id);

-- Create a function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_current_timetables;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_teacher_workload;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_classroom_utilization;
    -- Add more materialized views as needed
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_all_materialized_views IS 'Refreshes all materialized views concurrently';

-- =============================================
-- 9. VACUUM AND ANALYZE SETTINGS
-- =============================================

-- Set appropriate autovacuum settings for frequently updated tables
ALTER TABLE timetable_entries SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE substitutions SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE audit.access_logs SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE audit.timetable_changes SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

-- Analyze all tables to update statistics
ANALYZE VERBOSE;
