import os
import logging
from typing import Dict, Any, Tuple, Optional, List
from app.services.providers.gemini_provider import GeminiProvider

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AIService")

class AIService:
    def __init__(self):
        self.provider = GeminiProvider()
        logger.info("[PromptVault] Gemini provider selected as PRIMARY AI PROVIDER")

    def get_provider(self) -> GeminiProvider:
        return self.provider

    async def generate_completion(
        self, 
        system_prompt: str, 
        user_prompt_template: str, 
        variables: Dict[str, Any],
        api_key: Optional[str] = None
    ) -> Tuple[str, float, int, float]:
        """
        Delegates completion generation to the active AI Provider (Google Gemini).
        Returns a tuple of (output_text, latency_seconds, token_usage, estimated_cost).
        """
        return await self.provider.generate_completion(
            system_prompt=system_prompt,
            user_prompt_template=user_prompt_template,
            variables=variables,
            api_key=api_key
        )

    async def summarize_differences(
        self, 
        blueprint_name: str,
        prompt_a_sys: str, 
        prompt_a_user: str, 
        prompt_b_sys: str, 
        prompt_b_user: str,
        results_a: List[Dict[str, Any]],
        results_b: List[Dict[str, Any]],
        api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Delegates comparative evaluation and scorecard generation to the active AI Provider (Google Gemini).
        """
        return await self.provider.summarize_differences(
            blueprint_name=blueprint_name,
            prompt_a_sys=prompt_a_sys,
            prompt_a_user=prompt_a_user,
            prompt_b_sys=prompt_b_sys,
            prompt_b_user=prompt_b_user,
            results_a=results_a,
            results_b=results_b,
            api_key=api_key
        )

# Global singleton
ai_service = AIService()
