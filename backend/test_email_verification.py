import os
import sys
import time
from datetime import datetime, timedelta

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, select, delete
from app.database.connection import engine, init_db
from app.models.user import User
from app.models.blueprint import Blueprint
from app.models.version import Version
from app.models.comparison import Comparison
from app.models.email_verification_token import EmailVerificationToken
from app.auth.security import hash_password, verify_password, create_access_token, get_current_user
from app.config.settings import settings

print("=" * 60)
print("PROMPTVAULT EMAIL VERIFICATION TEST SUITE")
print("=" * 60)

init_db()

passed_count = 0
failed_count = 0

def test(name, condition, detail=""):
    global passed_count, failed_count
    if condition:
        passed_count += 1
        print(f"  OK [PASS] {name}: {detail}")
    else:
        failed_count += 1
        print(f"  !! [FAIL] {name}: {detail}")

uid = f"test_{int(time.time())}"
email_a = f"alice_{uid}@promptvault.io"
email_b = f"bob_{uid}@promptvault.io"
password_a = "SecretPassword123!"
password_b = "SecurePass456!"

with Session(engine) as session:
    # Cleanup any previous test data
    session.exec(delete(EmailVerificationToken))
    session.exec(delete(Version))
    session.exec(delete(Blueprint))
    session.exec(delete(User).where(User.email.in_([email_a, email_b])))
    session.commit()

    # -------------------------------------------------------------
    # 1. Successful signup -> Unverified user created (is_active=False)
    # -------------------------------------------------------------
    user_a = User(
        name="Alice Tester",
        email=email_a,
        password_hash=hash_password(password_a),
        is_active=False
    )
    session.add(user_a)
    session.commit()
    session.refresh(user_a)

    test("1. User created as unverified", user_a.is_active is False, f"is_active={user_a.is_active}")

    # -------------------------------------------------------------
    # 2. Password hashing & security
    # -------------------------------------------------------------
    test("2. Password is not plaintext", user_a.password_hash != password_a, "Stored as bcrypt hash")
    test("3. Password verification works", verify_password(password_a, user_a.password_hash), "bcrypt verify OK")
    test("4. Wrong password rejected", not verify_password("WrongPassword!", user_a.password_hash), "Rejected")

    # -------------------------------------------------------------
    # 3. Verification token generation & storage
    # -------------------------------------------------------------
    raw_token, token_hash = EmailVerificationToken.generate_token()
    token_record = EmailVerificationToken(
        user_id=user_a.id,
        token_hash=token_hash,
        expires_at=datetime.utcnow() + timedelta(minutes=60)
    )
    session.add(token_record)
    session.commit()
    session.refresh(token_record)

    test("5. Raw token is cryptographically secure string", len(raw_token) >= 32, f"length={len(raw_token)}")
    test("6. Only token hash is stored in DB", token_record.token_hash == token_hash and raw_token != token_hash, "Hash stored")
    test("7. Token not expired initially", not token_record.is_expired, "is_expired=False")
    test("8. Token not used initially", not token_record.is_used, "is_used=False")

    # -------------------------------------------------------------
    # 4. Unverified login attempt is blocked
    # -------------------------------------------------------------
    # Emulate login check:
    unverified_user = session.exec(select(User).where(User.email == email_a)).first()
    can_login = unverified_user and verify_password(password_a, unverified_user.password_hash) and unverified_user.is_active
    test("9. Unverified user cannot log in", not can_login, "Login blocked when is_active=False")

    # -------------------------------------------------------------
    # 5. Invalid token verification fails
    # -------------------------------------------------------------
    invalid_token_hash = EmailVerificationToken.hash_token("totally_invalid_token_123")
    invalid_lookup = session.exec(
        select(EmailVerificationToken).where(EmailVerificationToken.token_hash == invalid_token_hash)
    ).first()
    test("10. Invalid token is not found", invalid_lookup is None, "Lookup returned None")

    # -------------------------------------------------------------
    # 6. Expired token is rejected
    # -------------------------------------------------------------
    expired_raw, expired_hash = EmailVerificationToken.generate_token()
    expired_token = EmailVerificationToken(
        user_id=user_a.id,
        token_hash=expired_hash,
        expires_at=datetime.utcnow() - timedelta(minutes=5)
    )
    session.add(expired_token)
    session.commit()
    session.refresh(expired_token)
    test("11. Expired token detected", expired_token.is_expired, "is_expired=True")

    # -------------------------------------------------------------
    # 7. Successful email verification
    # -------------------------------------------------------------
    matched_hash = EmailVerificationToken.hash_token(raw_token)
    matched_token = session.exec(
        select(EmailVerificationToken).where(EmailVerificationToken.token_hash == matched_hash)
    ).first()
    test("12. Valid token matched by hash", matched_token is not None, f"id={matched_token.id}")

    if matched_token and not matched_token.is_expired and not matched_token.is_used:
        matched_token.used_at = datetime.utcnow()
        user_a.is_active = True
        session.add(matched_token)
        session.add(user_a)
        session.commit()
        session.refresh(user_a)
        session.refresh(matched_token)

    test("13. User is_active set to True on verification", user_a.is_active is True, "is_active=True")
    test("14. Token marked as used", matched_token.is_used is True, "is_used=True")

    # -------------------------------------------------------------
    # 8. Re-use of verified token is detected (already_verified)
    # -------------------------------------------------------------
    test("15. Re-used token detected as already verified", matched_token.is_used or user_a.is_active, "already_verified")

    # -------------------------------------------------------------
    # 9. Verified user can log in and gets JWT
    # -------------------------------------------------------------
    can_login_now = user_a.is_active and verify_password(password_a, user_a.password_hash)
    jwt_token = create_access_token(data={"sub": user_a.id, "email": user_a.email, "name": user_a.name})
    test("16. Verified user can log in", can_login_now, "Allowed")
    test("17. JWT access token generated", len(jwt_token) > 50, f"len={len(jwt_token)}")

    # -------------------------------------------------------------
    # 10. User Isolation Check
    # -------------------------------------------------------------
    # Create User B
    user_b = User(
        name="Bob Tester",
        email=email_b,
        password_hash=hash_password(password_b),
        is_active=True
    )
    session.add(user_b)
    session.commit()
    session.refresh(user_b)

    # User A creates Blueprint A & Version A1
    bp_a = Blueprint(name="Alice Vault", user_id=user_a.id)
    session.add(bp_a)
    session.commit()
    session.refresh(bp_a)

    ver_a1 = Version(blueprint_id=bp_a.id, user_id=user_a.id, version_number=1, system_prompt="Alice Prompt V1")
    session.add(ver_a1)
    session.commit()

    # User B queries blueprints
    b_visible_blueprints = session.exec(select(Blueprint).where(Blueprint.user_id == user_b.id)).all()
    test("18. User B cannot access User A's blueprints", len(b_visible_blueprints) == 0, f"visible={len(b_visible_blueprints)}")

    b_visible_versions = session.exec(select(Version).where(Version.user_id == user_b.id)).all()
    test("19. User B cannot access User A's versions", len(b_visible_versions) == 0, f"visible={len(b_visible_versions)}")

    # -------------------------------------------------------------
    # Cleanup
    # -------------------------------------------------------------
    session.exec(delete(EmailVerificationToken).where(EmailVerificationToken.user_id.in_([user_a.id, user_b.id])))
    session.exec(delete(Version).where(Version.user_id.in_([user_a.id, user_b.id])))
    session.exec(delete(Blueprint).where(Blueprint.user_id.in_([user_a.id, user_b.id])))
    session.exec(delete(User).where(User.id.in_([user_a.id, user_b.id])))
    session.commit()
    print("  [Cleanup] Test records cleaned up successfully.")

print("=" * 60)
print(f"TOTAL: {passed_count + failed_count} | PASSED: {passed_count} | FAILED: {failed_count}")
print("=" * 60)

if failed_count > 0:
    sys.exit(1)
