-- =============================================
-- SAMPLE DATA FOR TESTING
-- =============================================

-- =============================================
-- 1. AUTHENTICATION SAMPLE DATA
-- =============================================

-- Insert admin user (password: admin123)
INSERT INTO users (username, email, password_hash, first_name, last_name, role_id)
VALUES ('admin', 'admin@college.edu', 'admin123', 'System', 'Administrator', 
        (SELECT role_id FROM roles WHERE role_name = 'admin'));

-- Insert department head users (password: password123)
INSERT INTO users (username, email, password_hash, first_name, last_name, role_id)
VALUES 
('dhead_cs', 'cs_head@college.edu', 'password123', 'Robert', 'Johnson', 
 (SELECT role_id FROM roles WHERE role_name = 'department_head')),
('dhead_math', 'math_head@college.edu', 'password123', 'Sarah', 'Williams', 
 (SELECT role_id FROM roles WHERE role_name = 'department_head')),
('dhead_physics', 'physics_head@college.edu', 'password123', 'Michael', 'Brown', 
 (SELECT role_id FROM roles WHERE role_name = 'department_head'));

-- Insert teacher users (password: password123)
INSERT INTO users (username, email, password_hash, first_name, last_name, role_id)
VALUES 
('teacher1', 'teacher1@college.edu', 'password123', 'John', 'Smith', 
 (SELECT role_id FROM roles WHERE role_name = 'teacher')),
('teacher2', 'teacher2@college.edu', 'password123', 'Emily', 'Davis', 
 (SELECT role_id FROM roles WHERE role_name = 'teacher')),
('teacher3', 'teacher3@college.edu', 'password123', 'David', 'Wilson', 
 (SELECT role_id FROM roles WHERE role_name = 'teacher')),
('teacher4', 'teacher4@college.edu', 'password123', 'Jennifer', 'Taylor', 
 (SELECT role_id FROM roles WHERE role_name = 'teacher')),
('teacher5', 'teacher5@college.edu', 'password123', 'Richard', 'Miller', 
 (SELECT role_id FROM roles WHERE role_name = 'teacher')),
('teacher6', 'teacher6@college.edu', 'password123', 'Patricia', 'Anderson', 
 (SELECT role_id FROM roles WHERE role_name = 'teacher'));

-- Insert staff users (password: password123)
INSERT INTO users (username, email, password_hash, first_name, last_name, role_id)
VALUES 
('staff1', 'staff1@college.edu', 'password123', 'Thomas', 'Moore', 
 (SELECT role_id FROM roles WHERE role_name = 'staff')),
('staff2', 'staff2@college.edu', 'password123', 'Lisa', 'Jackson', 
 (SELECT role_id FROM roles WHERE role_name = 'staff'));

-- Insert student users (password: password123)
INSERT INTO users (username, email, password_hash, first_name, last_name, role_id)
VALUES 
('student1', 'student1@college.edu', 'password123', 'James', 'White', 
 (SELECT role_id FROM roles WHERE role_name = 'student')),
('student2', 'student2@college.edu', 'password123', 'Mary', 'Harris', 
 (SELECT role_id FROM roles WHERE role_name = 'student')),
('student3', 'student3@college.edu', 'password123', 'Christopher', 'Martin', 
 (SELECT role_id FROM roles WHERE role_name = 'student')),
('student4', 'student4@college.edu', 'password123', 'Elizabeth', 'Thompson', 
 (SELECT role_id FROM roles WHERE role_name = 'student')),
('student5', 'student5@college.edu', 'password123', 'Daniel', 'Garcia', 
 (SELECT role_id FROM roles WHERE role_name = 'student')),
('student6', 'student6@college.edu', 'password123', 'Jessica', 'Martinez', 
 (SELECT role_id FROM roles WHERE role_name = 'student'));

-- Insert guest user (password: guest123)
INSERT INTO users (username, email, password_hash, first_name, last_name, role_id)
VALUES ('guest', 'guest@example.com', 'guest123', 'Guest', 'User', 
        (SELECT role_id FROM roles WHERE role_name = 'guest'));

-- =============================================
-- 2. DEPARTMENTS SAMPLE DATA
-- =============================================

-- Insert departments
INSERT INTO departments (department_name, department_code, description, head_of_department)
VALUES 
('Computer Science', 'CS', 'Department of Computer Science and Information Technology', 
 (SELECT user_id FROM users WHERE username = 'dhead_cs')),
