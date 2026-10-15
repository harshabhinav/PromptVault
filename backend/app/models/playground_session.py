from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from app.utils.datetime import utc_now

class PlaygroundSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, index=True)
    conversation_id: str = Field(index=True)
    blueprint_id: int = Field(foreign_key="blueprint.id", index=True)
    version_id: Optional[int] = Field(default=None, foreign_key="version.id")
    version_label: str = Field(default="V1")
    model: str = Field(default="claude-3-5-sonnet")
    temperature: float = Field(default=0.3)
    max_tokens: int = Field(default=250)
    messages_json: str = Field(default="[]")
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
