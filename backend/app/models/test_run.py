from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from app.utils.datetime import utc_now

if TYPE_CHECKING:
    from app.models.version import Version
    from app.models.test_case import TestCase

class TestRun(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, index=True)
    version_id: int = Field(foreign_key="version.id", index=True)
    test_case_id: int = Field(foreign_key="testcase.id", index=True)
    output_text: str
    latency: float  # in seconds
    token_usage: int
    estimated_cost: float = Field(default=0.0)
    created_at: datetime = Field(default_factory=utc_now)

    # Added columns for evaluation storage
    test_case_name: Optional[str] = Field(default=None)
    version_label: Optional[str] = Field(default=None)
    input_text: Optional[str] = Field(default=None)
    prompt_text: Optional[str] = Field(default=None)
    status: Optional[str] = Field(default="completed")
    error: Optional[str] = Field(default=None)

    # Relationships
    version: "Version" = Relationship(back_populates="test_runs")
    test_case: "TestCase" = Relationship()
