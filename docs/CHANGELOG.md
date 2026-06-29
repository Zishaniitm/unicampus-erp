# UniCampus ERP — Changelog

All notable changes to this project are documented here.
Format: `## [version] — YYYY-MM-DD` with sections: Added, Changed, Fixed, Security, Migration Notes.

---

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

