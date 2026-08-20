from typing import List
from fastapi import HTTPException, status
from sqlmodel import Session, select
from app.models.test_run import TestRun
from app.models.version import Version
from app.models.test_case import TestCase
from app.schemas.test_run import TestRunCreate

class TestRunService:
    @staticmethod
    def create(session: Session, data: TestRunCreate) -> TestRun:
        # Verify version exists
        version = session.get(Version, data.version_id)
        if not version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Version with ID {data.version_id} not found"
            )
        
        # Verify test case exists
        test_case = session.get(TestCase, data.test_case_id)
        if not test_case:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"TestCase with ID {data.test_case_id} not found"
            )
            
        # Ensure test case belongs to the correct blueprint
        if test_case.blueprint_id != version.blueprint_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"TestCase with ID {data.test_case_id} does not belong to blueprint {version.blueprint_id}"
            )
        
        test_run = TestRun(
            version_id=data.version_id,
            test_case_id=data.test_case_id,
            output_text=data.output_text,
            latency=data.latency,
            token_usage=data.token_usage
        )
        session.add(test_run)
        session.commit()
        session.refresh(test_run)
        return test_run

    @staticmethod
    def get_by_version(session: Session, version_id: int) -> List[TestRun]:
        # Verify version exists
        version = session.get(Version, version_id)
        if not version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Version with ID {version_id} not found"
            )
        
        statement = select(TestRun).where(TestRun.version_id == version_id).order_by(TestRun.created_at.desc())
        return session.exec(statement).all()

    @staticmethod
    def delete_by_version(session: Session, version_id: int) -> None:
        statement = select(TestRun).where(TestRun.version_id == version_id)
        runs = session.exec(statement).all()
        for run in runs:
            session.delete(run)
        session.commit()
