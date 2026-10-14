from sqlmodel import SQLModel, create_engine, Session
from app.config.settings import settings
import sys

# We expect a PostgreSQL URL in production.
engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=300
)

try:
    with engine.connect() as conn:
        pass
except Exception as e:
    print(f"[CRITICAL] Database Connection Error: Unable to connect to PostgreSQL at host.")
    print("Please check your DATABASE_URL, network, and database server.")
    sys.exit(1)

def init_db():
    # Model imports to ensure they are registered with SQLModel.metadata
    import app.models
    # We no longer run create_all(engine) here.
    # Production schema management is now handled by Alembic migrations.
    pass

def get_session():
    with Session(engine) as session:
        yield session
