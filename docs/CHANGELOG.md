# UniCampus ERP — Changelog

All notable changes to this project are documented here.
Format: `## [version] — YYYY-MM-DD` with sections: Added, Changed, Fixed, Security, Migration Notes.

---

---

---

## [0.8.0] — 2026-07-19 (Week 8 — Library)

### Added
- **Migration 018** — `library_books` (catalogue with copy tracking + full-text index), `library_issues` (issue/return/lost lifecycle), `library_fines` (paise, waivable). `available_copies <= total_copies` enforced by CHECK.
- **Library module** (`backend/src/modules/library/`) replaces the Week 3 stub:
  - `calculateLibraryFine()` pure function (SRS Section 9) — fine from due_date + 1 (grace day), holiday-aware, never negative — 15 unit tests
  - Issue rules: no copies → ERR-LIB-001, max 3 books out → ERR-LIB-004, unpaid fines ≥ ₹100 → ERR-LIB-002; book row locked `FOR UPDATE` so the last copy can't double-issue
  - Return flow: copies restored (not on lost), overdue fine row auto-created, all in one transaction
  - Fines: pay at counter or waive with mandatory reason (both audited)
  - Student self-service: own issues with live fine estimates; searchable catalogue for all roles
- **Frontend** — `LibraryPage` (student: my books with overdue badges + fine estimates, searchable catalogue), `LibraryManagementPage` (librarian: issued/overdue tabs, one-click return with fine toast, add book, issue modal with friendly error mapping)
- **Demo seed** (`database/scripts/seed_demo_timetable.sql`) — teachers, courses, time slots, weekly timetables for all batches, 3 weeks of attendance, and `librarian1` / `accounts1` users (password123)
- Routes `/library` (student) + `/library/manage` (librarian/admin); Sidebar split by role

### Fixed
- Grievance status update crashed on real Postgres (`inconsistent types deduced for parameter $1`) — added explicit `::text` casts (Error IDs 1bfbc521, 6a9da199)
- **Migration 017** — dropped broken `log_user_action()` audit triggers that cast `current_user::uuid` and crashed every INSERT into departments/courses/teachers/students/timetables (root cause of the original sample-data seeding failure)
- Teacher/HOD Timetable page called the student-only endpoint → 403 loop; now routes to `/timetable/teacher/my`
- Form text invisible in dark-mode browsers — global `color-scheme: light` + explicit text color on inputs/textareas/selects

## [0.7.0] — 2026-07-19 (Week 7 — Fee Management)

### Added
- **Migration 016** — `fee_heads`, `fee_assignments`, `fee_concessions`, `fee_transactions`, `fee_ledger`, `fee_receipt_seq`. All money stored in **paise** (INTEGER) to avoid float rounding.
- **Fee module** (`backend/src/modules/fee/`) — full fee lifecycle per SRS 3.4:
  - Student self-service: balance breakdown, ledger, transaction history, initiate online payment
  - `calculateFeeBalance()` pure function (SRS Section 9) — gross/concession/net/paid/fine/due; concessions capped at charged amount; late fine accrues from `due_date + 1`, gated by oldest-due-first payment allocation; balance clamped at zero
  - Account Officer: create fee heads, assign heads to a batch (posts DEBIT ledger lines to every active student), grant concessions (CREDIT), record offline payments (cash/cheque/DD → receipt `RCP-<year>-<6-digit>`), view any student's ledger
  - **Razorpay integration** — order creation + webhook confirmation. Payments confirmed **only** on signature-verified webhook (`verifyRazorpayWebhookSignature`, HMAC-SHA256, constant-time compare); `razorpay_order_id` is the idempotency key so duplicate webhooks never double-post (row-locked `FOR UPDATE`)
- **Razorpay util** (`backend/src/utils/razorpay.ts`) — webhook + payment signature verification, lazy SDK client, order creation
- **Frontend** — `FeesPage` (student: balance cards, ledger, payment history, pay-online modal with graceful fallback when gateway unconfigured), `FeeManagementPage` (officer: fee heads, batch assignment, concessions, offline payments, student ledger lookup)
- **API client** — `fee.api.ts` with `formatPaise()` helper
- Routes wired in `App.tsx` (`/fees` student, `/fees/manage` officer); Sidebar split by role
- `frontend/src/vite-env.d.ts` — Vite env typings (was missing)
- `backend/tests/unit/fee.service.test.ts` — 18 tests: balance calc (concession cap, fine accrual, payment gating, overpayment clamp) + Razorpay signature verification

