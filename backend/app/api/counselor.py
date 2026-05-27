import math, time
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, text

from app.core.security import require_role
from app.models.student import StudentInfo
from app.models.behavior import BehaviorLog
from app.models.assessment import MentalAssessment
from app.schemas.student import StudentInfoOut
from app.schemas.behavior import BehaviorLogOut, BehaviorLatestOut
from app.schemas.assessment import AssessmentOut, AssessmentLatestOut, CounselorNotesUpdate
from app.schemas.statistics import OverviewStats, DepartmentStats, TrendPoint, PaginatedResponse

router = APIRouter(dependencies=[Depends(require_role("counselor"))])


# ── Student listing ──────────────────────────────────────────

@router.get("/students", response_model=PaginatedResponse)
def list_students(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = "",
    department: str = "",
    gender: str = "",
    risk_level: str = "",
    user: dict = Depends(require_role("counselor")),
):
    db = user["db"]

    # Subquery for latest assessment risk
    sub = db.query(
        MentalAssessment.student_id,
        MentalAssessment.risk_level,
        func.row_number().over(
            partition_by=MentalAssessment.student_id,
            order_by=MentalAssessment.assessment_date.desc(),
        ).label("rn"),
    ).subquery()
    risk_filter = sub.c.rn == 1

    q = db.query(StudentInfo, sub.c.risk_level).outerjoin(
        sub, (StudentInfo.student_id == sub.c.student_id) & risk_filter
    )

    if search:
        q = q.filter(
            (StudentInfo.student_id.contains(search)) |
            (StudentInfo.name.contains(search))
        )
    if department:
        q = q.filter(StudentInfo.department == department)
    if gender:
        q = q.filter(StudentInfo.gender == gender)
    if risk_level:
        q = q.filter(sub.c.risk_level == risk_level)

    total = q.count()
    rows = q.order_by(StudentInfo.student_id).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for s, risk in rows:
        items.append({
            "student_id": s.student_id,
            "name": s.name,
            "age": s.age,
            "gender": s.gender,
            "department": s.department,
            "cgpa": s.cgpa,
            "risk_level": risk,
        })

    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ── Student detail ───────────────────────────────────────────

@router.get("/students/{student_id}")
def get_student_detail(student_id: str, user: dict = Depends(require_role("counselor"))):
    db = user["db"]
    s = db.query(StudentInfo).filter(StudentInfo.student_id == student_id).first()
    if not s:
        raise HTTPException(404, "Student not found")

    latest_behavior = db.query(BehaviorLog).filter(
        BehaviorLog.student_id == student_id
    ).order_by(BehaviorLog.record_date.desc()).first()

    latest_assessment = db.query(MentalAssessment).filter(
        MentalAssessment.student_id == student_id
    ).order_by(MentalAssessment.assessment_date.desc()).first()

    return {
        "profile": StudentInfoOut.model_validate(s),
        "latest_behavior": BehaviorLatestOut(
            sleep_duration=latest_behavior.sleep_duration,
            study_hours=latest_behavior.study_hours,
            social_media_hours=latest_behavior.social_media_hours,
            physical_activity=latest_behavior.physical_activity,
            stress_level=latest_behavior.stress_level,
            record_date=latest_behavior.record_date,
        ) if latest_behavior else None,
        "latest_assessment": AssessmentLatestOut(
            assessment_date=latest_assessment.assessment_date,
            depression_predicted=latest_assessment.depression_predicted,
            depression_probability=latest_assessment.depression_probability,
            risk_level=latest_assessment.risk_level,
            intervention_text=latest_assessment.intervention_text,
            counselor_notes=latest_assessment.counselor_notes,
        ) if latest_assessment else None,
    }


