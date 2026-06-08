from sqlalchemy import Column, String, Integer, Float, Date, DateTime, ForeignKey, func, text
from app.core.database import Base, today_expr


class BehaviorLog(Base):
    __tablename__ = "behavior_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(20), ForeignKey("student_info.student_id", ondelete="CASCADE"), nullable=False)
    record_date = Column(Date, nullable=False, server_default=today_expr())
    year_week = Column(String(10), nullable=False, index=True, comment="预计算的周标签，如 2026-W23")
    sleep_duration = Column(Float, nullable=False)
    study_hours = Column(Float, nullable=False)
    social_media_hours = Column(Float, nullable=False)
    physical_activity = Column(Integer, nullable=False)
    stress_level = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.current_timestamp())
