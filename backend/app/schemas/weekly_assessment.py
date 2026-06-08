from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


class WeeklyAssessmentCreate(BaseModel):
    """学生提交每周心理测评的请求体"""
    mood_score: int = Field(ge=1, le=5, description="情绪状态 (1-5)")
    sleep_quality: int = Field(ge=1, le=5, description="睡眠质量 (1-5)")
    study_state: int = Field(ge=1, le=5, description="学习状态 (1-5)")
    social_state: int = Field(ge=1, le=5, description="社交状态 (1-5)")
    life_satisfaction: int = Field(ge=1, le=5, description="生活满意度 (1-5)")
    message: Optional[str] = Field(None, max_length=500, description="留言 (可选)")


class WeeklyAssessmentOut(BaseModel):
    """每周测评记录输出"""
    id: int
    student_id: str
    submit_date: date
    mood_score: int
    sleep_quality: int
    study_state: int
    social_state: int
    life_satisfaction: int
    overall_score: float
    message: Optional[str] = None
    counselor_reply: Optional[str] = None
    created_at: date

    model_config = {"from_attributes": True}


class WeeklyAssessmentLatestOut(BaseModel):
    """最新测评记录输出 (用于首页展示)"""
    submit_date: date
    mood_score: int
    sleep_quality: int
    study_state: int
    social_state: int
    life_satisfaction: int
    overall_score: float
    message: Optional[str] = None
    counselor_reply: Optional[str] = None
