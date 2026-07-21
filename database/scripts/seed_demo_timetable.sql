-- ============================================================
-- seed_demo_timetable.sql
-- Seeds teachers, courses, time slots, a weekly timetable and
-- ~3 weeks of attendance so teacher/HOD dashboards, timetable
-- and attendance modules show real data in dev.
-- Idempotent — safe to run repeatedly.
-- Run:  psql.exe -U postgres -d college_timetable_db -f database/scripts/seed_demo_timetable.sql
-- ============================================================

\echo '=== 1. Teacher profiles ==='
INSERT INTO teachers (user_id, department_id, employee_id, designation, qualification, date_of_joining, contact_number)
SELECT (SELECT user_id FROM users WHERE username = t.username),
       (SELECT department_id FROM departments WHERE department_code = t.dept),
       t.emp_id, t.designation, t.qual, t.doj, t.contact
FROM (VALUES
  ('teacher1', 'CS',   'EMP001', 'Assistant Professor', 'M.Tech CSE', DATE '2020-07-01', '555-111-2222'),
  ('teacher2', 'MATH', 'EMP002', 'Assistant Professor', 'M.Sc Mathematics', DATE '2019-07-01', '555-222-3333'),
  ('teacher3', 'PHYS', 'EMP003', 'Associate Professor', 'Ph.D Physics', DATE '2015-07-01', '555-333-4444'),
  ('dhead_cs', 'CS',   'EMP004', 'Professor & Head',    'Ph.D Computer Science', DATE '2010-07-01', '555-444-5555')
) AS t(username, dept, emp_id, designation, qual, doj, contact)
WHERE EXISTS (SELECT 1 FROM users u WHERE u.username = t.username)
  AND NOT EXISTS (SELECT 1 FROM teachers x
                  WHERE x.user_id = (SELECT user_id FROM users WHERE username = t.username)
                     OR x.employee_id = t.emp_id);

\echo '=== 2. Courses ==='
INSERT INTO courses (course_code, course_name, department_id, credits, hours_per_week, course_type, description)
SELECT c.code, c.name, (SELECT department_id FROM departments WHERE department_code = c.dept),
       c.credits, c.hours, c.ctype, c.descr
FROM (VALUES
  ('CS101',   'Programming Fundamentals',      'CS',   4, 4, 'Theory',    'Introduction to programming with C'),
  ('CS102',   'Database Management Systems',   'CS',   4, 4, 'Theory',    'Relational databases and SQL'),
  ('CS103',   'Data Structures Lab',           'CS',   2, 2, 'Practical', 'Hands-on data structures'),
  ('MATH101', 'Calculus I',                    'MATH', 4, 4, 'Theory',    'Limits, derivatives, integrals'),
  ('PHYS101', 'Mechanics',                     'PHYS', 4, 4, 'Theory',    'Classical mechanics fundamentals')
) AS c(code, name, dept, credits, hours, ctype, descr)
WHERE NOT EXISTS (SELECT 1 FROM courses x WHERE x.course_code = c.code);

\echo '=== 3. Time slots ==='
INSERT INTO time_slots (slot_name, start_time, end_time)
SELECT s.name, s.st, s.et
FROM (VALUES
  ('Morning 1',   TIME '09:00', TIME '10:00'),
  ('Morning 2',   TIME '10:00', TIME '11:00'),
  ('Midday 1',    TIME '11:15', TIME '12:15'),
  ('Midday 2',    TIME '12:15', TIME '13:15')
) AS s(name, st, et)
WHERE NOT EXISTS (SELECT 1 FROM time_slots x WHERE x.start_time = s.st AND x.end_time = s.et);

\echo '=== 4. Teacher-course mappings ==='
INSERT INTO teacher_courses (teacher_id, course_id, academic_year, semester)
SELECT (SELECT t.teacher_id FROM teachers t JOIN users u ON t.user_id = u.user_id WHERE u.username = m.teacher),
       (SELECT course_id FROM courses WHERE course_code = m.course),
       '2024-2025', 1
