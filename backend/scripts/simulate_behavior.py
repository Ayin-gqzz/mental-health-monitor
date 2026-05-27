"""
Generate synthetic behavior_log rows for past 12 weeks to simulate longitudinal data.
Optimized: loads all existing behaviors in one query, then works in-memory.
Run after seed_db.py: python scripts/simulate_behavior.py
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import random
from datetime import date, timedelta
from collections import defaultdict
from app.core.database import SessionLocal
from app.models.student import StudentInfo
from app.models.behavior import BehaviorLog

WEEKS = 12
BATCH_SIZE = 5000


def simulate():
    db = SessionLocal()
    try:
        total_students = db.query(StudentInfo).count()
        existing = db.query(BehaviorLog).count()
        expected = total_students * (WEEKS + 1)
        if existing >= expected:
            print(f"Already have {existing} behavior rows, skipping.")
            return

        print(f"Students: {total_students}, existing behaviors: {existing}, target: {expected}")

        # Load all latest behaviors in one query into a dict
        print("Loading existing behavior data...")
        all_behaviors = db.query(BehaviorLog).order_by(BehaviorLog.record_date.desc()).all()

        # Keep only the latest per student (first occurrence wins since sorted desc)
        base_map = {}
        for b in all_behaviors:
            if b.student_id not in base_map:
                base_map[b.student_id] = b

        print(f"Loaded {len(base_map)} student behavior baselines.")

        students = db.query(StudentInfo).all()
        today = date.today()

        # Generate weeks going backwards from today
        for week in range(1, WEEKS + 1):
            record_date = today - timedelta(weeks=week)
            batch = []
            week_count = 0

            for s in students:
                base = base_map.get(s.student_id)

                if base:
                    sleep = round(max(3.0, min(12.0, base.sleep_duration + random.uniform(-1.5, 1.5))), 2)
                    study = round(max(0.0, min(13.0, base.study_hours + random.uniform(-1.5, 1.5))), 2)
                    social = round(max(0.0, min(10.0, base.social_media_hours + random.uniform(-1.5, 1.5))), 2)
                    activity = max(0, min(149, int(base.physical_activity + random.randint(-25, 25))))
                    stress = max(2, min(10, int(base.stress_level + random.randint(-2, 2))))
                else:
                    sleep = round(random.uniform(4, 11), 2)
                    study = round(random.uniform(0, 10), 2)
                    social = round(random.uniform(0, 8), 2)
                    activity = random.randint(10, 140)
                    stress = random.randint(2, 8)

                new_behavior = BehaviorLog(
                    student_id=s.student_id,
                    record_date=record_date,
                    sleep_duration=sleep,
                    study_hours=study,
                    social_media_hours=social,
                    physical_activity=activity,
                    stress_level=stress,
                )
                batch.append(new_behavior)

                # Update base map so next week varies from this week
                base_map[s.student_id] = new_behavior

                week_count += 1

                if len(batch) >= BATCH_SIZE:
                    db.bulk_save_objects(batch)
                    db.commit()
                    print(f"  Week {week}/{WEEKS}: {len(batch)} committed...")
                    batch = []

            if batch:
                db.bulk_save_objects(batch)
                db.commit()

            print(f"  Week {week}/{WEEKS}: {week_count} records (date={record_date})")

        print("Simulation complete!")
        print(f"Total behavior rows: {db.query(BehaviorLog).count()}")

    finally:
        db.close()


if __name__ == "__main__":
    simulate()
