-- ============================================================
-- Migration 015: Grievances + Notice reads
-- Author: Zishan Ahmad | Date: July 2026
-- Week 6 — Notice board completion + Grievance management
-- ============================================================

-- ── Grievances (FR-GRIEV-001 … FR-GRIEV-005) ─────────────────
-- Categories route to a role (FR-GRIEV-002):
--   academic → HOD, financial → ACCOUNT_OFFICER, hostel → STAFF,
--   library → LIBRARIAN, administrative/other → SUPER_ADMIN
CREATE TABLE IF NOT EXISTS grievances (
    grievance_id     BIGSERIAL PRIMARY KEY,
    ticket_number    VARCHAR(20) NOT NULL UNIQUE,   -- e.g. GRV-2026-00042
    student_id       INTEGER NOT NULL REFERENCES students(student_id),
    category         VARCHAR(20) NOT NULL CHECK (category IN
                       ('academic','financial','administrative','hostel','library','other')),
    subject          VARCHAR(200) NOT NULL,
    description      VARCHAR(1000) NOT NULL,        -- SRS: max 1000 characters
    status           VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN
                       ('open','in_review','resolved','escalated')),
    assigned_role    VARCHAR(50) NOT NULL,          -- role responsible per category routing
    assigned_to      UUID REFERENCES users(user_id),-- specific officer once picked up
    sla_due_at       TIMESTAMPTZ NOT NULL,          -- computed at insert (created_at + SLA days)
    resolution_notes TEXT,
    resolved_by      UUID REFERENCES users(user_id),
    resolved_at      TIMESTAMPTZ,
    escalated_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_griev_student  ON grievances(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_griev_assigned ON grievances(assigned_role, status);
CREATE INDEX IF NOT EXISTS idx_griev_sla      ON grievances(status, sla_due_at);

COMMENT ON TABLE grievances IS
    'Student grievance tickets. Routed by category to a role; overdue tickets escalate to Principal (FR-GRIEV-004)';

-- Per-year ticket sequence: GRV-<year>-<5-digit counter>
CREATE SEQUENCE IF NOT EXISTS grievance_ticket_seq;

-- Status history for the ticket timeline (who changed what, when)
CREATE TABLE IF NOT EXISTS grievance_updates (
    update_id    BIGSERIAL PRIMARY KEY,
    grievance_id BIGINT NOT NULL REFERENCES grievances(grievance_id) ON DELETE CASCADE,
    old_status   VARCHAR(20),
    new_status   VARCHAR(20) NOT NULL,
    comment      TEXT,
    updated_by   UUID NOT NULL REFERENCES users(user_id),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_griev_updates ON grievance_updates(grievance_id, created_at);

COMMENT ON TABLE grievance_updates IS
    'Status-change timeline per grievance — shown to the student as ticket history (FR-GRIEV-005)';

-- ── Notice reads (FR-NOT-002 unread indicator) ───────────────
CREATE TABLE IF NOT EXISTS notice_reads (
    notice_id INTEGER NOT NULL REFERENCES notices(notice_id) ON DELETE CASCADE,
    user_id   UUID    NOT NULL REFERENCES users(user_id)     ON DELETE CASCADE,
    read_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (notice_id, user_id)
);

COMMENT ON TABLE notice_reads IS
    'Tracks which user has read which notice — powers the unread indicator (FR-NOT-002)';
