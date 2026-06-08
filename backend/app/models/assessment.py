from sqlalchemy import Column, String, Integer, Float, Boolean, Date, DateTime, Text, ForeignKey, func, text
from app.core.database import Base, today_expr


class MentalAssessment(Base):
    __tablename__ = "mental_assessment"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(20), ForeignKey("student_info.student_id", ondelete="CASCADE"), nullable=False)
    assessment_date = Column(Date, nullable=False, server_default=today_expr())
    depression_predicted = Column(Boolean, nullable=False)
    depression_probability = Column(Float, nullable=False)
    risk_level = Column(String(10), nullable=False)
    intervention_text = Column(Text)
    counselor_notes = Column(Text)
    created_at = Column(DateTime, server_default=func.current_timestamp())
