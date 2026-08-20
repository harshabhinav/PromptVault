from fastapi import APIRouter, Depends, status
from sqlmodel import Session
from typing import List
from app.database.connection import get_session
from app.schemas.test_case import TestCaseCreate, TestCaseResponse, SingleTestRunRequest, SingleTestRunResponse
from app.services.test_case import TestCaseService
from app.auth.security import get_current_user, AuthenticatedUser

router = APIRouter(tags=["Test Cases"])

@router.get("/blueprints/{blueprint_id}/test-cases", response_model=List[TestCaseResponse])
def list_test_cases(
    blueprint_id: int,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    return TestCaseService.get_by_blueprint(session, blueprint_id, current_user.id)

@router.post("/blueprints/{blueprint_id}/test-cases", response_model=TestCaseResponse, status_code=status.HTTP_201_CREATED)
def create_test_case(
    blueprint_id: int,
    data: TestCaseCreate,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    return TestCaseService.create(session, blueprint_id, data, current_user.id)

@router.put("/test-cases/{id}", response_model=TestCaseResponse)
def update_test_case(
    id: int,
    data: TestCaseCreate,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    return TestCaseService.update(session, id, data, current_user.id)

@router.delete("/test-cases/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_test_case(
    id: int,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    TestCaseService.delete(session, id, current_user.id)
    return None

@router.post("/test-cases/{id}/duplicate", response_model=TestCaseResponse, status_code=status.HTTP_201_CREATED)
def duplicate_test_case(
    id: int,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    return TestCaseService.duplicate(session, id, current_user.id)

@router.post("/test-cases/run-single", response_model=SingleTestRunResponse)
async def run_single_test(
    data: SingleTestRunRequest,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    return await TestCaseService.run_single_test(session, data)
