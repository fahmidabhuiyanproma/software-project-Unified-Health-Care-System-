-- ==========================================================================
-- SynCura — Core MVP Database (Phase 2)
-- MySQL 8.0+
--
-- Import AFTER database/syncura_auth.sql (which creates the `syncura`
-- database plus users / provider_applications / login_logs / user_sessions
-- and the 6 demo accounts). This file adds every table needed for the
-- rest of the MVP described in the SynCura SRS: hospital/doctor/lab/
-- pharmacy directories, appointments, unified medical records,
-- telemedicine, online pharmacy ordering, lab booking, sandbox payments,
-- and in-app notifications.
--
-- Design notes:
--  - Double-booking (FR-3.2) is prevented by a UNIQUE key on
--    (doctor_id, appointment_date, appointment_time) in `appointments`,
--    checked again at the application layer for a friendly error message.
--  - "Unified medical record" (FR-4.1..4.4) is one table, `medical_records`,
--    with a `record_type` discriminator (diagnosis/prescription/note/lab/
--    telemedicine) so a patient's full history is a single ORDER BY query
--    regardless of which module created the entry.
--  - Every provider (hospital/lab/pharmacy) is a one-row-per-organisation
--    table owned by the provider_admin user who registered it
--    (users.role = hospital/lab/pharmacy). Doctors are a separate
--    `doctors` directory table so Hospital Admins can add doctor profiles
--    directly (SRS FR-2.1) in addition to a doctor's own self-registration.
-- ==========================================================================

USE syncura;

