import json
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from sqlmodel import Session, select
from app.models.test_case import TestCase
from app.models.blueprint import Blueprint
from app.schemas.test_case import TestCaseCreate, SingleTestRunRequest
from app.services.ai_service import ai_service

class TestCaseService:
    @staticmethod
    def get_by_blueprint(session: Session, blueprint_id: int, user_id: str) -> List[TestCase]:
        blueprint = session.get(Blueprint, blueprint_id)
        if not blueprint or blueprint.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Blueprint with ID {blueprint_id} not found"
            )
        statement = select(TestCase).where(TestCase.blueprint_id == blueprint_id, TestCase.user_id == user_id)
        return session.exec(statement).all()

    @staticmethod
    def create(session: Session, blueprint_id: int, data: TestCaseCreate, user_id: str) -> TestCase:
        blueprint = session.get(Blueprint, blueprint_id)
        if not blueprint or blueprint.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Blueprint with ID {blueprint_id} not found"
            )
        
        test_case = TestCase(
            blueprint_id=blueprint_id,
            user_id=user_id,
            name=data.name,
            input_text=data.input_text,
            expected_behavior=data.expected_behavior,
            last_status="unevaluated",
            last_latency=0.0,
            last_run_at=None
        )
        session.add(test_case)
        session.commit()
        session.refresh(test_case)
        
        from app.services.activity import ActivityService
        ActivityService.log_activity(
            session=session,
            event_type="Test Case Added",
            description=f"Added test case '{test_case.name}' to blueprint '{blueprint.name}'",
            blueprint_id=blueprint_id,
            user_id=user_id
        )
        return test_case

    @staticmethod
    def update(session: Session, test_case_id: int, data: TestCaseCreate, user_id: str) -> TestCase:
        test_case = session.get(TestCase, test_case_id)
        if not test_case or test_case.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"TestCase with ID {test_case_id} not found"
            )
        
        test_case.name = data.name
        test_case.input_text = data.input_text
        test_case.expected_behavior = data.expected_behavior
        
        session.add(test_case)
        session.commit()
        session.refresh(test_case)
        return test_case

    @staticmethod
    def delete(session: Session, test_case_id: int, user_id: str) -> None:
        test_case = session.get(TestCase, test_case_id)
        if not test_case or test_case.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"TestCase with ID {test_case_id} not found"
            )
        blueprint_id = test_case.blueprint_id
        blueprint = session.get(Blueprint, blueprint_id)
        blueprint_name = blueprint.name if blueprint else "Unnamed"
        
        session.delete(test_case)
        session.commit()
        
        from app.services.activity import ActivityService
        ActivityService.log_activity(
            session=session,
            event_type="Test Case Deleted",
            description=f"Deleted test case '{test_case.name}' from blueprint '{blueprint_name}'",
            blueprint_id=blueprint_id,
            user_id=user_id
        )

    @staticmethod
    def duplicate(session: Session, test_case_id: int, user_id: str) -> TestCase:
        test_case = session.get(TestCase, test_case_id)
        if not test_case or test_case.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"TestCase with ID {test_case_id} not found"
            )
        
        new_name = f"{test_case.name} Copy"
        new_tc = TestCase(
            blueprint_id=test_case.blueprint_id,
            user_id=user_id,
            name=new_name,
            input_text=test_case.input_text,
            expected_behavior=test_case.expected_behavior,
            last_status="unevaluated",
            last_latency=0.0,
            last_run_at=None
        )
        session.add(new_tc)
        session.commit()
        session.refresh(new_tc)
        
        blueprint = session.get(Blueprint, test_case.blueprint_id)
        blueprint_name = blueprint.name if blueprint else "Unnamed"
        
        from app.services.activity import ActivityService
        ActivityService.log_activity(
            session=session,
            event_type="Test Case Added",
            description=f"Duplicated test case '{test_case.name}' as '{new_tc.name}' in blueprint '{blueprint_name}'",
            blueprint_id=test_case.blueprint_id,
            user_id=user_id
        )
        return new_tc

    @staticmethod
    async def run_single_test(session: Session, data: SingleTestRunRequest) -> Dict[str, Any]:
        # Extract variables from user prompt template
        var_names = re.findall(r"\{\{\s*([^}]+)\s*\}\}", data.user_prompt)
        var_names = [v.strip() for v in var_names]
        
        variables = {}
        try:
            variables = json.loads(data.input_text)
            if not isinstance(variables, dict):
                variables = {v: data.input_text for v in var_names} if var_names else {"input": data.input_text}
        except json.JSONDecodeError:
            variables = {v: data.input_text for v in var_names} if var_names else {"input": data.input_text}

        output_text, latency, tokens, cost = await ai_service.generate_completion(
            system_prompt=data.system_prompt,
            user_prompt_template=data.user_prompt,
            variables=variables
        )
        
        # Evaluate status: pass/fail/changed
        eval_status = "changed"
        if data.expected_behavior:
            expected_words = [w.lower() for w in re.findall(r'\w+', data.expected_behavior) if len(w) > 3]
            output_lower = output_text.lower()
            if expected_words:
                matches = sum(1 for w in expected_words if w in output_lower)
                # If matches at least 30% of keywords, mark pass
                if matches >= max(1, int(len(expected_words) * 0.3)):
                    eval_status = "pass"
                else:
                    eval_status = "fail"
            else:
                eval_status = "pass"
        
        # Persist telemetry back to TestCase row if ID is present
        if data.test_case_id:
            tc = session.get(TestCase, data.test_case_id)
            if tc:
                tc.last_status = eval_status
                tc.last_latency = round(latency, 3)
                tc.last_run_at = datetime.utcnow()
                session.add(tc)
                session.commit()

        return {
            "output_text": output_text,
            "latency": latency,
            "token_usage": tokens,
            "estimated_cost": cost,
            "timestamp": datetime.utcnow().isoformat()
        }
