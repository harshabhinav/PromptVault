from typing import List
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select, func
from app.models.version import Version
from app.models.blueprint import Blueprint
from app.models.activity import Activity
from app.schemas.version import VersionCreate
from app.utils.datetime import utc_now

class VersionService:
    @staticmethod
    def acquire_save_lock(session: Session, user_id: str) -> None:
        """
        Serializes save operations per user for the current transaction (released on
        commit/rollback) so concurrent saves can't compute the same version number or
        create duplicate 'Quick Save' blueprints.
        """
        if session.get_bind().dialect.name == "postgresql":
            session.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:key))"),
                {"key": f"promptvault-save:{user_id}"},
            )

    @staticmethod
    def create(session: Session, data: VersionCreate, user_id: str) -> Version:
        VersionService.acquire_save_lock(session, user_id)

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

        version_dict = data.model_dump()
        version_dict["user_id"] = user_id
        version_dict["version_number"] = next_num
        version = Version.model_validate(version_dict)

        import json
        commit_memo = ""
        try:
            params = json.loads(version.parameters_json or "{}")
            if params.get("tag"):
                commit_memo = f" — {params['tag']}"
        except Exception:
            pass

        try:
            session.add(version)
            session.flush()  # Allocates version.id

            # Version and its activity entry are committed atomically.
            session.add(Activity(
                event_type="Version Saved",
                description=f"Saved V{next_num}{commit_memo} for blueprint '{blueprint.name}'",
                blueprint_id=blueprint.id,
                version_id=version.id,
                user_id=user_id,
                created_at=utc_now()
            ))
            session.commit()
        except SQLAlchemyError:
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not save the version due to a database error. Nothing was saved; please try again."
            )
        session.refresh(version)
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
