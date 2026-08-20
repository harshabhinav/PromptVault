from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.models.blueprint import Blueprint

class TestCase(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, index=True)
    blueprint_id: int = Field(foreign_key="blueprint.id", index=True)
    name: str = Field(default="Unnamed Test Case")
    input_text: str = Field(default="")
    expected_behavior: Optional[str] = Field(default=None)
    
    last_status: Optional[str] = Field(default="unevaluated") # "pass", "fail", "changed", "unevaluated"
    last_latency: Optional[float] = Field(default=0.0)
    last_run_at: Optional[datetime] = Field(default=None)

    # Relationships
    blueprint: "Blueprint" = Relationship(back_populates="test_cases")
