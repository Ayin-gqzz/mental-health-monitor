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
    year_week           VARCHAR(10) NOT NULL DEFAULT '',
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
CREATE INDEX IF NOT EXISTS idx_behavior_year_week    ON behavior_log(year_week);

-- ============================================================
-- Table 3: mental_assessment — ML prediction results
-- ============================================================
CREATE TABLE IF NOT EXISTS mental_assessment (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id              VARCHAR(20) NOT NULL,
    assessment_date         DATE NOT NULL DEFAULT (date('now')),
    year_week               VARCHAR(10) NOT NULL DEFAULT '',
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
CREATE INDEX IF NOT EXISTS idx_assess_year_week        ON mental_assessment(year_week);

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

-- ============================================================
-- Table 5: risk_notification — auto-generated high-risk alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS risk_notification (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id  VARCHAR(20) NOT NULL,
    risk_level  VARCHAR(10) NOT NULL,
    message     TEXT,
    is_read     BOOLEAN DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES student_info(student_id) ON DELETE CASCADE
);

-- ============================================================
-- Views
-- ============================================================

-- View: latest assessment per student
CREATE VIEW IF NOT EXISTS v_latest_assessment AS
SELECT ma.*
FROM mental_assessment ma
INNER JOIN (
    SELECT student_id, MAX(assessment_date) AS max_date
    FROM mental_assessment
    GROUP BY student_id
) latest ON ma.student_id = latest.student_id AND ma.assessment_date = latest.max_date;

-- View: student behavior summary
CREATE VIEW IF NOT EXISTS v_student_behavior_summary AS
SELECT
    bl.student_id,
    si.name,
    si.department,
    ROUND(AVG(bl.stress_level), 2) AS avg_stress,
    ROUND(AVG(bl.sleep_duration), 2) AS avg_sleep,
    ROUND(AVG(bl.social_media_hours), 2) AS avg_social,
    ROUND(AVG(bl.physical_activity), 2) AS avg_activity,
    COUNT(*) AS record_count
FROM behavior_log bl
JOIN student_info si ON bl.student_id = si.student_id
GROUP BY bl.student_id, si.name, si.department;

-- ============================================================
-- Triggers
-- ============================================================

-- Trigger: auto-insert notification on high-risk assessment
CREATE TRIGGER IF NOT EXISTS trg_high_risk_alert
AFTER INSERT ON mental_assessment
WHEN NEW.risk_level = 'high'
BEGIN
    INSERT INTO risk_notification (student_id, risk_level, message)
    VALUES (NEW.student_id, NEW.risk_level,
            'Student ' || NEW.student_id || ' assessed as HIGH risk on ' || NEW.assessment_date);
END;

-- ============================================================
-- Table 6: weekly_assessment — 学生每周心理测评
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_assessment (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id          VARCHAR(20) NOT NULL,
    submit_date         DATE NOT NULL DEFAULT (date('now')),
    mood_score          INTEGER NOT NULL CHECK(mood_score BETWEEN 1 AND 5),
    sleep_quality       INTEGER NOT NULL CHECK(sleep_quality BETWEEN 1 AND 5),
    study_state         INTEGER NOT NULL CHECK(study_state BETWEEN 1 AND 5),
    social_state        INTEGER NOT NULL CHECK(social_state BETWEEN 1 AND 5),
    life_satisfaction   INTEGER NOT NULL CHECK(life_satisfaction BETWEEN 1 AND 5),
    overall_score       REAL NOT NULL,
    message             TEXT,
    counselor_reply     TEXT,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES student_info(student_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_weekly_assessment_student_date ON weekly_assessment(student_id, submit_date DESC);
