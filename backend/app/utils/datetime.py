from datetime import datetime, timezone

def utc_now() -> datetime:
    """
    Returns timezone-aware UTC datetime.
    Required by SQLModel and SQLAlchemy UTCDateTime columns when writing to PostgreSQL.
    """
    return datetime.now(timezone.utc)
