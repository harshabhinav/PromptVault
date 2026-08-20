from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select
from app.database.connection import get_session
from app.schemas.version import VersionCreate, VersionResponse
from app.services.version import VersionService
from app.models.version import Version
from app.models.blueprint import Blueprint
from app.auth.security import get_current_user, AuthenticatedUser

router = APIRouter(tags=["Versions"])


class BlueprintVersionCreatePayload(BaseModel):
    prompt_text: str
    platform: Optional[str] = "Unknown"
    source_url: Optional[str] = None
    metadata: Optional[dict] = {}


# Version Endpoints
@router.post("/versions", response_model=VersionResponse, status_code=status.HTTP_201_CREATED)
def create_version(
    data: VersionCreate,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    return VersionService.create(session, data, current_user.id)


@router.post("/blueprints/{id}/versions", status_code=status.HTTP_201_CREATED)
def create_version_for_blueprint(
    id: int,
    payload: BlueprintVersionCreatePayload,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Creates a new version for a specific blueprint.
    Verifies user ownership of blueprint before creation.
    - Preserves existing system_prompt (does not overwrite/modify).
    - Saves prompt text into user_prompt (corresponds to Blueprint Editor -> Prompt Template).
    """
    user_id = current_user.id

    # Verify blueprint exists and belongs to user
    blueprint = session.get(Blueprint, id)
    if not blueprint or blueprint.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Blueprint with ID {id} not found"
        )

    # Retrieve the latest version to copy its system_prompt
    latest_version = session.exec(
        select(Version)
        .where(Version.blueprint_id == id, Version.user_id == user_id)
        .order_by(Version.version_number.desc())
    ).first()

    existing_system_prompt = latest_version.system_prompt if latest_version else ""

    import json
    params = json.dumps({
        "platform": payload.platform or "Unknown",
        "source_url": payload.source_url,
        "metadata": payload.metadata or {}
    })

    # Save to user_prompt (Prompt Template), preserve existing_system_prompt
    data = VersionCreate(
        blueprint_id=id,
        system_prompt=existing_system_prompt,
        user_prompt=payload.prompt_text,
        parameters_json=params
    )

    created_version = VersionService.create(session, data, user_id)
    ver_label = f"V{created_version.version_number}"

    return {
        "success": True,
        "version": ver_label,
        "version_number": created_version.version_number,
        "version_id": str(created_version.id),
        "blueprint_id": id,
        "blueprint_name": blueprint.name,
        "created_at": created_version.created_at.isoformat()
    }


@router.get("/blueprints/{id}/versions", response_model=List[VersionResponse])
def list_blueprint_versions(
    id: int,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    return VersionService.get_by_blueprint(session, id, current_user.id)


@router.get("/versions/{id}", response_model=VersionResponse)
def get_version(
    id: int,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    return VersionService.get_by_id(session, id, current_user.id)


@router.delete("/versions/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_version(
    id: int,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    VersionService.delete(session, id, current_user.id)
    return None
