import logging
import time

from sqlalchemy import create_engine, event, func, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool

from app.core.config import settings

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

if _is_sqlite:
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_recycle=3600,
        echo=False,
    )

db_logger = logging.getLogger("db.query")


@event.listens_for(engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info["query_start_time"] = time.time()


@event.listens_for(engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    start = conn.info.get("query_start_time")
    if start:
        duration_ms = (time.time() - start) * 1000
        if duration_ms > 100:
            db_logger.warning(f"Slow query ({duration_ms:.1f}ms): {statement[:200]}")


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def is_sqlite():
    """返回当前是否使用 SQLite"""
    return _is_sqlite


def week_label(column):
    """跨数据库的周标签函数：SQLite 用 strftime，MySQL 用 DATE_FORMAT"""
    if _is_sqlite:
        return func.strftime("%Y-W%W", column).label("week")
    else:
        return func.date_format(column, "%x-W%v").label("week")


def today_expr():
    """跨数据库的今日日期表达式（用于 server_default）"""
    if _is_sqlite:
        return text("(date('now'))")
    else:
        return text("(CURDATE())")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
