from pydantic import BaseModel


class OverviewStats(BaseModel):
    total_students: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    avg_stress: float
    depression_rate: float


class DepartmentStats(BaseModel):
    department: str
    student_count: int
    avg_stress: float
    avg_cgpa: float
    depression_rate: float
    high_risk_count: int


class TrendPoint(BaseModel):
    week: str
    avg_stress: float
    depression_count: int


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int
