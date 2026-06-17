from sqlalchemy import Column, String, Integer, Boolean, DateTime, func
from app.core.database import Base


class CounselorUser(Base):
    __tablename__ = "counselor_user"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(128), nullable=False)
    display_name = Column(String(50), nullable=False)
    department = Column(String(50), nullable=False, default="")
    is_admin = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.current_timestamp())
