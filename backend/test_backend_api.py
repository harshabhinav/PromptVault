import os
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session
from app.main import app
from app.database.connection import get_session

from app.config.settings import settings
import sys

# We expect a PostgreSQL URL for testing in CI/CD or local
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", settings.DATABASE_URL)

if TEST_DATABASE_URL.startswith("sqlite"):
    print("Cannot run tests with SQLite. A proper PostgreSQL database is required.")
    sys.exit(1)

test_engine = create_engine(TEST_DATABASE_URL, echo=False)

def override_get_session():
    with Session(test_engine) as session:
        yield session

# Override the app dependency to use our test database
app.dependency_overrides[get_session] = override_get_session

def run_tests():
    # Setup test tables
    SQLModel.metadata.drop_all(test_engine)
    SQLModel.metadata.create_all(test_engine)
    
    client = TestClient(app)
    
    # 1. Health check
    print("Testing /health ...")
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    print("[OK] Health check passed!")
    
    # 2. Create Blueprint
    print("Testing POST /api/blueprints ...")
    bp_data = {
        "name": "Classifier Test",
        "description": "A blueprint for testing backend API routers."
    }
    response = client.post("/api/blueprints", json=bp_data)
    assert response.status_code == 201
    bp_json = response.json()
    assert bp_json["name"] == "Classifier Test"
    assert bp_json["id"] is not None
    bp_id = bp_json["id"]
    print(f"[OK] Blueprint created! ID: {bp_id}")

    # 3. List Blueprints
    print("Testing GET /api/blueprints ...")
    response = client.get("/api/blueprints")
    assert response.status_code == 200
    blueprints = response.json()
    assert len(blueprints) >= 1
    assert any(b["id"] == bp_id for b in blueprints)
    print("[OK] List blueprints passed!")

    # 4. Get Single Blueprint
    print("Testing GET /api/blueprints/{id} ...")
    response = client.get(f"/api/blueprints/{bp_id}")
    assert response.status_code == 200
    bp_detail = response.json()
    assert bp_detail["name"] == "Classifier Test"
    print("[OK] Get single blueprint passed!")

    # 5. Update Blueprint
    print("Testing PUT /api/blueprints/{id} ...")
    up_data = {
        "name": "Classifier Test Updated",
        "description": "Updated description text."
    }
    response = client.put(f"/api/blueprints/{bp_id}", json=up_data)
    assert response.status_code == 200
    bp_updated = response.json()
    assert bp_updated["name"] == "Classifier Test Updated"
    print("[OK] Update blueprint passed!")

    # 6. Create Version
    print("Testing POST /api/versions ...")
    ver_data = {
        "blueprint_id": bp_id,
        "system_prompt": "You are a coding tutor assistant.",
        "user_prompt": "Help me write code for {{topic}}",
        "parameters_json": '{"model": "gpt-4o", "temperature": 0.5}'
    }
    response = client.post("/api/versions", json=ver_data)
    assert response.status_code == 201
    ver_json = response.json()
    assert ver_json["system_prompt"] == "You are a coding tutor assistant."
    assert ver_json["blueprint_id"] == bp_id
    ver_id = ver_json["id"]
    print(f"[OK] Version created! ID: {ver_id}")

    # 7. Get Blueprint Versions
    print("Testing GET /api/blueprints/{id}/versions ...")
    response = client.get(f"/api/blueprints/{bp_id}/versions")
    assert response.status_code == 200
    versions = response.json()
    assert len(versions) == 1
    assert versions[0]["id"] == ver_id
    print("[OK] List blueprint versions passed!")

    # 8. Create Test Input
    print("Testing POST /api/versions/{id}/test-inputs ...")
    input_data = {
        "input_text": '{"topic": "Python variables"}'
    }
    response = client.post(f"/api/versions/{ver_id}/test-inputs", json=input_data)
    assert response.status_code == 201
    input_json = response.json()
    assert input_json["input_text"] == '{"topic": "Python variables"}'
    assert input_json["version_id"] == ver_id
    input_id = input_json["id"]
    print(f"[OK] Test input created! ID: {input_id}")

    # 9. List Test Inputs
    print("Testing GET /api/versions/{id}/test-inputs ...")
    response = client.get(f"/api/versions/{ver_id}/test-inputs")
    assert response.status_code == 200
    inputs = response.json()
    assert len(inputs) == 1
    assert inputs[0]["id"] == input_id
    print("[OK] List test inputs passed!")

    # 10. Create Test Run
    print("Testing POST /api/test-runs ...")
    run_data = {
        "version_id": ver_id,
        "test_input_id": input_id,
        "output_text": "Here is how you declare variables in Python: x = 5",
        "latency": 0.85,
        "token_usage": 45
    }
    response = client.post("/api/test-runs", json=run_data)
    assert response.status_code == 201
    run_json = response.json()
    assert run_json["output_text"] == "Here is how you declare variables in Python: x = 5"
    assert run_json["version_id"] == ver_id
    run_id = run_json["id"]
    print(f"[OK] Test run created! ID: {run_id}")

    # 11. List Test Runs for Version
    print("Testing GET /api/versions/{id}/test-runs ...")
    response = client.get(f"/api/versions/{ver_id}/test-runs")
    assert response.status_code == 200
    runs = response.json()
    assert len(runs) == 1
    assert runs[0]["id"] == run_id
    print("[OK] List test runs passed!")

    # 12. Standalone Delete Test Input
    print("Testing DELETE /api/test-inputs/{id} ...")
    response = client.delete(f"/api/test-inputs/{input_id}")
    assert response.status_code == 204
    # Verify input is gone
    response = client.get(f"/api/versions/{ver_id}/test-inputs")
    assert response.status_code == 200
    assert len(response.json()) == 0
    print("[OK] Standalone delete test input passed!")

    # 13. Standalone Delete Version
    print("Testing DELETE /api/versions/{id} ...")
    response = client.delete(f"/api/versions/{ver_id}")
    assert response.status_code == 204
    # Verify version is gone
    response = client.get(f"/api/versions/{ver_id}")
    assert response.status_code == 404
    print("[OK] Standalone delete version passed!")

    # 14. Cascading delete validation on Blueprint
    # Re-create a version, input, and run to verify cascade deleting blueprint
    print("Setting up cascade delete testing...")
    response = client.post("/api/versions", json=ver_data)
    new_ver_id = response.json()["id"]
    response = client.post(f"/api/versions/{new_ver_id}/test-inputs", json=input_data)
    new_input_id = response.json()["id"]
    run_data["version_id"] = new_ver_id
    run_data["test_input_id"] = new_input_id
    client.post("/api/test-runs", json=run_data)

    # 15. Fork Blueprint
    print("Testing POST /api/blueprints/{id}/fork ...")
    response = client.post(f"/api/blueprints/{bp_id}/fork")
    assert response.status_code == 201
    fork_json = response.json()
    assert fork_json["name"] == "Classifier Test Updated (Fork)"
    assert fork_json["forked_from"] == bp_id
    fork_id = fork_json["id"]
    print(f"[OK] Forked blueprint created! ID: {fork_id}")
    
    # Clean up fork blueprint
    client.delete(f"/api/blueprints/{fork_id}")

    print(f"Deleting Blueprint {bp_id} (should cascade delete Version {new_ver_id})...")
    response = client.delete(f"/api/blueprints/{bp_id}")
    assert response.status_code == 204
    
    # Verify blueprint and subcomponents are removed
    assert client.get(f"/api/blueprints/{bp_id}").status_code == 404
    assert client.get(f"/api/versions/{new_ver_id}").status_code == 404
    print("[OK] Blueprint cascade delete validated successfully!")

    # Clean up test database file
    SQLModel.metadata.drop_all(test_engine)

    print("\n[SUCCESS] ALL API ENDPOINTS VERIFIED AND WORKING SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