### Security
- Online payments never trusted on client redirect — only via webhook with verified HMAC signature (ERR-FEE-005 on mismatch)
- Idempotent payment posting via `razorpay_order_id` + `FOR UPDATE` row lock (ERR-FEE-006 territory)
- Raw request body captured in `app.ts` (`express.json` verify hook) so webhook signatures verify against exact bytes

### Migration Notes
- Run migration `016_fee_module.sql` before deploying this version
- Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (backend) and `VITE_RAZORPAY_KEY_ID` (frontend) to enable live online payments; offline payments and balance tracking work without them

## [0.6.0] — 2026-07-18 (Week 6 — Notices + Grievances)

### Added
- **Migration 015** — `grievances`, `grievance_updates` (status timeline), `notice_reads` (unread tracking), `grievance_ticket_seq`
- **Grievance module** (`backend/src/modules/grievance/`) — full ticketing per SRS 3.8:
  - Student submit with category → role routing (academic→HOD, financial→Account Officer, hostel→Staff, library→Librarian, administrative/other→Admin)
  - Ticket numbers `GRV-<year>-<5-digit>` generated atomically from a sequence
  - Status flow open → in_review → resolved / escalated; resolution notes mandatory on resolve
  - SLA tracking (5 working days) with `sla_breached` flag and admin-triggered `POST /grievances/escalate-overdue` sweep (BullMQ job planned)
  - Ownership + role checks on every read/update; all changes audit-logged and timeline-recorded
- **Notice module extensions** — mark-as-read (`POST /notices/:id/read`), unread count in list meta (FR-NOT-002), poster management list (`GET /notices/my-posted` with read counts), take-down (`DELETE /notices/:id`, poster/admin only)
- **Frontend** — `NoticesPage` (expandable cards, unread dots, critical pinning, post-notice modal for staff roles), `GrievancePage` (student submit + ticket tracking with timeline modal), `GrievanceQueuePage` (officer queue, SLA-breached first, in-review/resolve workflow)
- **API clients** — `notice.api.ts`, `grievance.api.ts`
- Routes wired in `App.tsx` (`/notices`, `/grievances`, `/grievances/queue`) and Sidebar split: students see Grievances, officer roles see Grievance Queue
- `backend/tests/unit/grievance.service.test.ts` — routing, permissions, transactions, SLA escalation
- Error codes: ERR-GRIEV-003 (already resolved), ERR-NOT-001 (notice not found)

### Migration Notes
- Run migration `015_grievances.sql` before deploying this version

## [0.1.0] — 2026-06-25

### Added
- Initial project scaffold: full directory structure per SRS Section 5
- Backend: Express + TypeScript + Drizzle ORM foundation
- `src/config/env.ts` — Zod-validated environment variable loader (crashes on missing vars)
- `src/utils/logger.ts` — Winston structured logger with daily file rotation and error_id support
- `src/middleware/error.middleware.ts` — Global error handler with `AppError` class and ERR-MODULE-NNN codes
- `src/middleware/auth.middleware.ts` — JWT verification (`requireAuth`) and RBAC (`requireRole`)
- `src/db/index.ts` — PostgreSQL connection pool with Drizzle ORM
- `src/db/migrate.ts` — Idempotent numbered SQL migration runner
- `src/modules/auth/` — Full auth module: login, logout, OTP reset, change password
- `backend/tests/unit/auth.service.test.ts` — Unit tests for all AuthService methods
- Database migrations: 010 (users extensions), 011 (students extensions), 012 (timetable extensions)
- `docker-compose.yml` — Local dev: PostgreSQL 14, PostgreSQL test, Redis 7, MinIO
- `.env.example` — All required environment variables documented
- `.gitignore` — Comprehensive ignore rules
- `docs/ERROR_CODES.md` — Full error code registry for all modules
- `docs/CHANGELOG.md` — This file
- `.github/workflows/ci.yml` — CI pipeline: lint + test on every PR

### Architecture Decisions
- JWT tokens stored in HttpOnly cookies only — never in response body (XSS protection)
- All error codes follow ERR-MODULE-NNN format with unique error_id UUID for log tracing
- Dual-layer permission enforcement: API middleware + PostgreSQL RLS
- Audit tables (access_logs, timetable_changes) protected by INSERT-only DB rules
- Migration files are numbered (010_, 011_) and tracked in `_migrations` table

