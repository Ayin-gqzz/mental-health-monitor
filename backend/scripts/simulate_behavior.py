"""
Generate synthetic behavior_log rows for past 12 weeks to simulate longitudinal data.
Optimized: uses raw SQL to fetch only the latest behavior per student (not all 1.3M rows),
then generates new rows in pure Python and bulk-inserts via SQL.
Run after seed_db.py: python scripts/simulate_behavior.py
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import random
from datetime import date, timedelta
from sqlalchemy import text
from app.core.database import engine, is_sqlite

WEEKS = 12
BATCH_SIZE = 5000


def simulate():
    with engine.connect() as conn:
        total_students = conn.execute(text("SELECT COUNT(*) FROM student_info")).scalar()
        existing = conn.execute(text("SELECT COUNT(*) FROM behavior_log")).scalar()
        expected = total_students * (WEEKS + 1)
        if existing >= expected:
            print(f"Already have {existing} behavior rows, skipping.")
            return

        print(f"Students: {total_students}, existing behaviors: {existing}, target: {expected}")

        # Get latest behavior per student using a single SQL subquery — NOT loading 1.3M rows
        print("Loading latest behavior per student via SQL...")
        if is_sqlite():
            base_rows = conn.execute(text("""
                SELECT bl.student_id, bl.sleep_duration, bl.study_hours,
                       bl.social_media_hours, bl.physical_activity, bl.stress_level
                FROM behavior_log bl
                INNER JOIN (
                    SELECT student_id, MAX(id) AS max_id
                    FROM behavior_log
                    GROUP BY student_id
                ) latest ON bl.id = latest.max_id
            """)).fetchall()
        else:
            base_rows = conn.execute(text("""
                SELECT bl.student_id, bl.sleep_duration, bl.study_hours,
                       bl.social_media_hours, bl.physical_activity, bl.stress_level
                FROM behavior_log bl
                INNER JOIN (
                    SELECT student_id, MAX(id) AS max_id
                    FROM behavior_log
                    GROUP BY student_id
                ) latest ON bl.id = latest.max_id
            """)).fetchall()

        # Build baseline map: student_id → (sleep, study, social, activity, stress)
        base_map = {}
        for r in base_rows:
            base_map[r[0]] = (float(r[1]), float(r[2]), float(r[3]), int(r[4]), int(r[5]))
        print(f"Loaded {len(base_map)} student baselines.")

        # Get all student IDs
        students = [r[0] for r in conn.execute(text("SELECT student_id FROM student_info")).fetchall()]
        today = date.today()

        # Generate weeks going backwards from today
        for week in range(1, WEEKS + 1):
            record_date = today - timedelta(weeks=week)
            # ISO 周标签：年份可能跨年，用 %G-W%V（ISO年-ISO周）
            year_week = record_date.strftime("%G-W%V")
            insert_sql = text(
                "INSERT INTO behavior_log (student_id, record_date, year_week, sleep_duration, "
                "study_hours, social_media_hours, physical_activity, stress_level) "
                "VALUES (:sid, :dt, :yw, :sleep, :study, :social, :act, :stress)"
            )
            batch = []
            week_count = 0

            for sid in students:
                base = base_map.get(sid)
                if base:
                    sleep_b, study_b, social_b, act_b, stress_b = base
                    sleep = round(max(3.0, min(12.0, sleep_b + random.uniform(-1.5, 1.5))), 2)
                    study = round(max(0.0, min(13.0, study_b + random.uniform(-1.5, 1.5))), 2)
                    social = round(max(0.0, min(10.0, social_b + random.uniform(-1.5, 1.5))), 2)
                    activity = max(0, min(149, act_b + random.randint(-25, 25)))
                    stress = max(2, min(10, stress_b + random.randint(-2, 2)))
                else:
                    sleep = round(random.uniform(4, 11), 2)
                    study = round(random.uniform(0, 10), 2)
                    social = round(random.uniform(0, 8), 2)
                    activity = random.randint(10, 140)
                    stress = random.randint(2, 8)

                batch.append({
                    "sid": sid, "dt": record_date.isoformat(), "yw": year_week,
                    "sleep": sleep, "study": study, "social": social,
                    "act": activity, "stress": stress,
                })
                # Update base so next week varies from this week
                base_map[sid] = (sleep, study, social, activity, stress)
                week_count += 1

                if len(batch) >= BATCH_SIZE:
                    conn.execute(insert_sql, batch)
                    conn.commit()
                    print(f"  Week {week}/{WEEKS}: {len(batch)} committed...")
                    batch = []

            if batch:
                conn.execute(insert_sql, batch)
                conn.commit()

            print(f"  Week {week}/{WEEKS}: {week_count} records (date={record_date})")

        final = conn.execute(text("SELECT COUNT(*) FROM behavior_log")).scalar()
        print(f"Simulation complete! Total behavior rows: {final}")


if __name__ == "__main__":
    simulate()
