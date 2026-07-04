-- College Timetable Management System
-- Database Setup Script
-- Created: April 17, 2025
-- PostgreSQL 14+ Compatible

-- This script creates a comprehensive database schema for a College Timetable Management System
-- with support for departments, courses, teachers, classrooms, students, batches/sections,
-- time slots, timetables, substitutions, and user authentication with role-based access control.

-- =============================================
-- DATABASE CREATION AND EXTENSIONS
-- =============================================

-- Create the database
CREATE DATABASE college_timetable_db;

-- Connect to the database
\c college_timetable_db;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- For password encryption
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- For UUID generation
CREATE EXTENSION IF NOT EXISTS citext;       -- For case-insensitive text fields

-- Set search path
SET search_path TO public;

-- Create schema for audit logs
CREATE SCHEMA audit;

-- Create schema for application logic
CREATE SCHEMA app;

COMMENT ON DATABASE college_timetable_db IS 'College Timetable Management System Database';
COMMENT ON SCHEMA audit IS 'Schema for audit logs and tracking changes';
COMMENT ON SCHEMA app IS 'Schema for application logic and stored procedures';
