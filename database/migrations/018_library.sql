-- ============================================================
-- Migration 018: Library Management
-- Author: Zishan Ahmad | Date: July 2026
-- Week 8 — Library module (SRS 3.5)
-- ============================================================
-- library_books  — catalogue with copy tracking
-- library_issues — issue/return lifecycle
-- library_fines  — fines in PAISE (INTEGER), consistent with fee module
--
-- Fine rule (SRS Section 6): starts due_date + 1 day.
--   fine_days = MAX(0, (return_or_today - due_date) - 1), holidays excluded
-- ============================================================

CREATE TABLE IF NOT EXISTS library_books (
    book_id          SERIAL PRIMARY KEY,
    isbn             VARCHAR(20) UNIQUE,             -- nullable: old books may lack ISBN
    title            VARCHAR(300) NOT NULL,
    author           VARCHAR(200) NOT NULL,
    publisher        VARCHAR(200),
    category         VARCHAR(50),                    -- e.g. Programming, Mathematics, Fiction
    edition          VARCHAR(30),
    total_copies     INTEGER NOT NULL DEFAULT 1 CHECK (total_copies >= 0),
    available_copies INTEGER NOT NULL DEFAULT 1 CHECK (available_copies >= 0),
    rack_number      VARCHAR(20),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    added_by         UUID REFERENCES users(user_id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT copies_consistent CHECK (available_copies <= total_copies)
);

CREATE INDEX IF NOT EXISTS idx_lib_books_title  ON library_books USING gin (to_tsvector('simple', title || ' ' || author));
CREATE INDEX IF NOT EXISTS idx_lib_books_active ON library_books(is_active, category);

COMMENT ON TABLE library_books IS 'Book catalogue. available_copies is decremented on issue, incremented on return.';

CREATE TABLE IF NOT EXISTS library_issues (
    issue_id     BIGSERIAL PRIMARY KEY,
    book_id      INTEGER NOT NULL REFERENCES library_books(book_id),
    student_id   INTEGER NOT NULL REFERENCES students(student_id),
    issued_by    UUID NOT NULL REFERENCES users(user_id),   -- librarian
    issue_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date     DATE NOT NULL,
    return_date  DATE,                                       -- NULL = still out
    returned_to  UUID REFERENCES users(user_id),             -- librarian who took it back
    status       VARCHAR(15) NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','returned','lost')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT return_after_issue CHECK (return_date IS NULL OR return_date >= issue_date)
);

CREATE INDEX IF NOT EXISTS idx_lib_issues_student ON library_issues(student_id, status);
CREATE INDEX IF NOT EXISTS idx_lib_issues_overdue ON library_issues(status, due_date);

COMMENT ON TABLE library_issues IS 'Issue/return lifecycle. status=issued + due_date past = overdue (derived, not stored).';

CREATE TABLE IF NOT EXISTS library_fines (
    fine_id      BIGSERIAL PRIMARY KEY,
    issue_id     BIGINT NOT NULL REFERENCES library_issues(issue_id),
    student_id   INTEGER NOT NULL REFERENCES students(student_id),
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    reason       VARCHAR(200) NOT NULL DEFAULT 'Late return',
    is_paid      BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at      TIMESTAMPTZ,
    collected_by UUID REFERENCES users(user_id),
    waived_by    UUID REFERENCES users(user_id),             -- non-NULL = waived, not collected
    waive_reason VARCHAR(500),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lib_fines_student ON library_fines(student_id, is_paid);

COMMENT ON TABLE library_fines IS 'Fines in paise. Unpaid total above threshold blocks new issues (ERR-LIB-002) and semester registration (ERR-STU-003).';
