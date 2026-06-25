# UniCampus ERP

> College Enterprise Resource Planning System for United Group of Institutions (FUGS)

A full-stack web application replacing the existing iCampus ERP with a custom, institution-owned system.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express + TypeScript |
| Frontend | React 18 + Vite + Tailwind CSS |
| Database | PostgreSQL 14+ with Drizzle ORM |
| Auth | JWT in HttpOnly cookies + bcrypt |
| Payments | Razorpay (webhook-confirmed) |
| Queue | BullMQ + Redis |
| Storage | MinIO |

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- Docker + Docker Compose (for PostgreSQL, Redis, MinIO)
- Git

### 1. Clone and configure
```bash
git clone https://github.com/YOUR_USERNAME/unicampus-erp.git
cd unicampus-erp
cp .env.example .env
# Edit .env with your values
```

### 2. Start local services
```bash
docker-compose up -d
# PostgreSQL: localhost:5432
# Redis:      localhost:6379
# MinIO:      localhost:9000 (API), localhost:9001 (Console UI)
```

### 3. Set up database
```bash
# Copy your original SQL files (00-09) to database/original/
# Then run all migrations:
cd backend
npm install
npm run db:migrate
```

### 4. Start backend
```bash
cd backend
npm run dev
# API running at http://localhost:3001
# Health check: http://localhost:3001/health
```

### 5. Start frontend _(coming in Phase 1, Week 7)_
```bash
cd frontend
npm install
npm run dev
# UI at http://localhost:5173
```

## Development Workflow

```
main       ← production-ready only
develop    ← integration branch (all PRs merge here)
feature/*  ← individual feature work
fix/*      ← bug fixes
```

### Commit convention
```
feat(auth): add OTP-based password reset
fix(fee): correct late fine calculation on holidays
chore(db): add migration 013_fee_heads
docs(api): document /api/v1/auth endpoints
test(auth): add unit tests for account lockout
```

## Running Tests

```bash
cd backend
npm run test:unit        # Unit tests (no DB needed)
npm run test:integration # Integration tests (requires test DB)
npm run test:coverage    # Full coverage report
```

## Project Structure

See `docs/SRS_v1.docx` Section 5 for the complete directory structure rationale.

## Error Handling

Every error returns:
```json
{
  "success": false,
  "error": {
    "code": "ERR-MODULE-NNN",
    "message": "Human-readable message",
    "error_id": "uuid-for-log-tracing",
    "timestamp": "ISO string"
  }
}
```

When users report issues, they provide the `error_id`. Developers grep server logs for it to get full context.

See `docs/ERROR_CODES.md` for the complete error code registry.

## Deployment

See `docs/RUNBOOK.md` for production deployment, backup, and maintenance procedures.

---

**Developer:** Zishan Ahmad | BCA + IIT Madras Data Science | United Institute of Management (FUGS)
