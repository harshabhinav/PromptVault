from typing import List
from fastapi import HTTPException, status
from sqlmodel import Session, select, func
from app.models.version import Version
from app.models.blueprint import Blueprint
from app.schemas.version import VersionCreate

class VersionService:
    @staticmethod
    def create(session: Session, data: VersionCreate, user_id: str) -> Version:
        # Verify parent blueprint exists and belongs to user
        blueprint = session.get(Blueprint, data.blueprint_id)
        if not blueprint or blueprint.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Blueprint with ID {data.blueprint_id} not found"
            )

        # Determine the next sequential version number for this blueprint
        max_num = session.exec(
            select(func.max(Version.version_number)).where(Version.blueprint_id == data.blueprint_id)
        ).one_or_none()
        next_num = (max_num or 0) + 1

        version = Version.model_validate(data)
        version.user_id = user_id
        version.version_number = next_num
        session.add(version)
        session.commit()
        session.refresh(version)

        from app.services.activity import ActivityService
        import json
        commit_memo = ""
        try:
            params = json.loads(version.parameters_json or "{}")
            if params.get("tag"):
                commit_memo = f" — {params['tag']}"
        except Exception:
            pass

        ActivityService.log_activity(
            session=session,
            event_type="Version Saved",
            description=f"Saved V{version.version_number}{commit_memo} for blueprint '{blueprint.name}'",
            blueprint_id=blueprint.id,
            version_id=version.id,
            user_id=user_id
        )
        return version

    @staticmethod
    def get_by_blueprint(session: Session, blueprint_id: int, user_id: str) -> List[Version]:
        # Verify blueprint exists and belongs to user
        blueprint = session.get(Blueprint, blueprint_id)
        if not blueprint or blueprint.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Blueprint with ID {blueprint_id} not found"
            )

        statement = select(Version).where(Version.blueprint_id == blueprint_id, Version.user_id == user_id).order_by(Version.created_at.desc())
        return session.exec(statement).all()

    @staticmethod
    def get_by_id(session: Session, version_id: int, user_id: str) -> Version:
        version = session.get(Version, version_id)
        if not version or version.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Version with ID {version_id} not found"
            )
        return version

    @staticmethod
    def delete(session: Session, version_id: int, user_id: str) -> None:
        version = session.get(Version, version_id)
        if not version or version.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Version with ID {version_id} not found"
            )
        blueprint_id = version.blueprint_id
        blueprint = session.get(Blueprint, blueprint_id)
        blueprint_name = blueprint.name if blueprint else "Unnamed"
        ver_label = f"V{version.version_number}" if version.version_number else f"version #{version_id}"

        session.delete(version)
        session.commit()

        from app.services.activity import ActivityService
        ActivityService.log_activity(
            session=session,
            event_type="Version Deleted",
            description=f"Deleted {ver_label} of blueprint '{blueprint_name}'",
            blueprint_id=blueprint_id,
            user_id=user_id
        )
