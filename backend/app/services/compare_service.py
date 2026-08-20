import asyncio
import json
import logging
import re
import time
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
from sqlmodel import Session, select
from app.models.blueprint import Blueprint
from app.models.version import Version
from app.models.test_case import TestCase
from app.models.test_run import TestRun
from app.models.comparison import Comparison
from app.services.credential_service import CredentialService
from app.services.ai_service import ai_service

logger = logging.getLogger("CompareService")

class CompareService:
    @staticmethod
    async def run_comparison(session: Session, version_a_id: int, version_b_id: int, user_id: str) -> Dict[str, Any]:
        logger.info("[PromptVault] Gemini provider selected")

        # 1. Fetch versions and blueprint details with user ownership validation
        version_a = session.get(Version, version_a_id)
        version_b = session.get(Version, version_b_id)
        if not version_a or not version_b or version_a.user_id != user_id or version_b.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="One or both versions not found"
            )

        blueprint_id = version_a.blueprint_id
        blueprint = session.get(Blueprint, blueprint_id)
        if not blueprint or blueprint.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Associated blueprint not found."
            )
        blueprint_name = blueprint.name

        # 2. Fetch the current user's Google Gemini API key via CredentialService
        user_api_key = CredentialService.get_gemini_key(session, user_id)
        print("[PV DEBUG]\nEvaluator\nauthenticated = true\nuser_id =", user_id, "\ngemini_credential_found =", bool(user_api_key), "\ngemini_request_starting = true")

        if not user_api_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "gemini_api_key_missing",
                    "message": "Google Gemini API key is not configured. Please add it in Settings."
                }
            )

        logger.info("[PromptVault] Gemini configuration loaded")

        # 3. Load all test cases for the blueprint
        test_cases = session.exec(select(TestCase).where(TestCase.blueprint_id == blueprint_id)).all()

        from app.services.activity import ActivityService
        ver_a_label = f"V{version_a.version_number}" if version_a.version_number else f"Node {version_a_id}"
        ver_b_label = f"V{version_b.version_number}" if version_b.version_number else f"Node {version_b_id}"

        if not test_cases:
            _comparison = Comparison(
                user_id=user_id,
                blueprint_id=blueprint_id,
                version_a_id=version_a_id,
                version_b_id=version_b_id,
            )
            session.add(_comparison)
            session.commit()
            logger.info(f"[Evaluate] Comparison saved (no test cases): user={user_id} bp={blueprint_id}")
            ActivityService.log_activity(
                session=session,
                event_type="Prompt Compared",
                description=f"Compared {ver_a_label} vs {ver_b_label} for blueprint '{blueprint_name}' (no test cases)",
                blueprint_id=blueprint_id,
                user_id=user_id
            )
            return {
                "summary": {
                    "behavior_changes": "No test cases configured for this blueprint. Add test cases in the Prompt Editor to evaluate outputs.",
                    "strengths": [],
                    "weaknesses": [],
                    "recommendation": "Add test cases in the Editor to generate quality scorecards and regression reports."
                },
                "regression_report": [],
                "scorecard": {
                    "version_a": {"helpfulness": 0, "accuracy": 0, "consistency": 0, "safety": 0, "conciseness": 0, "professional_tone": 0},
                    "version_b": {"helpfulness": 0, "accuracy": 0, "consistency": 0, "safety": 0, "conciseness": 0, "professional_tone": 0}
                },
                "test_case_comments": {},
                "resultsA": [],
                "resultsB": [],
                "metrics": {
                    "averageLatencyA": 0,
                    "averageLatencyB": 0,
                    "totalTokensA": 0,
                    "totalTokensB": 0,
                    "estimatedCostA": 0,
                    "estimatedCostB": 0
                }
            }

        logger.info(f"[PromptVault] Starting evaluation for blueprint '{blueprint_name}' with {len(test_cases)} test case(s)")

        # 4. Create concurrent tasks for asyncio.gather()
        async def run_prompt(version: Version, test_case: TestCase, version_label: str) -> Dict[str, Any]:
            var_names = re.findall(r"\{\{\s*([^}]+)\s*\}\}", version.user_prompt or "")
            var_names = [v.strip() for v in var_names]

            variables = {}
            try:
                variables = json.loads(test_case.input_text)
                if not isinstance(variables, dict):
                    variables = {v: test_case.input_text for v in var_names} if var_names else {"input": test_case.input_text}
            except (json.JSONDecodeError, Exception):
                variables = {v: test_case.input_text for v in var_names} if var_names else {"input": test_case.input_text}

            system_prompt = version.system_prompt or ""
            user_prompt = version.user_prompt or ""

            rendered_prompt = user_prompt
            for k, v in variables.items():
                rendered_prompt = rendered_prompt.replace(f"{{{{{k}}}}}", str(v))
                rendered_prompt = rendered_prompt.replace(f"{{{{ {k} }}}}", str(v))

            start_time = time.time()

            try:
                logger.info(f"[Gemini] Starting Gemini request for Version {version_label} — test case: '{test_case.name}'")
                output_text, latency, tokens, cost = await ai_service.generate_completion(
                    system_prompt=system_prompt,
                    user_prompt_template=user_prompt,
                    variables=variables,
                    api_key=user_api_key
                )
                return {
                    "version_id": version.id,
                    "version_label": version_label,
                    "test_case_id": test_case.id,
                    "test_case_name": test_case.name,
                    "expected_behavior": test_case.expected_behavior,
                    "input_text": test_case.input_text,
                    "prompt_text": f"[System]\n{system_prompt}\n\n[User]\n{rendered_prompt}",
                    "output_text": output_text,
                    "latency": latency,
                    "token_usage": tokens,
                    "estimated_cost": cost,
                    "status": "completed",
                    "error": None
                }
            except HTTPException as e:
                # If key missing or invalid, propagate immediately
                if isinstance(e.detail, dict) and e.detail.get("error") in ("gemini_api_key_missing", "gemini_api_key_invalid", "gemini_rate_limit"):
                    raise e
                latency = time.time() - start_time
                error_msg = e.detail.get("message") if isinstance(e.detail, dict) else str(e.detail)
                logger.error(f"[ConcurrentEvaluator] Version {version_label} failed for test case '{test_case.name}': {error_msg}")
                return {
                    "version_id": version.id,
                    "version_label": version_label,
                    "test_case_id": test_case.id,
                    "test_case_name": test_case.name,
                    "expected_behavior": test_case.expected_behavior,
                    "input_text": test_case.input_text,
                    "prompt_text": f"[System]\n{system_prompt}\n\n[User]\n{rendered_prompt}",
                    "output_text": "",
                    "latency": round(latency, 3),
                    "token_usage": 0,
                    "estimated_cost": 0.0,
                    "status": "failed",
                    "error": error_msg
                }
            except Exception as e:
                latency = time.time() - start_time
                error_msg = str(e)
                logger.error(f"[ConcurrentEvaluator] Version {version_label} failed for test case '{test_case.name}': {error_msg}")
                return {
                    "version_id": version.id,
                    "version_label": version_label,
                    "test_case_id": test_case.id,
                    "test_case_name": test_case.name,
                    "expected_behavior": test_case.expected_behavior,
                    "input_text": test_case.input_text,
                    "prompt_text": f"[System]\n{system_prompt}\n\n[User]\n{rendered_prompt}",
                    "output_text": "",
                    "latency": round(latency, 3),
                    "token_usage": 0,
                    "estimated_cost": 0.0,
                    "status": "failed",
                    "error": error_msg
                }

        # Build separate tasks for A and B — executed independently via Gemini
        tasks_a = []
        tasks_b = []
        for tc in test_cases:
            logger.info(f"[PromptVault] Starting Version A — test case: '{tc.name}'")
            tasks_a.append(run_prompt(version_a, tc, ver_a_label))
            logger.info(f"[PromptVault] Starting Version B — test case: '{tc.name}'")
            tasks_b.append(run_prompt(version_b, tc, ver_b_label))

        all_tasks = []
        for ta, tb in zip(tasks_a, tasks_b):
            all_tasks.append(ta)
            all_tasks.append(tb)

        logger.info(f"[ConcurrentEvaluator] Firing {len(all_tasks)} sequential Gemini API calls to respect free tier rate limits...")
        all_runs = []
        for task in all_tasks:
            all_runs.append(await task)
            await asyncio.sleep(3.0)  # 3-second delay between requests to bypass free-tier rate limit

        logger.info("[PromptVault] Gemini responses received")

        results_a = []
        results_b = []

        for run in all_runs:
            test_run = TestRun(
                version_id=run["version_id"],
                test_case_id=run["test_case_id"],
                user_id=user_id,
                output_text=run["output_text"] or "",
                latency=run["latency"],
                token_usage=run["token_usage"],
                estimated_cost=run["estimated_cost"],
                test_case_name=run["test_case_name"],
                version_label=run["version_label"],
                input_text=run["input_text"],
                prompt_text=run.get("prompt_text"),
                status=run["status"],
                error=run.get("error")
            )
            session.add(test_run)

            formatted_run = {
                "test_case_id": run["test_case_id"],
                "test_case_name": run["test_case_name"],
                "expected_behavior": run["expected_behavior"],
                "input_text": run["input_text"],
                "output_text": run["output_text"],
                "latency": run["latency"],
                "token_usage": run["token_usage"],
                "estimated_cost": run["estimated_cost"],
                "status": run["status"],
                "error": run.get("error")
            }
            if run["version_id"] == version_a_id:
                results_a.append(formatted_run)
            else:
                results_b.append(formatted_run)

        session.commit()

        a_all_failed = all(r["status"] == "failed" for r in results_a)
        b_all_failed = all(r["status"] == "failed" for r in results_b)

        if a_all_failed and b_all_failed:
            first_err = (results_a[0].get("error") or results_b[0].get("error")) if (results_a and results_b) else None
            if first_err and "invalid" in first_err.lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error": "gemini_api_key_invalid",
                        "message": "Google Gemini API key is invalid. Please check Settings."
                    }
                )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"error": "gemini_execution_failed", "message": first_err or "All Gemini evaluation runs failed."}
            )

        # 5. Evaluate outputs using Gemini
        logger.info("[PromptVault] Starting evaluation")
        prompt_a_sys = version_a.system_prompt or ""
        prompt_a_user = version_a.user_prompt or ""
        prompt_b_sys = version_b.system_prompt or ""
        prompt_b_user = version_b.user_prompt or ""

        evaluation_data = await ai_service.summarize_differences(
            blueprint_name=blueprint_name,
            prompt_a_sys=prompt_a_sys,
            prompt_a_user=prompt_a_user,
            prompt_b_sys=prompt_b_sys,
            prompt_b_user=prompt_b_user,
            results_a=results_a,
            results_b=results_b,
            api_key=user_api_key
        )

        logger.info("[PromptVault] Regression analysis completed")

        # 6. Update last run telemetry in TestCase records
        regression_map = {item["test_case_id"]: item["status"] for item in evaluation_data.get("regression_report", [])}
        for runB in results_b:
            tc_id = runB["test_case_id"]
            tc = session.get(TestCase, tc_id)
            if tc:
                reg_status = regression_map.get(tc_id, "no_change")
                if reg_status == "improved":
                    tc.last_status = "pass"
                elif reg_status == "worse":
                    tc.last_status = "fail"
                else:
                    tc.last_status = "changed"
                tc.last_latency = round(runB["latency"], 3)
                tc.last_run_at = datetime.utcnow()
                session.add(tc)
        session.commit()

        scorecard = evaluation_data.get("scorecard", {})
        a_metrics = scorecard.get("version_a", {})
        b_metrics = scorecard.get("version_b", {})
        score_a_avg = sum(a_metrics.values()) / len(a_metrics) if a_metrics else 0
        score_b_avg = sum(b_metrics.values()) / len(b_metrics) if b_metrics else 0

        ActivityService.log_activity(
            session=session,
            event_type="AI Evaluation Completed",
            description=f"AI Evaluation Completed (Gemini): Score A={round(score_a_avg,1)}%, Score B={round(score_b_avg,1)}% for blueprint '{blueprint_name}'",
            blueprint_id=blueprint_id,
            user_id=user_id
        )

        for item in evaluation_data.get("regression_report", []):
            if item.get("status") == "worse":
                ActivityService.log_activity(
                    session=session,
                    event_type="Regression Detected",
                    description=f"Regression detected in test case '{item.get('test_case_name')}' for blueprint '{blueprint_name}' (compared {ver_a_label} vs {ver_b_label}): {item.get('explanation')}",
                    blueprint_id=blueprint_id,
                    user_id=user_id
                )

        completed_a = [r for r in results_a if r["status"] == "completed"]
        completed_b = [r for r in results_b if r["status"] == "completed"]
        avg_latency_a = sum(r["latency"] for r in completed_a) / len(completed_a) if completed_a else 0
        avg_latency_b = sum(r["latency"] for r in completed_b) / len(completed_b) if completed_b else 0
        total_tokens_a = sum(r["token_usage"] for r in completed_a)
        total_tokens_b = sum(r["token_usage"] for r in completed_b)
        total_cost_a = sum(r["estimated_cost"] for r in completed_a)
        total_cost_b = sum(r["estimated_cost"] for r in completed_b)

        _comparison = Comparison(
            user_id=user_id,
            blueprint_id=blueprint_id,
            version_a_id=version_a_id,
            version_b_id=version_b_id,
        )
        session.add(_comparison)
        session.commit()

        logger.info("[PromptVault] Evaluation completed")

        return {
            "summary": evaluation_data.get("summary", {
                "behavior_changes": "Not generated.",
                "strengths": [],
                "weaknesses": [],
                "recommendation": "Not decided."
            }),
            "regression_report": evaluation_data.get("regression_report", []),
            "scorecard": evaluation_data.get("scorecard", {
                "version_a": {"helpfulness": 0, "accuracy": 0, "consistency": 0, "safety": 0, "conciseness": 0, "professional_tone": 0},
                "version_b": {"helpfulness": 0, "accuracy": 0, "consistency": 0, "safety": 0, "conciseness": 0, "professional_tone": 0}
            }),
            "test_case_comments": evaluation_data.get("test_case_comments", {}),
            "resultsA": results_a,
            "resultsB": results_b,
            "metrics": {
                "averageLatencyA": round(avg_latency_a, 3),
                "averageLatencyB": round(avg_latency_b, 3),
                "totalTokensA": total_tokens_a,
                "totalTokensB": total_tokens_b,
                "estimatedCostA": round(total_cost_a, 6),
                "estimatedCostB": round(total_cost_b, 6)
            }
        }
