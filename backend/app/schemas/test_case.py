from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class TestCaseBase(BaseModel):
    name: str
    input_text: str
    expected_behavior: Optional[str] = None

class TestCaseCreate(TestCaseBase):
    pass

class TestCaseResponse(TestCaseBase):
    id: int
    blueprint_id: int
    last_status: Optional[str] = "unevaluated"
    last_latency: Optional[float] = 0.0
    last_run_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class SingleTestRunRequest(BaseModel):
    test_case_id: Optional[int] = None
    system_prompt: str
    user_prompt: str
    input_text: str
    expected_behavior: Optional[str] = None

class SingleTestRunResponse(BaseModel):
    output_text: str
    latency: float
    token_usage: int
    estimated_cost: float
    timestamp: str
