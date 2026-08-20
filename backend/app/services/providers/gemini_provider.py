import os
import time
import json
import logging
import re
from typing import Dict, Any, Tuple, Optional, List
from fastapi import HTTPException, status
import httpx
from app.services.providers.base import AIProvider

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("GeminiProvider")

class GeminiProvider(AIProvider):
    def __init__(self):
        self.default_model = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
        self.default_api_key = os.getenv("GEMINI_API_KEY")
        logger.info(f"[PromptVault] Gemini provider initialized with model: {self.default_model}")

    def get_api_key(self, api_key: Optional[str] = None) -> Optional[str]:
        key = api_key or self.default_api_key
        if key:
            key = key.strip()
        return key if key else None

    def get_model(self) -> str:
        return os.getenv("GEMINI_MODEL", self.default_model)

    async def generate_completion(
        self,
        system_prompt: str,
        user_prompt_template: str,
        variables: Dict[str, Any],
        api_key: Optional[str] = None
    ) -> Tuple[str, float, int, float]:
        key = self.get_api_key(api_key)
        if not key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "gemini_api_key_missing",
                    "message": "Google Gemini API key is not configured. Please add it in Settings."
                }
            )

        # Render template variables
        rendered_prompt = user_prompt_template
        for k, v in variables.items():
            placeholder = f"{{{{{k}}}}}"
            rendered_prompt = rendered_prompt.replace(placeholder, str(v))
            rendered_prompt = rendered_prompt.replace(f"{{{{ {k} }}}}", str(v))

        model = self.get_model()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": rendered_prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 1000
            }
        }
        if system_prompt and system_prompt.strip():
            payload["systemInstruction"] = {
                "parts": [{"text": system_prompt.strip()}]
            }

        start_time = time.time()

        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                res = await client.post(url, json=payload)
                latency = time.time() - start_time

                if res.status_code == 400 or res.status_code == 403 or res.status_code == 401:
                    err_data = res.json()
                    err_msg = err_data.get("error", {}).get("message", "")
                    if "API key" in err_msg or "INVALID_ARGUMENT" in err_msg or "keyNotValid" in err_msg or res.status_code in (401, 403):
                        logger.error(f"[PromptVault] Gemini API Key Invalid: {res.status_code}")
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail={
                                "error": "gemini_api_key_invalid",
                                "message": "Google Gemini API key is invalid. Please check Settings."
                            }
                        )
                    else:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail={"error": "gemini_api_error", "message": f"Gemini API Error: {err_msg}"}
                        )

                if res.status_code == 429:
                    logger.error("[PromptVault] Gemini API Rate Limit Exceeded")
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail={
                            "error": "gemini_rate_limit",
                            "message": "Gemini API rate limit reached. Please try again later."
                        }
                    )

                if res.status_code != 200:
                    logger.error(f"[PromptVault] Gemini API Returned Status {res.status_code}: {res.text}")
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail={"error": "gemini_api_error", "message": f"Gemini API Error (status {res.status_code})"}
                    )

                data = res.json()
                output_text = ""
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    output_text = "".join([p.get("text", "") for p in parts])

                usage = data.get("usageMetadata", {})
                input_tokens = usage.get("promptTokenCount", len(rendered_prompt.split()) + len(system_prompt.split()))
                output_tokens = usage.get("candidatesTokenCount", len(output_text.split()))
                total_tokens = usage.get("totalTokenCount", input_tokens + output_tokens)

                # Pricing estimation for Gemini 2.5/2.0 Flash: ~$0.075 / M input, ~$0.30 / M output
                estimated_cost = (input_tokens * 0.000000075) + (output_tokens * 0.0000003)

                logger.info("[PromptVault] Gemini responses received")
                return output_text, round(latency, 3), total_tokens, round(estimated_cost, 7)

        except HTTPException:
            raise
        except httpx.TimeoutException:
            logger.error("[PromptVault] Gemini API request timed out")
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail={"error": "gemini_timeout", "message": "Gemini API request timed out."}
            )
        except Exception as e:
            logger.error(f"[PromptVault] Unexpected error calling Gemini API: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"error": "gemini_connection_error", "message": f"Unable to connect to Gemini API: {str(e)}"}
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
        key = self.get_api_key(api_key)
        if not key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "gemini_api_key_missing",
                    "message": "Google Gemini API key is not configured. Please add it in Settings."
                }
            )

        # Format test run outputs for comparison
        sample_runs_formatted = []
        for ra, rb in zip(results_a, results_b):
            sample_runs_formatted.append(
                f"--- TEST CASE: {ra['test_case_name']} (ID: {ra['test_case_id']}) ---\n"
                f"Input Variables JSON: {ra['input_text']}\n"
                f"Expected Behavior Notes: {ra['expected_behavior'] or 'None specified'}\n"
                f"Version A Generated Output:\n{ra['output_text']}\n"
                f"Version B Generated Output:\n{rb['output_text']}\n"
            )

        summary_prompt = (
            f"You are a Senior Prompt Engineering Evaluation Engine.\n"
            f"Evaluate two versions of a prompt configured under the Blueprint: '{blueprint_name}'.\n\n"
            f"=== VERSION A PROMPT CONFIG ===\n"
            f"System Prompt:\n{prompt_a_sys}\n"
            f"User Prompt Template:\n{prompt_a_user}\n\n"
            f"=== VERSION B PROMPT CONFIG ===\n"
            f"System Prompt:\n{prompt_b_sys}\n"
            f"User Prompt Template:\n{prompt_b_user}\n\n"
            f"=== TEST RUN OUTPUTS COMPARED ===\n"
            f"{chr(10).join(sample_runs_formatted)}\n\n"
            "Analyze the above outputs carefully. Note their differences in formatting, helpfulness, tone, "
            "conciseness, accuracy, and consistency. Return your evaluation strictly as a valid JSON object matching the following structure. "
            "Do not include any wrapping markdown like ```json or any other text:\n"
            "{\n"
            '  "summary": {\n'
            '    "behavior_changes": "Detailed description of behavior changes between Version A and B...",\n'
            '    "strengths": ["Version B strength 1", "Version B strength 2"],\n'
            '    "weaknesses": ["Version B weakness 1", "Version B weakness 2"],\n'
            '    "recommendation": "Version B (or Version A) - Detailed explanation of which version is recommended and why..."\n'
            "  },\n"
            '  "regression_report": [\n'
            "    {\n"
            '      "test_case_id": 1,\n'
            '      "test_case_name": "Test Case Name",\n'
            '      "status": "improved" | "no_change" | "worse",\n'
            '      "explanation": "Specific description of why B is better, worse, or unchanged compared to A..."\n'
            "    }\n"
            "  ],\n"
            '  "scorecard": {\n'
            '    "version_a": {\n'
            '      "helpfulness": 85,\n'
            '      "accuracy": 88,\n'
            '      "consistency": 80,\n'
            '      "safety": 90,\n'
            '      "conciseness": 85,\n'
            '      "professional_tone": 87\n'
            "    },\n"
            '    "version_b": {\n'
            '      "helpfulness": 92,\n'
            '      "accuracy": 90,\n'
            '      "consistency": 95,\n'
            '      "safety": 92,\n'
            '      "conciseness": 80,\n'
            '      "professional_tone": 93\n'
            "    }\n"
            "  },\n"
            '  "test_case_comments": {\n'
            '    "1": "Detailed AI evaluation comment comparing A and B for this specific test case..."\n'
            "  }\n"
            "}"
        )

        model = self.get_model()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"

        payload = {
            "systemInstruction": {
                "parts": [{"text": "You are a prompt engineering evaluation engine. Output only valid JSON matching the exact schema."}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": summary_prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 2000,
                "responseMimeType": "application/json"
            }
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code in (400, 401, 403):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail={
                            "error": "gemini_api_key_invalid",
                            "message": "Google Gemini API key is invalid. Please check Settings."
                        }
                    )
                if res.status_code == 429:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail={
                            "error": "gemini_rate_limit",
                            "message": "Gemini API rate limit reached. Please try again later."
                        }
                    )
                if res.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail={"error": "gemini_api_error", "message": f"Gemini evaluation failed with status {res.status_code}"}
                    )

                data = res.json()
                raw_text = ""
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    raw_text = "".join([p.get("text", "") for p in parts]).strip()

                # Clean markdown code blocks if wrapped
                if raw_text.startswith("```"):
                    lines = raw_text.split("\n")
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines[-1].startswith("```"):
                        lines = lines[:-1]
                    raw_text = "\n".join(lines).strip()

                parsed_eval = json.loads(raw_text)
                return parsed_eval

        except json.JSONDecodeError as e:
            logger.error(f"[PromptVault] Failed to parse Gemini evaluation JSON output: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"error": "eval_json_error", "message": "Failed to parse evaluation result from Gemini."}
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[PromptVault] Error during Gemini evaluation: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"error": "gemini_evaluation_failed", "message": f"Gemini evaluation failed: {str(e)}"}
            )

    def test_connection(self, api_key: Optional[str] = None) -> Dict[str, Any]:
        key = self.get_api_key(api_key)
        if not key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "gemini_api_key_missing",
                    "message": "Google Gemini API key is not configured. Please add it in Settings."
                }
            )

        model = self.get_model()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        payload = {
            "contents": [{"parts": [{"text": "Hi"}]}],
            "generationConfig": {"maxOutputTokens": 5}
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(url, json=payload)
                if res.status_code in (400, 401, 403):
                    err_msg = res.json().get("error", {}).get("message", "")
                    if "API key" in err_msg or "INVALID_ARGUMENT" in err_msg or res.status_code in (401, 403):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail={
                                "error": "gemini_api_key_invalid",
                                "message": "Google Gemini API key is invalid. Please check Settings."
                            }
                        )
                if res.status_code == 429:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail={
                            "error": "gemini_rate_limit",
                            "message": "Gemini API rate limit reached. Please try again later."
                        }
                    )
                if res.status_code == 200:
                    logger.info("[PromptVault] Gemini connection test succeeded")
                    return {"connected": True, "message": "✓ Gemini API connected"}
                
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail={"error": "gemini_connection_failed", "message": "⚠ Gemini API connection failed"}
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[PromptVault] Gemini test connection error: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"error": "gemini_connection_failed", "message": "⚠ Gemini API connection failed"}
            )
