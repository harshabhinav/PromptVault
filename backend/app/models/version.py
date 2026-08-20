from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.models.blueprint import Blueprint
    from app.models.test_run import TestRun

class Version(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, index=True)
    blueprint_id: int = Field(foreign_key="blueprint.id", index=True)
    version_number: Optional[int] = Field(default=None, nullable=True)  # Sequential version number per blueprint (V1=1, V2=2, ...)
    system_prompt: str = Field(default="")
    user_prompt: Optional[str] = Field(default=None)  # Extended for template compatibility
    parameters_json: Optional[str] = Field(default="{}")  # Extended for temperature/max_tokens compatibility
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    blueprint: "Blueprint" = Relationship(back_populates="versions")
    test_runs: List["TestRun"] = Relationship(
        back_populates="version",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