FROM (VALUES
  ('teacher1', 'CS101'),
  ('teacher1', 'CS102'),
  ('dhead_cs', 'CS103'),
  ('teacher2', 'MATH101'),
  ('teacher3', 'PHYS101')
) AS m(teacher, course)
WHERE EXISTS (SELECT 1 FROM teachers t JOIN users u ON t.user_id = u.user_id WHERE u.username = m.teacher)
ON CONFLICT (teacher_id, course_id, academic_year, semester) DO NOTHING;

\echo '=== 5. Batch-course mappings ==='
INSERT INTO batch_courses (batch_id, course_id, teacher_course_id)
SELECT (SELECT batch_id FROM batches WHERE batch_name = m.batch),
       (SELECT course_id FROM courses WHERE course_code = m.course),
       (SELECT tc.teacher_course_id FROM teacher_courses tc
         WHERE tc.course_id = (SELECT course_id FROM courses WHERE course_code = m.course)
         LIMIT 1)
FROM (VALUES
  ('CS-2024-1-A',   'CS101'),
  ('CS-2024-1-A',   'CS102'),
  ('CS-2024-1-A',   'CS103'),
  ('CS-2024-1-B',   'CS101'),
  ('MATH-2024-1-A', 'MATH101'),
  ('PHYS-2024-1-A', 'PHYS101')
) AS m(batch, course)
ON CONFLICT (batch_id, course_id) DO NOTHING;

\echo '=== 6. Timetables (one per batch) ==='
INSERT INTO timetables (batch_id, academic_year, semester, effective_from, created_by)
SELECT b.batch_id, '2024-2025', 1, DATE '2026-07-01',
       (SELECT user_id FROM users WHERE username = 'admin')
FROM batches b
WHERE NOT EXISTS (SELECT 1 FROM timetables t WHERE t.batch_id = b.batch_id AND t.is_active = TRUE);

\echo '=== 7. Timetable entries ==='
INSERT INTO timetable_entries (timetable_id, day_of_week, time_slot_id, batch_course_id, classroom_id, teacher_id)
SELECT tt.timetable_id,
       e.dow::day_of_week,
       (SELECT time_slot_id FROM time_slots WHERE slot_name = e.slot),
       bc.batch_course_id,
       (SELECT classroom_id FROM classrooms WHERE classroom_name = e.room),
       tc.teacher_id
FROM (VALUES
  -- CS-2024-1-A: 6 classes across the week
  ('CS-2024-1-A', 'Monday',    'Morning 1', 'CS101',   'Lecture Hall 1'),
  ('CS-2024-1-A', 'Monday',    'Morning 2', 'CS102',   'Lecture Hall 1'),
  ('CS-2024-1-A', 'Tuesday',   'Morning 1', 'CS102',   'Lecture Hall 2'),
  ('CS-2024-1-A', 'Wednesday', 'Morning 2', 'CS101',   'Lecture Hall 1'),
  ('CS-2024-1-A', 'Thursday',  'Midday 1',  'CS103',   'CS Lab 1'),
  ('CS-2024-1-A', 'Friday',    'Morning 1', 'CS101',   'Lecture Hall 1'),
  -- CS-2024-1-B
  ('CS-2024-1-B', 'Tuesday',   'Morning 2', 'CS101',   'Lecture Hall 1'),
  ('CS-2024-1-B', 'Thursday',  'Morning 1', 'CS101',   'Lecture Hall 2'),
  -- MATH & PHYS batches
  ('MATH-2024-1-A', 'Monday',   'Midday 1',  'MATH101', 'Math Room 1'),
  ('MATH-2024-1-A', 'Wednesday','Morning 1', 'MATH101', 'Math Room 1'),
  ('PHYS-2024-1-A', 'Tuesday',  'Midday 1',  'PHYS101', 'Physics Lab'),
  ('PHYS-2024-1-A', 'Friday',   'Morning 2', 'PHYS101', 'Physics Lab')
) AS e(batch, dow, slot, course, room)
JOIN batches b        ON b.batch_name = e.batch
JOIN timetables tt    ON tt.batch_id = b.batch_id AND tt.is_active = TRUE
JOIN batch_courses bc ON bc.batch_id = b.batch_id
                     AND bc.course_id = (SELECT course_id FROM courses WHERE course_code = e.course)
