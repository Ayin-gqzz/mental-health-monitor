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
        # 创建索引 — 覆盖索引让 MAX(id) GROUP BY student_id 走索引不扫全表
        # 自动迁移：给 behavior_log / mental_assessment 加 year_week 列（如果还没有）
        def _col_exists(table, col):
            if is_sqlite():
                return any(r[1] == col for r in conn.execute(text(f"PRAGMA table_info({table})")).fetchall())
            return len(conn.execute(text(
                f"SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='{table}' AND COLUMN_NAME='{col}'"
            )).fetchall()) > 0

        for table, date_col in [("behavior_log", "record_date"), ("mental_assessment", "assessment_date")]:
            if not _col_exists(table, "year_week"):
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN year_week VARCHAR(10) NOT NULL DEFAULT ''"))
                wk = "strftime('%Y-W%W', {})" if is_sqlite() else "DATE_FORMAT({}, '%x-W%v')"
                conn.execute(text(f"UPDATE {table} SET year_week = {wk.format(date_col)}"))
                print(f"[migrate] Added year_week to {table} and backfilled.")

        # 辅导员权限：给 counselor_user 表加 department 和 is_admin 列
        if not _col_exists("counselor_user", "department"):
            conn.execute(text("ALTER TABLE counselor_user ADD COLUMN department VARCHAR(50) NOT NULL DEFAULT ''"))
            print("[migrate] Added department to counselor_user.")
        if not _col_exists("counselor_user", "is_admin"):
            conn.execute(text("ALTER TABLE counselor_user ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0"))
            print("[migrate] Added is_admin to counselor_user.")
        # 将默认辅导员账号设为 admin
        conn.execute(text("UPDATE counselor_user SET is_admin = 1 WHERE username = 'counselor'"))

        for idx_sql in [
            # 已有的索引
            "CREATE INDEX IF NOT EXISTS idx_assess_student_date_desc ON mental_assessment(student_id, assessment_date DESC)",
            "CREATE INDEX IF NOT EXISTS idx_behavior_student_date_desc ON behavior_log(student_id, record_date DESC)",
            # 覆盖索引：MAX(id) GROUP BY student_id 模式（所有统计接口的核心模式）
            "CREATE INDEX IF NOT EXISTS idx_behavior_id_student ON behavior_log(id, student_id)",
            "CREATE INDEX IF NOT EXISTS idx_assess_id_student ON mental_assessment(id, student_id)",
            # trends 查询：先按日期过滤再聚合
            "CREATE INDEX IF NOT EXISTS idx_behavior_date_stress ON behavior_log(record_date, stress_level)",
            "CREATE INDEX IF NOT EXISTS idx_assess_date_depression ON mental_assessment(assessment_date, depression_predicted)",
            # alerts 查询
            "CREATE INDEX IF NOT EXISTS idx_notification_risk_read ON risk_notification(risk_level, is_read, created_at DESC)",
            # assess_all 窗口函数
            "CREATE INDEX IF NOT EXISTS idx_behavior_student_id_date_desc ON behavior_log(student_id, id DESC)",
            "CREATE INDEX IF NOT EXISTS idx_assess_student_id_date_desc ON mental_assessment(student_id, id DESC)",
            # year_week 预计算周标签（trends 查询核心索引）
            "CREATE INDEX IF NOT EXISTS idx_behavior_year_week ON behavior_log(year_week)",
            "CREATE INDEX IF NOT EXISTS idx_assess_year_week ON mental_assessment(year_week)",
            # trends 覆盖索引：WHERE record_date >= ? + GROUP BY year_week + AVG(stress_level) 全部走索引
            "CREATE INDEX IF NOT EXISTS idx_trends_cover ON behavior_log(record_date, year_week, stress_level)",
            "CREATE INDEX IF NOT EXISTS idx_assess_trends_cover ON mental_assessment(assessment_date, year_week, depression_predicted)",
            # student_latest_stats 按院系过滤（统计检验 + 聚类分析）
            "CREATE INDEX IF NOT EXISTS idx_sls_dept ON student_latest_stats(department)",
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

        # 预聚合表：首次启动或数据不完整时刷新（之后查询直接读预聚合表，毫秒级）
        _need_refresh = False
        try:
            _wbs = conn.execute(text("SELECT COUNT(*) FROM weekly_behavior_stats")).scalar()
            _sls = conn.execute(text("SELECT COUNT(*) FROM student_latest_stats")).scalar()
            _need_refresh = (_wbs == 0 or _sls == 0)
        except Exception:
            _need_refresh = True
        if _need_refresh:
            # 确保 behavior_log 和 mental_assessment 有数据才刷新
            _bl_count = conn.execute(text("SELECT COUNT(*) FROM behavior_log")).scalar()
            if _bl_count > 0:
                print("[startup] Refreshing pre-agg tables (first run, ~30s)...")
                from scripts.refresh_weekly_stats import refresh_all
                refresh_all(conn=conn)
                print("[startup] Pre-agg tables ready.")

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
