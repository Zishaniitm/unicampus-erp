-- =============================================
-- SECURITY FEATURES IMPLEMENTATION
-- =============================================

-- =============================================
-- 1. ROLE-BASED ACCESS CONTROL (RBAC)
-- =============================================

-- Create default roles
INSERT INTO roles (role_name, description) VALUES
('admin', 'System administrator with full access to all features'),
('department_head', 'Department head with access to department-specific data'),
('teacher', 'Teacher with access to their courses and timetables'),
('staff', 'Administrative staff with limited access'),
('student', 'Student with read-only access to their timetables'),
('guest', 'Guest user with minimal access');

-- Create default permissions
INSERT INTO permissions (permission_name, description) VALUES
-- User management permissions
('user_view', 'View user details'),
('user_create', 'Create new users'),
('user_edit', 'Edit user details'),
('user_delete', 'Delete users'),

-- Department permissions
('department_view', 'View department details'),
('department_create', 'Create new departments'),
('department_edit', 'Edit department details'),
('department_delete', 'Delete departments'),

-- Course permissions
('course_view', 'View course details'),
('course_create', 'Create new courses'),
('course_edit', 'Edit course details'),
('course_delete', 'Delete courses'),

-- Teacher permissions
('teacher_view', 'View teacher details'),
('teacher_create', 'Create new teacher records'),
('teacher_edit', 'Edit teacher details'),
('teacher_delete', 'Delete teacher records'),

-- Student permissions
('student_view', 'View student details'),
('student_create', 'Create new student records'),
('student_edit', 'Edit student details'),
('student_delete', 'Delete student records'),

-- Timetable permissions
('timetable_view', 'View timetables'),
('timetable_create', 'Create new timetables'),
('timetable_edit', 'Edit timetables'),
('timetable_delete', 'Delete timetables'),

-- Substitution permissions
('substitution_view', 'View substitution details'),
('substitution_create', 'Create new substitutions'),
('substitution_edit', 'Edit substitution details'),
('substitution_approve', 'Approve substitution requests');

-- Assign permissions to roles
-- Admin role (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT role_id FROM roles WHERE role_name = 'admin'),
    permission_id
FROM permissions;

-- Department Head role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT role_id FROM roles WHERE role_name = 'department_head'),
    permission_id
FROM permissions
WHERE permission_name IN (
    'user_view', 
    'department_view', 
    'course_view', 'course_create', 'course_edit',
    'teacher_view', 'teacher_create', 'teacher_edit',
    'student_view',
    'timetable_view', 'timetable_create', 'timetable_edit',
    'substitution_view', 'substitution_create', 'substitution_edit', 'substitution_approve'
);

-- Teacher role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT role_id FROM roles WHERE role_name = 'teacher'),
    permission_id
FROM permissions
WHERE permission_name IN (
    'user_view',
    'department_view',
    'course_view',
    'teacher_view',
    'student_view',
    'timetable_view',
    'substitution_view', 'substitution_create'
);

-- Staff role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT role_id FROM roles WHERE role_name = 'staff'),
    permission_id
FROM permissions
WHERE permission_name IN (
    'user_view',
    'department_view',
    'course_view',
    'teacher_view',
    'student_view', 'student_create', 'student_edit',
    'timetable_view',
    'substitution_view'
);

-- Student role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT role_id FROM roles WHERE role_name = 'student'),
    permission_id
FROM permissions
WHERE permission_name IN (
    'timetable_view'
);

-- Guest role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT role_id FROM roles WHERE role_name = 'guest'),
    permission_id
FROM permissions
WHERE permission_name IN (
    'department_view',
    'course_view'
);

-- =============================================
-- 2. ROW-LEVEL SECURITY (RLS)
-- =============================================

-- Enable row-level security on tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE substitutions ENABLE ROW LEVEL SECURITY;

