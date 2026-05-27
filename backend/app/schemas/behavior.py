from datetime import date
from pydantic import BaseModel


class BehaviorLogOut(BaseModel):
    id: int
    student_id: str
    record_date: date
    sleep_duration: float
    study_hours: float
    social_media_hours: float
    physical_activity: int
    stress_level: int

    model_config = {"from_attributes": True}


class BehaviorTrendPoint(BaseModel):
    week: str
    avg_stress: float
    avg_sleep: float
    avg_study: float
    avg_social: float
    avg_activity: float


class BehaviorLatestOut(BaseModel):
    sleep_duration: float
    study_hours: float
    social_media_hours: float
    physical_activity: int
    stress_level: int
    record_date: date
