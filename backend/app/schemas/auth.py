from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class StudentRegisterRequest(BaseModel):
    student_id: str
    name: str
    password: str
    age: int
    gender: str
    department: str
    cgpa: float


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    display_name: str
    user_id: str
