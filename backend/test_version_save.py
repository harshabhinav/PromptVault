import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, select, delete
from app.database.connection import engine
from app.models.user import User
from app.models.blueprint import Blueprint
from app.models.version import Version
from app.models.activity import Activity
from app.schemas.version import VersionCreate
from app.services.version import VersionService
from fastapi import HTTPException

print("=" * 60)
print("RUNNING PROMPTVAULT MANUAL VERSION SAVE COMPREHENSIVE SUITE")
print("=" * 60)

with Session(engine) as session:
    user = session.exec(select(User)).first()
    assert user is not None, "A user must exist for testing"
    user_id = user.id

    # Create a clean test blueprint
    test_bp = Blueprint(name=f"Save Test BP {os.urandom(4).hex()}", user_id=user_id)
    session.add(test_bp)
    session.commit()
    session.refresh(test_bp)
    bp_id = test_bp.id
    print(f"Created Test Blueprint id={bp_id} for user={user_id}")

    # Case 1: Create V1
    v1_data = VersionCreate(
        blueprint_id=bp_id,
        system_prompt="System Prompt V1",
        user_prompt="User Prompt V1",
        parameters_json=json.dumps({"model": "claude-3-5-sonnet", "temperature": 0.5})
    )
    v1 = VersionService.create(session, v1_data, user_id)
    assert v1.version_number == 1, f"Expected V1, got V{v1.version_number}"
    print("[PASS] Case 1: Successfully created V1 (version_number = 1)")

    # Case 2: Create V2
    v2_data = VersionCreate(
        blueprint_id=bp_id,
        system_prompt="System Prompt V2",
        user_prompt="User Prompt V2",
        parameters_json=json.dumps({"model": "claude-3-5-sonnet", "temperature": 0.7, "tag": "More empathetic tone"})
    )
    v2 = VersionService.create(session, v2_data, user_id)
    assert v2.version_number == 2, f"Expected V2, got V{v2.version_number}"
    print("[PASS] Case 2: Successfully created V2 (version_number = 2)")

    # Case 3: Verify commit message
    v2_params = json.loads(v2.parameters_json or "{}")
    assert v2_params.get("tag") == "More empathetic tone", "Commit memo not stored in parameters_json"
    activity = session.exec(
        select(Activity).where(Activity.version_id == v2.id).order_by(Activity.created_at.desc())
    ).first()
    assert activity is not None, "Activity should be logged"
    print(f"[PASS] Case 3: Commit message verified: tag='{v2_params.get('tag')}' activity='{activity.description}'")

    # Case 4: Create V3 with empty commit message
    v3_data = VersionCreate(
        blueprint_id=bp_id,
        system_prompt="System Prompt V3",
        user_prompt="User Prompt V3",
        parameters_json=json.dumps({"model": "gpt-4o", "temperature": 0.2})
    )
    v3 = VersionService.create(session, v3_data, user_id)
    assert v3.version_number == 3, f"Expected V3, got V{v3.version_number}"
    print("[PASS] Case 4: Successfully created V3 without commit message (version_number = 3)")

    # Case 5: Unauthorized/Invalid blueprint
    try:
        VersionService.create(session, VersionCreate(blueprint_id=999999, system_prompt=""), user_id)
        assert False, "Should have raised 404"
    except HTTPException as e:
        assert e.status_code == 404
        print("[PASS] Case 5: Correctly rejected invalid blueprint with 404")

    # Case 6: Concurrent-safe version numbering
    # Create V4 and V5 sequentially
    v4 = VersionService.create(session, VersionCreate(blueprint_id=bp_id, system_prompt="V4"), user_id)
    v5 = VersionService.create(session, VersionCreate(blueprint_id=bp_id, system_prompt="V5"), user_id)
    assert v4.version_number == 4
    assert v5.version_number == 5
    print("[PASS] Case 6: Sequential version numbering preserved (V4, V5)")

    # Case 7: Persistence check in PostgreSQL
    all_versions = VersionService.get_by_blueprint(session, bp_id, user_id)
    assert len(all_versions) == 5, f"Expected 5 versions persisted, found {len(all_versions)}"
    version_numbers = [v.version_number for v in all_versions]
    assert sorted(version_numbers) == [1, 2, 3, 4, 5], f"Unexpected version numbers: {version_numbers}"
    print(f"[PASS] Case 7: Persistence verified in PostgreSQL. All 5 versions retrieved: {version_numbers}")

    # Clean up test blueprint
    for v in all_versions:
        session.delete(v)
    session.delete(test_bp)
    session.commit()
    print("[PASS] Test cleanup completed.")

print("\n" + "=" * 60)
print("ALL TEST CASES PASSED SUCCESSFULLY!")
print("=" * 60)
