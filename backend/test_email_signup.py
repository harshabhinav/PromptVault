from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

print("1. Testing valid email signup...")
r_valid = client.post("/api/signup", json={
    "name": "Jane Doe",
    "email": "jane.doe@gmail.com",
    "password": "SecurePassword123!"
})
print("Valid email status:", r_valid.status_code)
print("Valid email body:", r_valid.json())

print("\n2. Testing invalid email syntax...")
r_invalid_syntax = client.post("/api/signup", json={
    "name": "Fake User",
    "email": "not-an-email",
    "password": "SecurePassword123!"
})
print("Invalid syntax status:", r_invalid_syntax.status_code)
print("Invalid syntax body:", r_invalid_syntax.json())

print("\n3. Testing undeliverable fake domain...")
r_fake_domain = client.post("/api/signup", json={
    "name": "Fake Domain",
    "email": "user@nonexistent-fake-domain-123456789.com",
    "password": "SecurePassword123!"
})
print("Fake domain status:", r_fake_domain.status_code)
print("Fake domain body:", r_fake_domain.json())

print("\nSUCCESS: All email validation tests completed!")
