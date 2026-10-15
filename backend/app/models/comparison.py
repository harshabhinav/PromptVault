from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from app.utils.datetime import utc_now

class Comparison(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)
    blueprint_id: int = Field(index=True)
    version_a_id: int
    version_b_id: int
    # "version" = standard A vs B evaluation, "git_diff" = Git Difference visual comparison
    comparison_type: str = Field(default="version", index=True)
    # For git_diff: optional branch names (purely informational)
    branch_a: Optional[str] = Field(default=None)
    branch_b: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=utc_now)
