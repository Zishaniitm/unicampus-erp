-- ============================================================
-- Migration 016: Fee Management
-- Author: Zishan Ahmad | Date: July 2026
-- Week 7 — Fee module foundation (Phase 2)
-- ============================================================
-- Scope (SRS 3.4 — Fee Management):
--   fee_heads         — catalogue of chargeable heads (tuition, exam, etc.)
--   fee_assignments   — which head applies to which batch + amount + due date
--   fee_concessions   — per-student waivers (scholarship, sibling, staff ward)
--   fee_transactions  — one row per payment attempt (Razorpay or offline)
--   fee_ledger        — immutable posting lines that make up a student balance
--
-- Money is stored in PAISE (INTEGER) everywhere to avoid float rounding.
-- Display layer divides by 100. Never use FLOAT/DECIMAL arithmetic for money
-- in application code paths that decide balances.
-- ============================================================

-- ── Fee heads (FR-FEE-001) ───────────────────────────────────
-- A catalogue entry: "Tuition Fee", "Exam Fee", "Library Deposit"…
CREATE TABLE IF NOT EXISTS fee_heads (
    fee_head_id   SERIAL PRIMARY KEY,
    head_code     VARCHAR(30)  NOT NULL UNIQUE,        -- e.g. TUITION, EXAM, LIBDEP
    head_name     VARCHAR(100) NOT NULL,
    description   TEXT,
    is_refundable BOOLEAN NOT NULL DEFAULT FALSE,      -- deposits are refundable
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_by    UUID REFERENCES users(user_id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fee_heads IS
    'Catalogue of chargeable fee heads. Amounts live in fee_assignments, not here.';

-- ── Fee assignments (FR-FEE-002) ─────────────────────────────
-- Binds a head to a batch for an academic year/semester with an amount + due date.
-- This is what generates a student''s payable ledger.
CREATE TABLE IF NOT EXISTS fee_assignments (
    assignment_id   SERIAL PRIMARY KEY,
    fee_head_id     INTEGER NOT NULL REFERENCES fee_heads(fee_head_id),
    batch_id        INTEGER NOT NULL REFERENCES batches(batch_id),
    academic_year   VARCHAR(9) NOT NULL,               -- e.g. 2026-2027
    semester        INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
    amount_paise    INTEGER NOT NULL CHECK (amount_paise >= 0),
    due_date        DATE NOT NULL,
    late_fine_per_day_paise INTEGER NOT NULL DEFAULT 0 CHECK (late_fine_per_day_paise >= 0),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID REFERENCES users(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (fee_head_id, batch_id, academic_year, semester)
);

CREATE INDEX IF NOT EXISTS idx_fee_assign_batch ON fee_assignments(batch_id, academic_year, semester);

COMMENT ON TABLE fee_assignments IS
    'A fee head assigned to a batch with amount + due date. Drives per-student payable amounts.';

-- ── Fee concessions (FR-FEE-003) ─────────────────────────────
-- Per-student waiver against a specific assignment (scholarship, sibling, staff ward).
CREATE TABLE IF NOT EXISTS fee_concessions (
    concession_id   SERIAL PRIMARY KEY,
    student_id      INTEGER NOT NULL REFERENCES students(student_id),
    assignment_id   INTEGER NOT NULL REFERENCES fee_assignments(assignment_id),
    concession_type VARCHAR(30) NOT NULL CHECK (concession_type IN
                      ('scholarship','sibling','staff_ward','merit','sports','other')),
    amount_paise    INTEGER NOT NULL CHECK (amount_paise > 0),
    reason          VARCHAR(500) NOT NULL,
    granted_by      UUID NOT NULL REFERENCES users(user_id),
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, assignment_id, concession_type)
);

CREATE INDEX IF NOT EXISTS idx_fee_concession_student ON fee_concessions(student_id);

COMMENT ON TABLE fee_concessions IS
    'Per-student waiver against a fee assignment. Reduces net payable in balance calc.';

-- ── Fee transactions (FR-FEE-004, FR-FEE-005) ────────────────
-- One row per payment attempt. Razorpay order_id is the idempotency key.
-- Status flow: CREATED → PENDING → SUCCESS | FAILED (never skip states).
-- Offline (cash/cheque/DD) rows are inserted directly as SUCCESS by Account Officer.
CREATE TABLE IF NOT EXISTS fee_transactions (
    transaction_id     BIGSERIAL PRIMARY KEY,
    receipt_number     VARCHAR(30) UNIQUE,             -- generated only after SUCCESS
    student_id         INTEGER NOT NULL REFERENCES students(student_id),
    amount_paise       INTEGER NOT NULL CHECK (amount_paise > 0),
    method             VARCHAR(20) NOT NULL CHECK (method IN
                         ('razorpay','cash','cheque','dd','neft','upi_offline')),
    status             VARCHAR(20) NOT NULL DEFAULT 'CREATED' CHECK (status IN
                         ('CREATED','PENDING','SUCCESS','FAILED')),
    -- Razorpay linkage (NULL for offline payments)
    razorpay_order_id   VARCHAR(60) UNIQUE,            -- idempotency key (FR-FEE: check before insert)
    razorpay_payment_id VARCHAR(60),
    razorpay_signature  VARCHAR(255),
    -- Offline linkage
    offline_reference   VARCHAR(60),                   -- cheque/DD number
    recorded_by         UUID REFERENCES users(user_id),-- Account Officer for offline
    notes               VARCHAR(500),
    paid_at             TIMESTAMPTZ,                    -- set when status → SUCCESS
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fee_txn_student ON fee_transactions(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fee_txn_status  ON fee_transactions(status);

COMMENT ON TABLE fee_transactions IS
    'One row per payment attempt. razorpay_order_id is the idempotency key; receipt issued only on SUCCESS via webhook.';

-- ── Fee ledger (FR-FEE-006) ──────────────────────────────────
-- Immutable posting lines. A DEBIT is something the student owes (an assignment),
-- a CREDIT is a payment or concession applied. Balance = SUM(debit) - SUM(credit).
-- INSERT-only in spirit; never UPDATE a posted line — post a reversing line instead.
CREATE TABLE IF NOT EXISTS fee_ledger (
    ledger_id       BIGSERIAL PRIMARY KEY,
    student_id      INTEGER NOT NULL REFERENCES students(student_id),
    assignment_id   INTEGER REFERENCES fee_assignments(assignment_id),
    transaction_id  BIGINT REFERENCES fee_transactions(transaction_id),
    concession_id   INTEGER REFERENCES fee_concessions(concession_id),
    entry_type      VARCHAR(10) NOT NULL CHECK (entry_type IN ('DEBIT','CREDIT')),
    amount_paise    INTEGER NOT NULL CHECK (amount_paise > 0),
    description     VARCHAR(200) NOT NULL,
    posted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fee_ledger_student ON fee_ledger(student_id, posted_at);

COMMENT ON TABLE fee_ledger IS
    'Immutable double-entry style postings. Balance = SUM(DEBIT) - SUM(CREDIT) per student. Never UPDATE a line.';

-- ── Receipt number sequence: RCP-<year>-<6-digit> ────────────
CREATE SEQUENCE IF NOT EXISTS fee_receipt_seq;
