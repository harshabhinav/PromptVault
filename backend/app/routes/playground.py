from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session
from app.database.connection import get_session
from app.services.playground import PlaygroundService
from app.auth.security import get_current_user, AuthenticatedUser

router = APIRouter(prefix="/playground", tags=["Playground"])

class MessageItem(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class PlaygroundChatRequest(BaseModel):
    blueprint_id: Optional[int] = None
    version_id: Optional[int] = None
    is_draft: Optional[bool] = False
    draft_system_prompt: Optional[str] = ""
    draft_user_prompt: Optional[str] = ""
    messages: List[MessageItem] = []
    model: Optional[str] = "claude-3-5-sonnet"
    temperature: Optional[float] = 0.3
    max_tokens: Optional[int] = 250

class PlaygroundSaveRequest(BaseModel):
    blueprint_id: int
    version_id: Optional[int] = None
    version_label: Optional[str] = "V1"
    messages: List[Dict[str, Any]] = []
    model: Optional[str] = "claude-3-5-sonnet"
    temperature: Optional[float] = 0.3
    max_tokens: Optional[int] = 250
    conversation_id: Optional[str] = None

@router.post("/chat")
async def playground_chat(
    req: PlaygroundChatRequest,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    msg_dicts = [{"role": m.role, "content": m.content} for m in req.messages]
    return await PlaygroundService.process_chat(
        session=session,
        blueprint_id=req.blueprint_id,
        version_id=req.version_id,
        is_draft=bool(req.is_draft),
        draft_system_prompt=req.draft_system_prompt,
        draft_user_prompt=req.draft_user_prompt,
        messages=msg_dicts,
        model=req.model or "claude-3-5-sonnet",
        temperature=req.temperature if req.temperature is not None else 0.3,
        max_tokens=req.max_tokens or 250
    )

@router.post("/save")
def save_playground_session(
    req: PlaygroundSaveRequest,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    pg_session = PlaygroundService.save_session(
        session=session,
        blueprint_id=req.blueprint_id,
        version_id=req.version_id,
        version_label=req.version_label or "V1",
        messages=req.messages,
        user_id=current_user.id,
        model=req.model or "claude-3-5-sonnet",
        temperature=req.temperature if req.temperature is not None else 0.3,
        max_tokens=req.max_tokens or 250,
        conversation_id=req.conversation_id
    )
    return {
        "message": "Playground conversation saved successfully.",
        "session_id": pg_session.id,
        "conversation_id": pg_session.conversation_id
    }

@router.get("/sessions/{blueprint_id}")
def get_playground_sessions(
    blueprint_id: int,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    return PlaygroundService.get_sessions_for_blueprint(session, blueprint_id, current_user.id)