@router.get("/students/{student_id}/behavior", response_model=PaginatedResponse)
def get_student_behavior(
    student_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    user: dict = Depends(require_role("counselor")),
):
    db = user["db"]
    q = db.query(BehaviorLog).filter(BehaviorLog.student_id == student_id)
    total = q.count()
    items = q.order_by(BehaviorLog.record_date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedResponse(
        items=[BehaviorLogOut.model_validate(b) for b in items],
        total=total, page=page, page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/students/{student_id}/assessments", response_model=PaginatedResponse)
def get_student_assessments(
    student_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    user: dict = Depends(require_role("counselor")),
):
    db = user["db"]
    q = db.query(MentalAssessment).filter(MentalAssessment.student_id == student_id)
    total = q.count()
    items = q.order_by(MentalAssessment.assessment_date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedResponse(
        items=[AssessmentOut.model_validate(a) for a in items],
        total=total, page=page, page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.put("/students/{student_id}/notes")
def update_notes(
    student_id: str,
    req: CounselorNotesUpdate,
    user: dict = Depends(require_role("counselor")),
):
    db = user["db"]
    a = db.query(MentalAssessment).filter(
        MentalAssessment.student_id == student_id
    ).order_by(MentalAssessment.assessment_date.desc()).first()
    if not a:
        raise HTTPException(404, "No assessment found")
    a.counselor_notes = req.counselor_notes
    db.commit()
    return {"status": "ok"}


# ── Assessment trigger ───────────────────────────────────────

@router.post("/students/{student_id}/assess")
def trigger_assessment(student_id: str, user: dict = Depends(require_role("counselor"))):
    db = user["db"]
    from app.services.ml_service import MLService
    from app.services.suggestion_service import generate_suggestion

    behavior = db.query(BehaviorLog).filter(
        BehaviorLog.student_id == student_id
    ).order_by(BehaviorLog.record_date.desc()).first()
    if not behavior:
        raise HTTPException(404, "No behavior data for this student")

    profile = db.query(StudentInfo).filter(StudentInfo.student_id == student_id).first()

    try:
        ml = MLService()
        result = ml.predict({
            "age": profile.age, "gender": profile.gender, "department": profile.department,
            "cgpa": profile.cgpa,
        }, {
            "sleep_duration": behavior.sleep_duration,
            "study_hours": behavior.study_hours,
            "social_media_hours": behavior.social_media_hours,
            "physical_activity": behavior.physical_activity,
            "stress_level": behavior.stress_level,
        })
    except FileNotFoundError:
        # Model not trained yet — use rule-based fallback
        prob = 0.42 if behavior.stress_level >= 8 else 0.09
        predicted = behavior.stress_level >= 8
        risk = "high" if predicted or behavior.stress_level >= 8 else (
            "medium" if behavior.stress_level >= 6 else "low"
        )
        result = type("Result", (), {})()
        result.depression_predicted = predicted
        result.depression_probability = prob
        result.risk_level = risk

    intervention = generate_suggestion(result, {
        "stress_level": behavior.stress_level,
        "sleep_duration": behavior.sleep_duration,
        "study_hours": behavior.study_hours,
        "social_media_hours": behavior.social_media_hours,
        "physical_activity": behavior.physical_activity,
    })

    assessment = MentalAssessment(
        student_id=student_id,
        assessment_date=date.today(),
        depression_predicted=result.depression_predicted,
        depression_probability=round(result.depression_probability, 4),
        risk_level=result.risk_level,
        intervention_text=intervention,
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return AssessmentOut.model_validate(assessment)


@router.post("/assess-all")
def trigger_assess_all(user: dict = Depends(require_role("counselor"))):
    db = user["db"]
    from app.services.ml_service import MLService
    from app.services.suggestion_service import generate_suggestion

    students = db.query(StudentInfo).all()
    try:
        ml = MLService()
        has_model = True
    except FileNotFoundError:
        has_model = False

    count = 0
    for s in students:
        behavior = db.query(BehaviorLog).filter(
            BehaviorLog.student_id == s.student_id
        ).order_by(BehaviorLog.record_date.desc()).first()
        if not behavior:
            continue

        if has_model:
            result = ml.predict({
                "age": s.age, "gender": s.gender, "department": s.department, "cgpa": s.cgpa,
            }, {
                "sleep_duration": behavior.sleep_duration,
                "study_hours": behavior.study_hours,
                "social_media_hours": behavior.social_media_hours,
                "physical_activity": behavior.physical_activity,
                "stress_level": behavior.stress_level,
            })
        else:
            prob = 0.42 if behavior.stress_level >= 8 else 0.09
            result = type("Result", (), {})()
            result.depression_predicted = behavior.stress_level >= 8
            result.depression_probability = prob
            result.risk_level = "high" if behavior.stress_level >= 8 else (
                "medium" if behavior.stress_level >= 6 else "low"
            )

        intervention = generate_suggestion(result, {
            "stress_level": behavior.stress_level,
            "sleep_duration": behavior.sleep_duration,
            "study_hours": behavior.study_hours,
            "social_media_hours": behavior.social_media_hours,
            "physical_activity": behavior.physical_activity,
        })

        db.add(MentalAssessment(
            student_id=s.student_id,
            assessment_date=date.today(),
            depression_predicted=result.depression_predicted,
            depression_probability=round(result.depression_probability, 4),
            risk_level=result.risk_level,
            intervention_text=intervention,
        ))
        count += 1

        if count % 5000 == 0:
            db.commit()

    db.commit()
    return {"assessed": count}


# ── Statistics ───────────────────────────────────────────────

@router.get("/statistics/overview", response_model=OverviewStats)
def get_overview(user: dict = Depends(require_role("counselor"))):
    db = user["db"]
    total = db.query(StudentInfo).count()

    # Latest assessment per student
    sub = db.query(
        MentalAssessment.student_id, MentalAssessment.risk_level,
        func.row_number().over(
            partition_by=MentalAssessment.student_id,
            order_by=MentalAssessment.assessment_date.desc(),
        ).label("rn"),
    ).subquery()

    risk_counts = db.query(
        sub.c.risk_level, func.count().label("cnt")
    ).filter(sub.c.rn == 1).group_by(sub.c.risk_level).all()
    risk_map = {r.risk_level: r.cnt for r in risk_counts}

    avg_stress = db.query(func.avg(BehaviorLog.stress_level)).scalar() or 0

    depressed = db.query(func.count(MentalAssessment.student_id.distinct())).filter(
        MentalAssessment.depression_predicted == True
    ).scalar() or 0

    return OverviewStats(
        total_students=total,
        high_risk_count=risk_map.get("high", 0),
        medium_risk_count=risk_map.get("medium", 0),
        low_risk_count=risk_map.get("low", 0),
        avg_stress=round(avg_stress, 2),
        depression_rate=round(depressed / total * 100, 1) if total > 0 else 0,
    )


@router.get("/statistics/departments", response_model=list[DepartmentStats])
def get_department_stats(user: dict = Depends(require_role("counselor"))):
    db = user["db"]

    sub = db.query(
        MentalAssessment.student_id, MentalAssessment.risk_level,
        func.row_number().over(
            partition_by=MentalAssessment.student_id,
            order_by=MentalAssessment.assessment_date.desc(),
        ).label("rn"),
    ).subquery()

    results = []
    departments = db.query(StudentInfo.department.distinct()).all()
    for (dept,) in departments:
        students = db.query(StudentInfo).filter(StudentInfo.department == dept)
        total = students.count()
        avg_cgpa = db.query(func.avg(StudentInfo.cgpa)).filter(StudentInfo.department == dept).scalar() or 0

        behavior_avg = db.query(func.avg(BehaviorLog.stress_level)).join(
            StudentInfo, BehaviorLog.student_id == StudentInfo.student_id
        ).filter(StudentInfo.department == dept).scalar() or 0

        high_risk = db.query(func.count()).select_from(sub).join(
            StudentInfo, sub.c.student_id == StudentInfo.student_id
        ).filter(
            StudentInfo.department == dept, sub.c.rn == 1, sub.c.risk_level == "high"
        ).scalar() or 0

        depressed = db.query(func.count(MentalAssessment.student_id.distinct())).join(
            StudentInfo, MentalAssessment.student_id == StudentInfo.student_id
        ).filter(
            StudentInfo.department == dept, MentalAssessment.depression_predicted == True
        ).scalar() or 0

        results.append(DepartmentStats(
            department=dept, student_count=total,
            avg_stress=round(behavior_avg, 2),
            avg_cgpa=round(avg_cgpa, 2),
            depression_rate=round(depressed / total * 100, 1) if total > 0 else 0,
            high_risk_count=high_risk,
        ))

    return results


@router.get("/statistics/trends", response_model=list[TrendPoint])
def get_trends(
    department: str = "",
    user: dict = Depends(require_role("counselor")),
):
    db = user["db"]
    end = date.today()
    start = end - timedelta(weeks=12)

    base = db.query(
        func.date_format(BehaviorLog.record_date, "%Y-W%u").label("week"),
        func.avg(BehaviorLog.stress_level).label("avg_stress"),
    ).filter(BehaviorLog.record_date >= start.isoformat())

    if department:
        base = base.join(StudentInfo, BehaviorLog.student_id == StudentInfo.student_id).filter(
            StudentInfo.department == department
        )

    rows = base.group_by("week").order_by("week").all()

    depression_sub = db.query(
        func.date_format(MentalAssessment.assessment_date, "%Y-W%u").label("week"),
        func.count(MentalAssessment.id).label("cnt"),
    ).filter(
        MentalAssessment.assessment_date >= start.isoformat(),
        MentalAssessment.depression_predicted == True,
    )
    if department:
        depression_sub = depression_sub.join(
            StudentInfo, MentalAssessment.student_id == StudentInfo.student_id
        ).filter(StudentInfo.department == department)
    depression_rows = depression_sub.group_by("week").all()
    dep_map = {r.week: r.cnt for r in depression_rows}

    return [
        TrendPoint(week=r.week, avg_stress=round(r.avg_stress, 2),
                   depression_count=dep_map.get(r.week, 0))
        for r in rows
    ]


# ── Alerts ───────────────────────────────────────────────────

@router.get("/alerts", response_model=PaginatedResponse)
def get_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    department: str = "",
    user: dict = Depends(require_role("counselor")),
):
    db = user["db"]

    sub = db.query(
        MentalAssessment.student_id, MentalAssessment.risk_level,
        MentalAssessment.depression_probability, MentalAssessment.assessment_date,
        func.row_number().over(
            partition_by=MentalAssessment.student_id,
            order_by=MentalAssessment.assessment_date.desc(),
        ).label("rn"),
    ).subquery()

    q = db.query(
        StudentInfo.student_id, StudentInfo.name, StudentInfo.department,
        StudentInfo.gender, sub.c.risk_level, sub.c.depression_probability,
        sub.c.assessment_date,
    ).join(sub, StudentInfo.student_id == sub.c.student_id).filter(
        sub.c.rn == 1, sub.c.risk_level == "high"
    )

    if department:
        q = q.filter(StudentInfo.department == department)

    total = q.count()
    rows = q.order_by(sub.c.depression_probability.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    items = [
        {
            "student_id": r.student_id, "name": r.name,
            "department": r.department, "gender": r.gender,
            "risk_level": r.risk_level, "depression_probability": r.depression_probability,
            "assessment_date": r.assessment_date.isoformat() if r.assessment_date else None,
        }
        for r in rows
    ]

    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ── SQL optimization demo ────────────────────────────────────

@router.get("/statistics/complex-query")
def run_complex_query(user: dict = Depends(require_role("counselor"))):
    db = user["db"]

    # Slow version: correlated subquery
    slow_sql = """
    SELECT si.department,
           COUNT(DISTINCT bl.student_id) AS total_students,
           ROUND(AVG(bl.stress_level), 2) AS avg_stress,
           ROUND(AVG(bl.sleep_duration), 2) AS avg_sleep,
           COUNT(DISTINCT CASE WHEN ma.risk_level = 'high'
               THEN ma.student_id END) AS high_risk_count
    FROM behavior_log bl
    JOIN student_info si ON bl.student_id = si.student_id
    LEFT JOIN mental_assessment ma ON bl.student_id = ma.student_id
        AND ma.id = (SELECT MAX(id) FROM mental_assessment WHERE student_id = bl.student_id)
    WHERE bl.record_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    GROUP BY si.department
    ORDER BY high_risk_count DESC
    """

    t0 = time.time()
    db.execute(text(slow_sql)).fetchall()
    slow_time = round((time.time() - t0) * 1000, 2)

    # Fast version: CTE with ROW_NUMBER
    fast_sql = """
    WITH latest_assessment AS (
        SELECT student_id, risk_level,
               ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY assessment_date DESC) AS rn
        FROM mental_assessment
    ),
    recent_behavior AS (
        SELECT student_id, stress_level, sleep_duration
        FROM behavior_log
        WHERE record_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    )
    SELECT si.department,
           COUNT(DISTINCT rb.student_id) AS total_students,
           ROUND(AVG(rb.stress_level), 2) AS avg_stress,
           ROUND(AVG(rb.sleep_duration), 2) AS avg_sleep,
           COUNT(DISTINCT CASE WHEN la.risk_level = 'high'
               THEN la.student_id END) AS high_risk_count
    FROM student_info si
    JOIN recent_behavior rb ON si.student_id = rb.student_id
    LEFT JOIN latest_assessment la ON si.student_id = la.student_id AND la.rn = 1
    GROUP BY si.department
    ORDER BY high_risk_count DESC
    """

    t0 = time.time()
    result = db.execute(text(fast_sql)).fetchall()
    fast_time = round((time.time() - t0) * 1000, 2)

    improvement = round((slow_time - fast_time) / slow_time * 100, 1) if slow_time > 0 else 0

    return {
        "slow_query_ms": slow_time,
        "optimized_query_ms": fast_time,
        "improvement_pct": improvement,
        "data": [
            {"department": r[0], "total_students": r[1], "avg_stress": r[2],
             "avg_sleep": r[3], "high_risk_count": r[4]}
            for r in result
        ],
    }
