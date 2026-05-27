from pydantic import BaseModel


class StudentInfoOut(BaseModel):
    student_id: str
    name: str
    age: int
    gender: str
    department: str
    cgpa: float

    model_config = {"from_attributes": True}


class StudentInfoUpdate(BaseModel):
    name: str | None = None
    age: int | None = None
    cgpa: float | None = None
