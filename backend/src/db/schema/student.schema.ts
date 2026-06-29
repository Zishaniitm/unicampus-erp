import { pgTable, serial, uuid, varchar, date, boolean, text, decimal, timestamp, integer } from 'drizzle-orm/pg-core';

/**
 * Drizzle schema — mirrors the existing students table (file 03_core_entity_tables.sql)
 * plus the extensions from migration 011_students_extensions.sql
 *
 * Do NOT create a new table. This is the type-safe representation of the existing table.
 */
export const students = pgTable('students', {
  student_id:                serial('student_id').primaryKey(),
  user_id:                   uuid('user_id').notNull().unique(),
  roll_number:               varchar('roll_number', { length: 20 }).notNull().unique(),
  batch_id:                  integer('batch_id').notNull(),
  admission_date:            date('admission_date').notNull(),
  date_of_birth:             date('date_of_birth').notNull(),
  gender:                    varchar('gender', { length: 20 }),
  address:                   text('address'),
  contact_number:            varchar('contact_number', { length: 15 }),
  parent_guardian_name:      varchar('parent_guardian_name', { length: 100 }),
  parent_contact_number:     varchar('parent_contact_number', { length: 15 }),
  is_active:                 boolean('is_active').default(true),
  // Extension columns (migration 011)
  cgpa:                      decimal('cgpa', { precision: 4, scale: 2 }),
  sgpa_latest:               decimal('sgpa_latest', { precision: 4, scale: 2 }),
  noc_issued:                boolean('noc_issued').default(false),
  library_membership_active: boolean('library_membership_active').default(true),
  academic_hold:             boolean('academic_hold').default(false),
  academic_hold_reason:      text('academic_hold_reason'),
  academic_hold_by:          uuid('academic_hold_by'),
  admission_status:          varchar('admission_status', { length: 20 }).default('pending'),
  credential_sent_at:        timestamp('credential_sent_at', { withTimezone: true }),
  first_login_at:            timestamp('first_login_at', { withTimezone: true }),
  created_at:                timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:                timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const users = pgTable('users', {
  user_id:                 uuid('user_id').primaryKey().defaultRandom(),
  username:                varchar('username', { length: 50 }).notNull().unique(),
  email:                   varchar('email', { length: 255 }).notNull().unique(),
  password_hash:           text('password_hash').notNull(),
  first_name:              varchar('first_name', { length: 100 }).notNull(),
  last_name:               varchar('last_name', { length: 100 }).notNull(),
  role_id:                 integer('role_id').notNull(),
  is_active:               boolean('is_active').default(true),
  last_login:              timestamp('last_login', { withTimezone: true }),
  // Extension columns (migration 010)
  photo_url:               text('photo_url'),
  mobile_number:           text('mobile_number'),   // AES-256 encrypted
  otp_hash:                text('otp_hash'),
  otp_expires_at:          timestamp('otp_expires_at', { withTimezone: true }),
  failed_login_attempts:   integer('failed_login_attempts').default(0),
  locked_until:            timestamp('locked_until', { withTimezone: true }),
  must_change_password:    boolean('must_change_password').default(true),
  onboarding_completed:    boolean('onboarding_completed').default(false),
  created_at:              timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:              timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