-- --------------------------------------------------------------------------
-- hospitals — one row per hospital/clinic provider organisation.
-- Created automatically when a System Admin approves a 'hospital' user's
-- provider_applications row (see api/system-admin/approvals.php).
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospitals (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_user_id   BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(150)    NOT NULL,
  address         VARCHAR(255)    NULL,
  city            VARCHAR(100)    NULL,
  phone           VARCHAR(20)     NULL,
  registration_no VARCHAR(100)    NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_hospitals_owner (owner_user_id),
  CONSTRAINT fk_hospitals_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- hospital_departments — departments within a hospital (FR-2.1).
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospital_departments (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id   BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(100)    NOT NULL,
  bed_count     INT UNSIGNED    NOT NULL DEFAULT 0,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dept_hospital_name (hospital_id, name),
  CONSTRAINT fk_dept_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Deferred from syncura_auth.sql: provider_applications.hospital_id /
-- department_id can only be FK-constrained once these tables exist.
ALTER TABLE provider_applications
  ADD CONSTRAINT fk_provider_app_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_provider_app_department FOREIGN KEY (department_id) REFERENCES hospital_departments(id) ON DELETE SET NULL;

-- --------------------------------------------------------------------------
-- doctors — the doctor directory used for search/booking (FR-2.1, FR-2.2).
-- Linked to a `users` login (user_id) when the doctor can sign in to the
-- Doctor Portal — either via self-registration (approved by System Admin)
-- or because a Hospital Admin added them (which also creates the login).
-- hospital_id is NULL for an independent/self-registered doctor not yet
-- attached to a hospital.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctors (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id             BIGINT UNSIGNED NULL,
  hospital_id         BIGINT UNSIGNED NULL,
  department_id       BIGINT UNSIGNED NULL,
  full_name           VARCHAR(150)    NOT NULL,
  specialty           VARCHAR(100)    NOT NULL,
  qualification       VARCHAR(255)    NULL,
  experience_years    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  consultation_fee    DECIMAL(10,2)   NOT NULL DEFAULT 0,
  bio                 TEXT            NULL,
  photo_url           VARCHAR(255)    NULL,
  status              ENUM('active','pending','inactive') NOT NULL DEFAULT 'active',
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_doctors_user (user_id),
  KEY idx_doctors_hospital (hospital_id),
  KEY idx_doctors_specialty (specialty),
  CONSTRAINT fk_doctors_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_doctors_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL,
  CONSTRAINT fk_doctors_department FOREIGN KEY (department_id) REFERENCES hospital_departments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- doctor_weekly_availability — which weekdays a doctor generally sees
-- patients (drives the toggle list on the doctor's Schedule page).
-- 0 = Sunday .. 6 = Saturday.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor_weekly_availability (
  doctor_id   BIGINT UNSIGNED NOT NULL,
  weekday     TINYINT UNSIGNED NOT NULL,
  is_available TINYINT(1)     NOT NULL DEFAULT 1,
  PRIMARY KEY (doctor_id, weekday),
  CONSTRAINT fk_avail_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- bed_bookings — a patient requests a hospital bed in one department; the
-- hospital approves/rejects it and later marks the patient discharged.
-- A department's free beds = hospital_departments.bed_count minus its
-- 'pending' + 'approved' bookings; at 0 the department stops taking requests.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bed_bookings (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id       BIGINT UNSIGNED NOT NULL,
  hospital_id      BIGINT UNSIGNED NOT NULL,
  department_id    BIGINT UNSIGNED NOT NULL,
  admission_date   DATE            NOT NULL,
  reason           VARCHAR(255)    NOT NULL,
  attendant_phone  VARCHAR(20)     NULL,
  notes            VARCHAR(500)    NULL,
  status           ENUM('pending','approved','rejected','cancelled','discharged') NOT NULL DEFAULT 'pending',
  rejection_reason VARCHAR(255)    NULL,
  decided_at       DATETIME        NULL,
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_bed_patient (patient_id, status),
  KEY idx_bed_hospital_status (hospital_id, status),
  KEY idx_bed_dept_status (department_id, status),
  CONSTRAINT fk_bed_patient  FOREIGN KEY (patient_id)    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_bed_hospital FOREIGN KEY (hospital_id)   REFERENCES hospitals(id) ON DELETE CASCADE,
  CONSTRAINT fk_bed_dept     FOREIGN KEY (department_id) REFERENCES hospital_departments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- appointments — FR-3.1..FR-3.4. active_slot_key is a generated column
-- that's NULL for cancelled rows, so the UNIQUE key only guards a doctor +
-- date + time combo while an appointment is actually pending/confirmed/
-- completed (FR-3.2) — a cancelled appointment frees the slot for reuse
-- instead of leaving a dead row that blocks it forever.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id        BIGINT UNSIGNED NOT NULL,
  doctor_id         BIGINT UNSIGNED NOT NULL,
  hospital_id       BIGINT UNSIGNED NULL,
  appointment_date  DATE            NOT NULL,
  appointment_time  VARCHAR(20)     NOT NULL COMMENT 'e.g. 9:00 AM — display string, matches the fixed slot list',
  visit_type        ENUM('in-person','telemedicine') NOT NULL DEFAULT 'in-person',
  reason            VARCHAR(255)    NULL,
  notes             VARCHAR(500)    NULL,
  fee               DECIMAL(10,2)   NOT NULL DEFAULT 0,
  status             ENUM('pending','confirmed','completed','cancelled') NOT NULL DEFAULT 'pending',
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  active_slot_key   VARCHAR(80) GENERATED ALWAYS AS (
                       CASE WHEN status <> 'cancelled'
                            THEN CONCAT(doctor_id, '|', appointment_date, '|', appointment_time)
                            ELSE NULL END
                     ) VIRTUAL,
  UNIQUE KEY uq_appt_active_slot (active_slot_key),
  KEY idx_appt_patient (patient_id),
  KEY idx_appt_doctor_date (doctor_id, appointment_date),
  CONSTRAINT fk_appt_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_appt_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  CONSTRAINT fk_appt_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- medical_records — the unified digital medical record (FR-4.1..FR-4.5).
-- One row per entry (diagnosis/prescription/note added by a doctor after a
-- consultation, or a lab/telemedicine entry logged automatically by those
-- modules). A patient's full history is every row WHERE patient_id = :id.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medical_records (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id        BIGINT UNSIGNED NOT NULL,
  doctor_id         BIGINT UNSIGNED NULL,
  appointment_id    BIGINT UNSIGNED NULL,
  record_type       ENUM('diagnosis','prescription','note','lab','telemedicine') NOT NULL,
  title             VARCHAR(200)    NOT NULL,
  description       TEXT            NULL,
  vitals            VARCHAR(150)    NULL COMMENT 'e.g. BP: 120/80, Pulse: 78, Temp: 36.8C',
  attachment_path   VARCHAR(255)    NULL,
  visit_date        DATE            NOT NULL,
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_records_patient (patient_id, visit_date),
  KEY idx_records_doctor (doctor_id),
  CONSTRAINT fk_records_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_records_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
  CONSTRAINT fk_records_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- telemedicine_sessions / telemedicine_messages — FR-5.1..FR-5.3.
-- One session per telemedicine appointment; messages are the basic chat.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS telemedicine_sessions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id  BIGINT UNSIGNED NOT NULL,
  started_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at        DATETIME        NULL,
  UNIQUE KEY uq_tm_appointment (appointment_id),
  CONSTRAINT fk_tm_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS telemedicine_messages (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id      BIGINT UNSIGNED NOT NULL,
  sender_user_id  BIGINT UNSIGNED NOT NULL,
  sender_role     ENUM('patient','doctor') NOT NULL,
  message         TEXT            NOT NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tm_msg_session (session_id, created_at),
  CONSTRAINT fk_tm_msg_session FOREIGN KEY (session_id) REFERENCES telemedicine_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_tm_msg_user FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- labs — diagnostic lab provider organisations.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS labs (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_user_id   BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(150)    NOT NULL,
  address         VARCHAR(255)    NULL,
  city            VARCHAR(100)    NULL,
  phone           VARCHAR(20)     NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_labs_owner (owner_user_id),
  CONSTRAINT fk_labs_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- lab_tests — diagnostic test catalog (FR-2.3): price + turnaround time.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lab_tests (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lab_id          BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(150)    NOT NULL,
  category        VARCHAR(80)     NOT NULL,
  description     VARCHAR(255)    NULL,
  price           DECIMAL(10,2)   NOT NULL,
  turnaround_text VARCHAR(50)     NOT NULL,
  is_active       TINYINT(1)      NOT NULL DEFAULT 1,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tests_lab (lab_id),
  CONSTRAINT fk_tests_lab FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- lab_bookings / lab_results — FR-6.3. A booking moves
-- pending -> processing -> ready as the Lab Admin works on it; publishing
-- a result also writes a `medical_records` row (record_type='lab') so it
-- appears in the patient's unified history.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lab_bookings (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id      BIGINT UNSIGNED NOT NULL,
  lab_id          BIGINT UNSIGNED NOT NULL,
  test_id         BIGINT UNSIGNED NOT NULL,
  booking_date    DATE            NOT NULL,
  booking_time    VARCHAR(20)     NOT NULL,
  fee             DECIMAL(10,2)   NOT NULL,
  status          ENUM('pending','processing','ready') NOT NULL DEFAULT 'pending',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_bookings_patient (patient_id),
  KEY idx_bookings_lab (lab_id),
  CONSTRAINT fk_bookings_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_bookings_lab FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE,
  CONSTRAINT fk_bookings_test FOREIGN KEY (test_id) REFERENCES lab_tests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lab_results (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id      BIGINT UNSIGNED NOT NULL,
  result_summary  TEXT            NOT NULL,
  file_path       VARCHAR(255)    NULL,
  uploaded_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_results_booking (booking_id),
  CONSTRAINT fk_results_booking FOREIGN KEY (booking_id) REFERENCES lab_bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- pharmacies / medicines — FR-2.4.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pharmacies (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_user_id   BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(150)    NOT NULL,
  address         VARCHAR(255)    NULL,
  city            VARCHAR(100)    NULL,
  phone           VARCHAR(20)     NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pharmacies_owner (owner_user_id),
  CONSTRAINT fk_pharmacies_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicines (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pharmacy_id     BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(150)    NOT NULL,
  generic_name    VARCHAR(150)    NOT NULL,
  brand           VARCHAR(100)    NULL,
  category        VARCHAR(80)     NOT NULL,
  unit            VARCHAR(20)     NOT NULL DEFAULT 'tablet',
  price           DECIMAL(10,2)   NOT NULL,
  stock_qty       INT UNSIGNED    NOT NULL DEFAULT 0,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_medicines_pharmacy (pharmacy_id),
  CONSTRAINT fk_medicines_pharmacy FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- pharmacy_orders / order_items — FR-6.1, FR-6.2.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pharmacy_orders (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id      BIGINT UNSIGNED NOT NULL,
  pharmacy_id     BIGINT UNSIGNED NOT NULL,
  subtotal        DECIMAL(10,2)   NOT NULL,
  delivery_fee    DECIMAL(10,2)   NOT NULL DEFAULT 50,
  total_amount    DECIMAL(10,2)   NOT NULL,
  payment_method  ENUM('bkash','nagad','rocket') NOT NULL,
  status          ENUM('pending','processing','delivered') NOT NULL DEFAULT 'pending',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_orders_patient (patient_id),
  KEY idx_orders_pharmacy (pharmacy_id),
  CONSTRAINT fk_orders_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_orders_pharmacy FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id        BIGINT UNSIGNED NOT NULL,
  medicine_id     BIGINT UNSIGNED NOT NULL,
  quantity        INT UNSIGNED    NOT NULL,
  unit_price      DECIMAL(10,2)   NOT NULL,
  KEY idx_items_order (order_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES pharmacy_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- payments — FR-7.1, FR-7.2. A generic receipt log shared by appointments,
-- lab bookings, and pharmacy orders. Sandbox only: `method` is one of the
-- three Bangladeshi MFS providers named in the SRS, and every payment is
-- recorded as an already-successful sandbox transaction — no real gateway
-- is called anywhere in this codebase.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id        BIGINT UNSIGNED NOT NULL,
  reference_type    ENUM('appointment','lab_booking','pharmacy_order') NOT NULL,
  reference_id      BIGINT UNSIGNED NOT NULL,
  amount            DECIMAL(10,2)   NOT NULL,
  method            ENUM('bkash','nagad','rocket') NOT NULL,
  status            ENUM('success') NOT NULL DEFAULT 'success',
  transaction_ref   VARCHAR(50)     NOT NULL,
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payments_ref (transaction_ref),
  KEY idx_payments_patient (patient_id),
  KEY idx_payments_reference (reference_type, reference_id),
  CONSTRAINT fk_payments_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- notifications — in-app notifications (FR-3.4 and general system events).
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  icon        VARCHAR(30)     NOT NULL DEFAULT 'bell',
  title       VARCHAR(150)    NOT NULL,
  body        VARCHAR(500)    NOT NULL,
  is_read     TINYINT(1)      NOT NULL DEFAULT 0,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notif_user (user_id, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- platform_settings — simple key/value store behind System Admin ->
-- Platform Settings (platform name/currency/support email + notification
-- toggles). Deliberately schemaless (key/value) since it is demo-only
-- global configuration, not a business entity.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_settings (
  setting_key   VARCHAR(60)  PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO platform_settings (setting_key, setting_value) VALUES
  ('platform_name', 'SynCura'),
  ('currency', 'BDT'),
  ('support_email', 'support@syncura.com.bd'),
  ('sms_notifications', '1'),
  ('email_notifications', '1'),
  ('push_notifications', '0')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- ==========================================================================
-- Sample / demo data
-- Builds on the 6 seed accounts already created by syncura_auth.sql:
--   patient@syncura.bd (id 1), doctor@syncura.bd (id 2),
--   hospital@syncura.bd (id 3), lab@syncura.bd (id 4),
--   pharmacy@syncura.bd (id 5), admin@syncura.bd (id 6)
-- All fictional demo data for a Bangladesh healthcare prototype.
-- ==========================================================================

INSERT INTO hospitals (owner_user_id, name, address, city, phone, registration_no) VALUES
  (3, 'Square Hospital', 'Panthapath', 'Dhaka', '+8802-8159457', 'DGHS-H-2024-001');

INSERT INTO hospital_departments (hospital_id, name, bed_count) VALUES
  (1, 'Cardiology', 40), (1, 'Neurology', 20), (1, 'Dermatology', 10),
  (1, 'Gynecology & Obstetrics', 35), (1, 'Pediatrics', 25);

INSERT INTO labs (owner_user_id, name, address, city, phone) VALUES
  (4, 'Ibn Sina Diagnostic Centre', 'Dhanmondi', 'Dhaka', '+8802-9661064');

INSERT INTO pharmacies (owner_user_id, name, address, city, phone) VALUES
  (5, 'SynCura Pharmacy', 'Mirpur', 'Dhaka', '+8802-9012345');

-- Doctors: the seeded doctor@syncura.bd login, plus independent directory
-- profiles so Find Doctors has a realistic list to search/filter/book.
INSERT INTO doctors (user_id, hospital_id, department_id, full_name, specialty, qualification, experience_years, consultation_fee, bio, status) VALUES
  (2,    1, 1, 'Dr. Karim Hossain',   'Cardiologist',   'MBBS, FCPS (Cardiology)',        22, 1000, 'Professor of Cardiology with two decades of experience in echocardiography and complex cardiac interventions.', 'active'),
  (NULL, 1, 1, 'Dr. Tahmina Akter',  'Cardiologist',   'MBBS, MD (Cardiology)',          15, 1200, 'Specialist in interventional cardiology and heart failure management, with over 2,000 cardiac procedures performed.', 'active'),
  (NULL, NULL, NULL, 'Dr. Mehedi Hasan', 'Dermatologist', 'MBBS, DDV',                    10, 800,  'Focuses on clinical and cosmetic dermatology for adult and pediatric patients.', 'active'),
  (NULL, 1, 4, 'Dr. Nasrin Sultana', 'Gynecologist',   'MBBS, FCPS (Gynecology & Obstetrics)', 20, 1500, 'Twenty years of experience in obstetrics, high-risk pregnancy, and reproductive health.', 'active'),
  (NULL, NULL, NULL, 'Dr. Fatema Khanam', 'Pediatrician', 'MBBS, DCH',                    12, 700,  'Child health specialist covering routine care, vaccination, and common childhood illnesses.', 'active'),
  (NULL, 1, 2, 'Dr. Rafiqul Islam',  'Neurologist',    'MBBS, MD (Neurology)',           18, 1300, 'Specialist in stroke management, epilepsy, and general adult neurology.', 'active');

-- Sun–Thu available, Fri–Sat off (Bangladesh weekend), until a doctor
-- toggles a day from their Schedule page.
INSERT INTO doctor_weekly_availability (doctor_id, weekday, is_available)
SELECT d.id, w.weekday, 1
FROM doctors d
JOIN (SELECT 0 AS weekday UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) w;

INSERT INTO doctor_weekly_availability (doctor_id, weekday, is_available)
SELECT d.id, w.weekday, 0
FROM doctors d
JOIN (SELECT 5 AS weekday UNION SELECT 6) w;

INSERT INTO lab_tests (lab_id, name, category, description, price, turnaround_text) VALUES
  (1, 'Complete Blood Count (CBC)', 'Hematology', 'Measures red/white cells, platelets, hemoglobin', 350, '4-6 hours'),
  (1, 'Blood Sugar (Fasting + PP)', 'Biochemistry', 'Fasting and post-prandial glucose levels', 200, '2-3 hours'),
  (1, 'Lipid Profile', 'Biochemistry', 'Cholesterol, LDL, HDL, triglycerides', 600, '4-6 hours'),
  (1, 'HbA1c (Glycated Hemoglobin)', 'Diabetes', '3-month average blood sugar control', 700, '24 hours'),
  (1, 'Thyroid Function (T3, T4, TSH)', 'Endocrinology', 'Complete thyroid hormone panel', 900, '24 hours'),
  (1, 'Urine R/E', 'Urology', 'Routine urine examination for kidney function', 150, '2 hours'),
  (1, 'Chest X-Ray (PA View)', 'Radiology', 'Standard posterior-anterior chest radiograph', 500, '1 hour'),
  (1, 'ECG (12-Lead)', 'Cardiology', '12-lead electrocardiogram with interpretation', 400, '30 minutes');

INSERT INTO medicines (pharmacy_id, name, generic_name, brand, category, unit, price, stock_qty) VALUES
  (1, 'Napa 500mg', 'Paracetamol', 'Beximco Pharma', 'Analgesic', 'tablet', 5, 1200),
  (1, 'Seclo 20mg', 'Omeprazole', 'Square Pharma', 'Antacid', 'capsule', 8, 800),
  (1, 'Metformin 500mg', 'Metformin HCl', 'Incepta Pharma', 'Antidiabetic', 'tablet', 3, 45),
  (1, 'Losartan 50mg', 'Losartan Potassium', 'ACI Pharma', 'Antihypertensive', 'tablet', 10, 30),
  (1, 'Amoxicillin 500mg', 'Amoxicillin', 'Drug International', 'Antibiotic', 'capsule', 12, 600),
  (1, 'Cetrizine 10mg', 'Cetirizine HCl', 'Renata', 'Antihistamine', 'tablet', 6, 0),
  (1, 'Vitamin D3 1000IU', 'Cholecalciferol', 'Healthcare Pharma', 'Supplement', 'softgel', 15, 500),
  (1, 'Calcium 500mg', 'Calcium Carbonate', 'Popular Pharma', 'Supplement', 'tablet', 7, 700);
