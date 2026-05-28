from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey, func
from app.core.database import Base


class RiskNotification(Base):
    __tablename__ = "risk_notification"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(20), ForeignKey("student_info.student_id", ondelete="CASCADE"), nullable=False)
    risk_level = Column(String(10), nullable=False)
    message = Column(Text)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.current_timestamp())
