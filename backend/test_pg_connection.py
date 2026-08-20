import os
from sqlalchemy import text
from app.config.settings import settings
from app.database.connection import engine

print(f"Connecting to database: {settings.DATABASE_URL[:30]}...")

try:
    with engine.connect() as conn:
        res = conn.execute(text("SELECT version();")).fetchone()
        print("SUCCESS: Connected to PostgreSQL Database!")
        print(f"PostgreSQL Version: {res[0]}")
except Exception as e:
    print("CONNECTION FAILURE:")
    print(str(e))
    exit(1)
