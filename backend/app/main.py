import time
from collections import defaultdict
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base
from app.core.logging_config import setup_logging
from app.api import auth, student, counselor


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    Base.metadata.create_all(bind=engine)
    # Create views and indexes for performance
    from sqlalchemy import text
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE VIEW IF NOT EXISTS v_latest_assessment AS
            SELECT ma.*
            FROM mental_assessment ma
            INNER JOIN (
                SELECT student_id, MAX(assessment_date) AS max_date
                FROM mental_assessment
                GROUP BY student_id
            ) latest ON ma.student_id = latest.student_id AND ma.assessment_date = latest.max_date
        """))
        conn.execute(text("""
            CREATE VIEW IF NOT EXISTS v_student_behavior_summary AS
            SELECT
                bl.student_id, si.name, si.department,
                ROUND(AVG(bl.stress_level), 2) AS avg_stress,
                ROUND(AVG(bl.sleep_duration), 2) AS avg_sleep,
                ROUND(AVG(bl.social_media_hours), 2) AS avg_social,
                ROUND(AVG(bl.physical_activity), 2) AS avg_activity,
                COUNT(*) AS record_count
            FROM behavior_log bl
            JOIN student_info si ON bl.student_id = si.student_id
            GROUP BY bl.student_id, si.name, si.department
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_assess_student_date_desc ON mental_assessment(student_id, assessment_date DESC)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_behavior_student_date_desc ON behavior_log(student_id, record_date DESC)"))
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS trg_high_risk_alert
            AFTER INSERT ON mental_assessment
            WHEN NEW.risk_level = 'high'
            BEGIN
                INSERT OR REPLACE INTO risk_notification (student_id, risk_level, message, is_read, created_at)
                VALUES (NEW.student_id, NEW.risk_level,
                        'Student ' || NEW.student_id || ' assessed as HIGH risk on ' || NEW.assessment_date,
                        0, CURRENT_TIMESTAMP);
            END
        """))
        # Backfill existing high-risk assessments into risk_notification (one per student, latest only)
        existing = conn.execute(text("SELECT COUNT(*) FROM risk_notification")).scalar()
        if existing == 0:
            conn.execute(text("""
                INSERT INTO risk_notification (student_id, risk_level, message, is_read, created_at)
                SELECT ma.student_id, ma.risk_level,
                       'Student ' || ma.student_id || ' assessed as HIGH risk on ' || ma.assessment_date,
                       0, ma.created_at
                FROM mental_assessment ma
                INNER JOIN (
                    SELECT student_id, MAX(assessment_date) AS max_date
                    FROM mental_assessment
                    WHERE risk_level = 'high'
                    GROUP BY student_id
                ) latest ON ma.student_id = latest.student_id AND ma.assessment_date = latest.max_date
                WHERE ma.risk_level = 'high'
            """))
    yield


request_metrics: dict = defaultdict(lambda: {"count": 0, "total_ms": 0.0})


app = FastAPI(
    title="Mental Health Monitor API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(student.router, prefix="/api/student", tags=["Student"])
app.include_router(counselor.router, prefix="/api/counselor", tags=["Counselor"])


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start) * 1000
    path = request.url.path
    request_metrics[path]["count"] += 1
    request_metrics[path]["total_ms"] += duration_ms
    return response


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/metrics")
def metrics():
    return {
        path: {"count": m["count"], "avg_ms": round(m["total_ms"] / m["count"], 2)}
        for path, m in request_metrics.items()
    }
