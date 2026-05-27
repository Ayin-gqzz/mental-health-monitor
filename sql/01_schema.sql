-- ============================================================
-- Table 1: student_info — static demographic data
-- ============================================================
CREATE TABLE IF NOT EXISTS student_info (
    student_id   VARCHAR(20) PRIMARY KEY,
    name         VARCHAR(50)  NOT NULL,
    age          INTEGER      NOT NULL CHECK(age BETWEEN 18 AND 30),
    gender       VARCHAR(10)  NOT NULL CHECK(gender IN ('Male', 'Female')),
    department   VARCHAR(50)  NOT NULL,
    cgpa         REAL         NOT NULL CHECK(cgpa BETWEEN 0.0 AND 4.0),
    password_hash VARCHAR(128) NOT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_student_department ON student_info(department);
CREATE INDEX IF NOT EXISTS idx_student_gender      ON student_info(gender);

-- ============================================================
-- Table 2: behavior_log — daily behavior records (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS behavior_log (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id          VARCHAR(20) NOT NULL,
    record_date         DATE        NOT NULL DEFAULT (date('now')),
    sleep_duration      REAL        NOT NULL CHECK(sleep_duration BETWEEN 0 AND 24),
    study_hours         REAL        NOT NULL CHECK(study_hours >= 0),
    social_media_hours  REAL        NOT NULL CHECK(social_media_hours >= 0),
    physical_activity   INTEGER     NOT NULL CHECK(physical_activity >= 0),
    stress_level        INTEGER     NOT NULL CHECK(stress_level BETWEEN 1 AND 10),
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES student_info(student_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_behavior_student_date ON behavior_log(student_id, record_date);
CREATE INDEX IF NOT EXISTS idx_behavior_date         ON behavior_log(record_date);
CREATE INDEX IF NOT EXISTS idx_behavior_stress_date  ON behavior_log(stress_level, record_date);

-- ============================================================
-- Table 3: mental_assessment — ML prediction results
-- ============================================================
CREATE TABLE IF NOT EXISTS mental_assessment (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id              VARCHAR(20) NOT NULL,
    assessment_date         DATE NOT NULL DEFAULT (date('now')),
    depression_predicted    BOOLEAN NOT NULL,
    depression_probability  REAL NOT NULL,
    risk_level              VARCHAR(10) NOT NULL CHECK(risk_level IN ('low', 'medium', 'high')),
    intervention_text       TEXT,
    counselor_notes         TEXT,
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES student_info(student_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_assessment_student_date ON mental_assessment(student_id, assessment_date);
CREATE INDEX IF NOT EXISTS idx_assessment_risk         ON mental_assessment(risk_level);
CREATE INDEX IF NOT EXISTS idx_assessment_date_risk    ON mental_assessment(assessment_date, risk_level);

-- ============================================================
-- Table 4: counselor_user — counselor login accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS counselor_user (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(128) NOT NULL,
    display_name  VARCHAR(50) NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
