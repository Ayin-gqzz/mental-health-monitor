import math, time
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, text

from app.core.security import require_role
from app.core.database import week_label
from app.models.student import StudentInfo
from app.models.behavior import BehaviorLog
from app.models.assessment import MentalAssessment
from app.models.notification import RiskNotification
from app.schemas.student import StudentInfoOut
from app.schemas.behavior import BehaviorLogOut, BehaviorLatestOut
from app.schemas.assessment import AssessmentOut, AssessmentLatestOut, CounselorNotesUpdate
from app.schemas.statistics import OverviewStats, DepartmentStats, TrendPoint, PaginatedResponse
from app.schemas.stat_tests import TTestResult, ChiSquareResult, CorrelationResult

router = APIRouter(dependencies=[Depends(require_role("counselor"))])


# ── Student listing ──────────────────────────────────────────

_students_cache = {}

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
    import time as _time
    # 只缓存第一页无筛选的请求
    cache_key = f"{page}_{search}_{department}_{gender}_{risk_level}"
    if not search and not department and not gender and not risk_level and cache_key in _students_cache:
        if _time.time() - _students_cache[cache_key]["time"] < 300:
            return _students_cache[cache_key]["data"]

    db = user["db"]

    q = db.query(
        StudentInfo.student_id, StudentInfo.name, StudentInfo.age,
        StudentInfo.gender, StudentInfo.department, StudentInfo.cgpa,
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

    total = q.count()
    rows = q.order_by(StudentInfo.student_id).offset((page - 1) * page_size).limit(page_size).all()

    # 用简单子查询查风险等级（避免视图和窗口函数）
    student_ids = [r[0] for r in rows]
    risk_map = {}
    if student_ids:
        placeholders = ",".join([f"'{sid}'" for sid in student_ids])
        risk_rows = db.execute(text(
            f"SELECT ma.student_id, ma.risk_level FROM mental_assessment ma "
            f"INNER JOIN (SELECT student_id, MAX(assessment_date) AS max_d FROM mental_assessment "
            f"WHERE student_id IN ({placeholders}) GROUP BY student_id) latest "
            f"ON ma.student_id = latest.student_id AND ma.assessment_date = latest.max_d"
        )).fetchall()
        risk_map = {r[0]: r[1] for r in risk_rows}

    items = []
    for r in rows:
        sid = r[0]
        items.append({
            "student_id": sid,
            "name": r[1],
            "age": r[2],
            "gender": r[3],
            "department": r[4],
            "cgpa": r[5],
            "risk_level": risk_map.get(sid),
        })

    result = PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )
    if not search and not department and not gender and not risk_level:
        _students_cache[cache_key] = {"data": result, "time": _time.time()}
    return result


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

# 缓存 overview 数据 60 秒，避免重复查询
_overview_cache = {"data": None, "timestamp": 0}

@router.get("/statistics/overview", response_model=OverviewStats)
def get_overview(user: dict = Depends(require_role("counselor"))):
    import time as _time
    if _overview_cache["data"] and _time.time() - _overview_cache["timestamp"] < 600:
        return _overview_cache["data"]

    db = user["db"]

    total = db.query(StudentInfo).count()

    risk_counts = db.execute(text(
        "SELECT risk_level, COUNT(*) FROM v_latest_assessment GROUP BY risk_level"
    )).fetchall()
    risk_map = {r[0]: r[1] for r in risk_counts}

    avg_stress = db.execute(text(
        "SELECT ROUND(AVG(bl.stress_level), 2) FROM behavior_log bl "
        "INNER JOIN (SELECT MAX(id) AS max_id FROM behavior_log GROUP BY student_id) latest "
        "ON bl.id = latest.max_id"
    )).scalar() or 0

    depressed = db.execute(text(
        "SELECT COUNT(*) FROM v_latest_assessment WHERE depression_predicted = 1"
    )).scalar() or 0

    result = OverviewStats(
        total_students=total,
        high_risk_count=risk_map.get("high", 0),
        medium_risk_count=risk_map.get("medium", 0),
        low_risk_count=risk_map.get("low", 0),
        avg_stress=round(float(avg_stress), 2),
        depression_rate=round(depressed / total * 100, 1) if total > 0 else 0,
    )
    _overview_cache["data"] = result
    _overview_cache["timestamp"] = _time.time()
    return result


