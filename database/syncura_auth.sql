-- ==========================================================================
-- SynCura — Authentication & Login Logging Database
-- MySQL 8.0+
--
-- Covers: user registration/login (pages/auth/register.html, login.html),
-- provider approval workflow, and login audit logging.
-- Roles match js/app.js roleHome keys: patient, doctor, hospital, lab,
-- pharmacy, admin.
-- ==========================================================================

CREATE DATABASE IF NOT EXISTS syncura
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE syncura;

-- --------------------------------------------------------------------------
-- users
-- Core account record created at the end of registration (regName, regPhone,
-- email, password fields in register.html). Provider roles start as
-- 'pending' until an admin approves their application.
-- --------------------------------------------------------------------------
CREATE TABLE users (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name       VARCHAR(150)    NOT NULL,
  email           VARCHAR(190)    NULL,
  phone           VARCHAR(20)     NOT NULL,
  password_hash   VARCHAR(255)    NOT NULL,
  role            ENUM('patient','doctor','hospital','lab','pharmacy','admin') NOT NULL,
  status          ENUM('pending','active','rejected','suspended') NOT NULL DEFAULT 'pending',
  avatar_url      VARCHAR(255)    NULL,
  phone_verified_at DATETIME      NULL,
  email_verified_at DATETIME      NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_phone (phone),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_status (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- provider_applications
-- One row per provider registration (doctor / hospital / lab / pharmacy),
-- holding the "Organization / License Number" field and admin review state.
-- Patients and admins never get a row here. hospital_id/department_id are
-- only set for doctor applications (the doctor chose their hospital at
-- registration) — that hospital reviews the application, not the System
-- Admin. Their FK constraints are added later in syncura.sql, once the
-- hospitals/hospital_departments tables it references exist.
-- --------------------------------------------------------------------------
CREATE TABLE provider_applications (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id             BIGINT UNSIGNED NOT NULL,
  hospital_id         BIGINT UNSIGNED NULL,
  department_id       BIGINT UNSIGNED NULL,
  license_number      VARCHAR(100)    NOT NULL,
  review_status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by_user_id BIGINT UNSIGNED NULL,
  reviewed_at         DATETIME        NULL,
  rejection_reason    VARCHAR(255)    NULL,
  submitted_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_provider_app_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_provider_app_reviewer
    FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_provider_app_status (review_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- login_logs
-- Audit trail for every sign-in attempt on login.html (success or failure),
-- including the demo quick-access buttons.
-- --------------------------------------------------------------------------
CREATE TABLE login_logs (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NULL,
  identifier      VARCHAR(190)    NOT NULL COMMENT 'email or phone entered on the login form',
  status          ENUM('success','failed') NOT NULL,
  failure_reason  VARCHAR(100)    NULL,
  ip_address      VARCHAR(45)     NULL,
  user_agent      VARCHAR(255)    NULL,
  attempted_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_login_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_login_logs_user (user_id),
  KEY idx_login_logs_attempted_at (attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- user_sessions
-- Active login sessions, for "remember me" / token-based auth and the
-- ability to revoke a session (e.g. on password change or admin suspension).
-- --------------------------------------------------------------------------
CREATE TABLE user_sessions (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  session_token CHAR(64)        NOT NULL,
  ip_address    VARCHAR(45)     NULL,
  user_agent    VARCHAR(255)    NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at    DATETIME        NOT NULL,
  revoked_at    DATETIME        NULL,
  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_sessions_token (session_token),
  KEY idx_sessions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- Seed data — demo accounts (used for manual sign-in testing; the
-- "Quick Demo Access" buttons have been removed from the login page).
-- Password for all demo accounts is "demo123"
-- (bcrypt hash below was generated with PHP's password_hash()).
-- --------------------------------------------------------------------------
INSERT INTO users (full_name, email, phone, password_hash, role, status, phone_verified_at, email_verified_at) VALUES
('Fatima Begum',      'patient@syncura.bd',  '+8801700000001', '$2y$10$xLq1Hh.q8oJruSrMDk9okeQFP0BCDiQ4u83iiJ.D2D8tHIEhhDiF6', 'patient',  'active', NOW(), NOW()),
('Dr. Karim Hossain',  'doctor@syncura.bd',   '+8801700000002', '$2y$10$xLq1Hh.q8oJruSrMDk9okeQFP0BCDiQ4u83iiJ.D2D8tHIEhhDiF6', 'doctor',   'active', NOW(), NOW()),
('Admin Rahman',       'hospital@syncura.bd', '+8801700000003', '$2y$10$xLq1Hh.q8oJruSrMDk9okeQFP0BCDiQ4u83iiJ.D2D8tHIEhhDiF6', 'hospital', 'active', NOW(), NOW()),
('Lab Manager Nadia',  'lab@syncura.bd',      '+8801700000004', '$2y$10$xLq1Hh.q8oJruSrMDk9okeQFP0BCDiQ4u83iiJ.D2D8tHIEhhDiF6', 'lab',      'active', NOW(), NOW()),
('Pharma Sakib',       'pharmacy@syncura.bd', '+8801700000005', '$2y$10$xLq1Hh.q8oJruSrMDk9okeQFP0BCDiQ4u83iiJ.D2D8tHIEhhDiF6', 'pharmacy', 'active', NOW(), NOW()),
('System Admin',       'admin@syncura.bd',    '+8801700000006', '$2y$10$xLq1Hh.q8oJruSrMDk9okeQFP0BCDiQ4u83iiJ.D2D8tHIEhhDiF6', 'admin',    'active', NOW(), NOW());
