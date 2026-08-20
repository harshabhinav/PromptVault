import os
import random
from fastapi.testclient import TestClient
from sqlmodel import Session, select
from app.main import app
from app.database import engine
from app.models import EmailOTP

client = TestClient(app)

print("1. Testing /health...")
r_health = client.get("/health")
assert r_health.status_code == 200
print("Health OK:", r_health.json())

print("2. Testing /auth/signup (OTP Generation)...")
rand_str = str(random.randint(1000, 9999))
test_email = f"testuser_{rand_str}@gmail.com" 
test_pass = "SecurePass123!"

r_signup = client.post("/auth/signup", json={
    "email": test_email,
    "password": test_pass
})
print("Signup Response Status:", r_signup.status_code)
assert r_signup.status_code == 200 
print("OTP successfully dispatched!")

print("3. Fetching OTP directly from Test Database...")
with Session(engine) as session:
    otp_record = session.exec(
        select(EmailOTP).where(EmailOTP.email == test_email)
    ).first()
    assert otp_record is not None
    test_otp = otp_record.otp_code
    print(f"Intercepted OTP: {test_otp}")

print("4. Testing /auth/verify-otp...")
r_verify = client.post("/auth/verify-otp", json={
    "email": test_email,
    "otp_code": test_otp
})
assert r_verify.status_code == 200
token_data = r_verify.json()
token = token_data["access_token"]
print("Token acquired successfully via OTP!")

print("5. Testing Protected Route (/api/blueprints/dashboard) with Bearer token...")
r_blueprints = client.get("/api/blueprints/dashboard", headers={"Authorization": f"Bearer {token}"})
assert r_blueprints.status_code == 200
print("Authenticated Dashboard Access Granted!")

print("SUCCESS: All Email OTP & PostgreSQL Tests Passed!")
