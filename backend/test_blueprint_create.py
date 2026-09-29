from app.database.connection import engine
from sqlmodel import Session, select
from app.models.user import User
from app.schemas.blueprint import BlueprintCreate
from app.services.blueprint import BlueprintService

def run_test():
    with Session(engine) as session:
        user = session.exec(select(User)).first()
        if not user:
            print("No user found.")
            return
        
        try:
            data = BlueprintCreate(name="Test BP Fix 2", description="Test Description")
            bp = BlueprintService.create(session, data, user.id)
            print(f"SUCCESS! id={bp.id}, name={bp.name}")
            
            # Cleanup
            session.delete(bp)
            session.commit()
            print("Cleanup successful.")
        except Exception as e:
            print(f"FAILED: {e}")

if __name__ == "__main__":
    run_test()
