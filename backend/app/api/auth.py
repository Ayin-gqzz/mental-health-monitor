from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_token
from app.models.student import StudentInfo
from app.models.user import CounselorUser
from app.schemas.auth import LoginRequest, StudentRegisterRequest, TokenResponse

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
def register(req: StudentRegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(StudentInfo).filter(StudentInfo.student_id == req.student_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student ID already registered")

    student = StudentInfo(
        student_id=req.student_id,
        name=req.name,
        age=req.age,
        gender=req.gender,
        department=req.department,
        cgpa=req.cgpa,
        password_hash=hash_password(req.password),
    )
    db.add(student)
    db.commit()

    token = create_token({"sub": req.student_id, "role": "student"})
    return TokenResponse(
        access_token=token, role="student",
        display_name=req.name, user_id=req.student_id,
    )


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    student = db.query(StudentInfo).filter(StudentInfo.student_id == req.username).first()
    if student and verify_password(req.password, student.password_hash):
        token = create_token({"sub": student.student_id, "role": "student"})
        return TokenResponse(
            access_token=token, role="student",
            display_name=student.name, user_id=student.student_id,
        )
    raise HTTPException(status_code=401, detail="Invalid credentials")


@router.post("/login/counselor", response_model=TokenResponse)
def login_counselor(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(CounselorUser).filter(CounselorUser.username == req.username).first()
    if user and verify_password(req.password, user.password_hash):
        token = create_token({"sub": str(user.id), "role": "counselor"})
        return TokenResponse(
            access_token=token, role="counselor",
            display_name=user.display_name, user_id=str(user.id),
        )
    raise HTTPException(status_code=401, detail="Invalid credentials")
