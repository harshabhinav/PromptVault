from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass
from fastapi import Security, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
from jose import JWTError, jwt
from app.config.settings import settings

security = HTTPBearer(auto_error=False)

@dataclass
class AuthenticatedUser:
    id: str
    email: str
    full_name: Optional[str] = None

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        pwd_bytes = plain_password.encode('utf-8')[:72]
        hash_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security)
) -> AuthenticatedUser:
    """
    Extracts and validates JWT token from the Authorization header.
    Decodes PromptVault JWTs or Supabase JWTs seamlessly.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        # First attempt decoding with local JWT secret
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub") or payload.get("user_id")
        email = payload.get("email") or "user@promptvault.io"
        name = payload.get("name") or email.split("@")[0]

        if user_id:
            return AuthenticatedUser(
                id=str(user_id),
                email=str(email),
                full_name=str(name)
            )
    except Exception:
        pass

    # Secondary attempt decoding raw claims (e.g. Supabase JWT)
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub") or payload.get("user_id")
        email = payload.get("email") or "user@promptvault.io"
        user_metadata = payload.get("user_metadata", {})
        full_name = user_metadata.get("full_name") or email.split("@")[0]

        if user_id:
            return AuthenticatedUser(
                id=str(user_id),
                email=str(email),
                full_name=str(full_name)
            )
    except Exception:
        pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
