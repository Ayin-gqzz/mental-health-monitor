"""Seed database from CSV. Works with both SQLite and MySQL."""
import sys, os, csv
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from app.core.database import engine, Base
from app.core.security import hash_password

HASH = hash_password("123456")
BATCH = 2000


def csv_path():
    if env := os.getenv("CSV_PATH"):
        return env
    # Default: project data/ directory
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", "数据集.csv")
    if os.path.exists(p):
        return os.path.normpath(p)
    # Fallback: original location outside project
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "数据集.csv")
    return os.path.normpath(p)


def seed():
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        if conn.execute(text("SELECT COUNT(*) FROM student_info")).scalar() > 0:
            print("Database already seeded, skipping.")
            return

        path = csv_path()
        print(f"Reading {path}...")
        with open(path, newline="", encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))
        print(f"Loaded {len(rows)} rows.")

        # Students
        print("Inserting students...")
        for i in range(0, len(rows), BATCH):
            batch = rows[i:i + BATCH]
            vals = []
            for r in batch:
                sid = str(int(float(r["Student_ID"])))
                vals.append({
                    "sid": sid, "name": f"Student_{sid}",
                    "age": int(float(r["Age"])), "gender": r["Gender"],
                    "department": r["Department"],
                    "cgpa": round(float(r["CGPA"]), 2), "ph": HASH,
                })
            conn.execute(
                text("INSERT INTO student_info (student_id, name, age, gender, department, cgpa, password_hash) "
                     "VALUES (:sid, :name, :age, :gender, :department, :cgpa, :ph)"),
                vals,
            )
            conn.commit()
            if (i + BATCH) % 20000 == 0 or i + BATCH >= len(rows):
                print(f"  {min(i + BATCH, len(rows))}/{len(rows)} students")

        # Behaviors
        print("Inserting behavior logs...")
        from datetime import datetime
        _init_date = "2026-05-21"
        _init_yw = datetime.strptime(_init_date, "%Y-%m-%d").strftime("%G-W%V")
        for i in range(0, len(rows), BATCH):
            batch = rows[i:i + BATCH]
            vals = []
            for r in batch:
                sid = str(int(float(r["Student_ID"])))
                vals.append({
                    "sid": sid, "date": _init_date, "yw": _init_yw,
                    "sleep": round(float(r["Sleep_Duration"]), 2),
                    "study": round(float(r["Study_Hours"]), 2),
                    "social": round(float(r["Social_Media_Hours"]), 2),
                    "activity": int(float(r["Physical_Activity"])),
                    "stress": int(float(r["Stress_Level"])),
                })
            conn.execute(
                text("INSERT INTO behavior_log (student_id, record_date, year_week, sleep_duration, study_hours, social_media_hours, physical_activity, stress_level) "
                     "VALUES (:sid, :date, :yw, :sleep, :study, :social, :activity, :stress)"),
                vals,
            )
            conn.commit()
            if (i + BATCH) % 20000 == 0 or i + BATCH >= len(rows):
                print(f"  {min(i + BATCH, len(rows))}/{len(rows)} behaviors")

        # Default counselor account
        conn.execute(
            text("INSERT INTO counselor_user (username, password_hash, display_name) VALUES (:u, :p, :d)"),
            {"u": "counselor", "p": HASH, "d": "Counselor Zhang"},
        )
        conn.commit()

        print("Seed complete!")
        print("  Default student password: 123456")
        print("  Counselor login: counselor / 123456")


if __name__ == "__main__":
    seed()
