from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from app.utils.datetime import utc_now

if TYPE_CHECKING:
    from app.models.version import Version
    from app.models.test_case import TestCase

class Blueprint(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True, nullable=False)
    name: str = Field(index=True)
    description: Optional[str] = None
    forked_from: Optional[int] = Field(default=None, foreign_key="blueprint.id", nullable=True)
    is_pinned: bool = Field(default=False)
    pinned_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=utc_now)

    # Relationships
    versions: List["Version"] = Relationship(
        back_populates="blueprint", 
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    test_cases: List["TestCase"] = Relationship(
        back_populates="blueprint",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