@router.get("/statistics/departments", response_model=list[DepartmentStats])
def get_department_stats(user: dict = Depends(require_role("counselor"))):
    db = user["db"]

    # Student counts + avg CGPA per department
    dept_info = db.execute(text(
        "SELECT department, COUNT(*) AS cnt, ROUND(AVG(cgpa), 2) AS avg_cgpa "
        "FROM student_info GROUP BY department"
    )).fetchall()
    dept_map = {r[0]: {"count": r[1], "avg_cgpa": r[2]} for r in dept_info}

    # Risk counts per department via view
    risk_rows = db.execute(text(
        "SELECT si.department, la.risk_level, COUNT(*) "
        "FROM v_latest_assessment la "
        "JOIN student_info si ON la.student_id = si.student_id "
        "GROUP BY si.department, la.risk_level"
    )).fetchall()

    risk_dept: dict = {}
    for dept, risk, cnt in risk_rows:
        if dept not in risk_dept:
            risk_dept[dept] = {"high": 0, "medium": 0, "low": 0}
        risk_dept[dept][risk] = cnt

    # Depression counts per department
    dep_rows = db.execute(text(
        "SELECT si.department, COUNT(*) "
        "FROM v_latest_assessment la "
        "JOIN student_info si ON la.student_id = si.student_id "
        "WHERE la.depression_predicted = 1 "
        "GROUP BY si.department"
    )).fetchall()
    dep_map = {r[0]: r[1] for r in dep_rows}

    # Average stress per department
    stress_rows = db.execute(text(
        "SELECT si.department, ROUND(AVG(bl.stress_level), 2) "
        "FROM behavior_log bl "
        "JOIN student_info si ON bl.student_id = si.student_id "
        "GROUP BY si.department"
    )).fetchall()
    stress_map = {r[0]: r[1] for r in stress_rows}

    results = []
    for dept, info in dept_map.items():
        total = info["count"]
        results.append(DepartmentStats(
            department=dept, student_count=total,
            avg_stress=round(float(stress_map.get(dept, 0) or 0), 2),
            avg_cgpa=round(float(info["avg_cgpa"] or 0), 2),
            depression_rate=round((dep_map.get(dept, 0) or 0) / total * 100, 1) if total > 0 else 0,
            high_risk_count=risk_dept.get(dept, {}).get("high", 0),
        ))

    return sorted(results, key=lambda x: x.high_risk_count, reverse=True)


_trends_cache = {}

