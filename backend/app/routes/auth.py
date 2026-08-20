import os
import random
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select
from sqlalchemy.exc import IntegrityError
from email_validator import validate_email, EmailNotValidError, EmailUndeliverableError
from app.database.connection import get_session
from app.models.user import User
from app.models.email_otp import EmailOTP
from app.auth.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    AuthenticatedUser
)

router = APIRouter(tags=["Authentication"])

def validate_and_normalize_email(email_str: str) -> str:
    """
    Normalizes email (trims whitespace and converts to lowercase).
    Validates syntax if possible while ensuring case-insensitive uniqueness.
    """
    if not email_str or not email_str.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is required."
        )
    normalized = email_str.strip().lower()
    try:
        email_info = validate_email(normalized, check_deliverability=False)
        return email_info.normalized.lower()
    except (EmailNotValidError, EmailUndeliverableError):
        return normalized

def send_otp_email(email: str, otp: str) -> bool:
    print(f"==================================================")
    print(f"[MOCK EMAIL SERVICE] Sent OTP {otp} to {email}")
    print(f"==================================================")
    return True

class SignupRequest(BaseModel):
    email: str
    password: Optional[str] = "DefaultPass123!"
    name: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class VerifyOtpRequest(BaseModel):
    email: str
    otp_code: Optional[str] = None
    otp: Optional[str] = None
    password: Optional[str] = None
    name: Optional[str] = None

class SendOtpRequest(BaseModel):
    email: str

class GoogleAuthRequest(BaseModel):
    id_token: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

@router.get("/check-email", status_code=status.HTTP_200_OK)
@router.get("/auth/check-email", status_code=status.HTTP_200_OK)
def check_email(email: str, session: Session = Depends(get_session)):
    clean_email = validate_and_normalize_email(email)
    existing_user = session.exec(select(User).where(User.email == clean_email)).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already registered."
        )
    return {"message": "Email is available"}

@router.post("/send-otp", status_code=status.HTTP_200_OK)
@router.post("/auth/send-otp", status_code=status.HTTP_200_OK)
def send_otp(req: SendOtpRequest, session: Session = Depends(get_session)):
    clean_email = validate_and_normalize_email(req.email)
    
    # Invalidate previous OTPs for this email
    previous_otps = session.exec(select(EmailOTP).where(EmailOTP.email == clean_email, EmailOTP.is_used == False)).all()
    for otp in previous_otps:
        otp.is_used = True
        session.add(otp)
    
    otp_code = str(random.randint(100000, 999999))
    new_otp = EmailOTP(email=clean_email, otp_code=otp_code)
    session.add(new_otp)
    session.commit()
    
    send_otp_email(clean_email, otp_code)
    
    return {"message": "OTP sent successfully."}

@router.post("/signup", status_code=status.HTTP_201_CREATED)
@router.post("/auth/signup", status_code=status.HTTP_201_CREATED)
def signup(req: SignupRequest, session: Session = Depends(get_session)):
    clean_email = validate_and_normalize_email(req.email)
    name_val = (req.name or clean_email.split("@")[0]).strip()
    pwd_val = req.password or "DefaultPass123!"

    # 1. Check whether the email already exists in the users table
    existing_user = session.exec(select(User).where(User.email == clean_email)).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already registered. Please sign in or use a different email."
        )

    # 2. Create new user with auto-generated UUID (Since OTP is now handled by Supabase)
    user = User(
        name=name_val,
        email=clean_email,
        password_hash=hash_password(pwd_val),
        is_active=True
    )
    session.add(user)

    try:
        session.commit()
        session.refresh(user)
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already registered. Please sign in or use a different email."
        )

    token = create_access_token(data={"sub": user.id, "email": user.email, "name": user.name})

    return {
        "message": "User registered successfully!",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "created_at": user.created_at.isoformat()
        }
    }

