from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class VersionBase(BaseModel):
    blueprint_id: int
    system_prompt: str = ""
    user_prompt: Optional[str] = None
    parameters_json: Optional[str] = "{}"

class VersionCreate(VersionBase):
    pass

class VersionResponse(VersionBase):
    id: int
    version_number: Optional[int] = None  # Sequential version number per blueprint
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
