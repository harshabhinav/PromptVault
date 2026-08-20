import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from sqlmodel import Session, select
from app.models.blueprint import Blueprint
from app.models.version import Version
from app.models.playground_session import PlaygroundSession
from app.services.ai_service import AIService
from app.services.activity import ActivityService

ai_service = AIService()

class PlaygroundService:
    @staticmethod
    async def process_chat(
        session: Session,
        blueprint_id: Optional[int],
        version_id: Optional[int],
        is_draft: bool,
        draft_system_prompt: Optional[str],
        draft_user_prompt: Optional[str],
        messages: List[Dict[str, str]],
        model: str = "claude-3-5-sonnet",
        temperature: float = 0.3,
        max_tokens: int = 250
    ) -> Dict[str, Any]:
        if not messages:
            raise HTTPException(status_code=400, detail="No messages provided for playground chat.")

        # 1. Source of Truth: Load System Prompt
        sys_prompt = ""
        user_prompt_tmpl = ""
        version_label = "Draft"

        if not is_draft and version_id:
            db_ver = session.get(Version, version_id)
            if db_ver:
                sys_prompt = db_ver.system_prompt or ""
                user_prompt_tmpl = db_ver.user_prompt or ""
                version_label = f"V{db_ver.version_number or 1}"
            else:
                sys_prompt = draft_system_prompt or ""
                user_prompt_tmpl = draft_user_prompt or ""
        else:
            sys_prompt = draft_system_prompt or ""
            user_prompt_tmpl = draft_user_prompt or ""

        if not sys_prompt.strip():
            sys_prompt = "You are a helpful AI assistant."

        # Format messages for AI service
        msg_list = [{"role": m.get("role", "user"), "content": m.get("content", "")} for m in messages]

        # Call AI Completion with full conversation history and active system prompt
        output_text, latency, tokens, cost = await ai_service.generate_chat_completion(
            system_prompt=sys_prompt,
            messages=msg_list,
            model=model or "claude-3-5-sonnet",
            temperature=temperature if temperature is not None else 0.3,
            max_tokens=max_tokens or 250
        )

        return {
            "role": "assistant",
            "content": output_text,
            "latency": latency,
            "tokens": tokens,
            "cost": cost,
            "version_label": version_label,
            "timestamp": datetime.utcnow().isoformat()
        }

    @staticmethod
    def save_session(
        session: Session,
        blueprint_id: int,
        version_id: Optional[int],
        version_label: str,
        messages: List[Dict[str, Any]],
        user_id: str,
        model: str = "claude-3-5-sonnet",
        temperature: float = 0.3,
        max_tokens: int = 250,
        conversation_id: Optional[str] = None
    ) -> PlaygroundSession:
        cid = conversation_id or str(uuid.uuid4())
        
        pg_session = PlaygroundSession(
            conversation_id=cid,
            blueprint_id=blueprint_id,
            version_id=version_id,
            user_id=user_id,
            version_label=version_label or "V1",
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            messages_json=json.dumps(messages),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(pg_session)
        session.commit()
        session.refresh(pg_session)

        # Log Activity
        msg_count = len(messages)
        ActivityService.log_activity(
            session=session,
            event_type="Playground Session Saved",
            description=f"Saved Playground conversation ({msg_count} message{'s' if msg_count != 1 else ''}) for version {version_label}",
            blueprint_id=blueprint_id,
            version_id=version_id,
            user_id=user_id
        )

        return pg_session

    @staticmethod
    def get_sessions_for_blueprint(session: Session, blueprint_id: int, user_id: str) -> List[PlaygroundSession]:
        statement = select(PlaygroundSession).where(
            PlaygroundSession.blueprint_id == blueprint_id,
            PlaygroundSession.user_id == user_id
        ).order_by(PlaygroundSession.updated_at.desc())
        return session.exec(statement).all()