@router.get("/statistics/trends", response_model=list[TrendPoint])
def get_trends(
    department: str = "",
    user: dict = Depends(require_role("counselor")),
):
    import time as _time
    cache_key = f"trends_{department}"
    if cache_key in _trends_cache and _time.time() - _trends_cache[cache_key]["time"] < 600:
        return _trends_cache[cache_key]["data"]

    db = user["db"]
    end = date.today()
    start = end - timedelta(weeks=12)

    base = db.query(
        week_label(BehaviorLog.record_date),
        func.avg(BehaviorLog.stress_level).label("avg_stress"),
    ).filter(BehaviorLog.record_date >= start.isoformat())

    if department:
        base = base.join(StudentInfo, BehaviorLog.student_id == StudentInfo.student_id).filter(
            StudentInfo.department == department
        )

    rows = base.group_by("week").order_by("week").all()

    depression_sub = db.query(
        week_label(MentalAssessment.assessment_date),
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

    result = [
        TrendPoint(week=r.week, avg_stress=round(r.avg_stress, 2),
                   depression_count=dep_map.get(r.week, 0))
        for r in rows
    ]
    _trends_cache[cache_key] = {"data": result, "time": _time.time()}
    return result


# ── Alerts & Notifications ────────────────────────────────────

@router.get("/alerts", response_model=PaginatedResponse)
def get_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    department: str = "",
    is_read: str = "",
    user: dict = Depends(require_role("counselor")),
):
    db = user["db"]

    q = db.query(
        RiskNotification.id,
        RiskNotification.student_id,
        RiskNotification.risk_level,
        RiskNotification.message,
        RiskNotification.is_read,
        RiskNotification.created_at,
        StudentInfo.name,
        StudentInfo.department,
        StudentInfo.gender,
    ).join(
        StudentInfo, RiskNotification.student_id == StudentInfo.student_id
    ).filter(
        RiskNotification.risk_level == "high"
    )

    if department:
        q = q.filter(StudentInfo.department == department)
    if is_read == "true":
        q = q.filter(RiskNotification.is_read == True)
    elif is_read == "false":
        q = q.filter(RiskNotification.is_read == False)

    total = q.count()
    rows = q.order_by(RiskNotification.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    # Get latest assessment data for displayed students
    student_ids = [r.student_id for r in rows]
    assess_map = {}
    if student_ids:
        sub = db.query(
            MentalAssessment.student_id,
            MentalAssessment.depression_probability,
            MentalAssessment.assessment_date,
            func.row_number().over(
                partition_by=MentalAssessment.student_id,
                order_by=MentalAssessment.assessment_date.desc(),
            ).label("rn"),
        ).filter(MentalAssessment.student_id.in_(student_ids)).subquery()
        a_rows = db.query(sub.c.student_id, sub.c.depression_probability, sub.c.assessment_date).filter(sub.c.rn == 1).all()
        assess_map = {r[0]: {"prob": r[1], "date": r[2]} for r in a_rows}

    items = []
    for r in rows:
        a = assess_map.get(r.student_id, {})
        items.append({
            "id": r.id,
            "student_id": r.student_id,
            "name": r.name,
            "department": r.department,
            "gender": r.gender,
            "risk_level": r.risk_level,
            "message": r.message,
            "is_read": r.is_read,
            "depression_probability": a.get("prob"),
            "assessment_date": a.get("date").isoformat() if a.get("date") else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/notifications/unread-count")
def get_unread_count(user: dict = Depends(require_role("counselor"))):
    db = user["db"]
    count = db.query(func.count(RiskNotification.id)).filter(
        RiskNotification.is_read == False
    ).scalar() or 0
    return {"unread_count": count}


@router.put("/notifications/{notification_id}/read")
def mark_as_read(notification_id: int, user: dict = Depends(require_role("counselor"))):
    db = user["db"]
    n = db.query(RiskNotification).filter(RiskNotification.id == notification_id).first()
    if not n:
        raise HTTPException(404, "Notification not found")
    n.is_read = True
    db.commit()
    return {"status": "ok"}


@router.put("/notifications/read-all")
def mark_all_as_read(user: dict = Depends(require_role("counselor"))):
    db = user["db"]
    db.query(RiskNotification).filter(RiskNotification.is_read == False).update({"is_read": True})
    db.commit()
    return {"status": "ok"}


# ── Statistical analysis ─────────────────────────────────────

@router.get("/statistics/t-test", response_model=list[TTestResult])
def run_t_tests(user: dict = Depends(require_role("counselor"))):
    db = user["db"]
    from scipy import stats

    # Latest assessment per student
    assess_sub = db.query(
        MentalAssessment.student_id, MentalAssessment.risk_level,
        func.row_number().over(
            partition_by=MentalAssessment.student_id,
            order_by=MentalAssessment.assessment_date.desc(),
        ).label("rn"),
    ).subquery()

    # Latest behavior per student
    beh_sub = db.query(
        BehaviorLog.student_id,
        BehaviorLog.stress_level, BehaviorLog.sleep_duration,
        BehaviorLog.study_hours, BehaviorLog.social_media_hours,
        BehaviorLog.physical_activity,
        func.row_number().over(
            partition_by=BehaviorLog.student_id,
            order_by=BehaviorLog.record_date.desc(),
        ).label("rn"),
    ).subquery()

    # Join: get behavior + risk for each student
    rows = db.query(
        beh_sub.c.stress_level, beh_sub.c.sleep_duration,
        beh_sub.c.study_hours, beh_sub.c.social_media_hours,
        beh_sub.c.physical_activity, assess_sub.c.risk_level,
    ).join(
        assess_sub, (beh_sub.c.student_id == assess_sub.c.student_id) & (assess_sub.c.rn == 1)
    ).filter(beh_sub.c.rn == 1).all()

    high = [r for r in rows if r.risk_level == "high"]
    low = [r for r in rows if r.risk_level == "low"]

    metrics = [
        ("stress_level", "压力水平", lambda r: r.stress_level),
        ("sleep_duration", "睡眠时长", lambda r: r.sleep_duration),
        ("study_hours", "学习时长", lambda r: r.study_hours),
        ("social_media_hours", "社交媒体时长", lambda r: r.social_media_hours),
        ("physical_activity", "运动时长", lambda r: r.physical_activity),
    ]

    results = []
    for key, label, extract in metrics:
        g1 = [extract(r) for r in high]
        g2 = [extract(r) for r in low]
        if len(g1) >= 2 and len(g2) >= 2:
            t_stat, p_val = stats.ttest_ind(g1, g2, equal_var=False)
            results.append(TTestResult(
                metric=key, metric_label=label,
                group1_mean=round(float(sum(g1) / len(g1)), 4),
                group2_mean=round(float(sum(g2) / len(g2)), 4),
                t_statistic=round(float(t_stat), 4),
                p_value=round(float(p_val), 6),
                significant=float(p_val) < 0.05,
                group1_n=len(g1), group2_n=len(g2),
            ))
    return results


@router.get("/statistics/chi-square", response_model=ChiSquareResult)
def run_chi_square(user: dict = Depends(require_role("counselor"))):
    db = user["db"]
    from scipy import stats

    # Latest assessment per student
    assess_sub = db.query(
        MentalAssessment.student_id, MentalAssessment.depression_predicted,
        func.row_number().over(
            partition_by=MentalAssessment.student_id,
            order_by=MentalAssessment.assessment_date.desc(),
        ).label("rn"),
    ).subquery()

    rows = db.query(
        StudentInfo.gender, assess_sub.c.depression_predicted,
    ).join(
        assess_sub, (StudentInfo.student_id == assess_sub.c.student_id) & (assess_sub.c.rn == 1)
    ).all()

    # Build 2x2 contingency table
    table = [[0, 0], [0, 0]]  # [[male_no, male_yes], [female_no, female_yes]]
    for r in rows:
        row_idx = 0 if r.gender == "Male" else 1
        col_idx = 1 if r.depression_predicted else 0
        table[row_idx][col_idx] += 1

    chi2, p, dof, _ = stats.chi2_contingency(table)
    return ChiSquareResult(
        chi2_statistic=round(float(chi2), 4),
        p_value=round(float(p), 6),
        degrees_of_freedom=int(dof),
        significant=float(p) < 0.05,
        contingency_table=table,
    )


@router.get("/statistics/correlation", response_model=list[CorrelationResult])
def run_correlation(user: dict = Depends(require_role("counselor"))):
    db = user["db"]
    from scipy import stats

    # Latest assessment per student
    assess_sub = db.query(
        MentalAssessment.student_id, MentalAssessment.depression_predicted,
        func.row_number().over(
            partition_by=MentalAssessment.student_id,
            order_by=MentalAssessment.assessment_date.desc(),
        ).label("rn"),
    ).subquery()

    # Latest behavior per student
    beh_sub = db.query(
        BehaviorLog.student_id,
        BehaviorLog.stress_level, BehaviorLog.sleep_duration,
        BehaviorLog.social_media_hours,
        func.row_number().over(
            partition_by=BehaviorLog.student_id,
            order_by=BehaviorLog.record_date.desc(),
        ).label("rn"),
    ).subquery()

    rows = db.query(
        beh_sub.c.stress_level, beh_sub.c.sleep_duration,
        beh_sub.c.social_media_hours, assess_sub.c.depression_predicted,
    ).join(
        assess_sub, (beh_sub.c.student_id == assess_sub.c.student_id) & (assess_sub.c.rn == 1)
    ).filter(beh_sub.c.rn == 1).all()

    depression = [1 if r.depression_predicted else 0 for r in rows]

    variables = [
        ("stress_level", "压力水平", [r.stress_level for r in rows]),
        ("sleep_duration", "睡眠时长", [r.sleep_duration for r in rows]),
        ("social_media_hours", "社交媒体时长", [r.social_media_hours for r in rows]),
    ]

    results = []
    for key, label, values in variables:
        r_p, p_p = stats.pearsonr(values, depression)
        r_s, p_s = stats.spearmanr(values, depression)
        results.append(CorrelationResult(
            variable=key, variable_label=label, method="pearson",
            correlation=round(float(r_p), 4), p_value=round(float(p_p), 6),
            significant=float(p_p) < 0.05,
        ))
        results.append(CorrelationResult(
            variable=key, variable_label=label, method="spearman",
            correlation=round(float(r_s), 4), p_value=round(float(p_s), 6),
            significant=float(p_s) < 0.05,
        ))
    return results


@router.get("/statistics/stress-distribution")
def get_stress_distribution(user: dict = Depends(require_role("counselor"))):
    db = user["db"]

    sub = db.query(
        BehaviorLog.student_id, BehaviorLog.stress_level,
        func.row_number().over(
            partition_by=BehaviorLog.student_id,
            order_by=BehaviorLog.record_date.desc(),
        ).label("rn"),
    ).subquery()

    rows = db.query(
        sub.c.stress_level, func.count().label("count")
    ).filter(sub.c.rn == 1).group_by(sub.c.stress_level).order_by(sub.c.stress_level).all()

    return [{"stress_level": r.stress_level, "count": r.count} for r in rows]


_cluster_cache = {"data": None, "timestamp": 0}

@router.get("/cluster-analysis")
def get_cluster_analysis(user: dict = Depends(require_role("counselor"))):
    """学生群体聚类画像 — K-Means + PCA 降维（带缓存）"""
    import time as _time
    # 缓存 10 分钟
    if _cluster_cache["data"] and _time.time() - _cluster_cache["timestamp"] < 600:
        return _cluster_cache["data"]

    import numpy as np
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler
    from sklearn.decomposition import PCA

    db = user["db"]

    # 获取每个学生最新行为数据
    beh_sub = db.query(
        BehaviorLog.student_id,
        BehaviorLog.stress_level,
        BehaviorLog.sleep_duration,
        BehaviorLog.study_hours,
        BehaviorLog.social_media_hours,
        BehaviorLog.physical_activity,
        func.row_number().over(
            partition_by=BehaviorLog.student_id,
            order_by=BehaviorLog.record_date.desc(),
        ).label("rn"),
    ).subquery()

    rows = db.query(
        beh_sub.c.student_id, beh_sub.c.stress_level, beh_sub.c.sleep_duration,
        beh_sub.c.study_hours, beh_sub.c.social_media_hours, beh_sub.c.physical_activity,
    ).filter(beh_sub.c.rn == 1).all()

    if len(rows) < 10:
        raise HTTPException(400, "数据不足，至少需要10条行为记录")

    student_ids = [r.student_id for r in rows]
    X = np.array([
        [r.stress_level, r.sleep_duration, r.study_hours, r.social_media_hours, r.physical_activity]
        for r in rows
    ], dtype=float)

    feature_names = ["压力水平", "睡眠时长", "学习时长", "社交媒体", "运动时长"]

    # 标准化
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # K-Means 聚类 (K=4)
    kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
    labels = kmeans.fit_predict(X_scaled)

    # PCA 降维到 2D
    pca = PCA(n_components=2, random_state=42)
    X_2d = pca.fit_transform(X_scaled)

    # 聚类中心（原始尺度）
    centers_original = scaler.inverse_transform(kmeans.cluster_centers_)

    # 一次性查询所有学生的最新风险等级（避免 IN 子句变量过多）
    risk_sub = db.query(
        MentalAssessment.student_id, MentalAssessment.risk_level,
        func.row_number().over(
            partition_by=MentalAssessment.student_id,
            order_by=MentalAssessment.assessment_date.desc(),
        ).label("rn"),
    ).subquery()
    all_risk_rows = db.query(risk_sub.c.student_id, risk_sub.c.risk_level).filter(risk_sub.c.rn == 1).all()
    risk_map = {r.student_id: (r.risk_level or "none") for r in all_risk_rows}

    # 一次性查询所有学生性别
    all_gender_rows = db.query(StudentInfo.student_id, StudentInfo.gender).all()
    gender_map = {r.student_id: r.gender for r in all_gender_rows}

    # 每个聚类的统计
    clusters = []

    for i in range(4):
        mask = labels == i
        cluster_indices = np.where(mask)[0]
        center = centers_original[i]
        count = int(mask.sum())

        # 用 Python 计算风险分布（避免 SQL IN 子句）
        cluster_sids = set(student_ids[j] for j in cluster_indices)
        risk_counts = {"high": 0, "medium": 0, "low": 0, "none": 0}
        for sid in cluster_sids:
            risk = risk_map.get(sid, "none")
            risk_counts[risk] = risk_counts.get(risk, 0) + 1

        # 用 Python 计算性别分布
        males = sum(1 for s in cluster_sids if gender_map.get(s) == "Male")
        females = sum(1 for s in cluster_sids if gender_map.get(s) == "Female")

        # 根据聚类中心特征自动命名
        stress = center[0]
        sleep = center[1]
        study = center[2]
        social = center[3]
        activity = center[4]

        if stress >= 6.5 and sleep <= 6:
            auto_name = "🔴 高压风险型"
        elif study >= 7 and social <= 4:
            auto_name = "🔵 学业专注型"
        elif social >= 5 and activity >= 150:
            auto_name = "🟡 社交活跃型"
        else:
            auto_name = "🟢 健康均衡型"

        clusters.append({
            "cluster_id": i,
            "name": auto_name,
            "count": count,
            "percentage": round(count / len(rows) * 100, 1),
            "features": {
                "stress_level": round(float(stress), 2),
                "sleep_duration": round(float(sleep), 2),
                "study_hours": round(float(study), 2),
                "social_media_hours": round(float(social), 2),
                "physical_activity": round(float(activity), 2),
            },
            "risk_distribution": risk_counts,
            "gender_ratio": {"male": males, "female": females},
        })

    # PCA 散点图数据（限制最多 2000 个点避免前端卡顿）
    max_points = min(2000, len(student_ids))
    step = max(1, len(student_ids) // max_points)
    scatter = []
    for idx in range(0, len(student_ids), step):
        i = idx
        scatter.append({
            "student_id": student_ids[i],
            "x": round(float(X_2d[i, 0]), 4),
            "y": round(float(X_2d[i, 1]), 4),
            "cluster": int(labels[i]),
        })

    # 全局特征均值（用于雷达图对比）
    global_means = {
        "stress_level": round(float(np.mean(X[:, 0])), 2),
        "sleep_duration": round(float(np.mean(X[:, 1])), 2),
        "study_hours": round(float(np.mean(X[:, 2])), 2),
        "social_media_hours": round(float(np.mean(X[:, 3])), 2),
        "physical_activity": round(float(np.mean(X[:, 4])), 2),
    }

    result = {
        "clusters": clusters,
        "scatter": scatter,
        "global_means": global_means,
        "feature_names": feature_names,
        "total_students": len(rows),
    }
    _cluster_cache["data"] = result
    _cluster_cache["timestamp"] = _time.time()
    return result


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
    WHERE bl.record_date >= DATE('now', '-30 days')
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
        WHERE record_date >= DATE('now', '-30 days')
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
