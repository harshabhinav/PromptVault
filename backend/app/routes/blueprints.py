from typing import List
from fastapi import APIRouter, Depends, status
from sqlmodel import Session
from app.database.connection import get_session
from app.schemas.blueprint import BlueprintCreate, BlueprintUpdate, BlueprintResponse, BlueprintDashboardResponse
from app.services.blueprint import BlueprintService
from app.auth.security import get_current_user, AuthenticatedUser

router = APIRouter(prefix="/blueprints", tags=["Blueprints"])

@router.post("", response_model=BlueprintResponse, status_code=status.HTTP_201_CREATED)
def create_blueprint(
    data: BlueprintCreate,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    return BlueprintService.create(session, data, current_user.id)

@router.get("/dashboard", response_model=List[BlueprintDashboardResponse])
def list_blueprints_dashboard(
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    return BlueprintService.get_dashboard(session, current_user.id)

@router.get("/", response_model=List[BlueprintResponse])
@router.get("", response_model=List[BlueprintResponse])
def list_blueprints(
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    return BlueprintService.get_all(session, current_user.id)

@router.get("/{id}", response_model=BlueprintResponse)
def get_blueprint(
    id: int,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    return BlueprintService.get_by_id(session, id, current_user.id)

@router.put("/{id}", response_model=BlueprintResponse)
def update_blueprint(
    id: int,
    data: BlueprintUpdate,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    return BlueprintService.update(session, id, data, current_user.id)

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blueprint(
    id: int,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    BlueprintService.delete(session, id, current_user.id)
    return None

@router.patch("/{id}/pin", response_model=BlueprintResponse)
def toggle_pin_blueprint(
    id: int,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    return BlueprintService.toggle_pin(session, id, current_user.id)

@router.post("/{id}/fork", response_model=BlueprintResponse, status_code=status.HTTP_201_CREATED)
def fork_blueprint(
    id: int,
    session: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    return BlueprintService.fork(session, id, current_user.id)
