from sqlalchemy import Column, String, Integer, Float, DateTime, func
from app.core.database import Base


class StudentInfo(Base):
    __tablename__ = "student_info"

    student_id = Column(String(20), primary_key=True)
    name = Column(String(50), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(10), nullable=False)
    department = Column(String(50), nullable=False)
    cgpa = Column(Float, nullable=False)
    password_hash = Column(String(128), nullable=False)
    created_at = Column(DateTime, server_default=func.current_timestamp())
