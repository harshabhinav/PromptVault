from datetime import datetime, timedelta
from typing import Optional
from sqlmodel import SQLModel, Field

class EmailOTP(SQLModel, table=True):
    __tablename__ = "email_otp"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True)
    otp_code: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime = Field(default_factory=lambda: datetime.utcnow() + timedelta(minutes=15))
    is_used: bool = Field(default=False)
