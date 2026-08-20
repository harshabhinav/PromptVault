import os
import logging
from typing import Optional
from sqlmodel import Session, select
from app.models.api_key import UserApiKey

logger = logging.getLogger("CredentialService")

class CredentialService:
    @staticmethod
    def get_gemini_key(session: Session, user_id: str) -> Optional[str]:
        """
        Safely retrieves the Gemini API key for the current authenticated user.
        Priority:
        1. Current user's saved Gemini API key in UserApiKey table
        2. Optional server environment variable GEMINI_API_KEY as fallback
        """
        logger.info("[Gemini] Current user authenticated: true")
        logger.info(f"[Gemini] Current user ID loaded: {user_id}")

        key_entry = session.exec(
            select(UserApiKey).where(UserApiKey.user_id == user_id)
        ).first()

        record_found = bool(key_entry)
        logger.info(f"[Gemini] Gemini credential record found: {record_found}")

        user_key = key_entry.gemini_key.strip() if key_entry and key_entry.gemini_key and key_entry.gemini_key.strip() else None

        if user_key:
            logger.info("[Gemini] Gemini API key configured: true (user database record)")
            return user_key

        env_key = os.getenv("GEMINI_API_KEY")
        if env_key and env_key.strip():
            logger.info("[Gemini] Gemini API key configured: true (environment fallback)")
            return env_key.strip()

        logger.warning("[Gemini] Gemini API key configured: false")
        return None

    @staticmethod
    def is_gemini_configured(session: Session, user_id: str) -> bool:
        key = CredentialService.get_gemini_key(session, user_id)
        return bool(key)
