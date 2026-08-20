from datetime import datetime
from typing import Optional
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select
from app.database.connection import get_session
from app.models.api_key import UserApiKey
from app.auth.security import get_current_user, AuthenticatedUser
from app.services.credential_service import CredentialService
from app.services.providers.gemini_provider import GeminiProvider

logger = logging.getLogger("PromptVaultSettings")

router = APIRouter(prefix="/settings", tags=["Settings"])

class ApiKeysResponse(BaseModel):
    gemini_configured: bool = False
    has_openai_key: bool = False
    has_anthropic_key: bool = False
    has_gemini_key: bool = False
    openai_masked: Optional[str] = None
    anthropic_masked: Optional[str] = None
    gemini_masked: Optional[str] = None

class ApiKeysUpdateRequest(BaseModel):
    openai_key: Optional[str] = None
    anthropic_key: Optional[str] = None
    gemini_key: Optional[str] = None

class TestConnectionRequest(BaseModel):
    provider: str  # "gemini" | "anthropic" | "openai"

def mask_key(key: Optional[str]) -> Optional[str]:
    if not key:
        return None
    if len(key) <= 8:
        return "****"
    return f"{key[:4]}...{key[-4:]}"

@router.get("/api-keys")
def get_user_api_keys(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    key_entry = session.exec(
        select(UserApiKey).where(UserApiKey.user_id == current_user.id)
    ).first()

    gemini_key = CredentialService.get_gemini_key(session, current_user.id)

    if not key_entry:
        return {
            "gemini_configured": bool(gemini_key),
            "has_openai_key": False,
            "has_anthropic_key": False,
            "has_gemini_key": bool(gemini_key),
            "openai_masked": None,
            "anthropic_masked": None,
            "gemini_masked": mask_key(gemini_key)
        }

    return {
        "gemini_configured": bool(gemini_key),
        "has_openai_key": bool(key_entry.openai_key),
        "has_anthropic_key": bool(key_entry.anthropic_key),
        "has_gemini_key": bool(key_entry.gemini_key or gemini_key),
        "openai_masked": mask_key(key_entry.openai_key),
        "anthropic_masked": mask_key(key_entry.anthropic_key),
        "gemini_masked": mask_key(key_entry.gemini_key or gemini_key)
    }

@router.get("/api-keys/status")
def get_credential_status(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    gemini_key = CredentialService.get_gemini_key(session, current_user.id)
    return {
        "gemini_configured": bool(gemini_key)
    }

@router.post("/api-keys")
def update_user_api_keys(
    req: ApiKeysUpdateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    key_entry = session.exec(
        select(UserApiKey).where(UserApiKey.user_id == current_user.id)
    ).first()

    if not key_entry:
        key_entry = UserApiKey(user_id=current_user.id)
        session.add(key_entry)

    if req.openai_key is not None:
        key_entry.openai_key = req.openai_key.strip() if req.openai_key.strip() else None
    if req.anthropic_key is not None:
        key_entry.anthropic_key = req.anthropic_key.strip() if req.anthropic_key.strip() else None
    if req.gemini_key is not None:
        key_entry.gemini_key = req.gemini_key.strip() if req.gemini_key.strip() else None

    key_entry.updated_at = datetime.utcnow()
    session.commit()

    logger.info(f"[PromptVault] API key configuration saved for user={current_user.id}")
    
    if req.gemini_key is not None:
        print("[PV DEBUG]\nSettings Save\nauthenticated = true\nuser_id =", current_user.id, "\ngemini_key_received = true\ngemini_key_persisted = true")

    return {"message": "API keys updated successfully."}

@router.post("/api-keys/test")
def test_api_key_connection(
    req: TestConnectionRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    if req.provider == "gemini":
        gemini_key = CredentialService.get_gemini_key(session, current_user.id)
        if not gemini_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "gemini_api_key_missing",
                    "message": "Google Gemini API key is not configured. Please add it in Settings."
                }
            )

        provider = GeminiProvider()
        return provider.test_connection(api_key=gemini_key)

    elif req.provider == "anthropic":
        key_entry = session.exec(
            select(UserApiKey).where(UserApiKey.user_id == current_user.id)
        ).first()
        key = key_entry.anthropic_key if key_entry else None
        if not key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "anthropic_api_key_missing",
                    "message": "Anthropic API key is not configured. Please add it in Settings."
                }
            )
        try:
            import httpx
            from anthropic import Anthropic, AuthenticationError, RateLimitError
            client = Anthropic(api_key=key, timeout=httpx.Timeout(10.0, read=20.0))
            client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=5,
                messages=[{"role": "user", "content": "Hi"}]
            )
            return {"connected": True, "message": "✓ Anthropic API connected"}
        except AuthenticationError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "anthropic_api_key_invalid", "message": "The Anthropic API key is invalid. Please check Settings."}
            )
        except RateLimitError:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"error": "anthropic_rate_limit", "message": "Anthropic rate limit reached. Please try again later."}
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"error": "anthropic_connection_failed", "message": f"Unable to connect to Anthropic: {str(e)}"}
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "unsupported_provider", "message": f"Provider '{req.provider}' test is not supported yet."}
        )
