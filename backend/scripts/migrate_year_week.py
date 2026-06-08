"""
迁移脚本：给 behavior_log 和 mental_assessment 表添加 year_week 列并回填数据。
运行方式：python scripts/migrate_year_week.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text, inspect
from app.core.database import engine, is_sqlite


def column_exists(conn, table, column):
    """检查列是否已存在"""
    if is_sqlite():
        rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
        return any(r[1] == column for r in rows)
    else:
        rows = conn.execute(text(
            f"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
            f"WHERE TABLE_NAME = '{table}' AND COLUMN_NAME = '{column}'"
        )).fetchall()
        return len(rows) > 0


def migrate():
    with engine.begin() as conn:
        # ── behavior_log ──
        if not column_exists(conn, "behavior_log", "year_week"):
            print("Adding year_week to behavior_log...")
            conn.execute(text("ALTER TABLE behavior_log ADD COLUMN year_week VARCHAR(10) NOT NULL DEFAULT ''"))

            if is_sqlite():
                week_fn = "strftime('%Y-W%W', record_date)"
            else:
                week_fn = "DATE_FORMAT(record_date, '%x-W%v')"

            print("Backfilling behavior_log.year_week...")
            conn.execute(text(f"UPDATE behavior_log SET year_week = {week_fn}"))

            print("Creating index on behavior_log.year_week...")
            conn.execute(text("CREATE INDEX idx_behavior_year_week ON behavior_log(year_week)"))
            print("  behavior_log done.")
        else:
            print("behavior_log.year_week already exists, skipping.")

        # ── mental_assessment ──
        if not column_exists(conn, "mental_assessment", "year_week"):
            print("Adding year_week to mental_assessment...")
            conn.execute(text("ALTER TABLE mental_assessment ADD COLUMN year_week VARCHAR(10) NOT NULL DEFAULT ''"))

            if is_sqlite():
                week_fn = "strftime('%Y-W%W', assessment_date)"
            else:
                week_fn = "DATE_FORMAT(assessment_date, '%x-W%v')"

            print("Backfilling mental_assessment.year_week...")
            conn.execute(text(f"UPDATE mental_assessment SET year_week = {week_fn}"))

            print("Creating index on mental_assessment.year_week...")
            conn.execute(text("CREATE INDEX idx_assess_year_week ON mental_assessment(year_week)"))
            print("  mental_assessment done.")
        else:
            print("mental_assessment.year_week already exists, skipping.")

    print("Migration complete!")


if __name__ == "__main__":
    migrate()
