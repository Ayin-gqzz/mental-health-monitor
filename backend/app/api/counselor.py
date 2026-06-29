import math, os, time
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, text

from app.core.security import require_role
from app.core.database import week_label
from app.models.student import StudentInfo
from app.models.behavior import BehaviorLog
from app.models.assessment import MentalAssessment
from app.models.notification import RiskNotification
from app.models.weekly_assessment import WeeklyAssessment
from app.models.report import CounselorReport
from app.schemas.student import StudentInfoOut
from app.schemas.behavior import BehaviorLogOut, BehaviorLatestOut
from app.schemas.assessment import AssessmentOut, AssessmentLatestOut, CounselorNotesUpdate
from app.schemas.statistics import OverviewStats, DepartmentStats, TrendPoint, PaginatedResponse
from app.schemas.stat_tests import TTestResult, ChiSquareResult, CorrelationResult

router = APIRouter(dependencies=[Depends(require_role("counselor"))])


def _check_student_access(user: dict, student_id: str, db):
    """检查辅导员是否有权访问该学生（admin跳过，普通辅导员只能看本院系）"""
    if user.get("is_admin"):
        return
    student = db.query(StudentInfo).filter(StudentInfo.student_id == student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")
    if student.department != user.get("department"):
        raise HTTPException(403, "You do not have access to students from other departments")


def _get_dept_filter(user: dict) -> str | None:
    """返回普通辅导员的院系过滤条件，admin返回None"""
    if user.get("is_admin"):
        return None
    return user.get("department")


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

    # 普通辅导员只能看本院系学生，admin看全部
    if not user.get("is_admin"):
        q = q.filter(StudentInfo.department == user.get("department"))
    elif department:
        q = q.filter(StudentInfo.department == department)

    if search:
        q = q.filter(
            (StudentInfo.student_id.contains(search)) |
            (StudentInfo.name.contains(search))
        )
    if gender:
        q = q.filter(StudentInfo.gender == gender)

    # risk_level 过滤：通过子查询关联 mental_assessment 最新记录
    if risk_level:
        latest_assess_sub = db.query(
            MentalAssessment.student_id,
            MentalAssessment.risk_level,
        ).filter(
            MentalAssessment.id.in_(
                db.query(func.max(MentalAssessment.id)).group_by(MentalAssessment.student_id)
            )
        ).subquery()

        q = q.join(
            latest_assess_sub,
            StudentInfo.student_id == latest_assess_sub.c.student_id,
        ).filter(latest_assess_sub.c.risk_level == risk_level)

    total = q.count()
    rows = q.order_by(StudentInfo.student_id).offset((page - 1) * page_size).limit(page_size).all()

    # 批量查风险等级（只查当前页的学生）
    student_ids = [r[0] for r in rows]
    risk_map = {}
    if student_ids:
        placeholders = ",".join([f"'{sid}'" for sid in student_ids])
        risk_rows = db.execute(text(
            f"SELECT ma.student_id, ma.risk_level FROM mental_assessment ma "
            f"INNER JOIN (SELECT student_id, MAX(id) AS max_id FROM mental_assessment "
            f"WHERE student_id IN ({placeholders}) GROUP BY student_id) latest "
            f"ON ma.id = latest.max_id"
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
    _check_student_access(user, student_id, db)
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
    _check_student_access(user, student_id, db)
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
    _check_student_access(user, student_id, db)
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
    _check_student_access(user, student_id, db)
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
    _check_student_access(user, student_id, db)
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

    today = date.today()
    assessment = MentalAssessment(
        student_id=student_id,
        assessment_date=today,
        year_week=today.strftime("%G-W%V"),
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
    dept = _get_dept_filter(user)
    from app.services.ml_service import MLService
    from app.services.suggestion_service import generate_suggestion

    try:
        ml = MLService()
        has_model = True
    except FileNotFoundError:
        has_model = False

    # 一次查询拿到所有学生 + 最新行为，避免 N+1（原方案10万次单条查询）
    if dept:
        rows = db.execute(text("""
            SELECT si.student_id, si.age, si.gender, si.department, si.cgpa,
                   bl.sleep_duration, bl.study_hours, bl.social_media_hours,
                   bl.physical_activity, bl.stress_level
            FROM student_info si
            INNER JOIN (
                SELECT student_id, sleep_duration, study_hours, social_media_hours,
                       physical_activity, stress_level,
                       ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY record_date DESC) AS rn
                FROM behavior_log
            ) bl ON si.student_id = bl.student_id AND bl.rn = 1
            WHERE si.department = :dept
        """), {"dept": dept}).fetchall()
    else:
        rows = db.execute(text("""
            SELECT si.student_id, si.age, si.gender, si.department, si.cgpa,
                   bl.sleep_duration, bl.study_hours, bl.social_media_hours,
                   bl.physical_activity, bl.stress_level
            FROM student_info si
            INNER JOIN (
                SELECT student_id, sleep_duration, study_hours, social_media_hours,
                       physical_activity, stress_level,
                       ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY record_date DESC) AS rn
                FROM behavior_log
            ) bl ON si.student_id = bl.student_id AND bl.rn = 1
        """)).fetchall()

    count = 0
    batch = []
    for r in rows:
        sid, age, gender, dept, cgpa = r[0], r[1], r[2], r[3], r[4]
        sleep_dur, study_hrs, social_hrs, phys_act, stress_lvl = r[5], r[6], r[7], r[8], r[9]

        if has_model:
            result = ml.predict({
                "age": age, "gender": gender, "department": dept, "cgpa": cgpa,
            }, {
                "sleep_duration": sleep_dur, "study_hours": study_hrs,
                "social_media_hours": social_hrs, "physical_activity": phys_act,
                "stress_level": stress_lvl,
            })
        else:
            prob = 0.42 if stress_lvl >= 8 else 0.09
            result = type("Result", (), {})()
            result.depression_predicted = stress_lvl >= 8
            result.depression_probability = prob
            result.risk_level = "high" if stress_lvl >= 8 else (
                "medium" if stress_lvl >= 6 else "low"
            )

        intervention = generate_suggestion(result, {
            "stress_level": stress_lvl, "sleep_duration": sleep_dur,
            "study_hours": study_hrs, "social_media_hours": social_hrs,
            "physical_activity": phys_act,
        })

        today_str = date.today().isoformat()
        batch.append(MentalAssessment(
            student_id=sid,
            assessment_date=date.today(),
            year_week=date.today().strftime("%G-W%V"),
            depression_predicted=result.depression_predicted,
            depression_probability=round(result.depression_probability, 4),
            risk_level=result.risk_level,
            intervention_text=intervention,
        ))
        count += 1

        if len(batch) >= 5000:
            db.add_all(batch)
            db.commit()
            batch = []

    if batch:
        db.add_all(batch)
    db.commit()
    return {"assessed": count}


# ── Statistics ───────────────────────────────────────────────

# 缓存 overview 数据 60 秒，避免重复查询
_overview_cache = {"data": None, "timestamp": 0}

@router.get("/statistics/overview", response_model=OverviewStats)
def get_overview(user: dict = Depends(require_role("counselor"))):
    import time as _time
    dept = _get_dept_filter(user)
    cache_key = f"overview_{dept or 'all'}"
    # 按院系分别缓存
    if not hasattr(get_overview, '_cache'):
        get_overview._cache = {}
    if cache_key in get_overview._cache and _time.time() - get_overview._cache[cache_key]["time"] < 600:
        return get_overview._cache[cache_key]["data"]

    db = user["db"]

    if dept:
        row = db.execute(text("""
            SELECT
                (SELECT COUNT(*) FROM student_info WHERE department = :dept) AS total,
                (SELECT COUNT(*) FROM v_latest_assessment la
                 JOIN student_info si ON la.student_id = si.student_id
                 WHERE la.risk_level = 'high' AND si.department = :dept) AS high_risk,
                (SELECT COUNT(*) FROM v_latest_assessment la
                 JOIN student_info si ON la.student_id = si.student_id
                 WHERE la.risk_level = 'medium' AND si.department = :dept) AS medium_risk,
                (SELECT COUNT(*) FROM v_latest_assessment la
                 JOIN student_info si ON la.student_id = si.student_id
                 WHERE la.risk_level = 'low' AND si.department = :dept) AS low_risk,
                (SELECT COUNT(*) FROM v_latest_assessment la
                 JOIN student_info si ON la.student_id = si.student_id
                 WHERE la.depression_predicted = 1 AND si.department = :dept) AS depressed,
                (SELECT ROUND(AVG(bl.stress_level), 2) FROM behavior_log bl
                 INNER JOIN (SELECT MAX(id) AS max_id FROM behavior_log GROUP BY student_id) latest
                 ON bl.id = latest.max_id
                 JOIN student_info si ON bl.student_id = si.student_id
                 WHERE si.department = :dept) AS avg_stress
        """), {"dept": dept}).fetchone()
    else:
        row = db.execute(text("""
            SELECT
                (SELECT COUNT(*) FROM student_info) AS total,
                (SELECT COUNT(*) FROM v_latest_assessment WHERE risk_level = 'high') AS high_risk,
                (SELECT COUNT(*) FROM v_latest_assessment WHERE risk_level = 'medium') AS medium_risk,
                (SELECT COUNT(*) FROM v_latest_assessment WHERE risk_level = 'low') AS low_risk,
                (SELECT COUNT(*) FROM v_latest_assessment WHERE depression_predicted = 1) AS depressed,
                (SELECT ROUND(AVG(bl.stress_level), 2) FROM behavior_log bl
                 INNER JOIN (SELECT MAX(id) AS max_id FROM behavior_log GROUP BY student_id) latest
                 ON bl.id = latest.max_id) AS avg_stress
        """)).fetchone()

    total = row[0] or 0
    result = OverviewStats(
        total_students=total,
        high_risk_count=row[1] or 0,
        medium_risk_count=row[2] or 0,
        low_risk_count=row[3] or 0,
        avg_stress=round(float(row[5] or 0), 2),
        depression_rate=round((row[4] or 0) / total * 100, 1) if total > 0 else 0,
    )
    get_overview._cache[cache_key] = {"data": result, "time": _time.time()}
    return result


@router.get("/statistics/departments", response_model=list[DepartmentStats])
def get_department_stats(user: dict = Depends(require_role("counselor"))):
    db = user["db"]

    # 始终返回全部院系数据，方便比较（不按辅导员院系过滤）

    # 查询1: 学生基础统计（人数 + 平均绩点）
    dept_info = db.execute(text(
        "SELECT department, COUNT(*) AS cnt, ROUND(AVG(cgpa), 2) AS avg_cgpa "
        "FROM student_info GROUP BY department"
    )).fetchall()
    dept_map = {r[0]: {"count": r[1], "avg_cgpa": r[2]} for r in dept_info}

    # 查询2: 用一条SQL拿院系维度的 最新风险分布 + 抑郁人数
    dept_stats_rows = db.execute(text("""
        SELECT
            si.department,
            ma.risk_level,
            COUNT(*) AS risk_cnt,
            SUM(CASE WHEN ma.depression_predicted = 1 THEN 1 ELSE 0 END) AS depressed_cnt
        FROM student_info si
        INNER JOIN mental_assessment ma ON si.student_id = ma.student_id
        INNER JOIN (
            SELECT student_id, MAX(id) AS max_id FROM mental_assessment GROUP BY student_id
        ) latest ON ma.id = latest.max_id
        GROUP BY si.department, ma.risk_level
    """)).fetchall()

    # 查询3: 从预聚合表读每院系平均压力
    stress_rows = db.execute(text(
        "SELECT department, avg_stress FROM weekly_behavior_stats "
        "WHERE department != '__ALL__'"
    )).fetchall()
    stress_map = {r[0]: r[1] for r in stress_rows}

    # 汇总 risk + depression
    risk_dept: dict = {}
    dep_map: dict = {}
    for dept, risk, risk_cnt, depressed_cnt in dept_stats_rows:
        if dept not in risk_dept:
            risk_dept[dept] = {"high": 0, "medium": 0, "low": 0}
        risk_dept[dept][risk] = risk_cnt
        dep_map[dept] = dep_map.get(dept, 0) + depressed_cnt

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
    # 非管理员强制使用自己的院系
    dept = _get_dept_filter(user) or department or "__ALL__"
    cache_key = f"trends_{dept}"
    if cache_key in _trends_cache and _time.time() - _trends_cache[cache_key]["time"] < 1800:
        return _trends_cache[cache_key]["data"]

    db = user["db"]

    # 直接读预聚合表（~60行，毫秒级），不扫百万行原始数据
    stress_rows = db.execute(text(
        "SELECT year_week, avg_stress FROM weekly_behavior_stats "
        "WHERE department = :dept ORDER BY year_week"
    ), {"dept": dept}).fetchall()

    dep_rows = db.execute(text(
        "SELECT year_week, depression_count FROM weekly_depression_stats "
        "WHERE department = :dept ORDER BY year_week"
    ), {"dept": dept}).fetchall()

    dep_map = {r[0]: r[1] for r in dep_rows}

    result = [
        TrendPoint(week=r[0], avg_stress=round(float(r[1]), 2),
                   depression_count=dep_map.get(r[0], 0))
        for r in stress_rows
    ]
    _trends_cache[cache_key] = {"data": result, "time": _time.time()}
    return result


# ── Alerts & Notifications ────────────────────────────────────

@router.get("/alerts", response_model=PaginatedResponse)
def get_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    department: str = "",
    gender: str = "",
    is_read: str = "",
    user: dict = Depends(require_role("counselor")),
):
    db = user["db"]
    dept = _get_dept_filter(user) or department

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

    if dept:
        q = q.filter(StudentInfo.department == dept)
    if gender:
        q = q.filter(StudentInfo.gender == gender)
    if is_read == "true":
        q = q.filter(RiskNotification.is_read == True)
    elif is_read == "false":
        q = q.filter(RiskNotification.is_read == False)

    total = q.count()
    rows = q.order_by(RiskNotification.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    # Get latest assessment data for displayed students — 用 MAX(id) 代替 ROW_NUMBER()
    student_ids = [r.student_id for r in rows]
    assess_map = {}
    if student_ids:
        placeholders = ",".join([f"'{sid}'" for sid in student_ids])
        a_rows = db.execute(text(
            f"SELECT ma.student_id, ma.depression_probability, ma.assessment_date "
            f"FROM mental_assessment ma "
            f"INNER JOIN (SELECT student_id, MAX(id) AS max_id FROM mental_assessment "
            f"WHERE student_id IN ({placeholders}) GROUP BY student_id) latest "
            f"ON ma.id = latest.max_id"
        )).fetchall()
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
    dept = _get_dept_filter(user)
    q = db.query(func.count(RiskNotification.id)).filter(RiskNotification.is_read == False)
    if dept:
        q = q.join(StudentInfo, RiskNotification.student_id == StudentInfo.student_id).filter(
            StudentInfo.department == dept
        )
    count = q.scalar() or 0
    return {"unread_count": count}


@router.put("/notifications/{notification_id}/read")
def mark_as_read(notification_id: int, user: dict = Depends(require_role("counselor"))):
    db = user["db"]
    dept = _get_dept_filter(user)
    n = db.query(RiskNotification).filter(RiskNotification.id == notification_id).first()
    if not n:
        raise HTTPException(404, "Notification not found")
    if dept:
        student = db.query(StudentInfo).filter(StudentInfo.student_id == n.student_id).first()
        if student and student.department != dept:
            raise HTTPException(403, "You do not have access to this notification")
    n.is_read = True
    db.commit()
    return {"status": "ok"}


@router.put("/notifications/read-all")
def mark_all_as_read(user: dict = Depends(require_role("counselor"))):
    db = user["db"]
    dept = _get_dept_filter(user)
    if dept:
        # 只标记本院系的通知
        subq = db.query(StudentInfo.student_id).filter(StudentInfo.department == dept).subquery()
        db.query(RiskNotification).filter(
            RiskNotification.is_read == False,
            RiskNotification.student_id.in_(db.query(subq.c.student_id))
        ).update({"is_read": True}, synchronize_session=False)
    else:
        db.query(RiskNotification).filter(RiskNotification.is_read == False).update({"is_read": True})
    db.commit()
    return {"status": "ok"}


# ── Statistical analysis（共享基础数据缓存，只查一次百万行）────────

_stat_base_cache = {"data": None, "timestamp": 0}
_STAT_TTL = 1800  # 30 分钟
_stat_base_lock = __import__("threading").Lock()


def _ensure_student_latest_stats(db):
    """如果 student_latest_stats 为空但 behavior_log 有数据，自动刷新预聚合表"""
    try:
        cnt = db.execute(text("SELECT COUNT(*) FROM student_latest_stats")).scalar()
        if cnt > 0:
            return
        bl_cnt = db.execute(text("SELECT COUNT(*) FROM behavior_log")).scalar()
        if bl_cnt == 0:
            return
        print("[auto-refresh] student_latest_stats is empty, refreshing...")
        from scripts.refresh_weekly_stats import refresh_all
        refresh_all(conn=db)
        print("[auto-refresh] Done.")
    except Exception as e:
        print(f"[auto-refresh] Skipped: {e}")


_ensured = False


def _ensure_once(db):
    """只在进程生命周期内检查一次"""
    global _ensured
    if _ensured:
        return
    _ensured = True
    _ensure_student_latest_stats(db)


def _get_stat_base(db, dept=None):
    """获取统计检验的基础数据：从预聚合表 student_latest_stats 读（10万行，毫秒级）
    带线程锁，防止并发请求重复查询数据库。
    """
    import time as _t
    cache_key = f"stat_base_{dept or 'all'}"
    if not hasattr(_get_stat_base, '_cache'):
        _get_stat_base._cache = {}

    # 快速路径：缓存命中，无需加锁
    if cache_key in _get_stat_base._cache and _t.time() - _get_stat_base._cache[cache_key]["time"] < _STAT_TTL:
        return _get_stat_base._cache[cache_key]["data"]

    with _stat_base_lock:
        # 双重检查：加锁后再检查一次，避免重复查询
        if cache_key in _get_stat_base._cache and _t.time() - _get_stat_base._cache[cache_key]["time"] < _STAT_TTL:
            return _get_stat_base._cache[cache_key]["data"]

        if dept:
            rows = db.execute(text(
                "SELECT s.student_id, s.stress_level, s.sleep_duration, s.study_hours, "
                "s.social_media_hours, s.physical_activity, "
                "s.risk_level, s.depression_predicted, s.depression_probability, s.gender "
                "FROM student_latest_stats s "
                "WHERE s.department = :dept"
            ), {"dept": dept}).fetchall()
        else:
            rows = db.execute(text(
                "SELECT student_id, stress_level, sleep_duration, study_hours, "
                "social_media_hours, physical_activity, "
                "risk_level, depression_predicted, depression_probability, gender "
                "FROM student_latest_stats"
            )).fetchall()

        _get_stat_base._cache[cache_key] = {"data": rows, "time": _t.time()}
        return rows


@router.get("/statistics/t-test", response_model=list[TTestResult])
def run_t_tests(user: dict = Depends(require_role("counselor"))):
    import numpy as np
    from scipy import stats
    _ensure_once(user["db"])
    dept = _get_dept_filter(user)
    rows = _get_stat_base(user["db"], dept)

    # 一次性构建 numpy 数组，避免多次列表推导
    arr = np.array(rows)
    risk_levels = arr[:, 6]
    high_mask = risk_levels == "high"
    low_mask = risk_levels == "low"

    metrics = [
        ("stress_level", "压力水平", 1),
        ("sleep_duration", "睡眠时长", 2),
        ("study_hours", "学习时长", 3),
        ("social_media_hours", "社交媒体时长", 4),
        ("physical_activity", "运动时长", 5),
    ]

    results = []
    for key, label, col_idx in metrics:
        col = arr[:, col_idx].astype(float)
        g1 = col[high_mask]
        g2 = col[low_mask]
        if len(g1) >= 2 and len(g2) >= 2:
            t_stat, p_val = stats.ttest_ind(g1, g2, equal_var=False)
            results.append(TTestResult(
                metric=key, metric_label=label,
                group1_mean=round(float(g1.mean()), 4),
                group2_mean=round(float(g2.mean()), 4),
                t_statistic=round(float(t_stat), 4),
                p_value=round(float(p_val), 6),
                significant=float(p_val) < 0.05,
                group1_n=len(g1), group2_n=len(g2),
            ))
    return results


@router.get("/statistics/chi-square", response_model=ChiSquareResult)
def run_chi_square(user: dict = Depends(require_role("counselor"))):
    import numpy as np
    from scipy import stats
    _ensure_once(user["db"])
    dept = _get_dept_filter(user)
    rows = _get_stat_base(user["db"], dept)

    # 向量化构建列联表
    arr = np.array(rows)
    gender = arr[:, 9]
    dep_pred = np.array([1 if r[7] else 0 for r in rows])
    male_mask = gender == "Male"
    table = [
        [int(np.sum(male_mask & (dep_pred == 0))), int(np.sum(male_mask & (dep_pred == 1)))],
        [int(np.sum(~male_mask & (dep_pred == 0))), int(np.sum(~male_mask & (dep_pred == 1)))],
    ]

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
    import numpy as np
    from scipy import stats as sp_stats
    _ensure_once(user["db"])
    dept = _get_dept_filter(user)
    rows = _get_stat_base(user["db"], dept)

    # 一次性转为 numpy 数组，避免多次列表推导
    arr = np.array(rows)
    depression = np.array([1 if r[7] else 0 for r in rows], dtype=float)

    variables = [
        ("stress_level", "压力水平", arr[:, 1].astype(float)),
        ("sleep_duration", "睡眠时长", arr[:, 2].astype(float)),
        ("social_media_hours", "社交媒体时长", arr[:, 4].astype(float)),
    ]

    results = []
    for key, label, values in variables:
        # Pearson：numpy 直接算比 scipy 快（只算 r，再手动算 p）
        r_p = float(np.corrcoef(values, depression)[0, 1])
        n = len(values)
        t_p = r_p * np.sqrt((n - 2) / (1 - r_p**2 + 1e-15))
        p_p = 2 * sp_stats.t.sf(abs(t_p), n - 2)

        # Spearman：先排名再算 Pearson
        rank_x = sp_stats.rankdata(values)
        rank_y = sp_stats.rankdata(depression)
        r_s = float(np.corrcoef(rank_x, rank_y)[0, 1])
        t_s = r_s * np.sqrt((n - 2) / (1 - r_s**2 + 1e-15))
        p_s = 2 * sp_stats.t.sf(abs(t_s), n - 2)

        results.append(CorrelationResult(
            variable=key, variable_label=label, method="pearson",
            correlation=round(r_p, 4), p_value=round(float(p_p), 6),
            significant=float(p_p) < 0.05,
        ))
        results.append(CorrelationResult(
            variable=key, variable_label=label, method="spearman",
            correlation=round(r_s, 4), p_value=round(float(p_s), 6),
            significant=float(p_s) < 0.05,
        ))
    return results


@router.get("/statistics/stress-distribution")
def get_stress_distribution(user: dict = Depends(require_role("counselor"))):
    db = user["db"]
    dept = _get_dept_filter(user)

    if dept:
        rows = db.execute(text("""
            SELECT bl.stress_level, COUNT(*) AS count
            FROM behavior_log bl
            INNER JOIN (
                SELECT student_id, MAX(id) AS max_id FROM behavior_log GROUP BY student_id
            ) latest ON bl.id = latest.max_id
            JOIN student_info si ON bl.student_id = si.student_id
            WHERE si.department = :dept
            GROUP BY bl.stress_level
            ORDER BY bl.stress_level
        """), {"dept": dept}).fetchall()
    else:
        rows = db.execute(text("""
            SELECT bl.stress_level, COUNT(*) AS count
            FROM behavior_log bl
            INNER JOIN (
                SELECT student_id, MAX(id) AS max_id FROM behavior_log GROUP BY student_id
            ) latest ON bl.id = latest.max_id
            GROUP BY bl.stress_level
            ORDER BY bl.stress_level
        """)).fetchall()

    return [{"stress_level": r[0], "count": r[1]} for r in rows]


_cluster_cache = {}  # 改为按院系分缓存，避免管理员/辅导员数据混淆
_cluster_lock = __import__("threading").Lock()

@router.get("/cluster-analysis")
def get_cluster_analysis(user: dict = Depends(require_role("counselor"))):
    """学生群体聚类画像 — K-Means + PCA 降维（带缓存，按院系隔离）"""
    import time as _time
    _ensure_once(user["db"])
    dept = _get_dept_filter(user)
    cache_key = dept or "__all__"

    # 快速路径：缓存命中
    if cache_key in _cluster_cache and _time.time() - _cluster_cache[cache_key]["ts"] < 600:
        return _cluster_cache[cache_key]["data"]

    with _cluster_lock:
        # 双重检查
        if cache_key in _cluster_cache and _time.time() - _cluster_cache[cache_key]["ts"] < 600:
            return _cluster_cache[cache_key]["data"]

        import numpy as np
        from sklearn.cluster import MiniBatchKMeans
        from sklearn.preprocessing import StandardScaler
        from sklearn.decomposition import PCA

        db = user["db"]

        # 直接从预聚合表按 department 过滤，无需 JOIN
        if dept:
            rows = db.execute(text(
                "SELECT student_id, stress_level, sleep_duration, study_hours, "
                "social_media_hours, physical_activity, risk_level, gender "
                "FROM student_latest_stats WHERE department = :dept"
            ), {"dept": dept}).fetchall()
        else:
            rows = db.execute(text(
                "SELECT student_id, stress_level, sleep_duration, study_hours, "
                "social_media_hours, physical_activity, risk_level, gender "
                "FROM student_latest_stats"
            )).fetchall()

        if len(rows) < 10:
            raise HTTPException(400, "数据不足，至少需要10条行为记录")

        # rows: (student_id, stress, sleep, study, social, activity, risk_level, gender)
        student_ids = [r[0] for r in rows]
        X = np.array([[r[1], r[2], r[3], r[4], r[5]] for r in rows], dtype=float)

        feature_names = ["压力水平", "睡眠时长", "学习时长", "社交媒体", "运动时长"]

        # 标准化
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # MiniBatchKMeans：比 KMeans 快 5-10 倍，10万行数据 1-2 秒完成
        kmeans = MiniBatchKMeans(n_clusters=4, random_state=42, batch_size=2048)
        labels = kmeans.fit_predict(X_scaled)

        # PCA 降维到 2D
        pca = PCA(n_components=2, random_state=42)
        X_2d = pca.fit_transform(X_scaled)

        # 聚类中心（原始尺度）
        centers_original = scaler.inverse_transform(kmeans.cluster_centers_)

        # 预提取 risk/gender 数组，用 numpy 向量化统计代替 Python 循环
        risk_arr = np.array([r[6] or "none" for r in rows])
        gender_arr = np.array([r[7] for r in rows])

        # 全局均值（用于判断偏离程度）
        g_mean = np.mean(X, axis=0)
        g_std = np.std(X, axis=0) + 1e-9  # 避免除零

        FEAT_KEYS = ["stress_level", "sleep_duration", "study_hours", "social_media_hours", "physical_activity"]
        FEAT_LABELS = ["压力水平", "睡眠时长", "学习时长", "社交媒体使用", "运动时长"]
        FEAT_UNITS = ["分", "小时", "小时", "小时", "分钟"]

        # ── 基于特征偏离度的智能画像生成 ──
        def _level(val, mean, std):
            """返回 'high' / 'medium' / 'low'，基于偏离标准差的程度"""
            z = (val - mean) / std
            if z >= 0.5:
                return "high"
            elif z <= -0.5:
                return "low"
            return "medium"

        def _generate_profile(stress, sleep, study, social, activity):
            """根据 5 个维度的偏离度生成群体名称、特征描述、干预建议"""
            sl = _level(stress, g_mean[0], g_std[0])
            dl = _level(sleep, g_mean[1], g_std[1])
            hl = _level(study, g_mean[2], g_std[2])
            ml = _level(social, g_mean[3], g_std[3])
            al = _level(activity, g_mean[4], g_std[4])

            # ── 群体名称（20+ 种组合） ──
            if sl == "high" and dl == "low":
                name, emoji = "高压失眠型", "🔴"
            elif sl == "high" and ml == "high":
                name, emoji = "焦虑社交型", "🟠"
            elif sl == "high" and hl == "high":
                name, emoji = "学业高压型", "🔴"
            elif sl == "high":
                name, emoji = "高压力型", "🔴"
            elif dl == "low" and al == "low":
                name, emoji = "作息紊乱型", "🟠"
            elif dl == "low" and hl == "high":
                name, emoji = "熬夜苦读型", "🟡"
            elif dl == "low" and sl == "low":
                name, emoji = "睡眠不足型", "🟡"
            elif dl == "low":
                name, emoji = "睡眠欠佳型", "🟠"
            elif dl == "high" and sl == "low":
                name, emoji = "睡眠充足型", "🟢"
            elif dl == "high" and al == "high":
                name, emoji = "健康阳光型", "🟢"
            elif dl == "high":
                name, emoji = "睡眠充裕型", "🟢"
            elif hl == "high" and ml == "low" and al == "low":
                name, emoji = "埋头苦学型", "🔵"
            elif hl == "high" and ml == "low":
                name, emoji = "学业专注型", "🔵"
            elif hl == "high" and al == "high":
                name, emoji = "全面发展型", "🟢"
            elif hl == "low" and al == "high":
                name, emoji = "运动达人型", "🟢"
            elif hl == "low" and sl == "low":
                name, emoji = "轻松休闲型", "🟡"
            elif ml == "high" and al == "high":
                name, emoji = "社交运动型", "🟡"
            elif ml == "high" and al == "low":
                name, emoji = "网络依赖型", "🟠"
            elif ml == "high":
                name, emoji = "社交活跃型", "🟡"
            elif al == "high" and sl == "low":
                name, emoji = "运动达人型", "🟢"
            elif al == "low" and sl == "low" and dl == "high":
                name, emoji = "安逸宅居型", "🟡"
            elif al == "low":
                name, emoji = "缺乏运动型", "🟠"
            elif sl == "low" and dl == "medium":
                name, emoji = "平稳发展型", "🟢"
            else:
                name, emoji = "普通均衡型", "🟢"

            # ── 特征描述（逐维度分析） ──
            traits = []
            if sl == "high":
                traits.append(f"压力偏高（{stress:.1f}分，高于均值{stress - g_mean[0]:.1f}分）")
            elif sl == "low":
                traits.append(f"压力较低（{stress:.1f}分，低于均值{g_mean[0] - stress:.1f}分）")
            else:
                traits.append(f"压力适中（{stress:.1f}分）")

            if dl == "low":
                traits.append(f"睡眠不足（{sleep:.1f}h，低于均值{g_mean[1] - sleep:.1f}h）")
            elif dl == "high":
                traits.append(f"睡眠充足（{sleep:.1f}h）")
            else:
                traits.append(f"睡眠一般（{sleep:.1f}h）")

            if hl == "high":
                traits.append(f"学习时间长（{study:.1f}h）")
            elif hl == "low":
                traits.append(f"学习时间较短（{study:.1f}h）")

            if ml == "high":
                traits.append(f"社交媒体使用多（{social:.1f}h）")
            elif ml == "low":
                traits.append(f"社交媒体使用少（{social:.1f}h）")

            if al == "high":
                traits.append(f"运动量充足（{activity:.0f}min）")
            elif al == "low":
                traits.append(f"运动量不足（{activity:.0f}min）")

            # ── 干预建议（多维度组合，20+ 种） ──
            suggestions = []

            # 压力相关
            if sl == "high" and dl == "low":
                suggestions.append("🔴 重点关注：安排心理健康一对一辅导，制定减压方案，建议就医排查睡眠障碍")
                suggestions.append("引入正念冥想或放松训练课程，帮助改善入睡质量")
            elif sl == "high" and hl == "high":
                suggestions.append("🔴 学业压力过大：与任课教师沟通适当减负，提供时间管理培训")
                suggestions.append("组织朋辈减压分享会，帮助学生建立合理的学习期望")
            elif sl == "high" and ml == "high":
                suggestions.append("⚠️ 压力大但社交多：引导将社交活动转化为正向支持网络，开展团体心理辅导")
            elif sl == "high":
                suggestions.append("⚠️ 压力偏高：建议定期心理疏导，推广校园减压活动（如运动、艺术疗愈）")

            # 睡眠相关
            if dl == "low" and hl == "high":
                suggestions.append("🌙 熬夜学习：引导时间管理，设定就寝闹钟，建议23:00前停止学习")
            elif dl == "low" and al == "low":
                suggestions.append("🌙 作息紊乱：制定规律作息计划，建议每天固定起床时间，减少睡前屏幕使用")
            elif dl == "low":
                suggestions.append("🌙 睡眠不足：建议每晚保证7-8小时睡眠，推送助眠音频资源")

            # 学习相关
            if hl == "high" and ml == "low" and al == "low":
                suggestions.append("📚 生活单一：鼓励参加社团活动和体育锻炼，每周至少安排2次社交/运动")
            elif hl == "high" and ml == "low":
                suggestions.append("📚 社交不足：鼓励适度社交，可参加学习小组兼顾学业与人际交往")
            elif hl == "low" and sl == "low":
                suggestions.append("📚 学习动力不足：了解是否存在学业困惑，提供学业辅导和职业规划引导")

            # 社交媒体相关
            if ml == "high" and al == "low":
                suggestions.append("📱 网络依赖：建议设定每日屏幕时间上限，用运动替代部分刷手机时间")
                suggestions.append("开展数字健康教育，引导学生识别网络成瘾征兆")
            elif ml == "high" and sl == "high":
                suggestions.append("📱 社交逃避型：社交媒体可能成为压力逃避方式，建议引导线下社交和运动")
            elif ml == "high":
                suggestions.append("📱 社交活跃：可发展为朋辈心理辅导员，发挥社交优势帮助他人")

            # 运动相关
            if al == "high" and sl == "low":
                suggestions.append("🏃 运动达人：可担任运动类朋辈互助骨干，带动更多同学参与锻炼")
            elif al == "high":
                suggestions.append("🏃 运动习惯好：继续保持，可作为健康生活方式的榜样")
            elif al == "low" and sl != "high":
                suggestions.append("🏃 运动不足：推荐校园运动打卡活动，从每天散步20分钟开始")

            # 综合正向
            if sl == "low" and dl == "high" and al == "high":
                suggestions.append("✅ 整体状态优秀：可作为朋辈互助骨干，帮助带动其他同学")

            # 保底
            if not suggestions:
                suggestions.append("各维度相对均衡，建议保持良好生活习惯，定期关注心理健康动态")

            return f"{emoji} {name}", traits, suggestions

        # 每个聚类的统计
        clusters = []
        for i in range(4):
            mask = labels == i
            count = int(mask.sum())
            center = centers_original[i]

            # 向量化统计风险分布
            cluster_risks = risk_arr[mask]
            risk_counts = {
                "high": int(np.sum(cluster_risks == "high")),
                "medium": int(np.sum(cluster_risks == "medium")),
                "low": int(np.sum(cluster_risks == "low")),
                "none": int(np.sum(cluster_risks == "none")),
            }

            # 向量化统计性别分布
            cluster_genders = gender_arr[mask]
            males = int(np.sum(cluster_genders == "Male"))
            females = int(np.sum(cluster_genders == "Female"))

            stress, sleep, study, social, activity = center
            auto_name, traits, suggestions = _generate_profile(stress, sleep, study, social, activity)

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
                "traits": traits,
                "suggestions": suggestions,
            })

        # PCA 散点图数据（限制最多 2000 个点避免前端卡顿）
        max_points = min(2000, len(student_ids))
        step = max(1, len(student_ids) // max_points)
        scatter = []
        for idx in range(0, len(student_ids), step):
            scatter.append({
                "student_id": student_ids[idx],
                "x": round(float(X_2d[idx, 0]), 4),
                "y": round(float(X_2d[idx, 1]), 4),
                "cluster": int(labels[idx]),
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
        _cluster_cache[cache_key] = {"data": result, "ts": _time.time()}
        return result


# ── Model evaluation ──────────────────────────────────────────

import joblib as _joblib

_ML_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "ml")


@router.get("/model/evaluation")
def get_model_evaluation(user: dict = Depends(require_role("counselor"))):
    """返回 ROC / PR / 学习曲线数据（由 train.py 预计算并持久化）"""
    curves_path = os.path.join(_ML_DIR, "evaluation_curves.pkl")
    if not os.path.exists(curves_path):
        raise HTTPException(
            404,
            "evaluation_curves.pkl not found. Run: python ml/train.py",
        )
    return _joblib.load(curves_path)


# ── SQL optimization demo ────────────────────────────────────

@router.get("/statistics/complex-query")
def run_complex_query(user: dict = Depends(require_role("counselor"))):
    db = user["db"]
    dept = _get_dept_filter(user)

    dept_filter = "AND si.department = :dept" if dept else ""
    params = {"dept": dept} if dept else {}

    fast_sql = f"""
    SELECT si.department,
           COUNT(DISTINCT rb.student_id) AS total_students,
           ROUND(AVG(rb.stress_level), 2) AS avg_stress,
           ROUND(AVG(rb.sleep_duration), 2) AS avg_sleep,
           COUNT(DISTINCT CASE WHEN la.risk_level = 'high'
               THEN la.student_id END) AS high_risk_count
    FROM student_info si
    JOIN (
        SELECT student_id, stress_level, sleep_duration
        FROM behavior_log
        WHERE record_date >= DATE('now', '-30 days')
    ) rb ON si.student_id = rb.student_id
    LEFT JOIN (
        SELECT student_id, risk_level
        FROM mental_assessment ma
        INNER JOIN (
            SELECT student_id, MAX(id) AS max_id FROM mental_assessment GROUP BY student_id
        ) latest ON ma.id = latest.max_id
    ) la ON si.student_id = la.student_id
    WHERE 1=1 {dept_filter}
    GROUP BY si.department
    ORDER BY high_risk_count DESC
    """

    t0 = time.time()
    result = db.execute(text(fast_sql), params).fetchall()
    query_time = round((time.time() - t0) * 1000, 2)

    return {
        "optimized_query_ms": query_time,
        "data": [
            {"department": r[0], "total_students": r[1], "avg_stress": r[2],
             "avg_sleep": r[3], "high_risk_count": r[4]}
            for r in result
        ],
    }


# ── Weekly Assessment Management ─────────────────────────────

@router.get("/weekly-assessments", response_model=PaginatedResponse)
def list_weekly_assessments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    department: str = "",
    has_message: str = "",
    sort_by: str = Query("sentiment", description="排序方式: sentiment(情感分升序) / date(日期降序)"),
    user: dict = Depends(require_role("counselor")),
):
    """辅导员查看学生每周测评列表，默认按情感分升序（最消极排最前）"""

    db = user["db"]
    dept = _get_dept_filter(user) or department

    q = db.query(
        WeeklyAssessment.id,
        WeeklyAssessment.student_id,
        WeeklyAssessment.submit_date,
        WeeklyAssessment.mood_score,
        WeeklyAssessment.sleep_quality,
        WeeklyAssessment.study_state,
        WeeklyAssessment.social_state,
        WeeklyAssessment.life_satisfaction,
        WeeklyAssessment.overall_score,
        WeeklyAssessment.message,
        WeeklyAssessment.ai_reply,
        WeeklyAssessment.counselor_reply,
        WeeklyAssessment.sentiment_score,
        StudentInfo.name,
        StudentInfo.department,
        StudentInfo.gender,
    ).join(
        StudentInfo, WeeklyAssessment.student_id == StudentInfo.student_id
    )

    if dept:
        q = q.filter(StudentInfo.department == dept)
    if has_message == "true":
        q = q.filter(WeeklyAssessment.message.isnot(None))
        q = q.filter(WeeklyAssessment.message != "")

    total = q.count()

    if sort_by == "sentiment":
        # 有情感分的按分升序（最消极排最前），没留言的排最后
        rows = q.order_by(
            WeeklyAssessment.sentiment_score.asc().nullslast(),
            WeeklyAssessment.submit_date.desc(),
        ).offset((page - 1) * page_size).limit(page_size).all()
    else:
        rows = q.order_by(
            WeeklyAssessment.submit_date.desc(), WeeklyAssessment.id.desc()
        ).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for r in rows:
        items.append({
            "id": r.id,
            "student_id": r.student_id,
            "student_name": r.name,
            "department": r.department,
            "gender": r.gender,
            "submit_date": r.submit_date.isoformat() if r.submit_date else None,
            "mood_score": r.mood_score,
            "sleep_quality": r.sleep_quality,
            "study_state": r.study_state,
            "social_state": r.social_state,
            "life_satisfaction": r.life_satisfaction,
            "overall_score": r.overall_score,
            "message": r.message,
            "ai_reply": r.ai_reply,
            "counselor_reply": r.counselor_reply,
            "sentiment_score": r.sentiment_score,
        })

    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/weekly-assessments/{assessment_id}")
def get_weekly_assessment_detail(
    assessment_id: int,
    user: dict = Depends(require_role("counselor")),
):
    """获取单条每周测评详情（含NLP分析）"""

    db = user["db"]
    dept = _get_dept_filter(user)

    wa = db.query(WeeklyAssessment).filter(WeeklyAssessment.id == assessment_id).first()
    if not wa:
        raise HTTPException(404, "Assessment not found")

    # 权限检查
    if dept:
        student = db.query(StudentInfo).filter(StudentInfo.student_id == wa.student_id).first()
        if student and student.department != dept:
            raise HTTPException(403, "No access to this assessment")

    student = db.query(StudentInfo).filter(StudentInfo.student_id == wa.student_id).first()

    result = {
        "id": wa.id,
        "student_id": wa.student_id,
        "student_name": student.name if student else "",
        "department": student.department if student else "",
        "gender": student.gender if student else "",
        "submit_date": wa.submit_date.isoformat() if wa.submit_date else None,
        "mood_score": wa.mood_score,
        "sleep_quality": wa.sleep_quality,
        "study_state": wa.study_state,
        "social_state": wa.social_state,
        "life_satisfaction": wa.life_satisfaction,
        "overall_score": wa.overall_score,
        "message": wa.message,
        "ai_reply": wa.ai_reply,
        "counselor_reply": wa.counselor_reply,
    }

    # 如果有留言，自动进行NLP分析
    if wa.message and wa.message.strip():
        try:
            from app.services.nlp_service import PsychAssessmentEngine
            engine = PsychAssessmentEngine()
            nlp_result = engine.full_analysis(wa.message)
            result["nlp_analysis"] = nlp_result
        except Exception as e:
            result["nlp_analysis"] = {"error": str(e)}

    return result


class CounselorReplyRequest(BaseModel):
    reply: str = Field(..., min_length=1, max_length=1000)


@router.post("/weekly-assessments/{assessment_id}/reply")
def reply_weekly_assessment(
    assessment_id: int,
    req: CounselorReplyRequest,
    user: dict = Depends(require_role("counselor")),
):
    """辅导员回复学生每周测评留言"""

    db = user["db"]
    dept = _get_dept_filter(user)

    wa = db.query(WeeklyAssessment).filter(WeeklyAssessment.id == assessment_id).first()
    if not wa:
        raise HTTPException(404, "Assessment not found")

    if dept:
        student = db.query(StudentInfo).filter(StudentInfo.student_id == wa.student_id).first()
        if student and student.department != dept:
            raise HTTPException(403, "No access to this assessment")

    wa.counselor_reply = req.reply
    db.commit()
    return {"status": "ok", "message": "Reply saved"}


@router.post("/weekly-assessments/{assessment_id}/analyze")
def analyze_weekly_message(
    assessment_id: int,
    user: dict = Depends(require_role("counselor")),
):
    """对学生的每周测评留言进行NLP分析"""

    db = user["db"]
    dept = _get_dept_filter(user)

    wa = db.query(WeeklyAssessment).filter(WeeklyAssessment.id == assessment_id).first()
    if not wa:
        raise HTTPException(404, "Assessment not found")

    if dept:
        student = db.query(StudentInfo).filter(StudentInfo.student_id == wa.student_id).first()
        if student and student.department != dept:
            raise HTTPException(403, "No access to this assessment")

    if not wa.message or not wa.message.strip():
        raise HTTPException(400, "No message to analyze")

    try:
        from app.services.nlp_service import PsychAssessmentEngine
        engine = PsychAssessmentEngine()
        result = engine.full_analysis(wa.message)
        return result
    except Exception as e:
        raise HTTPException(500, f"NLP analysis failed: {str(e)}")


@router.get("/weekly-assessments/stats")
def get_weekly_assessment_stats(
    user: dict = Depends(require_role("counselor")),
):
    """每周测评统计概览"""

    db = user["db"]
    dept = _get_dept_filter(user)

    base_q = db.query(WeeklyAssessment).join(
        StudentInfo, WeeklyAssessment.student_id == StudentInfo.student_id
    )
    if dept:
        base_q = base_q.filter(StudentInfo.department == dept)

    total = base_q.count()
    with_message = base_q.filter(WeeklyAssessment.message.isnot(None)).filter(WeeklyAssessment.message != "").count()
    replied = base_q.filter(WeeklyAssessment.counselor_reply.isnot(None)).filter(WeeklyAssessment.counselor_reply != "").count()
    unreplied = with_message - replied

    # 最近7天的提交数
    week_ago = date.today() - timedelta(days=7)
    recent = base_q.filter(WeeklyAssessment.submit_date >= week_ago.isoformat()).count()

    return {
        "total": total,
        "with_message": with_message,
        "replied": replied,
        "unreplied": unreplied,
        "recent_7days": recent,
    }


# ── Counselor Reports ──────────────────────────────────────

class ReportCreateRequest(BaseModel):
    overall_status: str = Field(..., min_length=1, max_length=2000)
    abnormal_cases: str = Field("", max_length=2000)
    key_students: str = Field("", max_length=2000)
    report_week: str = Field("", max_length=10)


def _current_week_label() -> str:
    """返回当前周标签，如 '2026-W25'"""
    from datetime import date
    d = date.today()
    return f"{d.isocalendar()[0]}-W{d.isocalendar()[1]:02d}"


@router.post("/reports")
def create_report(
    req: ReportCreateRequest,
    user: dict = Depends(require_role("counselor")),
):
    """辅导员提交每周汇报"""
    db = user["db"]
    week = req.report_week or _current_week_label()

    report = CounselorReport(
        counselor_id=int(user["user_id"]),
        department=user.get("department", ""),
        report_week=week,
        overall_status=req.overall_status,
        abnormal_cases=req.abnormal_cases,
        key_students=req.key_students,
    )
    db.add(report)
    db.commit()
    return {"status": "ok", "message": "汇报提交成功", "id": report.id}


@router.get("/reports", response_model=PaginatedResponse)
def list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    report_week: str = "",
    user: dict = Depends(require_role("counselor")),
):
    """获取汇报列表（admin看全部，普通辅导员看本院系）"""
    db = user["db"]
    dept = _get_dept_filter(user)

    q = db.query(
        CounselorReport.id,
        CounselorReport.counselor_id,
        CounselorReport.department,
        CounselorReport.report_week,
        CounselorReport.overall_status,
        CounselorReport.abnormal_cases,
        CounselorReport.key_students,
        CounselorReport.created_at,
    )
    if dept:
        q = q.filter(CounselorReport.department == dept)
    if report_week:
        q = q.filter(CounselorReport.report_week == report_week)

    total = q.count()
    rows = q.order_by(CounselorReport.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    items = []
    for r in rows:
        items.append({
            "id": r.id,
            "counselor_id": r.counselor_id,
            "department": r.department,
            "report_week": r.report_week,
            "overall_status": r.overall_status,
            "abnormal_cases": r.abnormal_cases,
            "key_students": r.key_students,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/reports/latest")
def get_latest_reports(user: dict = Depends(require_role("counselor"))):
    """获取各院系最新一条汇报（Dashboard展示用）"""
    db = user["db"]
    dept = _get_dept_filter(user)

    # 每个院系取最新一条
    q = db.execute(text("""
        SELECT cr.id, cr.department, cr.report_week, cr.overall_status,
               cr.abnormal_cases, cr.key_students, cr.created_at, cu.display_name
        FROM counselor_report cr
        JOIN counselor_user cu ON cr.counselor_id = cu.id
        INNER JOIN (
            SELECT department, MAX(id) AS max_id
            FROM counselor_report
            GROUP BY department
        ) latest ON cr.id = latest.max_id
        ORDER BY cr.created_at DESC
    """))

    items = []
    for r in q.fetchall():
        if dept and r[1] != dept:
            continue
        items.append({
            "id": r[0],
            "department": r[1],
            "report_week": r[2],
            "overall_status": r[3],
            "abnormal_cases": r[4],
            "key_students": r[5],
            "created_at": r[6].isoformat() if r[6] else None,
            "counselor_name": r[7],
        })

    return items
