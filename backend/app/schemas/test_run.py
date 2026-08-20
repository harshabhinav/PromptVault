from datetime import datetime
from pydantic import BaseModel, ConfigDict

class TestRunBase(BaseModel):
    version_id: int
    test_case_id: int
    output_text: str
    latency: float
    token_usage: int

class TestRunCreate(TestRunBase):
    pass

class TestRunResponse(TestRunBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
