import time
from collections import defaultdict
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base, is_sqlite
from app.core.logging_config import setup_logging
from app.api import auth, student, counselor


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    Base.metadata.create_all(bind=engine)

    from sqlalchemy import text
    with engine.begin() as conn:
        # 创建索引
        for idx_sql in [
            "CREATE INDEX IF NOT EXISTS idx_assess_student_date_desc ON mental_assessment(student_id, assessment_date DESC)",
            "CREATE INDEX IF NOT EXISTS idx_behavior_student_date_desc ON behavior_log(student_id, record_date DESC)",
        ]:
            try:
                conn.execute(text(idx_sql))
            except Exception:
                pass  # 索引已存在

        if is_sqlite():
            # SQLite 视图和触发器
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
                SELECT bl.student_id, si.name, si.department,
                       ROUND(AVG(bl.stress_level), 2) AS avg_stress,
                       ROUND(AVG(bl.sleep_duration), 2) AS avg_sleep,
                       ROUND(AVG(bl.social_media_hours), 2) AS avg_social,
                       ROUND(AVG(bl.physical_activity), 2) AS avg_activity,
                       COUNT(*) AS record_count
                FROM behavior_log bl
                JOIN student_info si ON bl.student_id = si.student_id
                GROUP BY bl.student_id, si.name, si.department
            """))
        else:
            # MySQL 视图（先删除再创建）
            conn.execute(text("DROP VIEW IF EXISTS v_latest_assessment"))
            conn.execute(text("""
                CREATE VIEW v_latest_assessment AS
                SELECT ma.*
                FROM mental_assessment ma
                INNER JOIN (
                    SELECT student_id, MAX(assessment_date) AS max_date
                    FROM mental_assessment
                    GROUP BY student_id
                ) latest ON ma.student_id = latest.student_id AND ma.assessment_date = latest.max_date
            """))
            conn.execute(text("DROP VIEW IF EXISTS v_student_behavior_summary"))
            conn.execute(text("""
                CREATE VIEW v_student_behavior_summary AS
                SELECT bl.student_id, si.name, si.department,
                       ROUND(AVG(bl.stress_level), 2) AS avg_stress,
                       ROUND(AVG(bl.sleep_duration), 2) AS avg_sleep,
                       ROUND(AVG(bl.social_media_hours), 2) AS avg_social,
                       ROUND(AVG(bl.physical_activity), 2) AS avg_activity,
                       COUNT(*) AS record_count
                FROM behavior_log bl
                JOIN student_info si ON bl.student_id = si.student_id
                GROUP BY bl.student_id, si.name, si.department
            """))

        # 回填高风险预警通知
        existing = conn.execute(text("SELECT COUNT(*) FROM risk_notification")).scalar()
        if existing == 0:
            if is_sqlite():
                conn.execute(text("""
                    INSERT OR IGNORE INTO risk_notification (student_id, risk_level, message, is_read, created_at)
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
            else:
                conn.execute(text("""
                    INSERT IGNORE INTO risk_notification (student_id, risk_level, message, is_read, created_at)
                    SELECT ma.student_id, ma.risk_level,
                           CONCAT('Student ', ma.student_id, ' assessed as HIGH risk on ', ma.assessment_date),
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