JOIN teacher_courses tc ON tc.teacher_course_id = bc.teacher_course_id
WHERE NOT EXISTS (
  SELECT 1 FROM timetable_entries x
  WHERE x.timetable_id = tt.timetable_id
    AND x.day_of_week  = e.dow::day_of_week
    AND x.time_slot_id = (SELECT time_slot_id FROM time_slots WHERE slot_name = e.slot)
);

\echo '=== 8. Attendance — past 3 weeks, ~1 in 5 absent ==='
INSERT INTO attendance (timetable_entry_id, student_id, att_date, status, marked_by)
SELECT te.entry_id, s.student_id, d::date,
       CASE WHEN (s.student_id + te.entry_id + EXTRACT(DAY FROM d)::int) % 5 = 0 THEN 'A' ELSE 'P' END,
       tu.user_id
FROM timetable_entries te
JOIN timetables tt ON te.timetable_id = tt.timetable_id
JOIN teachers t    ON te.teacher_id = t.teacher_id
JOIN users tu      ON t.user_id = tu.user_id
JOIN students s    ON s.batch_id = tt.batch_id AND s.is_active = TRUE
JOIN generate_series(CURRENT_DATE - INTERVAL '21 days', CURRENT_DATE - INTERVAL '1 day', INTERVAL '1 day') d
     ON TRIM(TO_CHAR(d, 'Day')) = te.day_of_week::text
ON CONFLICT (timetable_entry_id, student_id, att_date) DO NOTHING;

\echo '=== 9. Staff users: librarian1 + accounts1 (password: password123) ==='
-- Roles must match what the app checks (requireRole uses exact names from roles.role_name)
INSERT INTO roles (role_name, description)
SELECT r.name, r.descr FROM (VALUES
  ('LIBRARIAN',      'Library staff — catalogue, issue/return, fines'),
  ('ACCOUNT_OFFICER','Accounts staff — fees, payments, concessions')
) AS r(name, descr)
WHERE NOT EXISTS (SELECT 1 FROM roles x WHERE UPPER(x.role_name) = r.name);

-- hash_user_password trigger bcrypts these on insert
INSERT INTO users (username, email, password_hash, first_name, last_name, role_id)
SELECT u.username, u.email, 'password123', u.fn, u.ln,
       (SELECT role_id FROM roles WHERE UPPER(role_name) = u.role LIMIT 1)
FROM (VALUES
  ('librarian1', 'librarian@college.edu', 'Lakshmi', 'Iyer',  'LIBRARIAN'),
  ('accounts1',  'accounts@college.edu',  'Arun',    'Nair',  'ACCOUNT_OFFICER')
) AS u(username, email, fn, ln, role)
WHERE NOT EXISTS (SELECT 1 FROM users x WHERE x.username = u.username);

-- These are staff accounts; skip the forced first-login password change in dev
UPDATE users SET must_change_password = FALSE
 WHERE username IN ('librarian1', 'accounts1');

\echo '=== 10. Summary ==='
SELECT 'teachers' AS tbl, COUNT(*) FROM teachers
UNION ALL SELECT 'courses', COUNT(*) FROM courses
UNION ALL SELECT 'time_slots', COUNT(*) FROM time_slots
UNION ALL SELECT 'teacher_courses', COUNT(*) FROM teacher_courses
UNION ALL SELECT 'batch_courses', COUNT(*) FROM batch_courses
UNION ALL SELECT 'timetables', COUNT(*) FROM timetables
UNION ALL SELECT 'timetable_entries', COUNT(*) FROM timetable_entries
UNION ALL SELECT 'attendance', COUNT(*) FROM attendance;
