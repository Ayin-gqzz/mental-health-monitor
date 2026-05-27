from sqlalchemy import Column, String, Integer, DateTime, func
from app.core.database import Base


class CounselorUser(Base):
    __tablename__ = "counselor_user"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(128), nullable=False)
    display_name = Column(String(50), nullable=False)
    created_at = Column(DateTime, server_default=func.current_timestamp())
