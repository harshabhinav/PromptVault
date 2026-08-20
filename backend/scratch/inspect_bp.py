import os
import sys
from sqlmodel import Session, select

sys.path.insert(0, os.path.abspath("."))

from app.database.connection import engine
from app.models.blueprint import Blueprint
from app.models.version import Version

def inspect_blueprints():
    with Session(engine) as session:
        blueprints = session.exec(select(Blueprint)).all()
        print(f"Total Blueprints: {len(blueprints)}")
        for bp in blueprints:
            print(f"Blueprint ID: {bp.id}, Name: '{bp.name}', User ID: '{bp.user_id}'")

        versions = session.exec(select(Version)).all()
        print(f"\nTotal Versions: {len(versions)}")
        for v in versions:
            print(f"Version ID: {v.id}, Blueprint ID: {v.blueprint_id}, User ID: '{v.user_id}'")

if __name__ == "__main__":
    inspect_blueprints()
