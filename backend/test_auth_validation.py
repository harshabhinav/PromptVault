import urllib.request
import json
import sys

BASE_URL = "http://localhost:8000/api"

def make_request(endpoint, method="POST", payload=None):
    url = f"{BASE_URL}{endpoint}"
    data = json.dumps(payload).encode("utf-8") if payload else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method=method
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode("utf-8"))
        return e.code, body

def run_tests():
    print("==================================================")
    print("RUNNING AUTHENTICATION VALIDATION TEST SUITE")
    print("==================================================")

    import time
    unique = int(time.time())
    test_email = f"test.security.{unique}@promptvault.io"
    password = "SecurePassword123!"

    # Test 1: Register with new email -> Success (201 Created)
    status_code, body = make_request("/signup", payload={"email": test_email, "password": password, "name": "Security Test User"})
    print(f"1. Register New Email ({test_email}): Status {status_code}")
    assert status_code == 201, f"Expected 201, got {status_code}: {body}"
    assert "access_token" not in body, "access_token should not be in signup response"
    assert body.get("requires_verification") is True, "Expected requires_verification=True"
    print("   [PASS] PASS: Registered successfully with 201 Created (email verification required).")

    # Verify email directly in DB for login test
    from app.database.connection import engine
    from sqlmodel import Session, select
    from app.models.user import User
    with Session(engine) as session:
        u = session.exec(select(User).where(User.email == test_email)).first()
        if u:
            u.is_active = True
            session.add(u)
            session.commit()

    # Test 2: Register again with same email -> Rejected (409 Conflict)
    status_code, body = make_request("/signup", payload={"email": test_email, "password": password, "name": "Duplicate User"})
    print(f"2. Duplicate Register Same Email: Status {status_code}")
    assert status_code == 409, f"Expected 409 Conflict, got {status_code}: {body}"
    assert body.get("detail") == "This email is already registered. Please sign in or use a different email.", f"Unexpected detail: {body}"
    print(f"   [PASS] PASS: Rejected duplicate email with 409 Conflict and message: '{body.get('detail')}'")

    # Test 3: Register with same email but different letter case -> Rejected (409 Conflict)
    cased_email = f"TEST.SECURITY.{unique}@PROMPTVAULT.IO"
    status_code, body = make_request("/signup", payload={"email": cased_email, "password": password, "name": "Case Duplicate User"})
    print(f"3. Duplicate Register Case Variant ({cased_email}): Status {status_code}")
    assert status_code == 409, f"Expected 409 Conflict, got {status_code}: {body}"
    assert body.get("detail") == "This email is already registered. Please sign in or use a different email.", f"Unexpected detail: {body}"
    print("   [PASS] PASS: Case-insensitive email normalization blocked duplicate signup.")

    # Test 4: Login with registered email + correct password -> Success (200 OK)
    status_code, body = make_request("/login", payload={"email": test_email, "password": password})
    print(f"4. Login Correct Credentials: Status {status_code}")
    assert status_code == 200, f"Expected 200 OK, got {status_code}: {body}"
    assert "access_token" in body, "Expected access_token in response"
    print("   [PASS] PASS: Logged in successfully.")

    # Test 5: Login with unregistered email -> Rejected (404 Not Found)
    unregistered_email = "nonexistent.user.999@promptvault.io"
    status_code, body = make_request("/login", payload={"email": unregistered_email, "password": password})
    print(f"5. Login Unregistered Email ({unregistered_email}): Status {status_code}")
    assert status_code == 404, f"Expected 404 Not Found, got {status_code}: {body}"
    assert body.get("detail") == "No account found with this email.", f"Unexpected detail: {body}"
    print(f"   [PASS] PASS: Rejected with message: '{body.get('detail')}'")

    # Test 6: Login with wrong password -> Rejected (401 Unauthorized)
    status_code, body = make_request("/login", payload={"email": test_email, "password": "WrongPassword999!"})
    print(f"6. Login Wrong Password: Status {status_code}")
    assert status_code == 401, f"Expected 401 Unauthorized, got {status_code}: {body}"
    assert body.get("detail") == "Incorrect password.", f"Unexpected detail: {body}"
    print(f"   [PASS] PASS: Rejected with message: '{body.get('detail')}'")

    print("\n==================================================")
    print("ALL AUTHENTICATION VALIDATION TESTS PASSED 100%!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
