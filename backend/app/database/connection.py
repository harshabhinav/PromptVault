from sqlmodel import SQLModel, create_engine, Session
from app.config.settings import settings

is_sqlite = settings.DATABASE_URL.startswith("sqlite")
engine_kwargs = {}
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}

try:
    engine = create_engine(settings.DATABASE_URL, echo=False, **engine_kwargs)
    with engine.connect() as conn:
        pass
except Exception as e:
    print(f"[Database Connection Warning] Unable to connect to remote DB ({e}). Falling back to local SQLite DB.")
    sqlite_url = "sqlite:///./promptvault.db"
    engine = create_engine(sqlite_url, echo=False, connect_args={"check_same_thread": False})

def init_db():
    # Importing all models here to register them on SQLModel metadata
    import app.models  # Registers User, Blueprint, Version, TestCase, TestRun, Activity, Comparison, PlaygroundSession, UserApiKey
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