-- Create a function to check user role
CREATE OR REPLACE FUNCTION user_has_role(role_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT r.role_name INTO user_role
    FROM users u
    JOIN roles r ON u.role_id = r.role_id
    WHERE u.user_id = current_user::uuid;
    
    RETURN user_role = role_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if user belongs to a department
CREATE OR REPLACE FUNCTION user_in_department(dept_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    user_dept_id INTEGER;
    user_role TEXT;
BEGIN
    -- Get user's role
    SELECT r.role_name INTO user_role
    FROM users u
    JOIN roles r ON u.role_id = r.role_id
    WHERE u.user_id = current_user::uuid;
    
    -- Admin can access all departments
    IF user_role = 'admin' THEN
        RETURN TRUE;
    END IF;
    
    -- For teachers, check their department
    IF user_role = 'teacher' THEN
        SELECT t.department_id INTO user_dept_id
        FROM teachers t
        JOIN users u ON t.user_id = u.user_id
        WHERE u.user_id = current_user::uuid;
        
        RETURN user_dept_id = dept_id;
    END IF;
    
    -- For department heads, check their department
    IF user_role = 'department_head' THEN
        SELECT d.department_id INTO user_dept_id
        FROM departments d
        WHERE d.head_of_department = current_user::uuid;
        
        RETURN user_dept_id = dept_id;
    END IF;
    
    -- For students, check their batch's department
    IF user_role = 'student' THEN
        SELECT b.department_id INTO user_dept_id
        FROM students s
        JOIN batches b ON s.batch_id = b.batch_id
        JOIN users u ON s.user_id = u.user_id
        WHERE u.user_id = current_user::uuid;
        
        RETURN user_dept_id = dept_id;
    END IF;
    
    -- Staff can access all departments
    IF user_role = 'staff' THEN
        RETURN TRUE;
    END IF;
    
    -- Guest can view all departments
    IF user_role = 'guest' THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if teacher can access a specific timetable entry
CREATE OR REPLACE FUNCTION teacher_can_access_entry(entry_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    teacher_id_param INTEGER;
    entry_teacher_id INTEGER;
BEGIN
    -- Get the teacher's ID
    SELECT t.teacher_id INTO teacher_id_param
    FROM teachers t
    JOIN users u ON t.user_id = u.user_id
    WHERE u.user_id = current_user::uuid;
    
    -- Get the teacher ID from the timetable entry
    SELECT te.teacher_id INTO entry_teacher_id
    FROM timetable_entries te
    WHERE te.entry_id = entry_id;
    
    RETURN teacher_id_param = entry_teacher_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if student can access a specific timetable
CREATE OR REPLACE FUNCTION student_can_access_timetable(timetable_id_param INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    student_batch_id INTEGER;
    timetable_batch_id INTEGER;
BEGIN
    -- Get the student's batch ID
    SELECT s.batch_id INTO student_batch_id
    FROM students s
    JOIN users u ON s.user_id = u.user_id
    WHERE u.user_id = current_user::uuid;
    
    -- Get the batch ID from the timetable
    SELECT t.batch_id INTO timetable_batch_id
    FROM timetables t
    WHERE t.timetable_id = timetable_id_param;
    
    RETURN student_batch_id = timetable_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies for departments
CREATE POLICY admin_all_departments ON departments
    USING (user_has_role('admin'));

CREATE POLICY dept_head_own_department ON departments
    USING (head_of_department = current_user::uuid OR user_has_role('admin'));

CREATE POLICY view_all_departments ON departments
    FOR SELECT
    USING (TRUE);

-- Create RLS policies for courses
CREATE POLICY admin_all_courses ON courses
    USING (user_has_role('admin'));

CREATE POLICY dept_head_department_courses ON courses
    USING (user_in_department(department_id) OR user_has_role('admin'));

CREATE POLICY view_all_courses ON courses
    FOR SELECT
    USING (TRUE);

-- Create RLS policies for teachers
CREATE POLICY admin_all_teachers ON teachers
    USING (user_has_role('admin'));

CREATE POLICY dept_head_department_teachers ON teachers
    USING (user_in_department(department_id) OR user_has_role('admin'));

CREATE POLICY teachers_own_record ON teachers
    USING (user_id = current_user::uuid OR user_has_role('admin'));

CREATE POLICY view_all_teachers ON teachers
    FOR SELECT
    USING (TRUE);

-- Create RLS policies for students
CREATE POLICY admin_all_students ON students
    USING (user_has_role('admin'));

CREATE POLICY staff_all_students ON students
    USING (user_has_role('staff') OR user_has_role('admin'));

CREATE POLICY students_own_record ON students
    USING (user_id = current_user::uuid OR user_has_role('admin'));

CREATE POLICY dept_head_department_students ON students
    USING (
        user_has_role('department_head') AND 
        EXISTS (
            SELECT 1 FROM batches b
            WHERE b.batch_id = students.batch_id
            AND user_in_department(b.department_id)
        )
    );

CREATE POLICY teachers_view_students ON students
    FOR SELECT
    USING (
        user_has_role('teacher') AND 
        EXISTS (
            SELECT 1 FROM batches b
            JOIN batch_courses bc ON b.batch_id = bc.batch_id
            JOIN teacher_courses tc ON bc.course_id = tc.course_id
            JOIN teachers t ON tc.teacher_id = t.teacher_id
            WHERE b.batch_id = students.batch_id
            AND t.user_id = current_user::uuid
        )
    );

-- Create RLS policies for timetables
CREATE POLICY admin_all_timetables ON timetables
    USING (user_has_role('admin'));

CREATE POLICY dept_head_department_timetables ON timetables
    USING (
        user_has_role('department_head') AND 
        EXISTS (
            SELECT 1 FROM batches b
            WHERE b.batch_id = timetables.batch_id
            AND user_in_department(b.department_id)
        )
    );

CREATE POLICY teachers_related_timetables ON timetables
    FOR SELECT
    USING (
        user_has_role('teacher') AND 
        EXISTS (
            SELECT 1 FROM timetable_entries te
            JOIN teachers t ON te.teacher_id = t.teacher_id
            WHERE te.timetable_id = timetables.timetable_id
            AND t.user_id = current_user::uuid
        )
    );

CREATE POLICY students_own_timetables ON timetables
    FOR SELECT
    USING (
        user_has_role('student') AND 
        student_can_access_timetable(timetable_id)
    );

CREATE POLICY staff_all_timetables ON timetables
    FOR SELECT
    USING (user_has_role('staff'));

-- Create RLS policies for timetable entries
CREATE POLICY admin_all_entries ON timetable_entries
    USING (user_has_role('admin'));

CREATE POLICY dept_head_department_entries ON timetable_entries
    USING (
        user_has_role('department_head') AND 
        EXISTS (
            SELECT 1 FROM timetables t
            JOIN batches b ON t.batch_id = b.batch_id
            WHERE t.timetable_id = timetable_entries.timetable_id
            AND user_in_department(b.department_id)
        )
    );

CREATE POLICY teachers_own_entries ON timetable_entries
    USING (
        user_has_role('teacher') AND 
        teacher_can_access_entry(entry_id)
    );

CREATE POLICY students_related_entries ON timetable_entries
    FOR SELECT
    USING (
        user_has_role('student') AND 
        EXISTS (
            SELECT 1 FROM timetables t
            JOIN students s ON t.batch_id = s.batch_id
            WHERE t.timetable_id = timetable_entries.timetable_id
            AND s.user_id = current_user::uuid
        )
    );

CREATE POLICY staff_all_entries ON timetable_entries
    FOR SELECT
    USING (user_has_role('staff'));

-- Create RLS policies for substitutions
CREATE POLICY admin_all_substitutions ON substitutions
    USING (user_has_role('admin'));

CREATE POLICY dept_head_department_substitutions ON substitutions
    USING (
        user_has_role('department_head') AND 
        EXISTS (
            SELECT 1 FROM timetable_entries te
            JOIN timetables t ON te.timetable_id = t.timetable_id
            JOIN batches b ON t.batch_id = b.batch_id
            WHERE te.entry_id = substitutions.timetable_entry_id
            AND user_in_department(b.department_id)
        )
    );

CREATE POLICY teachers_related_substitutions ON substitutions
    USING (
        user_has_role('teacher') AND 
        (
            EXISTS (
                SELECT 1 FROM teachers t
                WHERE t.user_id = current_user::uuid
                AND (
                    t.teacher_id = substitutions.original_teacher_id OR
                    t.teacher_id = substitutions.substitute_teacher_id
                )
            )
        )
    );

CREATE POLICY staff_all_substitutions ON substitutions
    FOR SELECT
    USING (user_has_role('staff'));

-- =============================================
-- 3. PASSWORD ENCRYPTION
-- =============================================

-- Create a function to securely hash passwords using pgcrypto
CREATE OR REPLACE FUNCTION hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN crypt(password, gen_salt('bf', 10));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to verify passwords
CREATE OR REPLACE FUNCTION verify_password(password TEXT, password_hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN password_hash = crypt(password, password_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to automatically hash passwords on insert/update
CREATE OR REPLACE FUNCTION hash_password_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Only hash if the password has changed
    IF TG_OP = 'INSERT' OR NEW.password_hash <> OLD.password_hash THEN
        NEW.password_hash := hash_password(NEW.password_hash);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER hash_user_password
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION hash_password_trigger();

-- =============================================
-- 4. AUDIT LOGGING
-- =============================================

-- Create a function to log user actions
CREATE OR REPLACE FUNCTION log_user_action()
RETURNS TRIGGER AS $$
DECLARE
    action_type VARCHAR(50);
    resource_type VARCHAR(50);
    resource_id TEXT;
    details_json JSONB;
BEGIN
    -- Determine action type
    IF TG_OP = 'INSERT' THEN
        action_type := 'CREATE';
    ELSIF TG_OP = 'UPDATE' THEN
        action_type := 'UPDATE';
    ELSIF TG_OP = 'DELETE' THEN
        action_type := 'DELETE';
    END IF;
    
    -- Determine resource type (table name)
    resource_type := TG_TABLE_NAME;
    
    -- Determine resource ID
    IF TG_OP = 'DELETE' THEN
        -- For DELETE operations, use the primary key from OLD
        EXECUTE format('SELECT $1.%I::TEXT', TG_ARGV[0])
        INTO resource_id
        USING OLD;
    ELSE
        -- For INSERT and UPDATE operations, use the primary key from NEW
        EXECUTE format('SELECT $1.%I::TEXT', TG_ARGV[0])
        INTO resource_id
        USING NEW;
    END IF;
    
    -- Create details JSON
    IF TG_OP = 'INSERT' THEN
        details_json := row_to_json(NEW)::JSONB;
    ELSIF TG_OP = 'UPDATE' THEN
        details_json := jsonb_build_object(
            'old', row_to_json(OLD)::JSONB,
            'new', row_to_json(NEW)::JSONB,
            'changed_fields', (
                SELECT jsonb_object_agg(key, value)
                FROM jsonb_each(row_to_json(NEW)::JSONB)
                WHERE NOT (row_to_json(OLD)::JSONB ? key AND row_to_json(OLD)::JSONB->key = value)
            )
        );
    ELSIF TG_OP = 'DELETE' THEN
        details_json := row_to_json(OLD)::JSONB;
    END IF;
    
    -- Insert into access_logs
    INSERT INTO audit.access_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        ip_address,
        details
    ) VALUES (
        current_user::uuid,
        action_type,
        resource_type,
        resource_id,
        inet_client_addr(),
        details_json
    );
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for important tables
CREATE TRIGGER audit_departments_changes
AFTER INSERT OR UPDATE OR DELETE ON departments
FOR EACH ROW EXECUTE FUNCTION log_user_action('department_id');

CREATE TRIGGER audit_courses_changes
AFTER INSERT OR UPDATE OR DELETE ON courses
FOR EACH ROW EXECUTE FUNCTION log_user_action('course_id');

CREATE TRIGGER audit_teachers_changes
AFTER INSERT OR UPDATE OR DELETE ON teachers
FOR EACH ROW EXECUTE FUNCTION log_user_action('teacher_id');

CREATE TRIGGER audit_students_changes
AFTER INSERT OR UPDATE OR DELETE ON students
FOR EACH ROW EXECUTE FUNCTION log_user_action('student_id');

CREATE TRIGGER audit_timetables_changes
AFTER INSERT OR UPDATE OR DELETE ON timetables
FOR EACH ROW EXECUTE FUNCTION log_user_action('timetable_id');

CREATE TRIGGER audit_substitutions_changes
AFTER INSERT OR UPDATE OR DELETE ON substitutions
FOR EACH ROW EXECUTE FUNCTION log_user_action('substitution_id');

-- Create a function to log authentication events
CREATE OR REPLACE FUNCTION log_authentication_event(
    p_user_id UUID,
    p_event_type VARCHAR(50),
    p_ip_address INET,
    p_user_agent TEXT,
    p_details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO audit.access_logs (
        user_id,
        action,
        resource_type,
        ip_address,
        user_agent,
        details
    ) VALUES (
        p_user_id,
        p_event_type,
        'AUTHENTICATION',
        p_ip_address,
        p_user_agent,
        p_details
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
