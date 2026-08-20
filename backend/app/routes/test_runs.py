from typing import List
from fastapi import APIRouter, Depends, status
from sqlmodel import Session
from app.database.connection import get_session
from app.schemas.test_run import TestRunCreate, TestRunResponse
from app.services.test_run import TestRunService

router = APIRouter(tags=["Test Runs"])

@router.post("/test-runs", response_model=TestRunResponse, status_code=status.HTTP_201_CREATED)
def create_test_run(data: TestRunCreate, session: Session = Depends(get_session)):
    return TestRunService.create(session, data)

@router.get("/versions/{id}/test-runs", response_model=List[TestRunResponse])
def list_test_runs(id: int, session: Session = Depends(get_session)):
    return TestRunService.get_by_version(session, id)
