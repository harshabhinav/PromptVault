import re
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func, delete
from app.database.connection import get_session
from app.models.activity import Activity
from app.models.blueprint import Blueprint
from app.models.version import Version
from app.models.test_case import TestCase
from app.models.comparison import Comparison
from app.auth.security import get_current_user, AuthenticatedUser

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.delete("/activities", status_code=status.HTTP_200_OK)
@router.delete("/activity", status_code=status.HTTP_200_OK)
def clear_activities(
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    session.exec(delete(Activity).where(Activity.user_id == current_user.id))
    session.commit()
    return {"message": "All activity logs cleared successfully."}


@router.delete("/activities/{activity_id}", status_code=status.HTTP_200_OK)
def delete_activity(
    activity_id: int,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """Deletes a single activity log entry (never the underlying blueprint/version/etc.)."""
    activity = session.get(Activity, activity_id)
    if not activity or activity.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity not found."
        )
    session.delete(activity)
    session.commit()
    return {"message": "Activity deleted successfully.", "id": activity_id}


@router.get("/stats")
def get_dashboard_stats(
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
) -> Dict[str, Any]:
    # 1. Total Blueprints for user
    total_blueprints = session.exec(
        select(func.count(Blueprint.id)).where(Blueprint.user_id == current_user.id)
    ).first() or 0

    # 2. Total Versions for user
    total_versions = session.exec(
        select(func.count(Version.id)).where(Version.user_id == current_user.id)
    ).first() or 0

    # 3. Total Test Cases for user
    total_test_cases = session.exec(
        select(func.count(TestCase.id)).where(TestCase.user_id == current_user.id)
    ).first() or 0

    # 4. Total Comparisons for user — sourced from the dedicated Comparison table
    # This is the authoritative count: one row = one comparison run, always filtered by user_id
    total_comparisons = session.exec(
        select(func.count(Comparison.id)).where(
            Comparison.user_id == current_user.id
        )
    ).first() or 0

    # 5. Regression Warnings for user
    regression_warnings = session.exec(
        select(func.count(Activity.id)).where(
            Activity.user_id == current_user.id,
            Activity.event_type == "Regression Detected"
        )
    ).first() or 0

    # 6. Average AI Score for user
    eval_activities = session.exec(
        select(Activity).where(
            Activity.user_id == current_user.id,
            Activity.event_type == "AI Evaluation Completed"
        )
    ).all()
    
    scores = []
    for act in eval_activities:
        match = re.search(r"Score A=(\d+(?:\.\d+)?)%, Score B=(\d+(?:\.\d+)?)%", act.description)
        if match:
            scores.append(float(match.group(1)))
            scores.append(float(match.group(2)))
            
    average_ai_score = round(sum(scores) / len(scores), 1) if scores else None

    return {
        "total_blueprints": total_blueprints,
        "total_versions": total_versions,
        "total_comparisons": total_comparisons,
        "total_test_cases": total_test_cases,
        "regression_warnings": regression_warnings,
        "average_ai_score": average_ai_score
    }

@router.get("/activities")
def get_recent_activities(
    search: Optional[str] = None,
    type: Optional[str] = None,
    limit: int = 15,
    offset: int = 0,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
) -> Dict[str, Any]:
    # Build query for user
    statement = select(Activity).where(Activity.user_id == current_user.id)

    # 1. Filter by activity type category
    if type and type != "All":
        type_lower = type.lower()
        if "blueprint" in type_lower:
            statement = statement.where(Activity.event_type.in_(["Blueprint Created", "Blueprint Updated", "Blueprint Deleted", "Blueprint Renamed"]))
        elif "version" in type_lower:
            statement = statement.where(Activity.event_type.in_(["Version Saved", "Version Restored", "Version Deleted"]))
        elif "evaluat" in type_lower:
            statement = statement.where(Activity.event_type.in_(["AI Evaluation Completed", "Evaluation Completed"]))
        elif "compar" in type_lower:
            statement = statement.where(Activity.event_type.in_(["Prompt Compared"]))
        elif "regress" in type_lower:
            statement = statement.where(Activity.event_type.in_(["Regression Detected"]))
        elif "test" in type_lower:
            statement = statement.where(Activity.event_type.in_(["Test Case Added", "Test Case Updated", "Test Case Deleted"]))
        elif "generator" in type_lower:
            statement = statement.where(Activity.event_type.in_(["Prompt Generated", "Prompt Improved"]))
        elif "playground" in type_lower:
            statement = statement.where(Activity.event_type.in_(["Playground Session Saved"]))

    # 2. Search filter in SQL across description and event_type
    if search and search.strip():
        s = f"%{search.strip()}%"
        statement = statement.where(
            (Activity.description.like(s)) | (Activity.event_type.like(s))
        )

    # Get total matching count
    count_statement = select(func.count()).select_from(statement.subquery())
    total_count = session.exec(count_statement).first() or 0

    # Paginate and sort
    statement = statement.order_by(Activity.created_at.desc()).limit(limit).offset(offset)
    activities = session.exec(statement).all()
    
    items = []
    for act in activities:
        bp_name = ""
        if act.blueprint_id:
            bp = session.get(Blueprint, act.blueprint_id)
            if bp:
                bp_name = bp.name

        ver_label = ""
        if act.version_id:
            ver = session.get(Version, act.version_id)
            if ver and ver.version_number:
                ver_label = f"V{ver.version_number}"

        items.append({
            "id": act.id,
            "event_type": act.event_type,
            "blueprint_id": act.blueprint_id,
            "blueprint_name": bp_name,
            "version_id": act.version_id,
            "version_label": ver_label,
            "description": act.description,
            "created_at": act.created_at.isoformat()
        })

    return {
        "items": items,
        "total": total_count,
        "has_more": (offset + limit) < total_count,
        "limit": limit,
        "offset": offset
    }

@router.get("/regressions")
def get_regressions_list(
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    statement = select(Activity).where(
        Activity.user_id == current_user.id,
        Activity.event_type == "Regression Detected"
    ).order_by(Activity.created_at.desc())
    activities = session.exec(statement).all()
    
    result = []
    for act in activities:
        blueprint_name = "Unknown Blueprint"
        bp_match = re.search(r"blueprint '([^']+)'", act.description)
        if bp_match:
            blueprint_name = bp_match.group(1)
            
        tc_name = "Unknown Test Case"
        tc_match = re.search(r"test case '([^']+)'", act.description)
        if tc_match:
            tc_name = tc_match.group(1)
            
        compared_versions = "N/A"
        versions_match = re.search(r"compared ([^)]+)", act.description)
        if versions_match:
            compared_versions = versions_match.group(1)
            
        reason = ""
        reason_match = re.search(r":\s*(.*)$", act.description)
        if reason_match:
            reason = reason_match.group(1)
            # Remove compared versions if it overlaps with reason
            reason = re.sub(r"\(compared (?:Node \d+|V\d+) vs (?:Node \d+|V\d+)\)\s*", "", reason)
            
        result.append({
            "id": act.id,
            "blueprint_id": act.blueprint_id,
            "blueprint_name": blueprint_name,
            "compared_versions": compared_versions,
            "test_case_name": tc_name,
            "explanation": reason,
            "created_at": act.created_at.isoformat()
        })
    return result

@router.delete("/regressions/all", status_code=status.HTTP_204_NO_CONTENT)
def clear_all_regressions(
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    from sqlmodel import delete
    session.exec(
        delete(Activity).where(
            Activity.user_id == current_user.id,
            Activity.event_type == "Regression Detected"
        )
    )
    session.commit()
    return None

@router.delete("/regressions/{id}", status_code=status.HTTP_204_NO_CONTENT)
def clear_regression(
    id: int,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    from fastapi import HTTPException
    activity = session.get(Activity, id)
    if not activity or activity.user_id != current_user.id or activity.event_type != "Regression Detected":
        raise HTTPException(status_code=404, detail="Regression warning not found")
    
    session.delete(activity)
    session.commit()
    return None
