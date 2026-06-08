"""
刷新预聚合表：weekly_behavior_stats / weekly_depression_stats / student_latest_stats。
行为数据变化后运行一次即可，之后查询直接读预聚合表（毫秒级）。

运行方式：python scripts/refresh_weekly_stats.py
也可 from scripts.refresh_weekly_stats import refresh_all 在代码中调用。
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from app.core.database import engine, is_sqlite


def _ensure_tables(conn):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS weekly_behavior_stats (
            year_week       VARCHAR(10) NOT NULL,
            department      VARCHAR(50) NOT NULL DEFAULT '__ALL__',
            student_count   INTEGER NOT NULL DEFAULT 0,
            avg_stress      REAL NOT NULL DEFAULT 0,
            avg_sleep       REAL NOT NULL DEFAULT 0,
            avg_study       REAL NOT NULL DEFAULT 0,
            avg_social      REAL NOT NULL DEFAULT 0,
            avg_activity    REAL NOT NULL DEFAULT 0,
            PRIMARY KEY (year_week, department)
        )
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS weekly_depression_stats (
            year_week        VARCHAR(10) NOT NULL,
            department       VARCHAR(50) NOT NULL DEFAULT '__ALL__',
            depression_count INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (year_week, department)
        )
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS student_latest_stats (
            student_id              VARCHAR(20) PRIMARY KEY,
            gender                  VARCHAR(10) NOT NULL DEFAULT '',
            department              VARCHAR(50) NOT NULL DEFAULT '',
            stress_level            INTEGER NOT NULL DEFAULT 0,
            sleep_duration          REAL NOT NULL DEFAULT 0,
            study_hours             REAL NOT NULL DEFAULT 0,
            social_media_hours      REAL NOT NULL DEFAULT 0,
            physical_activity       INTEGER NOT NULL DEFAULT 0,
            risk_level              VARCHAR(10) NOT NULL DEFAULT '',
            depression_predicted    INTEGER NOT NULL DEFAULT 0,
            depression_probability  REAL NOT NULL DEFAULT 0
        )
    """))


def refresh_all(conn=None):
    """刷新所有预聚合表。传入 conn 复用已有连接，不传则自开一个。"""
    if conn is not None:
        _ensure_tables(conn)
        _refresh_behavior(conn)
        _refresh_depression(conn)
        _refresh_student_latest(conn)
    else:
        with engine.begin() as c:
            _ensure_tables(c)
            _refresh_behavior(c)
            _refresh_depression(c)
            _refresh_student_latest(c)
    print("All pre-agg tables refreshed.")


def _refresh_behavior(conn):
    conn.execute(text("DELETE FROM weekly_behavior_stats"))
    conn.execute(text("""
        INSERT INTO weekly_behavior_stats
            (year_week, department, student_count, avg_stress, avg_sleep, avg_study, avg_social, avg_activity)
        SELECT bl.year_week, si.department,
               COUNT(DISTINCT bl.student_id),
               ROUND(AVG(bl.stress_level), 2),
               ROUND(AVG(bl.sleep_duration), 2),
               ROUND(AVG(bl.study_hours), 2),
               ROUND(AVG(bl.social_media_hours), 2),
               ROUND(AVG(bl.physical_activity), 2)
        FROM behavior_log bl
        JOIN student_info si ON bl.student_id = si.student_id
        WHERE bl.year_week != ''
        GROUP BY bl.year_week, si.department
    """))
    conn.execute(text("""
        INSERT INTO weekly_behavior_stats
            (year_week, department, student_count, avg_stress, avg_sleep, avg_study, avg_social, avg_activity)
        SELECT year_week, '__ALL__',
               COUNT(DISTINCT student_id),
               ROUND(AVG(stress_level), 2),
               ROUND(AVG(sleep_duration), 2),
               ROUND(AVG(study_hours), 2),
               ROUND(AVG(social_media_hours), 2),
               ROUND(AVG(physical_activity), 2)
        FROM behavior_log
        WHERE year_week != ''
        GROUP BY year_week
    """))
    print(f"  weekly_behavior_stats: {conn.execute(text('SELECT COUNT(*) FROM weekly_behavior_stats')).scalar()} rows")


def _refresh_depression(conn):
    conn.execute(text("DELETE FROM weekly_depression_stats"))
    conn.execute(text("""
        INSERT INTO weekly_depression_stats (year_week, department, depression_count)
        SELECT ma.year_week, si.department, COUNT(*)
        FROM mental_assessment ma
        JOIN student_info si ON ma.student_id = si.student_id
        WHERE ma.depression_predicted = 1 AND ma.year_week != ''
        GROUP BY ma.year_week, si.department
    """))
    conn.execute(text("""
        INSERT INTO weekly_depression_stats (year_week, department, depression_count)
        SELECT year_week, '__ALL__', COUNT(*)
        FROM mental_assessment
        WHERE depression_predicted = 1 AND year_week != ''
        GROUP BY year_week
    """))
    print(f"  weekly_depression_stats: {conn.execute(text('SELECT COUNT(*) FROM weekly_depression_stats')).scalar()} rows")


def _refresh_student_latest(conn):
    """每个学生的最新行为 + 最新评估 + 性别/院系，供统计检验使用（10万行，查询毫秒级）"""
    conn.execute(text("DELETE FROM student_latest_stats"))
    conn.execute(text("""
        INSERT INTO student_latest_stats
            (student_id, gender, department, stress_level, sleep_duration, study_hours,
             social_media_hours, physical_activity, risk_level, depression_predicted, depression_probability)
        SELECT si.student_id, si.gender, si.department,
               bl.stress_level, bl.sleep_duration, bl.study_hours,
               bl.social_media_hours, bl.physical_activity,
               ma.risk_level, ma.depression_predicted, ma.depression_probability
        FROM student_info si
        INNER JOIN behavior_log bl ON si.student_id = bl.student_id
        INNER JOIN (
            SELECT student_id, MAX(id) AS max_id FROM behavior_log GROUP BY student_id
        ) bl_latest ON bl.id = bl_latest.max_id
        INNER JOIN mental_assessment ma ON si.student_id = ma.student_id
        INNER JOIN (
            SELECT student_id, MAX(id) AS max_id FROM mental_assessment GROUP BY student_id
        ) ma_latest ON ma.id = ma_latest.max_id
    """))
    print(f"  student_latest_stats: {conn.execute(text('SELECT COUNT(*) FROM student_latest_stats')).scalar()} rows")


if __name__ == "__main__":
    refresh_all()
