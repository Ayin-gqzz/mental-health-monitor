from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, func
from app.core.database import Base


class CounselorReport(Base):
    __tablename__ = "counselor_report"

    id = Column(Integer, primary_key=True, autoincrement=True)
    counselor_id = Column(Integer, ForeignKey("counselor_user.id", ondelete="CASCADE"), nullable=False)
    department = Column(String(50), nullable=False)
    report_week = Column(String(10), nullable=False)
    overall_status = Column(Text, nullable=False)
    abnormal_cases = Column(Text)
    key_students = Column(Text)
    created_at = Column(DateTime, server_default=func.current_timestamp())
