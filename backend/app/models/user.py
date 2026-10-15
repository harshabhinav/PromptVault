import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field

from app.utils.datetime import utc_now

class User(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    email: str = Field(unique=True, index=True, nullable=False)
    password_hash: str
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
