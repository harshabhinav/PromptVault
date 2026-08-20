import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional
from sqlmodel import SQLModel, Field


class EmailVerificationToken(SQLModel, table=True):
    __tablename__ = "email_verification_tokens"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True, nullable=False, foreign_key="user.id", ondelete="CASCADE")
    token_hash: str = Field(index=True, nullable=False, unique=True)
    expires_at: datetime = Field(nullable=False)
    used_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @property
    def is_expired(self) -> bool:
        return datetime.utcnow() > self.expires_at

    @property
    def is_used(self) -> bool:
        return self.used_at is not None

    @staticmethod
    def generate_token():
        raw = secrets.token_urlsafe(32)
        hashed = hashlib.sha256(raw.encode()).hexdigest()
        return raw, hashed

    @staticmethod
    def hash_token(raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode()).hexdigest()
