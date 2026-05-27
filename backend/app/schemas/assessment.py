from datetime import date
from pydantic import BaseModel


class AssessmentOut(BaseModel):
    id: int
    assessment_date: date
    depression_predicted: bool
    depression_probability: float
    risk_level: str
    intervention_text: str | None
    counselor_notes: str | None

    model_config = {"from_attributes": True}


class AssessmentLatestOut(BaseModel):
    assessment_date: date
    depression_predicted: bool
    depression_probability: float
    risk_level: str
    intervention_text: str | None
    counselor_notes: str | None


class CounselorNotesUpdate(BaseModel):
    counselor_notes: str
