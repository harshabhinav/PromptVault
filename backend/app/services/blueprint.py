from typing import List, Optional
from fastapi import HTTPException, status
from sqlmodel import Session, select, func
from app.models.blueprint import Blueprint
from app.models.version import Version
from app.models.test_case import TestCase
from app.models.activity import Activity
from app.schemas.blueprint import BlueprintCreate, BlueprintUpdate, BlueprintResponse, BlueprintDashboardResponse

class BlueprintService:
    @staticmethod
    def _check_name_uniqueness(session: Session, name: str, user_id: str, exclude_id: Optional[int] = None):
        cleaned_name = name.strip()
        if not cleaned_name:
            return
        
        statement = select(Blueprint).where(
            func.lower(func.trim(Blueprint.name)) == func.lower(cleaned_name),
            Blueprint.user_id == user_id
        )
        if exclude_id is not None:
            statement = statement.where(Blueprint.id != exclude_id)
            
        existing = session.exec(statement).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Blueprint name already exists."
            )

    @staticmethod
    def create(session: Session, data: BlueprintCreate, user_id: str) -> Blueprint:
        # Validate uniqueness of blueprint name (case-insensitive & trimmed per user)
        BlueprintService._check_name_uniqueness(session, data.name, user_id)

        # If forked_from is specified, verify it exists and belongs to user
        if data.forked_from:
            parent = session.get(Blueprint, data.forked_from)
            if not parent or parent.user_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Parent blueprint with ID {data.forked_from} does not exist"
                )
        
        data.name = data.name.strip()
        blueprint = Blueprint.model_validate(data)
        blueprint.user_id = user_id
        session.add(blueprint)
        session.commit()
        session.refresh(blueprint)
        
        from app.services.activity import ActivityService
        ActivityService.log_activity(
            session=session,
            event_type="Blueprint Created",
            description=f"Created blueprint '{blueprint.name}'",
            blueprint_id=blueprint.id,
            user_id=user_id
        )
        return blueprint

    @staticmethod
    def get_all(session: Session, user_id: str) -> List[BlueprintResponse]:
        # Return user blueprints ordered by is_pinned DESC, pinned_at DESC, created_at DESC
        blueprints = session.exec(
            select(Blueprint)
            .where(Blueprint.user_id == user_id)
            .order_by(
                Blueprint.is_pinned.desc(),
                Blueprint.pinned_at.desc(),
                Blueprint.created_at.desc()
            )
        ).all()
        results = []
        for bp in blueprints:
            count = session.exec(
                select(func.count(Version.id)).where(Version.blueprint_id == bp.id)
            ).first() or 0
            
            # Map SQLModel to Pydantic and append version count
            bp_res = BlueprintResponse.model_validate(bp)
            bp_res.version_count = count
            results.append(bp_res)
        return results

    @staticmethod
    def get_dashboard(session: Session, user_id: str) -> List[BlueprintDashboardResponse]:
        import re
        blueprints = session.exec(
            select(Blueprint)
            .where(Blueprint.user_id == user_id)
            .order_by(
                Blueprint.is_pinned.desc(),
                Blueprint.pinned_at.desc(),
                Blueprint.created_at.desc()
            )
        ).all()
        
        results = []
        for bp in blueprints:
            # 1. Version count
            v_count = session.exec(
                select(func.count(Version.id)).where(Version.blueprint_id == bp.id)
            ).first() or 0
            
            # 2. Test case count
            tc_count = session.exec(
                select(func.count(TestCase.id)).where(TestCase.blueprint_id == bp.id)
            ).first() or 0
            
            # 3. Average AI Score for this blueprint
            eval_activities = session.exec(
                select(Activity).where(
                    Activity.blueprint_id == bp.id,
                    Activity.user_id == user_id,
                    Activity.event_type == "AI Evaluation Completed"
                )
            ).all()
            
            scores = []
            for act in eval_activities:
                match = re.search(r"Score A=(\d+(?:\.\d+)?)%, Score B=(\d+(?:\.\d+)?)%", act.description or "")
                if match:
                    scores.append(float(match.group(1)))
                    scores.append(float(match.group(2)))
                    
            avg_score = round(sum(scores) / len(scores)) if scores else None

            # 4. Last updated timestamp
            latest_act = session.exec(
                select(func.max(Activity.created_at)).where(Activity.blueprint_id == bp.id)
            ).first()
            
            latest_ver = session.exec(
                select(func.max(Version.created_at)).where(Version.blueprint_id == bp.id)
            ).first()

            timestamps = [bp.created_at]
            if latest_act:
                timestamps.append(latest_act)
            if latest_ver:
                timestamps.append(latest_ver)
                
            last_updated = max(timestamps)
            
            res = BlueprintDashboardResponse(
                id=bp.id,
                name=bp.name,
                description=bp.description,
                forked_from=bp.forked_from,
                is_pinned=bp.is_pinned,
                pinned_at=bp.pinned_at,
                created_at=bp.created_at,
                version_count=v_count,
                test_case_count=tc_count,
                average_ai_score=avg_score,
                last_updated=last_updated
            )
            results.append(res)
            
        return results

    @staticmethod
    def toggle_pin(session: Session, blueprint_id: int, user_id: str) -> BlueprintResponse:
        from datetime import datetime
        blueprint = session.get(Blueprint, blueprint_id)
        if not blueprint or blueprint.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Blueprint with ID {blueprint_id} not found"
            )
        
        blueprint.is_pinned = not blueprint.is_pinned
        if blueprint.is_pinned:
            blueprint.pinned_at = datetime.utcnow()
        else:
            blueprint.pinned_at = None

        session.add(blueprint)
        session.commit()
        session.refresh(blueprint)

        from app.services.activity import ActivityService
        ActivityService.log_activity(
            session=session,
            event_type="Blueprint Updated",
            description=f"{'Pinned' if blueprint.is_pinned else 'Unpinned'} blueprint '{blueprint.name}'",
            blueprint_id=blueprint.id
        )

        count = session.exec(
            select(func.count(Version.id)).where(Version.blueprint_id == blueprint_id)
        ).first() or 0
        
        bp_res = BlueprintResponse.model_validate(blueprint)
        bp_res.version_count = count
        return bp_res

    @staticmethod
    def get_by_id(session: Session, blueprint_id: int, user_id: str) -> BlueprintResponse:
        blueprint = session.get(Blueprint, blueprint_id)
        if not blueprint or blueprint.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Blueprint with ID {blueprint_id} not found"
            )
        count = session.exec(
            select(func.count(Version.id)).where(Version.blueprint_id == blueprint_id)
        ).first() or 0
        
        bp_res = BlueprintResponse.model_validate(blueprint)
        bp_res.version_count = count
        return bp_res

    @staticmethod
    def update(session: Session, blueprint_id: int, data: BlueprintUpdate, user_id: str) -> BlueprintResponse:
        blueprint = session.get(Blueprint, blueprint_id)
        if not blueprint or blueprint.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Blueprint with ID {blueprint_id} not found"
            )
        
        if data.name is not None:
            BlueprintService._check_name_uniqueness(session, data.name, user_id, exclude_id=blueprint_id)
            data.name = data.name.strip()

        update_data = data.model_dump(exclude_unset=True)
        for key, val in update_data.items():
            setattr(blueprint, key, val)
        
        session.add(blueprint)
        session.commit()
        session.refresh(blueprint)
        
        count = session.exec(
            select(func.count(Version.id)).where(Version.blueprint_id == blueprint_id)
        ).first() or 0
        
        bp_res = BlueprintResponse.model_validate(blueprint)
        bp_res.version_count = count
        return bp_res

    @staticmethod
    def delete(session: Session, blueprint_id: int, user_id: str) -> None:
        blueprint = session.get(Blueprint, blueprint_id)
        if not blueprint or blueprint.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Blueprint with ID {blueprint_id} not found"
            )
        blueprint_name = blueprint.name

        from sqlmodel import delete
        session.exec(
            delete(Activity).where(
                Activity.blueprint_id == blueprint_id,
                Activity.event_type == "Regression Detected"
            )
        )

        session.delete(blueprint)
        session.commit()
        
        from app.services.activity import ActivityService
        ActivityService.log_activity(
            session=session,
            event_type="Blueprint Deleted",
            description=f"Deleted blueprint '{blueprint_name}'",
            user_id=user_id
        )

    @staticmethod
    def fork(session: Session, blueprint_id: int, user_id: str) -> BlueprintResponse:
        source = session.get(Blueprint, blueprint_id)
        if not source or source.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Blueprint with ID {blueprint_id} not found"
            )
        
        # Determine a unique name for the forked blueprint
        base_name = f"{source.name} (Fork)"
        fork_name = base_name
        counter = 1
        while session.exec(
            select(Blueprint).where(
                func.lower(func.trim(Blueprint.name)) == func.lower(fork_name),
                Blueprint.user_id == user_id
            )
        ).first():
            counter += 1
            fork_name = f"{source.name} (Fork {counter})"

        # 1. Create new forked blueprint
        forked = Blueprint(
            name=fork_name,
            description=source.description,
            forked_from=source.id,
            user_id=user_id
        )
        session.add(forked)
        session.commit()
        session.refresh(forked)
        
        # 2. Copy latest prompt version as V1 (version_number=1)
        latest_version = session.exec(
            select(Version)
            .where(Version.blueprint_id == source.id)
            .order_by(Version.created_at.desc())
        ).first()
        
        if latest_version:
            import json
            params = {}
            try:
                params = json.loads(latest_version.parameters_json or "{}")
                # Remove any old version memo tag from original blueprint
                params.pop("tag", None)
            except Exception:
                params = {}

            forked_version = Version(
                blueprint_id=forked.id,
                user_id=user_id,
                version_number=1,  # Forked blueprint starts independently at V1
                system_prompt=latest_version.system_prompt,
                user_prompt=latest_version.user_prompt,
                parameters_json=json.dumps(params)
            )
            session.add(forked_version)
            session.commit()

        # 3. Copy test cases from original blueprint to forked blueprint
        source_test_cases = session.exec(
            select(TestCase).where(TestCase.blueprint_id == source.id)
        ).all()

        for tc in source_test_cases:
            forked_tc = TestCase(
                blueprint_id=forked.id,
                user_id=user_id,
                name=tc.name,
                input_text=tc.input_text,
                expected_behavior=tc.expected_behavior,
                last_status="unevaluated",
                last_latency=0.0,
                last_run_at=None
            )
            session.add(forked_tc)

        session.commit()
        
        # 4. Log activity
        from app.services.activity import ActivityService
        ActivityService.log_activity(
            session=session,
            event_type="Blueprint Created",
            description=f"Forked blueprint '{source.name}' as '{forked.name}' (V1 created)",
            blueprint_id=forked.id,
            user_id=user_id
        )
        
        count = 1 if latest_version else 0
        bp_res = BlueprintResponse.model_validate(forked)
        bp_res.version_count = count
        return bp_res


