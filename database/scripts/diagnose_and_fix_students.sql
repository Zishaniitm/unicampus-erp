-- ============================================================
-- diagnose_and_fix_students.sql  (v2)
-- The sample-data seeding (09_sample_data.sql) partially failed:
-- users exist, but departments/batches/students are missing.
-- This script rebuilds the chain idempotently:
--   departments -> classrooms -> batches -> student profiles
-- Safe to run repeatedly.
-- Run:  psql.exe -U postgres -d college_timetable_db -f database/scripts/diagnose_and_fix_students.sql
-- ============================================================

\echo '=== 0. Current table counts ==='
SELECT 'departments' AS tbl, COUNT(*) FROM departments
UNION ALL SELECT 'classrooms', COUNT(*) FROM classrooms
UNION ALL SELECT 'batches', COUNT(*) FROM batches
UNION ALL SELECT 'students', COUNT(*) FROM students
UNION ALL SELECT 'courses', COUNT(*) FROM courses
UNION ALL SELECT 'teachers', COUNT(*) FROM teachers;

-- The original 06_security_features.sql attached audit triggers that cast
-- current_user::uuid — that crashes for manual psql sessions (current_user =
-- 'postgres', not a UUID). Disable triggers for this seeding session only.
SET session_replication_role = replica;

\echo '=== 1. Departments ==='
INSERT INTO departments (department_name, department_code, description, head_of_department)
SELECT d.name, d.code, d.descr, (SELECT user_id FROM users WHERE username = d.head)
FROM (VALUES
  ('Computer Science', 'CS',   'Department of Computer Science and Information Technology', 'dhead_cs'),
  ('Mathematics',      'MATH', 'Department of Mathematics and Statistics',                  'dhead_math'),
  ('Physics',          'PHYS', 'Department of Physics and Astronomy',                       'dhead_physics')
) AS d(name, code, descr, head)
WHERE NOT EXISTS (SELECT 1 FROM departments x WHERE x.department_code = d.code);

\echo '=== 2. Classrooms ==='
INSERT INTO classrooms (classroom_name, building, floor, room_number, capacity, has_projector, has_computer, has_ac, is_lab)
SELECT c.name, c.building, c.floor, c.room, c.cap, c.proj, c.comp, c.ac, c.lab
FROM (VALUES
  ('CS Lab 1',       'Technology Building', 1, '101', 40,  TRUE, TRUE,  TRUE, TRUE),
  ('CS Lab 2',       'Technology Building', 1, '102', 30,  TRUE, TRUE,  TRUE, TRUE),
  ('Lecture Hall 1', 'Main Building',       2, '201', 100, TRUE, TRUE,  TRUE, FALSE),
  ('Lecture Hall 2', 'Main Building',       2, '202', 80,  TRUE, TRUE,  TRUE, FALSE),
  ('Math Room 1',    'Science Building',    1, '101', 50,  TRUE, FALSE, TRUE, FALSE),
  ('Physics Lab',    'Science Building',    2, '201', 35,  TRUE, TRUE,  TRUE, TRUE),
  ('Seminar Room 1', 'Main Building',       3, '301', 25,  TRUE, FALSE, TRUE, FALSE),
  ('Seminar Room 2', 'Main Building',       3, '302', 25,  TRUE, FALSE, TRUE, FALSE)
) AS c(name, building, floor, room, cap, proj, comp, ac, lab)
WHERE NOT EXISTS (SELECT 1 FROM classrooms x WHERE x.classroom_name = c.name AND x.building = c.building);

\echo '=== 3. Batches ==='
INSERT INTO batches (batch_name, department_id, academic_year, semester, section, start_date, end_date)
SELECT b.name, (SELECT department_id FROM departments WHERE department_code = b.dept),
       b.year, b.sem, b.section, b.sdate, b.edate
FROM (VALUES
  ('CS-2024-1-A',   'CS',   '2024-2025', 1, 'A', DATE '2024-08-01', DATE '2024-12-15'),
  ('CS-2024-1-B',   'CS',   '2024-2025', 1, 'B', DATE '2024-08-01', DATE '2024-12-15'),
  ('MATH-2024-1-A', 'MATH', '2024-2025', 1, 'A', DATE '2024-08-01', DATE '2024-12-15'),
  ('PHYS-2024-1-A', 'PHYS', '2024-2025', 1, 'A', DATE '2024-08-01', DATE '2024-12-15')
) AS b(name, dept, year, sem, section, sdate, edate)
WHERE NOT EXISTS (SELECT 1 FROM batches x WHERE x.batch_name = b.name);

\echo '=== 4. Student profiles ==='
INSERT INTO students (user_id, roll_number, batch_id, admission_date, date_of_birth,
                      gender, address, contact_number, parent_guardian_name, parent_contact_number)
SELECT (SELECT user_id  FROM users   WHERE username   = s.username),
       s.roll,
       (SELECT batch_id FROM batches WHERE batch_name = s.batch),
       s.adm, s.dob, s.gender, s.addr, s.contact, s.parent, s.pcontact
FROM (VALUES
  ('student1', 'CS2024001',   'CS-2024-1-A',   DATE '2024-07-15', DATE '2006-05-10', 'Male',   '123 College St',    '555-123-4567', 'George White',     '555-987-6543'),
  ('student2', 'CS2024002',   'CS-2024-1-A',   DATE '2024-07-16', DATE '2006-08-22', 'Female', '456 University Av', '555-234-5678', 'Robert Harris',    '555-876-5432'),
  ('student3', 'CS2024003',   'CS-2024-1-B',   DATE '2024-07-17', DATE '2006-03-15', 'Male',   '789 Campus Rd',     '555-345-6789', 'Susan Martin',     '555-765-4321'),
  ('student4', 'MATH2024001', 'MATH-2024-1-A', DATE '2024-07-18', DATE '2006-11-30', 'Female', '101 Academy St',    '555-456-7890', 'William Thompson', '555-654-3210'),
  ('student5', 'MATH2024002', 'MATH-2024-1-A', DATE '2024-07-19', DATE '2006-07-05', 'Male',   '202 Scholar Ave',   '555-567-8901', 'Maria Garcia',     '555-543-2109'),
  ('student6', 'PHYS2024001', 'PHYS-2024-1-A', DATE '2024-07-20', DATE '2006-01-25', 'Female', '303 Education Bl',  '555-678-9012', 'Carlos Martinez',  '555-432-1098')
) AS s(username, roll, batch, adm, dob, gender, addr, contact, parent, pcontact)
WHERE EXISTS (SELECT 1 FROM users u WHERE u.username = s.username)
  AND NOT EXISTS (SELECT 1 FROM students x
                  WHERE x.user_id = (SELECT user_id FROM users WHERE username = s.username)
                     OR x.roll_number = s.roll);

\echo '=== 5. Final check — student IDs and batches for the Fee Management page ==='
-- Re-enable triggers before finishing
SET session_replication_role = DEFAULT;

SELECT s.student_id, u.username, s.roll_number, b.batch_id, b.batch_name, s.is_active
FROM students s
JOIN users u   ON s.user_id  = u.user_id
JOIN batches b ON s.batch_id = b.batch_id
ORDER BY s.student_id;
