"""
Run ML assessment for all students using SQL window functions to efficiently
get the latest behavior per student in a single streaming query.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import date
from sqlalchemy import text
from app.core.database import SessionLocal
from app.models.student import StudentInfo
from app.models.assessment import MentalAssessment
from app.services.ml_service import MLService
from app.services.suggestion_service import generate_suggestion

BATCH_SIZE = 5000


def main():
    db = SessionLocal()

    existing = db.query(MentalAssessment).count()
    if existing >= 100000:
        print(f"Already have {existing} assessments, skipping.")
        db.close()
        return

    try:
        ml = MLService()
        has_model = True
        print("ML model loaded.")
    except FileNotFoundError:
        has_model = False
        print("No ML model found, using rule-based fallback.")

    # Single query joining student_info with latest behavior per student
    sql = text("""
        SELECT
            si.student_id, si.age, si.gender, si.department, si.cgpa,
            bl.sleep_duration, bl.study_hours, bl.social_media_hours,
            bl.physical_activity, bl.stress_level
        FROM student_info si
        INNER JOIN (
            SELECT student_id, sleep_duration, study_hours, social_media_hours,
                   physical_activity, stress_level,
                   ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY record_date DESC) AS rn
            FROM behavior_log
        ) bl ON si.student_id = bl.student_id AND bl.rn = 1
    """)

    result = db.execute(sql)
    count = 0
    batch = []

    for row in result:
        (sid, age, gender, dept, cgpa,
         sleep_dur, study_hrs, social_hrs, phys_act, stress_lvl) = row

        if has_model:
            r = ml.predict(
                {"age": age, "gender": gender, "department": dept, "cgpa": cgpa},
                {"sleep_duration": sleep_dur, "study_hours": study_hrs,
                 "social_media_hours": social_hrs, "physical_activity": phys_act,
                 "stress_level": stress_lvl},
            )
        else:
            prob = 0.42 if stress_lvl >= 8 else 0.09
            r = type("Result", (), {})()
            r.depression_predicted = stress_lvl >= 8
            r.depression_probability = prob
            r.risk_level = "high" if stress_lvl >= 8 else ("medium" if stress_lvl >= 6 else "low")

        intervention = generate_suggestion(r, {
            "stress_level": stress_lvl, "sleep_duration": sleep_dur,
            "study_hours": study_hrs, "social_media_hours": social_hrs,
            "physical_activity": phys_act,
        })

        batch.append(MentalAssessment(
            student_id=sid,
            assessment_date=date.today(),
            depression_predicted=r.depression_predicted,
            depression_probability=round(r.depression_probability, 4),
            risk_level=r.risk_level,
            intervention_text=intervention,
        ))
        count += 1

        if len(batch) >= BATCH_SIZE:
            db.add_all(batch)
            db.commit()
            print(f"  {count} students assessed...")
            batch = []

    if batch:
        db.add_all(batch)
        db.commit()

    print(f"Done! {count} students assessed.")
    db.close()


if __name__ == "__main__":
    main()
