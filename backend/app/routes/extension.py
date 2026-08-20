import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select, func
from app.database.connection import get_session
from app.models.blueprint import Blueprint
from app.models.version import Version
from app.models.activity import Activity
from app.auth.security import get_current_user, AuthenticatedUser

router = APIRouter(prefix="/extension", tags=["Extension"])


class QuickSaveRequest(BaseModel):
    blueprint_id: Optional[int] = None     # None = create or find by name
    blueprint_name: Optional[str] = None   # Default "Quick Save" if not provided
    system_prompt: str                     # Captured prompt text
    source_site: Optional[str] = "Unknown" # "ChatGPT" | "Claude" | "Gemini" etc.


class QuickSaveResponse(BaseModel):
    success: bool = True
    blueprint_id: int
    blueprint_name: str
    version_number: int
    version: str
    version_id: str
    created_at: str
    is_new_blueprint: bool


@router.post("/quick-save", response_model=QuickSaveResponse, status_code=status.HTTP_201_CREATED)
def quick_save_prompt(
    data: QuickSaveRequest,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Extension atomic one-click save endpoint.
    1. Authenticate current user
    2. Find or create the target blueprint (e.g. "Quick Save")
    3. Find the latest version & compute next version number
    4. Save the prompt version
    5. Log activity
    6. Return saved blueprint/version atomically in ONE single database commit.
    """
    user_id = current_user.id
    prompt_text = (data.system_prompt or "").strip()
    if not prompt_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prompt text cannot be empty."
        )

    blueprint = None
    is_new_blueprint = False

    # ── 1 & 2. Find or Create Blueprint ──────────────────────────────────────
    if data.blueprint_id is not None:
        blueprint = session.get(Blueprint, data.blueprint_id)
        if not blueprint or blueprint.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Blueprint {data.blueprint_id} not found."
            )
    else:
        bp_name = (data.blueprint_name or "Quick Save").strip()
        existing = session.exec(
            select(Blueprint).where(
                Blueprint.user_id == user_id,
                func.lower(func.trim(Blueprint.name)) == bp_name.lower()
            )
        ).first()

        if existing:
            blueprint = existing
        else:
            blueprint = Blueprint(
                name=bp_name,
                description=f"Created from {data.source_site or 'extension'}",
                user_id=user_id
            )
            session.add(blueprint)
            session.flush()  # Allocates blueprint.id without committing
            is_new_blueprint = True

            activity_bp = Activity(
                event_type="Blueprint Created",
                description=f"Created blueprint '{blueprint.name}' from {data.source_site}",
                blueprint_id=blueprint.id,
                user_id=user_id,
                created_at=datetime.utcnow()
            )
            session.add(activity_bp)

    # ── 3 & 4. Find Latest Version & Calculate Next Version Number ───────────
    latest_version = session.exec(
        select(Version)
        .where(Version.blueprint_id == blueprint.id, Version.user_id == user_id)
        .order_by(Version.version_number.desc())
    ).first()

    if latest_version:
        next_num = (latest_version.version_number or 0) + 1
        existing_system_prompt = latest_version.system_prompt or ""
    else:
        next_num = 1
        existing_system_prompt = ""

    params = json.dumps({
        "source_site": data.source_site or "Unknown",
        "saved_via": "extension"
    })

    # ── 5 & 6. Create Version & Activity Log ─────────────────────────────────
    version = Version(
        blueprint_id=blueprint.id,
        user_id=user_id,
        version_number=next_num,
        system_prompt=existing_system_prompt,
        user_prompt=prompt_text,
        parameters_json=params,
        created_at=datetime.utcnow()
    )
    session.add(version)
    session.flush()  # Allocates version.id

    activity_ver = Activity(
        event_type="Prompt Saved",
        description=f"Saved V{next_num} from {data.source_site} for blueprint '{blueprint.name}'",
        blueprint_id=blueprint.id,
        version_id=version.id,
        user_id=user_id,
        created_at=datetime.utcnow()
    )
    session.add(activity_ver)

    # ── 7. Single Atomic Commit ─────────────────────────────────────────────
    session.commit()
    session.refresh(version)

    return QuickSaveResponse(
        success=True,
        blueprint_id=blueprint.id,
        blueprint_name=blueprint.name,
        version_number=next_num,
        version=f"V{next_num}",
        version_id=str(version.id),
        created_at=version.created_at.isoformat(),
        is_new_blueprint=is_new_blueprint
    )


@router.get("/blueprints")
def get_extension_blueprints(
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Returns the 10 most recently used blueprints for the extension popup list.
    Optimized with single grouped query instead of N+1 database queries.
    """
    blueprints = session.exec(
        select(Blueprint)
        .where(Blueprint.user_id == current_user.id)
        .order_by(Blueprint.created_at.desc())
        .limit(10)
    ).all()

    if not blueprints:
        return []

    bp_ids = [bp.id for bp in blueprints if bp.id is not None]

    version_stats = session.exec(
        select(
            Version.blueprint_id,
            func.count(Version.id).label("version_count"),
            func.max(Version.version_number).label("latest_version"),
            func.max(Version.created_at).label("last_updated")
        )
        .where(Version.blueprint_id.in_(bp_ids))
        .group_by(Version.blueprint_id)
    ).all()

    stats_map = {
        row[0]: {
            "version_count": row[1] or 0,
            "latest_version": row[2] or 0,
            "last_updated": row[3]
        }
        for row in version_stats
    }

    result = []
    for bp in blueprints:
        st = stats_map.get(bp.id, {"version_count": 0, "latest_version": 0, "last_updated": None})
        latest_ver_num = st["version_count"] or st["latest_version"] or 1
        updated_at = (st["last_updated"] or bp.created_at).isoformat()

        result.append({
            "id": bp.id,
            "name": bp.name,
            "description": bp.description,
            "version_count": latest_ver_num,
            "latest_version": latest_ver_num,
            "updated_at": updated_at
        })

    return result