('Mathematics', 'MATH', 'Department of Mathematics and Statistics', 
 (SELECT user_id FROM users WHERE username = 'dhead_math')),
('Physics', 'PHYS', 'Department of Physics and Astronomy', 
 (SELECT user_id FROM users WHERE username = 'dhead_physics'));

-- =============================================
-- 3. CLASSROOMS SAMPLE DATA
-- =============================================

-- Insert classrooms
INSERT INTO classrooms (classroom_name, building, floor, room_number, capacity, has_projector, has_computer, has_ac, is_lab)
VALUES 
('CS Lab 1', 'Technology Building', 1, '101', 40, TRUE, TRUE, TRUE, TRUE),
('CS Lab 2', 'Technology Building', 1, '102', 30, TRUE, TRUE, TRUE, TRUE),
('Lecture Hall 1', 'Main Building', 2, '201', 100, TRUE, TRUE, TRUE, FALSE),
('Lecture Hall 2', 'Main Building', 2, '202', 80, TRUE, TRUE, TRUE, FALSE),
('Math Room 1', 'Science Building', 1, '101', 50, TRUE, FALSE, TRUE, FALSE),
('Physics Lab', 'Science Building', 2, '201', 35, TRUE, TRUE, TRUE, TRUE),
('Seminar Room 1', 'Main Building', 3, '301', 25, TRUE, FALSE, TRUE, FALSE),
('Seminar Room 2', 'Main Building', 3, '302', 25, TRUE, FALSE, TRUE, FALSE);

-- =============================================
-- 4. BATCHES SAMPLE DATA
-- =============================================

-- Insert batches
INSERT INTO batches (batch_name, department_id, academic_year, semester, section, start_date, end_date)
VALUES 
('CS-2024-1-A', 
 (SELECT department_id FROM departments WHERE department_code = 'CS'), 
 '2024-2025', 1, 'A', '2024-08-01', '2024-12-15'),
('CS-2024-1-B', 
 (SELECT department_id FROM departments WHERE department_code = 'CS'), 
 '2024-2025', 1, 'B', '2024-08-01', '2024-12-15'),
('MATH-2024-1-A', 
 (SELECT department_id FROM departments WHERE department_code = 'MATH'), 
 '2024-2025', 1, 'A', '2024-08-01', '2024-12-15'),
('PHYS-2024-1-A', 
 (SELECT department_id FROM departments WHERE department_code = 'PHYS'), 
 '2024-2025', 1, 'A', '2024-08-01', '2024-12-15');

-- =============================================
-- 5. TEACHERS SAMPLE DATA
-- =============================================

-- Insert teachers
INSERT INTO teachers (user_id, department_id, employee_id, designation, qualification, date_of_joining, specialization)
VALUES 
((SELECT user_id FROM users WHERE username = 'teacher1'),
 (SELECT department_id FROM departments WHERE department_code = 'CS'),
 'EMP001', 'Professor', 'Ph.D. in Computer Science', '2015-06-01', 
 ARRAY['Algorithms', 'Data Structures', 'Machine Learning']),
 
((SELECT user_id FROM users WHERE username = 'teacher2'),
 (SELECT department_id FROM departments WHERE department_code = 'CS'),
 'EMP002', 'Associate Professor', 'Ph.D. in Information Systems', '2017-08-15', 
 ARRAY['Database Systems', 'Web Development', 'Software Engineering']),
 
((SELECT user_id FROM users WHERE username = 'teacher3'),
 (SELECT department_id FROM departments WHERE department_code = 'MATH'),
 'EMP003', 'Professor', 'Ph.D. in Mathematics', '2010-01-10', 
 ARRAY['Calculus', 'Linear Algebra', 'Discrete Mathematics']),
 
((SELECT user_id FROM users WHERE username = 'teacher4'),
 (SELECT department_id FROM departments WHERE department_code = 'MATH'),
 'EMP004', 'Assistant Professor', 'Ph.D. in Applied Mathematics', '2019-07-20', 
 ARRAY['Statistics', 'Numerical Methods', 'Operations Research']),
 
((SELECT user_id FROM users WHERE username = 'teacher5'),
 (SELECT department_id FROM departments WHERE department_code = 'PHYS'),
 'EMP005', 'Professor', 'Ph.D. in Physics', '2012-09-01', 
 ARRAY['Mechanics', 'Electromagnetism', 'Quantum Physics']),
 
