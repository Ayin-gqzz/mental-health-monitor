import math
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func

from app.core.security import require_role
from app.core.database import week_label
from app.models.student import StudentInfo
from app.models.behavior import BehaviorLog
from app.models.assessment import MentalAssessment
from app.models.weekly_assessment import WeeklyAssessment
from app.schemas.student import StudentInfoOut, StudentInfoUpdate
from app.schemas.behavior import BehaviorLogOut, BehaviorTrendPoint, BehaviorLatestOut
from app.schemas.assessment import AssessmentOut, AssessmentLatestOut
from app.schemas.weekly_assessment import WeeklyAssessmentCreate, WeeklyAssessmentOut, WeeklyAssessmentLatestOut
from app.schemas.statistics import PaginatedResponse

router = APIRouter(dependencies=[Depends(require_role("student"))])


def _student_id(user: dict) -> str:
    return user["user_id"]


@router.get("/profile", response_model=StudentInfoOut)
def get_profile(user: dict = Depends(require_role("student"))):
    db = user["db"]
    s = db.query(StudentInfo).filter(StudentInfo.student_id == _student_id(user)).first()
    if not s:
        raise HTTPException(404, "Student not found")
    return s


@router.put("/profile", response_model=StudentInfoOut)
def update_profile(req: StudentInfoUpdate, user: dict = Depends(require_role("student"))):
    db = user["db"]
    s = db.query(StudentInfo).filter(StudentInfo.student_id == _student_id(user)).first()
    if not s:
        raise HTTPException(404, "Student not found")
    if req.name is not None:
        s.name = req.name
    if req.age is not None:
        s.age = req.age
    if req.cgpa is not None:
        s.cgpa = req.cgpa
    db.commit()
    db.refresh(s)
    return s


