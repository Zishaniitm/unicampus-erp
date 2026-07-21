-- ============================================================
-- Migration 020: Hostel & Bus registrations + registration windows
-- Author: Zishan Ahmad | Date: July 2026
-- Week 9 — Hostel and Bus modules (SRS 3.6, 3.7)
-- ============================================================
-- registration_windows — shared open/close windows (hostel/bus/semester)
-- hostel_categories    — room types with capacity + semester fee (paise)
-- hostel_registrations — student applications, staff approval flow
-- bus_routes           — routes with stops (JSONB) + capacity + fee
-- bus_registrations    — student bus pass applications
--
-- Rules enforced in service layer:
--   window open check, server-side IST (ERR-HST-001 / ERR-BUS-001)
--   capacity check (ERR-HST-002), one active registration/year (ERR-HST-003)
-- ============================================================

CREATE TABLE IF NOT EXISTS registration_windows (
    window_id     SERIAL PRIMARY KEY,
    window_type   VARCHAR(20) NOT NULL CHECK (window_type IN ('hostel','bus','semester')),
    academic_year VARCHAR(9) NOT NULL,                -- e.g. 2026-2027
    opens_at      TIMESTAMPTZ NOT NULL,
    closes_at     TIMESTAMPTZ NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_by    UUID REFERENCES users(user_id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT window_valid_range CHECK (closes_at > opens_at),
    UNIQUE (window_type, academic_year)
);

COMMENT ON TABLE registration_windows IS
    'Open/close windows per registration type per academic year. Checked server-side in IST — never trust client time.';

CREATE TABLE IF NOT EXISTS hostel_categories (
    category_id      SERIAL PRIMARY KEY,
    category_name    VARCHAR(80) NOT NULL UNIQUE,      -- e.g. "2-Seater AC"
    description      TEXT,
    gender           VARCHAR(10) NOT NULL DEFAULT 'Any' CHECK (gender IN ('Male','Female','Any')),
    total_capacity   INTEGER NOT NULL CHECK (total_capacity >= 0),
    fee_per_semester_paise INTEGER NOT NULL CHECK (fee_per_semester_paise >= 0),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_by       UUID REFERENCES users(user_id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE hostel_categories IS
    'Hostel room categories. Occupancy = approved + pending registrations for the year (service computes).';

CREATE TABLE IF NOT EXISTS hostel_registrations (
    registration_id BIGSERIAL PRIMARY KEY,
    student_id      INTEGER NOT NULL REFERENCES students(student_id),
    category_id     INTEGER NOT NULL REFERENCES hostel_categories(category_id),
    academic_year   VARCHAR(9) NOT NULL,
    status          VARCHAR(15) NOT NULL DEFAULT 'pending' CHECK (status IN
                      ('pending','approved','rejected','cancelled')),
    remarks         VARCHAR(500),                      -- student note / staff rejection reason
    decided_by      UUID REFERENCES users(user_id),
    decided_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One live (pending/approved) registration per student per year — enforced
-- via partial unique index so rejected/cancelled don't block re-applying.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_reg_live
    ON hostel_registrations(student_id, academic_year)
    WHERE status IN ('pending','approved');

CREATE INDEX IF NOT EXISTS idx_hostel_reg_category ON hostel_registrations(category_id, academic_year, status);

CREATE TABLE IF NOT EXISTS bus_routes (
    route_id       SERIAL PRIMARY KEY,
    route_name     VARCHAR(100) NOT NULL UNIQUE,       -- e.g. "Route 1 — City Centre"
    stops          JSONB NOT NULL DEFAULT '[]',        -- ["Stop A", "Stop B", ...]
    capacity       INTEGER NOT NULL CHECK (capacity >= 0),
    fee_per_semester_paise INTEGER NOT NULL CHECK (fee_per_semester_paise >= 0),
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_by     UUID REFERENCES users(user_id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE bus_routes IS 'Bus routes; stops stored as a JSONB array of stop names in order.';

CREATE TABLE IF NOT EXISTS bus_registrations (
    registration_id BIGSERIAL PRIMARY KEY,
    student_id      INTEGER NOT NULL REFERENCES students(student_id),
    route_id        INTEGER NOT NULL REFERENCES bus_routes(route_id),
    stop_name       VARCHAR(100) NOT NULL,
    academic_year   VARCHAR(9) NOT NULL,
    status          VARCHAR(15) NOT NULL DEFAULT 'pending' CHECK (status IN
                      ('pending','approved','rejected','cancelled')),
    remarks         VARCHAR(500),
    decided_by      UUID REFERENCES users(user_id),
    decided_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bus_reg_live
    ON bus_registrations(student_id, academic_year)
    WHERE status IN ('pending','approved');

CREATE INDEX IF NOT EXISTS idx_bus_reg_route ON bus_registrations(route_id, academic_year, status);