((SELECT user_id FROM users WHERE username = 'teacher6'),
 (SELECT department_id FROM departments WHERE department_code = 'PHYS'),
 'EMP006', 'Associate Professor', 'Ph.D. in Theoretical Physics', '2016-03-15', 
 ARRAY['Thermodynamics', 'Optics', 'Modern Physics']);

-- =============================================
-- 6. STUDENTS SAMPLE DATA
-- =============================================

-- Insert students
INSERT INTO students (user_id, roll_number, batch_id, admission_date, date_of_birth, gender, address, contact_number, parent_guardian_name, parent_contact_number)
VALUES 
((SELECT user_id FROM users WHERE username = 'student1'),
 'CS2024001', 
 (SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-A'),
 '2024-07-15', '2006-05-10', 'Male', '123 College St, Anytown', '555-123-4567', 'George White', '555-987-6543'),
 
((SELECT user_id FROM users WHERE username = 'student2'),
 'CS2024002', 
 (SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-A'),
 '2024-07-16', '2006-08-22', 'Female', '456 University Ave, Anytown', '555-234-5678', 'Robert Harris', '555-876-5432'),
 
((SELECT user_id FROM users WHERE username = 'student3'),
 'CS2024003', 
 (SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-B'),
 '2024-07-17', '2006-03-15', 'Male', '789 Campus Rd, Anytown', '555-345-6789', 'Susan Martin', '555-765-4321'),
 
((SELECT user_id FROM users WHERE username = 'student4'),
 'MATH2024001', 
 (SELECT batch_id FROM batches WHERE batch_name = 'MATH-2024-1-A'),
 '2024-07-18', '2006-11-30', 'Female', '101 Academy St, Anytown', '555-456-7890', 'William Thompson', '555-654-3210'),
 
((SELECT user_id FROM users WHERE username = 'student5'),
 'MATH2024002', 
 (SELECT batch_id FROM batches WHERE batch_name = 'MATH-2024-1-A'),
 '2024-07-19', '2006-07-05', 'Male', '202 Scholar Ave, Anytown', '555-567-8901', 'Maria Garcia', '555-543-2109'),
 
((SELECT user_id FROM users WHERE username = 'student6'),
 'PHYS2024001', 
 (SELECT batch_id FROM batches WHERE batch_name = 'PHYS-2024-1-A'),
 '2024-07-20', '2006-01-25', 'Female', '303 Education Blvd, Anytown', '555-678-9012', 'Carlos Martinez', '555-432-1098');

-- =============================================
-- 7. COURSES SAMPLE DATA
-- =============================================

-- Insert courses
INSERT INTO courses (course_code, course_name, department_id, credits, hours_per_week, course_type, description, is_elective)
VALUES 
-- Computer Science courses
('CS101', 'Introduction to Programming', 
 (SELECT department_id FROM departments WHERE department_code = 'CS'),
 4, 6, 'Theory', 'Fundamentals of programming using Python', FALSE),
 
('CS102', 'Data Structures', 
 (SELECT department_id FROM departments WHERE department_code = 'CS'),
 4, 6, 'Theory', 'Basic data structures and algorithms', FALSE),
 
('CS103', 'Database Systems', 
 (SELECT department_id FROM departments WHERE department_code = 'CS'),
 3, 5, 'Theory', 'Introduction to database design and SQL', FALSE),
 
('CS104', 'Web Development', 
 (SELECT department_id FROM departments WHERE department_code = 'CS'),
 3, 5, 'Practical', 'HTML, CSS, JavaScript, and web frameworks', TRUE),
 
-- Mathematics courses
('MATH101', 'Calculus I', 
 (SELECT department_id FROM departments WHERE department_code = 'MATH'),
 4, 6, 'Theory', 'Limits, derivatives, and integrals', FALSE),
 
('MATH102', 'Linear Algebra', 
 (SELECT department_id FROM departments WHERE department_code = 'MATH'),
 3, 5, 'Theory', 'Vectors, matrices, and linear transformations', FALSE),
 
('MATH103', 'Discrete Mathematics', 
 (SELECT department_id FROM departments WHERE department_code = 'MATH'),
 3, 5, 'Theory', 'Logic, sets, relations, and graph theory', FALSE),
 
-- Physics courses
('PHYS101', 'Mechanics', 
 (SELECT department_id FROM departments WHERE department_code = 'PHYS'),
 4, 6, 'Theory', 'Newtonian mechanics and applications', FALSE),
 
('PHYS102', 'Electromagnetism', 
 (SELECT department_id FROM departments WHERE department_code = 'PHYS'),
 4, 6, 'Theory', 'Electric and magnetic fields and phenomena', FALSE),
 
('PHYS103', 'Physics Lab I', 
 (SELECT department_id FROM departments WHERE department_code = 'PHYS'),
 2, 4, 'Practical', 'Laboratory experiments in mechanics and electromagnetism', FALSE);

-- =============================================
-- 8. RELATIONSHIP DATA
-- =============================================

-- Insert department working days
INSERT INTO department_working_days (department_id, working_day)
VALUES 
((SELECT department_id FROM departments WHERE department_code = 'CS'), 'Monday'),
((SELECT department_id FROM departments WHERE department_code = 'CS'), 'Tuesday'),
((SELECT department_id FROM departments WHERE department_code = 'CS'), 'Wednesday'),
((SELECT department_id FROM departments WHERE department_code = 'CS'), 'Thursday'),
((SELECT department_id FROM departments WHERE department_code = 'CS'), 'Friday'),
((SELECT department_id FROM departments WHERE department_code = 'MATH'), 'Monday'),
((SELECT department_id FROM departments WHERE department_code = 'MATH'), 'Tuesday'),
((SELECT department_id FROM departments WHERE department_code = 'MATH'), 'Wednesday'),
((SELECT department_id FROM departments WHERE department_code = 'MATH'), 'Thursday'),
((SELECT department_id FROM departments WHERE department_code = 'MATH'), 'Friday'),
((SELECT department_id FROM departments WHERE department_code = 'PHYS'), 'Monday'),
((SELECT department_id FROM departments WHERE department_code = 'PHYS'), 'Tuesday'),
((SELECT department_id FROM departments WHERE department_code = 'PHYS'), 'Wednesday'),
((SELECT department_id FROM departments WHERE department_code = 'PHYS'), 'Thursday'),
((SELECT department_id FROM departments WHERE department_code = 'PHYS'), 'Friday');

-- Insert time slots
INSERT INTO time_slots (slot_name, start_time, end_time)
VALUES 
('Morning 1', '09:00:00', '10:30:00'),
('Morning 2', '10:45:00', '12:15:00'),
('Afternoon 1', '13:00:00', '14:30:00'),
('Afternoon 2', '14:45:00', '16:15:00'),
('Evening', '16:30:00', '18:00:00');

-- Assign teachers to courses
-- Use the stored procedure to assign teachers to courses
DO $$
BEGIN
    -- CS Department
    CALL assign_teacher_to_course(
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP001'), -- John Smith
        (SELECT course_id FROM courses WHERE course_code = 'CS101'),
        '2024-2025', 1, TRUE
    );
    
    CALL assign_teacher_to_course(
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP001'), -- John Smith
        (SELECT course_id FROM courses WHERE course_code = 'CS102'),
        '2024-2025', 1, TRUE
    );
    
    CALL assign_teacher_to_course(
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP002'), -- Emily Davis
        (SELECT course_id FROM courses WHERE course_code = 'CS103'),
        '2024-2025', 1, TRUE
    );
    
    CALL assign_teacher_to_course(
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP002'), -- Emily Davis
        (SELECT course_id FROM courses WHERE course_code = 'CS104'),
        '2024-2025', 1, TRUE
    );
    
    -- MATH Department
    CALL assign_teacher_to_course(
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP003'), -- David Wilson
        (SELECT course_id FROM courses WHERE course_code = 'MATH101'),
        '2024-2025', 1, TRUE
    );
    
    CALL assign_teacher_to_course(
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP003'), -- David Wilson
        (SELECT course_id FROM courses WHERE course_code = 'MATH103'),
        '2024-2025', 1, TRUE
    );
    
    CALL assign_teacher_to_course(
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP004'), -- Jennifer Taylor
        (SELECT course_id FROM courses WHERE course_code = 'MATH102'),
        '2024-2025', 1, TRUE
    );
    
    -- PHYS Department
    CALL assign_teacher_to_course(
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP005'), -- Richard Miller
        (SELECT course_id FROM courses WHERE course_code = 'PHYS101'),
        '2024-2025', 1, TRUE
    );
    
    CALL assign_teacher_to_course(
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP006'), -- Patricia Anderson
        (SELECT course_id FROM courses WHERE course_code = 'PHYS102'),
        '2024-2025', 1, TRUE
    );
    
    CALL assign_teacher_to_course(
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP005'), -- Richard Miller
        (SELECT course_id FROM courses WHERE course_code = 'PHYS103'),
        '2024-2025', 1, TRUE
    );
END $$;

-- Insert batch courses
INSERT INTO batch_courses (batch_id, course_id, teacher_course_id)
VALUES 
-- CS-2024-1-A batch courses
((SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-A'),
 (SELECT course_id FROM courses WHERE course_code = 'CS101'),
 (SELECT teacher_course_id FROM teacher_courses 
  WHERE teacher_id = (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP001')
  AND course_id = (SELECT course_id FROM courses WHERE course_code = 'CS101'))),
  
((SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-A'),
 (SELECT course_id FROM courses WHERE course_code = 'CS102'),
 (SELECT teacher_course_id FROM teacher_courses 
  WHERE teacher_id = (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP001')
  AND course_id = (SELECT course_id FROM courses WHERE course_code = 'CS102'))),
  
((SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-A'),
 (SELECT course_id FROM courses WHERE course_code = 'CS103'),
 (SELECT teacher_course_id FROM teacher_courses 
  WHERE teacher_id = (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP002')
  AND course_id = (SELECT course_id FROM courses WHERE course_code = 'CS103'))),
  
((SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-A'),
 (SELECT course_id FROM courses WHERE course_code = 'MATH101'),
 (SELECT teacher_course_id FROM teacher_courses 
  WHERE teacher_id = (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP003')
  AND course_id = (SELECT course_id FROM courses WHERE course_code = 'MATH101'))),

-- CS-2024-1-B batch courses
((SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-B'),
 (SELECT course_id FROM courses WHERE course_code = 'CS101'),
 (SELECT teacher_course_id FROM teacher_courses 
  WHERE teacher_id = (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP001')
  AND course_id = (SELECT course_id FROM courses WHERE course_code = 'CS101'))),
  
((SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-B'),
 (SELECT course_id FROM courses WHERE course_code = 'CS102'),
 (SELECT teacher_course_id FROM teacher_courses 
  WHERE teacher_id = (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP001')
  AND course_id = (SELECT course_id FROM courses WHERE course_code = 'CS102'))),
  
((SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-B'),
 (SELECT course_id FROM courses WHERE course_code = 'CS103'),
 (SELECT teacher_course_id FROM teacher_courses 
  WHERE teacher_id = (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP002')
  AND course_id = (SELECT course_id FROM courses WHERE course_code = 'CS103'))),
  
((SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-B'),
 (SELECT course_id FROM courses WHERE course_code = 'MATH101'),
 (SELECT teacher_course_id FROM teacher_courses 
  WHERE teacher_id = (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP003')
  AND course_id = (SELECT course_id FROM courses WHERE course_code = 'MATH101'))),

-- MATH-2024-1-A batch courses
((SELECT batch_id FROM batches WHERE batch_name = 'MATH-2024-1-A'),
 (SELECT course_id FROM courses WHERE course_code = 'MATH101'),
 (SELECT teacher_course_id FROM teacher_courses 
  WHERE teacher_id = (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP003')
  AND course_id = (SELECT course_id FROM courses WHERE course_code = 'MATH101'))),
  
((SELECT batch_id FROM batches WHERE batch_name = 'MATH-2024-1-A'),
 (SELECT course_id FROM courses WHERE course_code = 'MATH102'),
 (SELECT teacher_course_id FROM teacher_courses 
  WHERE teacher_id = (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP004')
  AND course_id = (SELECT course_id FROM courses WHERE course_code = 'MATH102'))),
  
((SELECT batch_id FROM batches WHERE batch_name = 'MATH-2024-1-A'),
 (SELECT course_id FROM courses WHERE course_code = 'MATH103'),
 (SELECT teacher_course_id FROM teacher_courses 
  WHERE teacher_id = (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP003')
  AND course_id = (SELECT course_id FROM courses WHERE course_code = 'MATH103'))),

-- PHYS-2024-1-A batch courses
((SELECT batch_id FROM batches WHERE batch_name = 'PHYS-2024-1-A'),
 (SELECT course_id FROM courses WHERE course_code = 'PHYS101'),
 (SELECT teacher_course_id FROM teacher_courses 
  WHERE teacher_id = (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP005')
  AND course_id = (SELECT course_id FROM courses WHERE course_code = 'PHYS101'))),
  
((SELECT batch_id FROM batches WHERE batch_name = 'PHYS-2024-1-A'),
 (SELECT course_id FROM courses WHERE course_code = 'PHYS102'),
 (SELECT teacher_course_id FROM teacher_courses 
  WHERE teacher_id = (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP006')
  AND course_id = (SELECT course_id FROM courses WHERE course_code = 'PHYS102'))),
  
((SELECT batch_id FROM batches WHERE batch_name = 'PHYS-2024-1-A'),
 (SELECT course_id FROM courses WHERE course_code = 'PHYS103'),
 (SELECT teacher_course_id FROM teacher_courses 
  WHERE teacher_id = (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP005')
  AND course_id = (SELECT course_id FROM courses WHERE course_code = 'PHYS103'))),
  
((SELECT batch_id FROM batches WHERE batch_name = 'PHYS-2024-1-A'),
 (SELECT course_id FROM courses WHERE course_code = 'MATH101'),
 (SELECT teacher_course_id FROM teacher_courses 
  WHERE teacher_id = (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP003')
  AND course_id = (SELECT course_id FROM courses WHERE course_code = 'MATH101')));

-- =============================================
-- 9. TIMETABLE SAMPLE DATA
-- =============================================

-- Create timetables
DO $$
DECLARE
    cs_a_timetable_id INTEGER;
    cs_b_timetable_id INTEGER;
    math_a_timetable_id INTEGER;
    phys_a_timetable_id INTEGER;
    admin_user_id UUID;
BEGIN
    -- Get admin user ID
    SELECT user_id INTO admin_user_id FROM users WHERE username = 'admin';
    
    -- Create timetables for each batch
    -- CS-2024-1-A
    CALL create_timetable(
        (SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-A'),
        '2024-2025', 1, '2024-08-15', '2024-12-15', admin_user_id
    );
    
    SELECT timetable_id INTO cs_a_timetable_id 
    FROM timetables 
    WHERE batch_id = (SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-A')
    AND academic_year = '2024-2025' AND semester = 1;
    
    -- CS-2024-1-B
    CALL create_timetable(
        (SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-B'),
        '2024-2025', 1, '2024-08-15', '2024-12-15', admin_user_id
    );
    
    SELECT timetable_id INTO cs_b_timetable_id 
    FROM timetables 
    WHERE batch_id = (SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-B')
    AND academic_year = '2024-2025' AND semester = 1;
    
    -- MATH-2024-1-A
    CALL create_timetable(
        (SELECT batch_id FROM batches WHERE batch_name = 'MATH-2024-1-A'),
        '2024-2025', 1, '2024-08-15', '2024-12-15', admin_user_id
    );
    
    SELECT timetable_id INTO math_a_timetable_id 
    FROM timetables 
    WHERE batch_id = (SELECT batch_id FROM batches WHERE batch_name = 'MATH-2024-1-A')
    AND academic_year = '2024-2025' AND semester = 1;
    
    -- PHYS-2024-1-A
    CALL create_timetable(
        (SELECT batch_id FROM batches WHERE batch_name = 'PHYS-2024-1-A'),
        '2024-2025', 1, '2024-08-15', '2024-12-15', admin_user_id
    );
    
    SELECT timetable_id INTO phys_a_timetable_id 
    FROM timetables 
    WHERE batch_id = (SELECT batch_id FROM batches WHERE batch_name = 'PHYS-2024-1-A')
    AND academic_year = '2024-2025' AND semester = 1;
    
    -- Add timetable entries for CS-2024-1-A
    -- Monday
    CALL add_timetable_entry(
        cs_a_timetable_id, 'Monday',
        (SELECT time_slot_id FROM time_slots WHERE slot_name = 'Morning 1'),
        (SELECT batch_course_id FROM batch_courses 
         WHERE batch_id = (SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-A')
         AND course_id = (SELECT course_id FROM courses WHERE course_code = 'CS101')),
        (SELECT classroom_id FROM classrooms WHERE classroom_name = 'Lecture Hall 1'),
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP001'),
        TRUE
    );
    
    CALL add_timetable_entry(
        cs_a_timetable_id, 'Monday',
        (SELECT time_slot_id FROM time_slots WHERE slot_name = 'Morning 2'),
        (SELECT batch_course_id FROM batch_courses 
         WHERE batch_id = (SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-A')
         AND course_id = (SELECT course_id FROM courses WHERE course_code = 'CS102')),
        (SELECT classroom_id FROM classrooms WHERE classroom_name = 'Lecture Hall 1'),
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP001'),
        TRUE
    );
    
    -- Tuesday
    CALL add_timetable_entry(
        cs_a_timetable_id, 'Tuesday',
        (SELECT time_slot_id FROM time_slots WHERE slot_name = 'Morning 1'),
        (SELECT batch_course_id FROM batch_courses 
         WHERE batch_id = (SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-A')
         AND course_id = (SELECT course_id FROM courses WHERE course_code = 'CS103')),
        (SELECT classroom_id FROM classrooms WHERE classroom_name = 'Lecture Hall 2'),
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP002'),
        TRUE
    );
    
    CALL add_timetable_entry(
        cs_a_timetable_id, 'Tuesday',
        (SELECT time_slot_id FROM time_slots WHERE slot_name = 'Afternoon 1'),
        (SELECT batch_course_id FROM batch_courses 
         WHERE batch_id = (SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-A')
         AND course_id = (SELECT course_id FROM courses WHERE course_code = 'MATH101')),
        (SELECT classroom_id FROM classrooms WHERE classroom_name = 'Math Room 1'),
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP003'),
        TRUE
    );
    
    -- Wednesday
    CALL add_timetable_entry(
        cs_a_timetable_id, 'Wednesday',
        (SELECT time_slot_id FROM time_slots WHERE slot_name = 'Morning 1'),
        (SELECT batch_course_id FROM batch_courses 
         WHERE batch_id = (SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-A')
         AND course_id = (SELECT course_id FROM courses WHERE course_code = 'CS101')),
        (SELECT classroom_id FROM classrooms WHERE classroom_name = 'CS Lab 1'),
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP001'),
        TRUE
    );
    
    -- Thursday
    CALL add_timetable_entry(
        cs_a_timetable_id, 'Thursday',
        (SELECT time_slot_id FROM time_slots WHERE slot_name = 'Morning 2'),
        (SELECT batch_course_id FROM batch_courses 
         WHERE batch_id = (SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-A')
         AND course_id = (SELECT course_id FROM courses WHERE course_code = 'CS102')),
        (SELECT classroom_id FROM classrooms WHERE classroom_name = 'CS Lab 2'),
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP001'),
        TRUE
    );
    
    -- Friday
    CALL add_timetable_entry(
        cs_a_timetable_id, 'Friday',
        (SELECT time_slot_id FROM time_slots WHERE slot_name = 'Afternoon 1'),
        (SELECT batch_course_id FROM batch_courses 
         WHERE batch_id = (SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-A')
         AND course_id = (SELECT course_id FROM courses WHERE course_code = 'CS103')),
        (SELECT classroom_id FROM classrooms WHERE classroom_name = 'CS Lab 1'),
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP002'),
        TRUE
    );
    
    -- Add timetable entries for CS-2024-1-B (different times to avoid conflicts)
    -- Monday
    CALL add_timetable_entry(
        cs_b_timetable_id, 'Monday',
        (SELECT time_slot_id FROM time_slots WHERE slot_name = 'Afternoon 1'),
        (SELECT batch_course_id FROM batch_courses 
         WHERE batch_id = (SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-B')
         AND course_id = (SELECT course_id FROM courses WHERE course_code = 'CS101')),
        (SELECT classroom_id FROM classrooms WHERE classroom_name = 'Lecture Hall 1'),
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP001'),
        TRUE
    );
    
    CALL add_timetable_entry(
        cs_b_timetable_id, 'Monday',
        (SELECT time_slot_id FROM time_slots WHERE slot_name = 'Afternoon 2'),
        (SELECT batch_course_id FROM batch_courses 
         WHERE batch_id = (SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-B')
         AND course_id = (SELECT course_id FROM courses WHERE course_code = 'CS102')),
        (SELECT classroom_id FROM classrooms WHERE classroom_name = 'Lecture Hall 1'),
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP001'),
        TRUE
    );
    
    -- Add a few entries for MATH-2024-1-A
    CALL add_timetable_entry(
        math_a_timetable_id, 'Monday',
        (SELECT time_slot_id FROM time_slots WHERE slot_name = 'Morning 1'),
        (SELECT batch_course_id FROM batch_courses 
         WHERE batch_id = (SELECT batch_id FROM batches WHERE batch_name = 'MATH-2024-1-A')
         AND course_id = (SELECT course_id FROM courses WHERE course_code = 'MATH101')),
        (SELECT classroom_id FROM classrooms WHERE classroom_name = 'Math Room 1'),
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP003'),
        TRUE
    );
    
    CALL add_timetable_entry(
        math_a_timetable_id, 'Tuesday',
        (SELECT time_slot_id FROM time_slots WHERE slot_name = 'Morning 1'),
        (SELECT batch_course_id FROM batch_courses 
         WHERE batch_id = (SELECT batch_id FROM batches WHERE batch_name = 'MATH-2024-1-A')
         AND course_id = (SELECT course_id FROM courses WHERE course_code = 'MATH102')),
        (SELECT classroom_id FROM classrooms WHERE classroom_name = 'Math Room 1'),
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP004'),
        TRUE
    );
    
    -- Add a few entries for PHYS-2024-1-A
    CALL add_timetable_entry(
        phys_a_timetable_id, 'Monday',
        (SELECT time_slot_id FROM time_slots WHERE slot_name = 'Morning 2'),
        (SELECT batch_course_id FROM batch_courses 
         WHERE batch_id = (SELECT batch_id FROM batches WHERE batch_name = 'PHYS-2024-1-A')
         AND course_id = (SELECT course_id FROM courses WHERE course_code = 'PHYS101')),
        (SELECT classroom_id FROM classrooms WHERE classroom_name = 'Physics Lab'),
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP005'),
        TRUE
    );
    
    CALL add_timetable_entry(
        phys_a_timetable_id, 'Wednesday',
        (SELECT time_slot_id FROM time_slots WHERE slot_name = 'Afternoon 1'),
        (SELECT batch_course_id FROM batch_courses 
         WHERE batch_id = (SELECT batch_id FROM batches WHERE batch_name = 'PHYS-2024-1-A')
         AND course_id = (SELECT course_id FROM courses WHERE course_code = 'PHYS103')),
        (SELECT classroom_id FROM classrooms WHERE classroom_name = 'Physics Lab'),
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP005'),
        TRUE
    );
END $$;

-- =============================================
-- 10. SUBSTITUTION SAMPLE DATA
-- =============================================

-- Create a teacher absence
INSERT INTO teacher_absences (teacher_id, start_date, end_date, reason, is_approved, approved_by)
VALUES (
    (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP001'),
    '2024-09-02', '2024-09-03', 'Medical leave',
    TRUE,
    (SELECT user_id FROM users WHERE username = 'dhead_cs')
);

-- Create a substitution
DO $$
DECLARE
    absence_id_param INTEGER;
    timetable_entry_id_param INTEGER;
BEGIN
    -- Get the absence ID
    SELECT absence_id INTO absence_id_param
    FROM teacher_absences
    WHERE teacher_id = (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP001')
    AND start_date = '2024-09-02';
    
    -- Get a timetable entry ID for Monday (2024-09-02 is a Monday)
    SELECT entry_id INTO timetable_entry_id_param
    FROM timetable_entries te
    JOIN timetables t ON te.timetable_id = t.timetable_id
    WHERE te.teacher_id = (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP001')
    AND te.day_of_week = 'Monday'
    AND t.batch_id = (SELECT batch_id FROM batches WHERE batch_name = 'CS-2024-1-A');
    
    -- Create the substitution
    CALL create_substitution(
        timetable_entry_id_param,
        (SELECT teacher_id FROM teachers WHERE employee_id = 'EMP002'),
        '2024-09-02',
        'Substituting for medical leave',
        absence_id_param
    );
    
    -- Approve the substitution
    UPDATE substitutions
    SET is_confirmed = TRUE,
        confirmed_by = (SELECT user_id FROM users WHERE username = 'dhead_cs'),
        notification_sent = TRUE
    WHERE timetable_entry_id = timetable_entry_id_param
    AND substitution_date = '2024-09-02';
END $$;

-- =============================================
-- 11. REFRESH MATERIALIZED VIEWS
-- =============================================

-- Refresh all materialized views
SELECT refresh_all_materialized_views();
