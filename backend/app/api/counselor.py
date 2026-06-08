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
    from app.services.ml_service import MLService
    from app.services.suggestion_service import generate_suggestion

    try:
        ml = MLService()
        has_model = True
    except FileNotFoundError:
        has_model = False

    # 一次查询拿到所有学生 + 最新行为，避免 N+1（原方案10万次单条查询）
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
    if _overview_cache["data"] and _time.time() - _overview_cache["timestamp"] < 600:
        return _overview_cache["data"]

    db = user["db"]

    # 单条SQL拿学生总数 + 风险分布 + 抑郁人数，避免4次独立全表扫描
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
    _overview_cache["data"] = result
    _overview_cache["timestamp"] = _time.time()
    return result


@router.get("/statistics/departments", response_model=list[DepartmentStats])
def get_department_stats(user: dict = Depends(require_role("counselor"))):
    db = user["db"]

    # 查询1: 学生基础统计（人数 + 平均绩点）
    dept_info = db.execute(text(
        "SELECT department, COUNT(*) AS cnt, ROUND(AVG(cgpa), 2) AS avg_cgpa "
        "FROM student_info GROUP BY department"
    )).fetchall()
    dept_map = {r[0]: {"count": r[1], "avg_cgpa": r[2]} for r in dept_info}

    # 查询2: 用一条SQL拿院系维度的 最新风险分布 + 抑郁人数 + 平均压力
    #        避免原来 3 条独立SQL各扫一遍 behavior_log (130万行) + v_latest_assessment
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

    # 查询3: 从预聚合表读每院系平均压力（不扫130万行）
    stress_rows = db.execute(text(
        "SELECT department, avg_stress FROM weekly_behavior_stats "
        "WHERE department != '__ALL__' GROUP BY department"
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
    cache_key = f"trends_{department}"
    if cache_key in _trends_cache and _time.time() - _trends_cache[cache_key]["time"] < 1800:
        return _trends_cache[cache_key]["data"]

    db = user["db"]

    # 直接读预聚合表（~60行，毫秒级），不扫百万行原始数据
    dept_filter = department if department else "__ALL__"
    stress_rows = db.execute(text(
        "SELECT year_week, avg_stress FROM weekly_behavior_stats "
        "WHERE department = :dept ORDER BY year_week"
    ), {"dept": dept_filter}).fetchall()

    dep_rows = db.execute(text(
        "SELECT year_week, depression_count FROM weekly_depression_stats "
        "WHERE department = :dept ORDER BY year_week"
    ), {"dept": dept_filter}).fetchall()

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


# ── Statistical analysis（共享基础数据缓存，只查一次百万行）────────

_stat_base_cache = {"data": None, "timestamp": 0}
_STAT_TTL = 1800  # 30 分钟


def _get_stat_base(db):
    """获取统计检验的基础数据：从预聚合表 student_latest_stats 读（10万行，毫秒级）"""
    import time as _t
    if _stat_base_cache["data"] is not None and _t.time() - _stat_base_cache["timestamp"] < _STAT_TTL:
        return _stat_base_cache["data"]

    rows = db.execute(text(
        "SELECT student_id, stress_level, sleep_duration, study_hours, "
        "social_media_hours, physical_activity, "
        "risk_level, depression_predicted, depression_probability, gender "
        "FROM student_latest_stats"
    )).fetchall()

    _stat_base_cache["data"] = rows
    _stat_base_cache["timestamp"] = _t.time()
    return rows


@router.get("/statistics/t-test", response_model=list[TTestResult])
def run_t_tests(user: dict = Depends(require_role("counselor"))):
    from scipy import stats
    rows = _get_stat_base(user["db"])

    # (student_id, stress, sleep, study, social, activity, risk_level, dep_pred, dep_prob, gender)
    high = [r for r in rows if r[6] == "high"]
    low = [r for r in rows if r[6] == "low"]

    metrics = [
        ("stress_level", "压力水平", lambda r: r[1]),
        ("sleep_duration", "睡眠时长", lambda r: r[2]),
        ("study_hours", "学习时长", lambda r: r[3]),
        ("social_media_hours", "社交媒体时长", lambda r: r[4]),
        ("physical_activity", "运动时长", lambda r: r[5]),
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
    from scipy import stats
    rows = _get_stat_base(user["db"])

    # gender=r[9], depression_predicted=r[7]
    table = [[0, 0], [0, 0]]
    for r in rows:
        row_idx = 0 if r[9] == "Male" else 1
        col_idx = 1 if r[7] else 0
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
    from scipy import stats
    rows = _get_stat_base(user["db"])

    # stress=r[1], sleep=r[2], social=r[4], depression_predicted=r[7]
    depression = [1 if r[7] else 0 for r in rows]

    variables = [
        ("stress_level", "压力水平", [r[1] for r in rows]),
        ("sleep_duration", "睡眠时长", [r[2] for r in rows]),
        ("social_media_hours", "社交媒体时长", [r[4] for r in rows]),
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

    # 从预聚合表读（10万行，毫秒级），不扫130万行原始数据
    rows = db.execute(text(
        "SELECT student_id, stress_level, sleep_duration, study_hours, "
        "social_media_hours, physical_activity, risk_level, gender "
        "FROM student_latest_stats"
    )).fetchall()

    if len(rows) < 10:
        raise HTTPException(400, "数据不足，至少需要10条行为记录")

    # rows: (student_id, stress, sleep, study, social, activity, risk_level, gender)
    student_ids = [r[0] for r in rows]
    X = np.array([
        [r[1], r[2], r[3], r[4], r[5]]
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

    # risk 和 gender 已经在 rows 里了（r[6]=risk_level, r[7]=gender），不需要额外查询
    risk_map = {r[0]: (r[6] or "none") for r in rows}
    gender_map = {r[0]: r[7] for r in rows}

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

    # 只跑优化版本，不再故意执行慢查询（关联子查询在130万行上会锁表）
    fast_sql = """
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
    GROUP BY si.department
    ORDER BY high_risk_count DESC
    """

    t0 = time.time()
    result = db.execute(text(fast_sql)).fetchall()
    query_time = round((time.time() - t0) * 1000, 2)

    return {
        "optimized_query_ms": query_time,
        "data": [
            {"department": r[0], "total_students": r[1], "avg_stress": r[2],
             "avg_sleep": r[3], "high_risk_count": r[4]}
            for r in result
        ],
    }
