# UniCampus ERP — Error Code Registry

> Every error in the system has a unique code in the format `ERR-{MODULE}-{NNN}`.
> When a user reports a bug, they provide the `error_id` (UUID shown in the UI).
> A developer can grep the log file for that UUID to see the full context instantly.
>
> This file is the canonical reference. Add new codes here when building each module.

---

## AUTH — Authentication and Session Management

| Code | HTTP | Description | When Thrown |
|---|---|---|---|
| ERR-AUTH-001 | 401 | Invalid credentials | Wrong username or password (deliberately generic) |
| ERR-AUTH-002 | 423 | Account locked | 5+ failed login attempts within window |
| ERR-AUTH-003 | 401 | Session expired | JWT access token missing or expired |
| ERR-AUTH-004 | 403 | Insufficient permissions | Role not allowed for this endpoint |
| ERR-AUTH-005 | 400 | OTP invalid or expired | Wrong OTP or OTP past 10-min expiry |
| ERR-AUTH-006 | 400 | Password too weak | Doesn't meet complexity requirements |

## STU — Student Module

| Code | HTTP | Description |
|---|---|---|
| ERR-STU-001 | 422 | Semester registration window is not open |
| ERR-STU-002 | 422 | Academic hold is active on student account |
| ERR-STU-003 | 422 | Library fine balance blocks registration |
| ERR-STU-004 | 422 | Fee dues block registration |
| ERR-STU-005 | 404 | Student record not found |

## ADM — Admission Module

| Code | HTTP | Description |
|---|---|---|
| ERR-ADM-001 | 422 | Duplicate roll number (on import or create) |
| ERR-ADM-002 | 422 | Admission not confirmed — cannot generate credentials |
| ERR-ADM-003 | 400 | Invalid bulk import row — see error report Excel |
| ERR-ADM-004 | 422 | Credentials already dispatched for this student |
| ERR-ADM-005 | 404 | Student not found for credential reset |

## FEE — Fee Management

| Code | HTTP | Description |
|---|---|---|
| ERR-FEE-001 | 502 | Payment gateway timeout |
| ERR-FEE-002 | 400 | Invalid payment amount |
| ERR-FEE-003 | 422 | Registration window closed |
| ERR-FEE-004 | 422 | Fee dues block active |
| ERR-FEE-005 | 400 | Razorpay webhook signature mismatch (tampered request) |
| ERR-FEE-006 | 409 | Duplicate payment order (idempotency) |
| ERR-FEE-007 | 404 | Fee head or assignment not found |
| ERR-FEE-008 | 422 | Duplicate fee head code |
| ERR-FEE-009 | 422 | Concession exceeds the assigned fee amount |

## LIB — Library

| Code | HTTP | Description |
|---|---|---|
| ERR-LIB-001 | 422 | Book not available (no copies in stock) |
| ERR-LIB-002 | 422 | Student has unpaid fines above limit — cannot issue |
| ERR-LIB-003 | 404 | Book not found in catalog |
| ERR-LIB-004 | 422 | Student has already borrowed maximum allowed books |
| ERR-LIB-005 | 404 | Issue record not found |

## TT — Timetable

| Code | HTTP | Description |
|---|---|---|
| ERR-TT-001 | 409 | Teacher clash — teacher already scheduled at this time |
| ERR-TT-002 | 409 | Classroom clash — room already booked at this time |
| ERR-TT-003 | 409 | Batch clash — batch already has a class at this time |
| ERR-TT-004 | 404 | Timetable not found |

## ATT — Attendance

| Code | HTTP | Description |
|---|---|---|
| ERR-ATT-001 | 422 | Attendance edit window closed (>24h, only HOD can edit) |
| ERR-ATT-002 | 422 | Attendance already marked for this session |
| ERR-ATT-003 | 404 | Attendance record not found |

## EX — Examination and Marks

| Code | HTTP | Description |
|---|---|---|
| ERR-EX-001 | 422 | Marks entry window closed (locked by Exam Controller) |
| ERR-EX-002 | 422 | Results not yet published (student cannot view) |
| ERR-EX-003 | 422 | Student not eligible for exam (attendance below threshold) |
| ERR-EX-004 | 404 | Exam schedule not found |

## HST — Hostel

| Code | HTTP | Description |
|---|---|---|
| ERR-HST-001 | 422 | Hostel registration window closed |
| ERR-HST-002 | 422 | Selected hostel category is full |
| ERR-HST-003 | 422 | Student already has an active hostel registration |

## BUS — Bus Registration

| Code | HTTP | Description |
|---|---|---|
| ERR-BUS-001 | 422 | Bus registration window closed |
| ERR-BUS-002 | 404 | Route or stop not found |

## GRIEV — Grievances

| Code | HTTP | Description |
|---|---|---|
| ERR-GRIEV-001 | 404 | Grievance ticket not found |
| ERR-GRIEV-002 | 422 | Cannot reopen a resolved grievance after 7 days |
| ERR-GRIEV-003 | 422 | Grievance already resolved — status cannot change |

## NOT — Notices

| Code | HTTP | Description |
|---|---|---|
| ERR-NOT-001 | 404 | Notice not found or no longer active |

## EXP — Export / Reports

| Code | HTTP | Description |
|---|---|---|
| ERR-EXP-001 | 202 | Export is still generating (async job) — check notification |
| ERR-EXP-002 | 410 | Export download link expired (>24 hours) |
| ERR-EXP-003 | 404 | Export job not found |

## SYS — System / Generic

| Code | HTTP | Description |
|---|---|---|
| ERR-SYS-001 | 500 | Unexpected server error — check logs with error_id |
| ERR-SYS-404 | 404 | Endpoint does not exist |
| ERR-SYS-RATE | 429 | Rate limit exceeded |
| ERR-VALIDATION | 400 | Request body/params failed validation — see errors field |

---

## How to Use This in Practice

When a user reports an issue:
1. Ask them for the **Error ID** shown on screen (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
2. SSH into the server: `grep "error_id_here" logs/error-YYYY-MM-DD.log`
3. The log entry contains: user_id, route, method, IP, full stack trace, and timestamp
4. Fix the bug, add the error code to this registry if it was new, deploy

