import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from sqlmodel import Session, select, delete
from app.main import app
from app.database.connection import engine
from app.models.user import User
from app.models.email_verification_token import EmailVerificationToken

client = TestClient(app)

print("=" * 60)
print("FASTAPI EMAIL VERIFICATION ENDPOINT TESTS")
print("=" * 60)

uid = f"api_test_{int(time.time())}"
test_email = f"user_{uid}@promptvault.io"
test_password = "SecurePassword123!"
test_name = "API Test User"

with Session(engine) as session:
    session.exec(delete(EmailVerificationToken))
    session.exec(delete(User).where(User.email == test_email))
    session.commit()

# 1. Signup
signup_res = client.post("/auth/signup", json={
    "name": test_name,
    "email": test_email,
    "password": test_password
})
print("1. Signup Status:", signup_res.status_code)
assert signup_res.status_code == 201, f"Expected 201, got {signup_res.status_code}: {signup_res.text}"
assert "access_token" not in signup_res.json(), "Access token should NOT be in signup response"
assert signup_res.json().get("requires_verification") is True
print("   Signup response OK:", signup_res.json().get("message"))

# 2. Attempt Login Before Verification -> Should be 403
login_unverified = client.post("/auth/login", json={
    "email": test_email,
    "password": test_password
})
print("2. Login Unverified Status:", login_unverified.status_code)
assert login_unverified.status_code == 403, f"Expected 403, got {login_unverified.status_code}: {login_unverified.text}"
assert "verify your email" in login_unverified.json().get("detail", "").lower()
print("   Unverified login successfully blocked (403)")

# 3. Retrieve generated token hash from DB to get the verification token
with Session(engine) as session:
    user = session.exec(select(User).where(User.email == test_email)).first()
    assert user is not None
    assert user.is_active is False
    token_record = session.exec(select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)).first()
    assert token_record is not None
    token_hash = token_record.token_hash

# Test with invalid token
invalid_verify = client.get("/auth/verify-email?token=invalid_random_token")
print("3. Invalid token status:", invalid_verify.status_code)
assert invalid_verify.status_code == 400

# 4. Verify with actual token by generating matching hash in test
# To verify directly, we can update the token with a known raw token
known_raw = "test_verification_raw_token_xyz"
known_hash = EmailVerificationToken.hash_token(known_raw)
with Session(engine) as session:
    token_record = session.exec(select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)).first()
    token_record.token_hash = known_hash
    session.add(token_record)
    session.commit()

valid_verify = client.get(f"/auth/verify-email?token={known_raw}")
print("4. Valid verify status:", valid_verify.status_code)
assert valid_verify.status_code == 200
assert valid_verify.json().get("status") == "verified"
print("   Email verified successfully via GET /auth/verify-email")

# 5. Check user is now is_active=True in DB
with Session(engine) as session:
    user = session.exec(select(User).where(User.email == test_email)).first()
    assert user.is_active is True

# 6. Re-clicking verified link returns already_verified
reclick = client.get(f"/auth/verify-email?token={known_raw}")
print("5. Re-click status:", reclick.status_code)
assert reclick.status_code == 200
assert reclick.json().get("status") == "already_verified"
print("   Re-click correctly returns already_verified")

# 7. Login after verification -> Should succeed (200) with JWT
login_verified = client.post("/auth/login", json={
    "email": test_email,
    "password": test_password
})
print("6. Login Verified Status:", login_verified.status_code)
assert login_verified.status_code == 200
data = login_verified.json()
assert "access_token" in data
assert data["token_type"] == "bearer"
assert data["user"]["email"] == test_email
print("   Verified login succeeded, JWT issued!")

# 8. Test /auth/me with JWT
token = data["access_token"]
me_res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
print("7. GET /auth/me Status:", me_res.status_code)
assert me_res.status_code == 200
assert me_res.json()["email"] == test_email

# Cleanup
with Session(engine) as session:
    session.exec(delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id))
    session.exec(delete(User).where(User.id == user.id))
    session.commit()

print("=" * 60)
print("ALL FASTAPI ENDPOINT TESTS PASSED SUCCESSFULLY!")
print("=" * 60)
