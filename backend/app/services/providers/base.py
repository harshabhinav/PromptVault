from abc import ABC, abstractmethod
from typing import Dict, Any, Tuple, Optional, List

class AIProvider(ABC):
    @abstractmethod
    async def generate_completion(
        self,
        system_prompt: str,
        user_prompt_template: str,
        variables: Dict[str, Any],
        api_key: Optional[str] = None
    ) -> Tuple[str, float, int, float]:
        """
        Renders prompt template and queries the AI provider.
        Returns: (output_text, latency_seconds, token_usage, estimated_cost)
        """
        pass

    @abstractmethod
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
        Evaluates two versions and returns structured evaluation JSON.
        """
        pass

    @abstractmethod
    def test_connection(self, api_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Tests the API key connection with a minimal request.
        """
        pass