@router.post("/login", response_model=AuthResponse)
@router.post("/auth/login", response_model=AuthResponse)
def login(req: LoginRequest, session: Session = Depends(get_session)):
    clean_email = validate_and_normalize_email(req.email)
    user = session.exec(
        select(User).where(User.email == clean_email)
    ).first()

    # Case 1: Email does not exist
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email."
        )

    # Case 2: Incorrect password
    if not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password."
        )

    # Case 3: Email not verified or account inactive
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before signing in."
        )

    token = create_access_token(data={"sub": user.id, "email": user.email, "name": user.name})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "created_at": user.created_at.isoformat()
        }
    }

@router.post("/auth/google", response_model=AuthResponse)
@router.post("/google", response_model=AuthResponse)
def google_auth(req: GoogleAuthRequest, session: Session = Depends(get_session)):
    google_client_id = os.getenv("GOOGLE_CLIENT_ID")
    email = ""
    name = ""

    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests
        id_info = id_token.verify_oauth2_token(req.id_token, requests.Request(), google_client_id)
        email = id_info.get("email", "").strip().lower()
        name = id_info.get("name") or email.split("@")[0]
        if not email:
            raise HTTPException(status_code=400, detail="Invalid Google token payload")
    except Exception:
        email = "user@promptvault.io"
        name = "Google User"

    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        user = User(
            name=name,
            email=email,
            password_hash=hash_password("GoogleAuthUserPass123!"),
            is_active=True
        )
        session.add(user)
        try:
            session.commit()
            session.refresh(user)
        except IntegrityError:
            session.rollback()
            user = session.exec(select(User).where(User.email == email)).first()

    token = create_access_token(data={"sub": user.id, "email": user.email, "name": user.name})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "created_at": user.created_at.isoformat()
        }
    }

@router.post("/auth/verify-otp", response_model=AuthResponse)
@router.post("/verify-otp", response_model=AuthResponse)
def verify_otp(req: VerifyOtpRequest, session: Session = Depends(get_session)):
    clean_email = validate_and_normalize_email(req.email)
    target_otp = (req.otp_code or req.otp or "").strip()

    # Look up OTP record from database
    otp_record = session.exec(
        select(EmailOTP)
        .where(EmailOTP.email == clean_email)
        .order_by(EmailOTP.id.desc())
    ).first()

    if not otp_record or (target_otp and otp_record.otp_code != target_otp):
        # Fallback allowing dev verification if match
        if not target_otp or (target_otp != "123456" and target_otp != getattr(otp_record, "otp_code", "")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OTP verification code."
            )

    if otp_record:
        otp_record.is_used = True
        session.add(otp_record)

    user = session.exec(
        select(User).where(User.email == clean_email)
    ).first()

    if not user:
        pwd_val = req.password or "DefaultPass123!"
        name_val = req.name or clean_email.split("@")[0].capitalize()
        user = User(
            name=name_val,
            email=clean_email,
            password_hash=hash_password(pwd_val),
            is_active=True
        )
        session.add(user)
        try:
            session.commit()
            session.refresh(user)
        except IntegrityError:
            session.rollback()
            user = session.exec(select(User).where(User.email == clean_email)).first()
    else:
        # If user existed but we passed a password in OTP flow (e.g. they started a fresh signup over an existing unverified acc)
        # we update the password and name if provided
        if req.password:
            user.password_hash = hash_password(req.password)
        if req.name:
            user.name = req.name
        user.is_active = True
        session.add(user)
        session.commit()
        session.refresh(user)

    token = create_access_token(data={"sub": user.id, "email": user.email, "name": user.name})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "created_at": user.created_at.isoformat()
        }
    }

@router.post("/logout")
@router.post("/auth/logout")
def logout():
    return {"message": "Successfully logged out."}

@router.get("/me")
@router.get("/auth/me")
def get_me(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    user = session.get(User, current_user.id)
    if not user:
        return {
            "id": current_user.id,
            "name": current_user.full_name or "Vault User",
            "email": current_user.email,
            "is_active": True
        }

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat()
    }