@router.get("/behavior", response_model=PaginatedResponse)
def get_behavior(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    date_from: str | None = None,
    date_to: str | None = None,
    user: dict = Depends(require_role("student")),
):
    db = user["db"]
    q = db.query(BehaviorLog).filter(BehaviorLog.student_id == _student_id(user))
    if date_from:
        q = q.filter(BehaviorLog.record_date >= date_from)
    if date_to:
        q = q.filter(BehaviorLog.record_date <= date_to)

    total = q.count()
    items = q.order_by(BehaviorLog.record_date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedResponse(
        items=[BehaviorLogOut.model_validate(b) for b in items],
        total=total, page=page, page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/behavior/latest", response_model=BehaviorLatestOut)
def get_latest_behavior(user: dict = Depends(require_role("student"))):
    db = user["db"]
    b = db.query(BehaviorLog).filter(
        BehaviorLog.student_id == _student_id(user)
    ).order_by(BehaviorLog.record_date.desc()).first()
    if not b:
        raise HTTPException(404, "No behavior data")
    return BehaviorLatestOut(
        sleep_duration=b.sleep_duration, study_hours=b.study_hours,
        social_media_hours=b.social_media_hours, physical_activity=b.physical_activity,
        stress_level=b.stress_level, record_date=b.record_date,
    )


@router.get("/behavior/trend", response_model=list[BehaviorTrendPoint])
def get_behavior_trend(user: dict = Depends(require_role("student"))):
    from sqlalchemy import text
    db = user["db"]
    sid = _student_id(user)
    end = date.today()
    start = end - timedelta(weeks=12)

    # 直接 GROUP BY 预计算的 year_week，不走函数
    rows = db.execute(text(
        "SELECT year_week, ROUND(AVG(stress_level), 2), ROUND(AVG(sleep_duration), 2), "
        "ROUND(AVG(study_hours), 2), ROUND(AVG(social_media_hours), 2), ROUND(AVG(physical_activity), 2) "
        "FROM behavior_log "
        "WHERE student_id = :sid AND record_date >= :start "
        "GROUP BY year_week ORDER BY year_week"
    ), {"sid": sid, "start": start.isoformat()}).fetchall()

    return [
        BehaviorTrendPoint(
            week=r[0], avg_stress=float(r[1]),
            avg_sleep=float(r[2]), avg_study=float(r[3]),
            avg_social=float(r[4]), avg_activity=float(r[5]),
        ) for r in rows
    ]


@router.get("/assessments", response_model=PaginatedResponse)
def get_assessments(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    user: dict = Depends(require_role("student")),
):
    db = user["db"]
    q = db.query(MentalAssessment).filter(MentalAssessment.student_id == _student_id(user))
    total = q.count()
    items = q.order_by(MentalAssessment.assessment_date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedResponse(
        items=[AssessmentOut.model_validate(a) for a in items],
        total=total, page=page, page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/assessments/latest", response_model=AssessmentLatestOut | dict)
def get_latest_assessment(user: dict = Depends(require_role("student"))):
    db = user["db"]
    a = db.query(MentalAssessment).filter(
        MentalAssessment.student_id == _student_id(user)
    ).order_by(MentalAssessment.assessment_date.desc()).first()
    if not a:
        return {}
    return AssessmentLatestOut(
        assessment_date=a.assessment_date,
        depression_predicted=a.depression_predicted,
        depression_probability=a.depression_probability,
        risk_level=a.risk_level,
        intervention_text=a.intervention_text,
        counselor_notes=a.counselor_notes,
    )


@router.get("/dashboard")
def get_dashboard(user: dict = Depends(require_role("student"))):
    db = user["db"]
    sid = _student_id(user)

    profile = db.query(StudentInfo).filter(StudentInfo.student_id == sid).first()
    latest_behavior = db.query(BehaviorLog).filter(
        BehaviorLog.student_id == sid
    ).order_by(BehaviorLog.record_date.desc()).first()
    latest_assessment = db.query(MentalAssessment).filter(
        MentalAssessment.student_id == sid
    ).order_by(MentalAssessment.assessment_date.desc()).first()
    latest_weekly = db.query(WeeklyAssessment).filter(
        WeeklyAssessment.student_id == sid
    ).order_by(WeeklyAssessment.submit_date.desc()).first()

    # Weekly trend — GROUP BY 预计算的 year_week
    from sqlalchemy import text
    end = date.today()
    start = end - timedelta(weeks=12)
    trend_rows = db.execute(text(
        "SELECT year_week, ROUND(AVG(stress_level), 2), ROUND(AVG(sleep_duration), 2) "
        "FROM behavior_log "
        "WHERE student_id = :sid AND record_date >= :start "
        "GROUP BY year_week ORDER BY year_week"
    ), {"sid": sid, "start": start.isoformat()}).fetchall()

    return {
        "profile": StudentInfoOut.model_validate(profile) if profile else None,
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
        "latest_weekly_assessment": WeeklyAssessmentLatestOut(
            submit_date=latest_weekly.submit_date,
            mood_score=latest_weekly.mood_score,
            sleep_quality=latest_weekly.sleep_quality,
            study_state=latest_weekly.study_state,
            social_state=latest_weekly.social_state,
            life_satisfaction=latest_weekly.life_satisfaction,
            overall_score=latest_weekly.overall_score,
            message=latest_weekly.message,
            counselor_reply=latest_weekly.counselor_reply,
        ) if latest_weekly else None,
        "trend": [
            {"week": r[0], "avg_stress": float(r[1]), "avg_sleep": float(r[2])}
            for r in trend_rows
        ],
    }


# ============================================================
# 每周心理测评接口
# ============================================================

@router.post("/weekly-assessments", response_model=WeeklyAssessmentOut)
def create_weekly_assessment(
    req: WeeklyAssessmentCreate,
    user: dict = Depends(require_role("student")),
):
    """提交每周心理测评"""
    db = user["db"]
    sid = _student_id(user)

    # 检查本周是否已提交
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    existing = db.query(WeeklyAssessment).filter(
        WeeklyAssessment.student_id == sid,
        WeeklyAssessment.submit_date >= week_start.isoformat(),
    ).first()
    if existing:
        raise HTTPException(400, "本周已提交过测评，请下周再试")

    # 计算综合得分 (加权平均)
    overall = round(
        req.mood_score * 0.25 +
        req.sleep_quality * 0.20 +
        req.study_state * 0.20 +
        req.social_state * 0.15 +
        req.life_satisfaction * 0.20,
        2,
    )

    # 如果有留言，自动计算 NLP 情感分
    sentiment_score = None
    if req.message and req.message.strip():
        try:
            from app.services.nlp_service import PsychAssessmentEngine
            engine = PsychAssessmentEngine()
            sentiment_score = engine.analyze_sentiment(req.message)
        except Exception:
            pass

    record = WeeklyAssessment(
        student_id=sid,
        mood_score=req.mood_score,
        sleep_quality=req.sleep_quality,
        study_state=req.study_state,
        social_state=req.social_state,
        life_satisfaction=req.life_satisfaction,
        overall_score=overall,
        message=req.message,
        sentiment_score=sentiment_score,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/weekly-assessments", response_model=PaginatedResponse)
def get_weekly_assessments(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    user: dict = Depends(require_role("student")),
):
    """获取每周测评历史"""
    db = user["db"]
    q = db.query(WeeklyAssessment).filter(WeeklyAssessment.student_id == _student_id(user))
    total = q.count()
    items = q.order_by(WeeklyAssessment.submit_date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedResponse(
        items=[WeeklyAssessmentOut.model_validate(a) for a in items],
        total=total, page=page, page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/weekly-assessments/latest", response_model=WeeklyAssessmentLatestOut | dict)
def get_latest_weekly_assessment(user: dict = Depends(require_role("student"))):
    """获取最新一次每周测评"""
    db = user["db"]
    a = db.query(WeeklyAssessment).filter(
        WeeklyAssessment.student_id == _student_id(user)
    ).order_by(WeeklyAssessment.submit_date.desc()).first()
    if not a:
        return {}
    return WeeklyAssessmentLatestOut(
        submit_date=a.submit_date,
        mood_score=a.mood_score,
        sleep_quality=a.sleep_quality,
        study_state=a.study_state,
        social_state=a.social_state,
        life_satisfaction=a.life_satisfaction,
        overall_score=a.overall_score,
        message=a.message,
        counselor_reply=a.counselor_reply,
    )


@router.get("/weekly-assessments/can-submit")
def can_submit_weekly(user: dict = Depends(require_role("student"))):
    """检查本周是否可以提交"""
    db = user["db"]
    sid = _student_id(user)
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    existing = db.query(WeeklyAssessment).filter(
        WeeklyAssessment.student_id == sid,
        WeeklyAssessment.submit_date >= week_start.isoformat(),
    ).first()
    return {"can_submit": existing is None, "submitted": existing is not None}
