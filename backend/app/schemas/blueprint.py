from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class BlueprintBase(BaseModel):
    name: str
    description: Optional[str] = None
    forked_from: Optional[int] = None

class BlueprintCreate(BlueprintBase):
    pass

class BlueprintUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class BlueprintResponse(BlueprintBase):
    id: int
    created_at: datetime
    is_pinned: bool = False
    pinned_at: Optional[datetime] = None
    version_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class BlueprintDashboardResponse(BlueprintResponse):
    test_case_count: int = 0
    average_ai_score: Optional[float] = None
    last_updated: Optional[datetime] = None
