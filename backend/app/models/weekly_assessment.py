from sqlalchemy import Column, String, Integer, Float, Date, DateTime, Text, ForeignKey, func, text
from app.core.database import Base, today_expr


class WeeklyAssessment(Base):
    """学生每周主动提交的心理测评"""
    __tablename__ = "weekly_assessment"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(20), ForeignKey("student_info.student_id", ondelete="CASCADE"), nullable=False)
    submit_date = Column(Date, nullable=False, server_default=today_expr())

    # 心理测评量表 (1-5 分，1=非常不好，5=非常好)
    mood_score = Column(Integer, nullable=False)           # 情绪状态
    sleep_quality = Column(Integer, nullable=False)        # 睡眠质量
    study_state = Column(Integer, nullable=False)          # 学习状态
    social_state = Column(Integer, nullable=False)         # 社交状态
    life_satisfaction = Column(Integer, nullable=False)    # 生活满意度
    overall_score = Column(Float, nullable=False)          # 综合得分 (自动计算)

    # 留言
    message = Column(Text, nullable=True)                  # 学生留言
    counselor_reply = Column(Text, nullable=True)          # 辅导员回复
    sentiment_score = Column(Float, nullable=True)         # NLP 情感得分 (0.0消极 ~ 1.0积极)

    created_at = Column(DateTime, server_default=func.current_timestamp())
