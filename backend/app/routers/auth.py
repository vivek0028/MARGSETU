import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User, AuditLog, Notification
from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user
)

router = APIRouter(prefix="/api/auth", tags=["Authentication & Security"])

# ============================================================================
# SCHEMAS
# ============================================================================

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str
    employee_id: str = Field(..., min_length=3, max_length=50)
    department: str = Field(default="Engineering")
    designation: str = Field(default="Operations Officer")
    password: str = Field(..., min_length=6)
    confirm_password: Optional[str] = None
    role: Optional[str] = "PLANNER"

class LoginRequest(BaseModel):
    email: str
    password: str
    remember_me: Optional[bool] = False

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict

class RefreshRequest(BaseModel):
    refresh_token: str

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    reset_code: str
    new_password: str = Field(..., min_length=6)

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(req: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new railway personnel account."""
    if req.confirm_password and req.password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password and confirm password do not match."
        )

    # Check for existing email or employee ID
    existing_user = db.query(User).filter(
        (User.email == req.email.lower()) | (User.employee_id == req.employee_id.upper())
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this official email or Employee ID already exists."
        )

    # Validate role
    valid_roles = ["ADMIN", "PLANNER", "CONTROL_OFFICER", "ENGINEERING", "TRD", "SIGNAL_TELECOM", "OPERATIONS"]
    assigned_role = req.role.upper() if req.role and req.role.upper() in valid_roles else "PLANNER"

    new_user = User(
        id=f"USR-{uuid.uuid4().hex[:8].upper()}",
        name=req.name,
        email=req.email.lower(),
        employee_id=req.employee_id.upper(),
        department=req.department,
        designation=req.designation,
        hashed_password=hash_password(req.password),
        role=assigned_role,
        is_active=True
    )
    db.add(new_user)

    # Audit log
    db.add(AuditLog(
        user_name=req.name,
        user_role=assigned_role,
        action="USER_REGISTERED",
        target_id=new_user.id,
        target_type="USER",
        details=f"New personnel registered: {req.name} ({req.email}) in department {req.department}."
    ))

    # Notification
    db.add(Notification(
        title="Welcome to RailOptiBlock",
        message=f"Welcome {req.name}. Your account with role {assigned_role} has been provisioned.",
        notification_type="SYSTEM",
        recipient_role=assigned_role
    ))

    db.commit()
    db.refresh(new_user)

    # Generate JWT
    token_payload = {"sub": new_user.id, "email": new_user.email, "role": new_user.role}
    access_token = create_access_token(token_payload)
    refresh_token = create_refresh_token(token_payload)

    return {
        "status": "success",
        "message": "User registered successfully.",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "employee_id": new_user.employee_id,
            "department": new_user.department,
            "designation": new_user.designation,
            "role": new_user.role
        }
    }


@router.post("/login", response_model=TokenResponse)
def login_user(req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate railway personnel and issue JWT tokens."""
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid railway email credentials or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your railway account is deactivated. Contact Divisional Admin."
        )

    token_payload = {"sub": user.id, "email": user.email, "role": user.role}
    access_token = create_access_token(token_payload)
    refresh_token = create_refresh_token(token_payload)

    # Audit log
    db.add(AuditLog(
        user_id=user.id,
        user_name=user.name,
        user_role=user.role,
        action="USER_LOGIN",
        target_id=user.id,
        target_type="USER",
        details=f"Successful login by {user.name} ({user.role})."
    ))
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "employee_id": user.employee_id,
            "department": user.department,
            "designation": user.designation,
            "role": user.role
        }
    }


@router.post("/refresh")
def refresh_token(req: RefreshRequest, db: Session = Depends(get_db)):
    """Refresh an expired access token using a valid refresh token."""
    payload = decode_token(req.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token type."
        )
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer active."
        )

    token_payload = {"sub": user.id, "email": user.email, "role": user.role}
    new_access_token = create_access_token(token_payload)
    new_refresh_token = create_refresh_token(token_payload)

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "employee_id": user.employee_id,
            "department": user.department,
            "designation": user.designation,
            "role": user.role
        }
    }


@router.get("/me")
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Fetch profile of currently authenticated user."""
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "employee_id": current_user.employee_id,
        "department": current_user.department,
        "designation": current_user.designation,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None
    }


@router.put("/profile")
def update_profile(
    req: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update profile information."""
    if req.name:
        current_user.name = req.name
    if req.designation:
        current_user.designation = req.designation
    if req.department:
        current_user.department = req.department

    db.add(AuditLog(
        user_id=current_user.id,
        user_name=current_user.name,
        user_role=current_user.role,
        action="PROFILE_UPDATED",
        target_id=current_user.id,
        target_type="USER",
        details="User profile information updated."
    ))
    db.commit()
    db.refresh(current_user)

    return {
        "status": "success",
        "message": "Profile updated successfully.",
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "employee_id": current_user.employee_id,
            "department": current_user.department,
            "designation": current_user.designation,
            "role": current_user.role
        }
    }


@router.put("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change user password."""
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect."
        )

    current_user.hashed_password = hash_password(req.new_password)
    db.add(AuditLog(
        user_id=current_user.id,
        user_name=current_user.name,
        user_role=current_user.role,
        action="PASSWORD_CHANGED",
        target_id=current_user.id,
        target_type="USER",
        details="User updated their account password."
    ))
    db.commit()

    return {"status": "success", "message": "Password updated successfully."}


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Initiate password reset process."""
    user = db.query(User).filter(User.email == req.email.lower()).first()
    # Always return success message to avoid email enumeration
    return {
        "status": "success",
        "message": "If this email is registered in RailOptiBlock, a reset code has been generated.",
        "demo_reset_code": "IR-2026-RESET"
    }


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password with reset code."""
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    if req.reset_code != "IR-2026-RESET":
        raise HTTPException(status_code=400, detail="Invalid or expired reset code.")

    user.hashed_password = hash_password(req.new_password)
    db.commit()

    return {"status": "success", "message": "Password reset successfully. You may now login."}


@router.post("/logout")
def logout_user(current_user: User = Depends(get_current_user)):
    """Log out current user."""
    return {"status": "success", "message": "Logged out successfully."}
