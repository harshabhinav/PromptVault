from typing import Optional
from sqlmodel import Session
from app.models.activity import Activity
from app.utils.datetime import utc_now

class ActivityService:
    @staticmethod
    def log_activity(
        session: Session,
        event_type: str,
        description: str,
        blueprint_id: Optional[int] = None,
        version_id: Optional[int] = None,
        user_id: Optional[str] = None
    ) -> Activity:
        activity = Activity(
            event_type=event_type,
            description=description,
            blueprint_id=blueprint_id,
            version_id=version_id,
            user_id=user_id,
            created_at=utc_now()
        )
        session.add(activity)
        session.commit()
        session.refresh(activity)
        return activity
