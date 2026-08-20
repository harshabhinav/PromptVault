from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field

class UserApiKey(SQLModel, table=True):
    user_id: str = Field(primary_key=True)
    openai_key: Optional[str] = Field(default=None)
    anthropic_key: Optional[str] = Field(default=None)
    gemini_key: Optional[str] = Field(default=None)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
