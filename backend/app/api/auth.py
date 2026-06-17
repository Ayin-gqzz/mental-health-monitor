from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_token, require_role
from app.models.student import StudentInfo
from app.models.user import CounselorUser
from app.schemas.auth import LoginRequest, StudentRegisterRequest, TokenResponse, CounselorRegisterRequest, PasswordChangeRequest

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
        token = create_token({
            "sub": str(user.id),
            "role": "counselor",
            "department": user.department,
            "is_admin": user.is_admin,
        })
        return TokenResponse(
            access_token=token, role="counselor",
            display_name=user.display_name, user_id=str(user.id),
            department=user.department,
            is_admin=user.is_admin,
        )
    raise HTTPException(status_code=401, detail="Invalid credentials")


@router.post("/register/counselor", response_model=TokenResponse)
def register_counselor(req: CounselorRegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(CounselorUser).filter(CounselorUser.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    counselor = CounselorUser(
        username=req.username,
        password_hash=hash_password(req.password),
        display_name=req.display_name,
        department=req.department,
    )
    db.add(counselor)
    db.commit()
    db.refresh(counselor)

    token = create_token({
        "sub": str(counselor.id),
        "role": "counselor",
        "department": counselor.department,
        "is_admin": False,
    })
    return TokenResponse(
        access_token=token, role="counselor",
        display_name=counselor.display_name, user_id=str(counselor.id),
        department=counselor.department,
    )


@router.put("/counselor/password")
def change_counselor_password(
    req: PasswordChangeRequest,
    user: dict = Depends(require_role("counselor")),
):
    db = user["db"]
    counselor_id = int(user["user_id"])
    counselor = db.query(CounselorUser).filter(CounselorUser.id == counselor_id).first()
    if not counselor:
        raise HTTPException(404, "Counselor not found")

    if not verify_password(req.old_password, counselor.password_hash):
        raise HTTPException(400, "Old password is incorrect")

    counselor.password_hash = hash_password(req.new_password)
    db.commit()
    return {"status": "ok"}
