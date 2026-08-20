from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field

class Activity(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, index=True)
    event_type: str
    blueprint_id: Optional[int] = Field(default=None, nullable=True)
    version_id: Optional[int] = Field(default=None, nullable=True)
    description: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
