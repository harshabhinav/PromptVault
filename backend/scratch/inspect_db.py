import os
import sys
from sqlmodel import Session, select

sys.path.insert(0, os.path.abspath("."))

from app.database.connection import engine
from app.models.user import User
from app.models.api_key import UserApiKey

def inspect_db():
    with Session(engine) as session:
        users = session.exec(select(User)).all()
        print(f"Total Users: {len(users)}")
        for u in users:
            print(f"User ID: '{u.id}', Email: '{u.email}'")

        keys = session.exec(select(UserApiKey)).all()
        print(f"\nTotal UserApiKey entries: {len(keys)}")
        for k in keys:
            has_gemini = bool(k.gemini_key)
            masked = f"{k.gemini_key[:4]}...{k.gemini_key[-4:]}" if k.gemini_key and len(k.gemini_key) > 8 else ("Set" if k.gemini_key else "None")
            print(f"Key User ID: '{k.user_id}', Has Gemini: {has_gemini}, Masked: {masked}")

if __name__ == "__main__":
    inspect_db()
