from typing import List, Dict, Any
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlmodel import Session, select, delete
from app.database.connection import get_session
from app.schemas.compare import CompareRequest, CompareResponse
from app.services.compare_service import CompareService
from app.models.comparison import Comparison
from app.models.blueprint import Blueprint
from app.models.version import Version
from app.auth.security import get_current_user, AuthenticatedUser
from pydantic import BaseModel, Field as PydanticField

router = APIRouter(prefix="/compare", tags=["Compare Engine"])


class ComparisonHistoryItem(BaseModel):
    id: int
    blueprint_id: int
    blueprint_name: str
    version_a_id: int
    version_b_id: int
    version_a_label: str
    version_b_label: str
    comparison_type: str = "version"
    status: str = "success"
    created_at: str


@router.post("", response_model=CompareResponse, status_code=status.HTTP_200_OK)
async def run_comparison(
    data: CompareRequest,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Accepts two Version IDs.
    Loads all test inputs for both versions, runs prompt completions concurrently,
    saves the results to the database, generates a comparative AI summary, and returns the aggregated results.
    """
    return await CompareService.run_comparison(session, data.versionA, data.versionB, current_user.id)


class GitDiffRequest(BaseModel):
    versionA: int
    versionB: int
    blueprintId: int

@router.post("/git-diff", status_code=status.HTTP_201_CREATED)
def log_git_diff_comparison(
    data: GitDiffRequest,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Logs a successful Git Difference visual comparison into the database.
    This ensures the 'Comparison Runs' metric increments.
    """
    comp = Comparison(
        user_id=current_user.id,
        blueprint_id=data.blueprintId,
        version_a_id=data.versionA,
        version_b_id=data.versionB,
        comparison_type="git_diff"
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    return {"message": "Git difference logged successfully", "id": comp.id}


@router.get("/history", response_model=List[ComparisonHistoryItem])
def get_comparison_history(
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Returns all successful comparison run records for the authenticated user,
    ordered by created_at descending.
    """
    records = session.exec(
        select(Comparison)
        .where(Comparison.user_id == current_user.id)
        .order_by(Comparison.created_at.desc())
    ).all()

    result = []
    for comp in records:
        bp = session.get(Blueprint, comp.blueprint_id)
        bp_name = bp.name if bp else f"Blueprint #{comp.blueprint_id}"

        ver_a = session.get(Version, comp.version_a_id)
        ver_b = session.get(Version, comp.version_b_id)

        ver_a_label = f"V{ver_a.version_number}" if ver_a and ver_a.version_number else f"Node #{comp.version_a_id}"
        ver_b_label = f"V{ver_b.version_number}" if ver_b and ver_b.version_number else f"Node #{comp.version_b_id}"

        result.append({
            "id": comp.id,
            "blueprint_id": comp.blueprint_id,
            "blueprint_name": bp_name,
            "version_a_id": comp.version_a_id,
            "version_b_id": comp.version_b_id,
            "version_a_label": ver_a_label,
            "version_b_label": ver_b_label,
            "comparison_type": comp.comparison_type,
            "status": "success",
            "created_at": comp.created_at.isoformat()
        })

    return result


@router.delete("/history", status_code=status.HTTP_200_OK)
def clear_comparison_history(
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Permanently deletes ONLY comparison records for the authenticated user.
    Resets the Comparison Runs count to 0 without deleting blueprints or versions.
    """
    session.exec(
        delete(Comparison).where(Comparison.user_id == current_user.id)
    )
    session.commit()
    return {"message": "Comparison history cleared successfully."}

